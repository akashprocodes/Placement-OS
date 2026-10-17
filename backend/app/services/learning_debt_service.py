import uuid
from datetime import datetime, timezone, timedelta, date
from typing import List, Dict, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status

from app.models.learning_plan import LearningPlan
from app.models.learning_daily_activity import LearningDailyActivity
from app.schemas.learning import LearningPlanProgress


def compute_plan_debt(
    daily_target_seconds: int,
    target_completion_date: date,
    created_at_date: date,
    plan_status: str,
    plan_updated_at_date: date,
    daily_completed: Dict[date, int],
    today: date,
    max_lookback_days: int = 1095,
) -> Tuple[int, int]:
    """
    Deterministically computes (previous_debt, current_debt) with bounded iterations.
    Optimized to skip idle periods after target_completion_date where debt is mathematically constant.
    """
    start_date = created_at_date
    initial_debt = 0

    if (today - start_date).days > max_lookback_days:
        bounded_start = today - timedelta(days=max_lookback_days)
        # Compute exact debt accumulated prior to the lookback window without looping
        prior_cutoff = min(target_completion_date, bounded_start - timedelta(days=1))
        if plan_status == "completed" and plan_updated_at_date < prior_cutoff:
            prior_cutoff = min(prior_cutoff, plan_updated_at_date)
        if prior_cutoff >= start_date:
            active_prior_days = (prior_cutoff - start_date).days + 1
            prior_target_seconds = active_prior_days * daily_target_seconds
            prior_completed = sum(sec for d, sec in daily_completed.items() if start_date <= d < bounded_start)
            initial_debt = max(0, prior_target_seconds - prior_completed)
        start_date = bounded_start

    current_debt = initial_debt
    current_day = start_date

    while current_day < today:
        completed = daily_completed.get(current_day, 0)

        base_target = daily_target_seconds
        if current_day > target_completion_date:
            base_target = 0
        if plan_status == "completed" and current_day > plan_updated_at_date:
            base_target = 0

        required = base_target + current_debt
        current_debt = max(0, required - completed)

        current_day += timedelta(days=1)

        # Performance optimization: past target_completion_date, base_target is 0.
        # If there are no future activity dates between current_day and today, debt remains constant.
        if current_day > target_completion_date:
            remaining_acts = [d for d in daily_completed.keys() if current_day <= d < today]
            if not remaining_acts:
                current_day = today
                break
            else:
                next_act = min(remaining_acts)
                if next_act > current_day:
                    current_day = next_act

    previous_debt = current_debt
    return previous_debt, current_debt


async def batch_get_plan_progress(
    db: AsyncSession,
    user_id: uuid.UUID,
    plans: List[LearningPlan]
) -> Dict[uuid.UUID, LearningPlanProgress]:
    """
    Batch-calculate plan progress and debt across multiple plans in 2-3 queries total,
    eliminating N+1 database queries.
    """
    if not plans:
        return {}

    today = datetime.now(timezone.utc).date()

    # 1. Gather all content IDs across active plans
    direct_video_plans = {p.id: p.content_id for p in plans if p.content_type == "video"}
    playlist_plans = [p for p in plans if p.content_type == "playlist"]
    playlist_video_map: Dict[str, List[str]] = {}

    if playlist_plans:
        from app.models.learning_playlist import LearningPlaylist
        from app.models.learning_playlist_item import LearningPlaylistItem
        pl_ids = [p.content_id for p in playlist_plans]
        v_stmt = (
            select(LearningPlaylist.playlist_id, LearningPlaylistItem.video_id)
            .join(LearningPlaylist, LearningPlaylist.id == LearningPlaylistItem.playlist_internal_id)
            .where(LearningPlaylist.playlist_id.in_(pl_ids))
        )
        for pl_id, v_id in (await db.execute(v_stmt)).all():
            if pl_id not in playlist_video_map:
                playlist_video_map[pl_id] = []
            playlist_video_map[pl_id].append(v_id)

    # 2. Gather all video IDs to fetch daily activity in 1 batch query
    all_content_ids = set(direct_video_plans.values())
    for v_list in playlist_video_map.values():
        all_content_ids.update(v_list)

    activity_map: Dict[Tuple[str, str, date], int] = {}
    if all_content_ids:
        act_stmt = (
            select(
                LearningDailyActivity.content_id,
                LearningDailyActivity.content_type,
                LearningDailyActivity.activity_date,
                func.sum(LearningDailyActivity.watched_content_seconds)
            )
            .where(
                LearningDailyActivity.user_id == user_id,
                LearningDailyActivity.content_id.in_(list(all_content_ids))
            )
            .group_by(
                LearningDailyActivity.content_id,
                LearningDailyActivity.content_type,
                LearningDailyActivity.activity_date
            )
        )
        for c_id, c_type, a_date, w_sec in (await db.execute(act_stmt)).all():
            activity_map[(c_id, c_type, a_date)] = int(w_sec or 0)

    # 3. Compute progress for each plan in memory
    results: Dict[uuid.UUID, LearningPlanProgress] = {}

    for plan in plans:
        daily_completed: Dict[date, int] = {}
        if plan.content_type == "playlist":
            v_ids = playlist_video_map.get(plan.content_id, [])
            for (c_id, c_type, a_date), w_sec in activity_map.items():
                if c_type == "video" and c_id in v_ids:
                    daily_completed[a_date] = daily_completed.get(a_date, 0) + w_sec
        else:
            for (c_id, c_type, a_date), w_sec in activity_map.items():
                if c_type == plan.content_type and c_id == plan.content_id:
                    daily_completed[a_date] = daily_completed.get(a_date, 0) + w_sec

        start_date = plan.created_at.date()
        updated_date = plan.updated_at.date() if plan.updated_at else start_date

        previous_debt, current_debt = compute_plan_debt(
            daily_target_seconds=plan.daily_target_seconds,
            target_completion_date=plan.target_completion_date,
            created_at_date=start_date,
            plan_status=plan.status,
            plan_updated_at_date=updated_date,
            daily_completed=daily_completed,
            today=today
        )

        completed_today = daily_completed.get(today, 0)
        base_target_today = plan.daily_target_seconds
        if today > plan.target_completion_date:
            base_target_today = 0
        if plan.status == "completed" and today > updated_date:
            base_target_today = 0

        required_today = base_target_today + previous_debt
        remaining_today = max(0, required_today - completed_today)

        if today < start_date:
            base_target_today = 0
            required_today = 0
            remaining_today = 0
            previous_debt = 0

        results[plan.id] = LearningPlanProgress(
            plan_id=plan.id,
            target_completion_date=plan.target_completion_date,
            daily_target_seconds=plan.daily_target_seconds,
            completed_seconds_today=completed_today,
            base_target_seconds_today=base_target_today,
            previous_debt_seconds=previous_debt,
            required_seconds_today=required_today,
            remaining_seconds_today=remaining_today,
            current_debt_seconds=remaining_today,
            current_date=today,
            status=plan.status,
            completed_at=plan.completed_at
        )

    return results


async def get_plan_progress(db: AsyncSession, user_id: uuid.UUID, plan_id: uuid.UUID) -> LearningPlanProgress:
    # 1. Fetch Plan
    stmt = select(LearningPlan).where(LearningPlan.id == plan_id)
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()

    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learning plan not found")

    if plan.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this plan")

    video_ids = []
    if plan.content_type == "playlist":
        from app.models.learning_playlist import LearningPlaylist
        from app.models.learning_playlist_item import LearningPlaylistItem

        video_ids_stmt = select(LearningPlaylistItem.video_id).join(
            LearningPlaylist, LearningPlaylist.id == LearningPlaylistItem.playlist_internal_id
        ).where(LearningPlaylist.playlist_id == plan.content_id)
        video_ids = (await db.execute(video_ids_stmt)).scalars().all()

        if not video_ids:
            daily_completed = {}
        else:
            session_stmt = select(
                LearningDailyActivity.activity_date,
                func.sum(LearningDailyActivity.watched_content_seconds).label("watched_content_seconds")
            ).where(
                LearningDailyActivity.user_id == user_id,
                LearningDailyActivity.content_id.in_(video_ids),
                LearningDailyActivity.content_type == "video"
            ).group_by(LearningDailyActivity.activity_date)
            session_result = await db.execute(session_stmt)
            daily_completed = {row.activity_date: row.watched_content_seconds for row in session_result.all()}
    else:
        session_stmt = select(
            LearningDailyActivity.activity_date,
            func.sum(LearningDailyActivity.watched_content_seconds).label("watched_content_seconds")
        ).where(
            LearningDailyActivity.user_id == user_id,
            LearningDailyActivity.content_id == plan.content_id,
            LearningDailyActivity.content_type == plan.content_type
        ).group_by(LearningDailyActivity.activity_date)

        session_result = await db.execute(session_stmt)
        daily_completed = {row.activity_date: row.watched_content_seconds for row in session_result.all()}

    # 3. Calculate Debt using bounded calculation helper
    today = datetime.now(timezone.utc).date()
    start_date = plan.created_at.date()
    updated_date = plan.updated_at.date() if plan.updated_at else start_date

    previous_debt, current_debt = compute_plan_debt(
        daily_target_seconds=plan.daily_target_seconds,
        target_completion_date=plan.target_completion_date,
        created_at_date=start_date,
        plan_status=plan.status,
        plan_updated_at_date=updated_date,
        daily_completed=daily_completed,
        today=today
    )

    completed_today = daily_completed.get(today, 0)
    base_target_today = plan.daily_target_seconds
    if today > plan.target_completion_date:
        base_target_today = 0
    if plan.status == "completed" and today > updated_date:
        base_target_today = 0

    required_today = base_target_today + previous_debt
    remaining_today = max(0, required_today - completed_today)

    if today < start_date:
        base_target_today = 0
        required_today = 0
        remaining_today = 0
        previous_debt = 0

    # 4. Calculate adaptive recommendation
    from app.services.learning_adaptive_service import calculate_adaptive_plan
    from app.models.learning_progress import LearningProgress

    completed_content = 0
    if plan.content_type == "video":
        vp_stmt = select(LearningProgress).where(
            LearningProgress.user_id == user_id,
            LearningProgress.content_id == plan.content_id,
            LearningProgress.content_type == "video"
        )
        vp_res = (await db.execute(vp_stmt)).scalar_one_or_none()
        if vp_res:
            completed_content = plan.total_duration_seconds if vp_res.completed else vp_res.progress_seconds
    elif plan.content_type == "playlist" and video_ids:
        pl_prog_stmt = select(LearningProgress).where(
            LearningProgress.user_id == user_id,
            LearningProgress.content_id.in_(video_ids),
            LearningProgress.content_type == "video"
        )
        pl_progs = (await db.execute(pl_prog_stmt)).scalars().all()
        pl_item_dur_stmt = select(LearningPlaylistItem.video_id, LearningPlaylistItem.duration_seconds).join(
            LearningPlaylist, LearningPlaylist.id == LearningPlaylistItem.playlist_internal_id
        ).where(LearningPlaylist.playlist_id == plan.content_id)
        dur_map = dict((await db.execute(pl_item_dur_stmt)).all())
        for p_item in pl_progs:
            v_dur = dur_map.get(p_item.content_id) or 0
            if p_item.completed:
                completed_content += v_dur
            else:
                completed_content += min(p_item.progress_seconds, v_dur)

    adaptive_rec = calculate_adaptive_plan(
        total_duration_seconds=plan.total_duration_seconds,
        target_completion_date=plan.target_completion_date,
        created_at_date=plan.created_at.date(),
        daily_target_seconds=plan.daily_target_seconds,
        status=plan.status,
        completed_content_seconds=completed_content,
        previous_debt_seconds=previous_debt,
        completed_seconds_today=completed_today,
        today=today,
    )

    return LearningPlanProgress(
        plan_id=plan.id,
        target_completion_date=plan.target_completion_date,
        daily_target_seconds=plan.daily_target_seconds,
        completed_seconds_today=completed_today,
        base_target_seconds_today=base_target_today,
        previous_debt_seconds=previous_debt,
        required_seconds_today=required_today,
        remaining_seconds_today=remaining_today,
        current_debt_seconds=remaining_today,
        current_date=today,
        status=plan.status,
        completed_at=plan.completed_at,
        adaptive=adaptive_rec,
    )

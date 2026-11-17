import uuid
from datetime import datetime, timezone
from typing import List, Optional, Set, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.learning_plan import LearningPlan
from app.models.learning_progress import LearningProgress
from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem


def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


async def check_and_update_plan_completion(
    db: AsyncSession,
    user_id: uuid.UUID,
    plan_id: uuid.UUID
) -> Optional[LearningPlan]:
    """
    Authoritative backend definition for when a single learning plan is completed.
    Returns the updated plan.
    Only marks complete if video completion occurred during or after plan.created_at,
    ensuring retaken plans or new plans are not prematurely completed by historical progress.
    """
    stmt = select(LearningPlan).where(LearningPlan.id == plan_id, LearningPlan.user_id == user_id)
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()

    if not plan:
        return None

    if plan.status == "completed":
        return plan

    is_complete = False
    plan_created = _to_naive_utc(plan.created_at)

    if plan.content_type == "video":
        prog_stmt = select(LearningProgress).where(
            LearningProgress.user_id == user_id,
            LearningProgress.content_id == plan.content_id,
            LearningProgress.content_type == "video"
        )
        prog_res = await db.execute(prog_stmt)
        prog = prog_res.scalar_one_or_none()

        if prog and prog.completed:
            watched_at = _to_naive_utc(prog.last_watched_at)
            if watched_at and plan_created and watched_at >= plan_created:
                is_complete = True

    elif plan.content_type == "playlist":
        pl_stmt = select(LearningPlaylist.id).where(LearningPlaylist.playlist_id == plan.content_id)
        pl_res = await db.execute(pl_stmt)
        pl_internal_id = pl_res.scalar_one_or_none()

        if pl_internal_id:
            v_stmt = select(LearningPlaylistItem.video_id).where(
                LearningPlaylistItem.playlist_internal_id == pl_internal_id,
                LearningPlaylistItem.duration_seconds > 0
            )
            v_res = await db.execute(v_stmt)
            video_ids = v_res.scalars().all()

            if video_ids:
                p_stmt = select(LearningProgress).where(
                    LearningProgress.user_id == user_id,
                    LearningProgress.content_id.in_(video_ids),
                    LearningProgress.content_type == "video",
                    LearningProgress.completed == True
                )
                p_res = await db.execute(p_stmt)
                completed_progs = p_res.scalars().all()
                completed_video_ids = {p.content_id for p in completed_progs}

                if set(video_ids).issubset(completed_video_ids):
                    # All videos are completed; ensure at least one completion occurred during/after plan creation
                    if any(
                        p.last_watched_at and plan_created and _to_naive_utc(p.last_watched_at) >= plan_created
                        for p in completed_progs
                    ):
                        is_complete = True

    if is_complete:
        plan.status = "completed"
        plan.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.add(plan)
        await db.commit()
        await db.refresh(plan)

    return plan


async def batch_check_and_update_plan_completions(
    db: AsyncSession,
    user_id: uuid.UUID,
    plans: List[LearningPlan]
) -> List[LearningPlan]:
    """
    Batched evaluation of plan completion across multiple plans.
    Avoids N+1 queries by batching video progress and playlist queries in 2-3 batched queries.
    Prevents historical completions from completing newer retake plans.
    """
    if not plans:
        return []

    active_plans = [p for p in plans if p.status == "active"]
    if not active_plans:
        return plans

    video_active = [p for p in active_plans if p.content_type == "video"]
    playlist_active = [p for p in active_plans if p.content_type == "playlist"]

    completed_video_prog_map: Dict[str, Optional[datetime]] = {}

    # 1. Batch check video progress for active video plans
    if video_active:
        v_ids = [p.content_id for p in video_active]
        prog_stmt = select(LearningProgress.content_id, LearningProgress.last_watched_at).where(
            LearningProgress.user_id == user_id,
            LearningProgress.content_id.in_(v_ids),
            LearningProgress.content_type == "video",
            LearningProgress.completed == True
        )
        for c_id, l_watched in (await db.execute(prog_stmt)).all():
            completed_video_prog_map[c_id] = _to_naive_utc(l_watched)

    # 2. Batch check playlist items and their video progress for active playlist plans
    playlist_required_map: Dict[str, Set[str]] = {}
    all_playlist_vids: Set[str] = set()

    if playlist_active:
        pl_cids = [p.content_id for p in playlist_active]
        pl_stmt = (
            select(LearningPlaylist.playlist_id, LearningPlaylistItem.video_id)
            .join(LearningPlaylist, LearningPlaylist.id == LearningPlaylistItem.playlist_internal_id)
            .where(
                LearningPlaylist.playlist_id.in_(pl_cids),
                LearningPlaylistItem.duration_seconds > 0
            )
        )
        for pl_cid, v_id in (await db.execute(pl_stmt)).all():
            if pl_cid not in playlist_required_map:
                playlist_required_map[pl_cid] = set()
            playlist_required_map[pl_cid].add(v_id)
            all_playlist_vids.add(v_id)

        if all_playlist_vids:
            pl_prog_stmt = select(LearningProgress.content_id, LearningProgress.last_watched_at).where(
                LearningProgress.user_id == user_id,
                LearningProgress.content_id.in_(list(all_playlist_vids)),
                LearningProgress.content_type == "video",
                LearningProgress.completed == True
            )
            for c_id, l_watched in (await db.execute(pl_prog_stmt)).all():
                completed_video_prog_map[c_id] = _to_naive_utc(l_watched)

    # 3. Evaluate completion and commit in a single atomic transaction if any updated
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    has_changes = False

    for plan in active_plans:
        is_complete = False
        plan_created = _to_naive_utc(plan.created_at)
        if plan.content_type == "video":
            if plan.content_id in completed_video_prog_map:
                watched_at = completed_video_prog_map[plan.content_id]
                if watched_at and plan_created and watched_at >= plan_created:
                    is_complete = True
        elif plan.content_type == "playlist":
            required = playlist_required_map.get(plan.content_id)
            if required and required.issubset(set(completed_video_prog_map.keys())):
                # Must have at least one completion event during or after plan.created_at
                if any(
                    completed_video_prog_map.get(v) and plan_created and completed_video_prog_map[v] >= plan_created
                    for v in required
                ):
                    is_complete = True

        if is_complete:
            plan.status = "completed"
            plan.completed_at = now
            db.add(plan)
            has_changes = True

    if has_changes:
        await db.commit()
        for plan in active_plans:
            if plan.status == "completed":
                await db.refresh(plan)

    return plans

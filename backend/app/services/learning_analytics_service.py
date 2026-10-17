import uuid
from datetime import date, timedelta
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, and_

from app.models.learning_daily_activity import LearningDailyActivity
from app.models.learning_plan import LearningPlan
from app.models.learning_playlist_item import LearningPlaylistItem
from app.schemas.learning_analytics import (
    LearningAnalyticsResponse,
    AnalyticsSummary,
    DailyActivityRecord,
    WeeklyActivityRecord,
    PlanPerformanceRecord,
    RecentActivityRecord
)
from app.services.learning_streak_service import get_user_study_streak

async def get_dashboard_analytics(db: AsyncSession, user_id: uuid.UUID, start_date: date, end_date: date) -> LearningAnalyticsResponse:
    # 1. Overall Summary
    # Total watched seconds & Active days (Bounded by range)
    stmt_summary = select(
        func.sum(LearningDailyActivity.watched_content_seconds).label("total_seconds"),
        func.count(func.distinct(LearningDailyActivity.activity_date)).label("active_days")
    ).where(
        LearningDailyActivity.user_id == user_id, 
        LearningDailyActivity.watched_content_seconds > 0,
        LearningDailyActivity.activity_date >= start_date,
        LearningDailyActivity.activity_date <= end_date
    )
    res_summary = (await db.execute(stmt_summary)).first()
    total_watched_seconds = int(res_summary.total_seconds or 0)
    total_active_days = int(res_summary.active_days or 0)
    
    # Active & Completed Plans count
    stmt_plans_count = select(LearningPlan.status, func.count(LearningPlan.id)).where(LearningPlan.user_id == user_id).group_by(LearningPlan.status)
    plans_counts = {row[0]: row[1] for row in (await db.execute(stmt_plans_count)).all()}
    active_plans_count = plans_counts.get("active", 0)
    completed_plans_count = plans_counts.get("completed", 0)
    
    # Calculate study streaks
    streak_info = await get_user_study_streak(db, user_id)

    summary = AnalyticsSummary(
        total_watched_seconds=total_watched_seconds,
        total_active_days=total_active_days,
        active_plans_count=active_plans_count,
        completed_plans_count=completed_plans_count,
        current_streak_days=streak_info.current_streak,
        longest_streak_days=streak_info.longest_streak,
    )
    
    # 2. Daily History (Bounded by range)
    stmt_daily = select(
        LearningDailyActivity.activity_date,
        func.sum(LearningDailyActivity.watched_content_seconds).label("seconds")
    ).where(
        LearningDailyActivity.user_id == user_id,
        LearningDailyActivity.activity_date >= start_date,
        LearningDailyActivity.activity_date <= end_date
    ).group_by(LearningDailyActivity.activity_date).order_by(LearningDailyActivity.activity_date)
    
    daily_rows = (await db.execute(stmt_daily)).all()
    daily_dict = {row.activity_date: int(row.seconds) for row in daily_rows}
    
    # Fill missing days in range
    daily_history = []
    curr = start_date
    while curr <= end_date:
        daily_history.append(DailyActivityRecord(date=curr, watched_seconds=daily_dict.get(curr, 0)))
        curr += timedelta(days=1)
        
    # 3. Weekly History (Calculated from daily_dict for safety across DB boundaries, starting Monday)
    weekly_history = []
    # Find the nearest previous Monday for start_date
    curr_week_start = start_date - timedelta(days=start_date.weekday())
    
    while curr_week_start <= end_date:
        curr_week_end = curr_week_start + timedelta(days=6)
        week_seconds = 0
        week_active_days = 0
        for i in range(7):
            d = curr_week_start + timedelta(days=i)
            s = daily_dict.get(d, 0)
            if s > 0:
                week_seconds += s
                week_active_days += 1
        weekly_history.append(WeeklyActivityRecord(
            week_start=curr_week_start,
            watched_seconds=week_seconds,
            active_days=week_active_days
        ))
        curr_week_start += timedelta(days=7)
        
    # 4. Plan Performance
    stmt_all_plans = select(LearningPlan).where(LearningPlan.user_id == user_id).order_by(desc(LearningPlan.created_at))
    plans = (await db.execute(stmt_all_plans)).scalars().all()
    
    # To compute total_watched_seconds per plan efficiently within the selected range:
    stmt_user_activity = select(
        LearningDailyActivity.content_id, 
        LearningDailyActivity.content_type, 
        func.sum(LearningDailyActivity.watched_content_seconds)
    ).where(
        LearningDailyActivity.user_id == user_id,
        LearningDailyActivity.activity_date >= start_date,
        LearningDailyActivity.activity_date <= end_date
    ).group_by(
        LearningDailyActivity.content_id, LearningDailyActivity.content_type
    )
    act_rows = (await db.execute(stmt_user_activity)).all()
    # map: (content_id, type) -> total_seconds
    act_map = {(row[0], row[1]): int(row[2]) for row in act_rows}
    
    # For playlists, we need to map playlist_id -> list of video_ids
    # Fetch all playlist items for user's plans
    playlist_plan_ids = [p.content_id for p in plans if p.content_type == "playlist"]
    playlist_video_map = {}
    if playlist_plan_ids:
        from app.models.learning_playlist import LearningPlaylist
        pl_stmt = select(LearningPlaylist.playlist_id, LearningPlaylistItem.video_id).join(
            LearningPlaylist, LearningPlaylist.id == LearningPlaylistItem.playlist_internal_id
        ).where(LearningPlaylist.playlist_id.in_(playlist_plan_ids))
        pl_rows = (await db.execute(pl_stmt)).all()
        for p_id, v_id in pl_rows:
            if p_id not in playlist_video_map:
                playlist_video_map[p_id] = []
            playlist_video_map[p_id].append(v_id)
            
    plan_performance = []
    for plan in plans:
        tw = 0
        if plan.content_type == "video":
            tw = act_map.get((plan.content_id, "video"), 0)
        elif plan.content_type == "playlist":
            v_ids = playlist_video_map.get(plan.content_id, [])
            for v_id in v_ids:
                tw += act_map.get((v_id, "video"), 0)
                
        plan_performance.append(PlanPerformanceRecord(
            plan_id=plan.id,
            title=plan.title,
            content_id=plan.content_id,
            content_type=plan.content_type,
            target_completion_date=plan.target_completion_date,
            total_duration_seconds=plan.total_duration_seconds,
            total_watched_seconds=tw,
            status=plan.status,
            completed_at=plan.completed_at
        ))
        
    # 5. Recent Activity (Bounded by range)
    stmt_recent = select(
        LearningDailyActivity.activity_date,
        LearningDailyActivity.content_id,
        LearningDailyActivity.content_type,
        LearningDailyActivity.watched_content_seconds
    ).where(
        LearningDailyActivity.user_id == user_id,
        LearningDailyActivity.watched_content_seconds > 0,
        LearningDailyActivity.activity_date >= start_date,
        LearningDailyActivity.activity_date <= end_date
    ).order_by(
        desc(LearningDailyActivity.activity_date),
        desc(LearningDailyActivity.updated_at)
    ).limit(20)
    recent_rows = (await db.execute(stmt_recent)).all()
    
    # Try to resolve titles from plans first
    title_map = {}
    for plan in plans:
        title_map[(plan.content_id, plan.content_type)] = plan.title

    # For videos not directly represented in plans (e.g. videos watched within playlists),
    # resolve their authoritative titles from playlist items
    unresolved_video_ids = [
        r.content_id for r in recent_rows
        if (r.content_id, r.content_type) not in title_map and r.content_type == "video"
    ]
    playlist_item_titles = {}
    if unresolved_video_ids:
        item_title_stmt = select(
            LearningPlaylistItem.video_id,
            LearningPlaylistItem.title
        ).where(LearningPlaylistItem.video_id.in_(unresolved_video_ids))
        for v_id, v_title in (await db.execute(item_title_stmt)).all():
            if v_title and v_title.strip():
                playlist_item_titles[v_id] = v_title.strip()

    recent_activity = []
    for r in recent_rows:
        title = title_map.get((r.content_id, r.content_type))
        if not title and r.content_type == "video":
            title = playlist_item_titles.get(r.content_id)
        if not title:
            if r.content_type == "video":
                title = f"Video • ID: {r.content_id}"
            else:
                title = f"Content • ID: {r.content_id}"
        recent_activity.append(RecentActivityRecord(
            activity_date=r.activity_date,
            content_id=r.content_id,
            content_type=r.content_type,
            title=title,
            watched_seconds=r.watched_content_seconds
        ))
        
    return LearningAnalyticsResponse(
        summary=summary,
        daily_history=daily_history,
        weekly_history=weekly_history,
        plan_performance=plan_performance,
        recent_activity=recent_activity,
        streak=streak_info
    )

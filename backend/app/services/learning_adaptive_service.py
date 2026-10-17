import uuid
import math
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.learning_plan import LearningPlan
from app.models.learning_progress import LearningProgress
from app.models.learning_daily_activity import LearningDailyActivity
from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem
from app.schemas.learning_adaptive import (
    AdaptivePlanRecommendation,
    PlanMilestoneInfo,
    LearningMilestone,
    UserMilestonesSummary,
)


def format_duration_human(seconds: int) -> str:
    if seconds <= 0:
        return "0m"
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0 and m > 0:
        return f"{h}h {m}m"
    elif h > 0:
        return f"{h}h"
    elif m > 0:
        return f"{m}m"
    else:
        return f"{s}s"


def calculate_adaptive_plan(
    total_duration_seconds: int,
    target_completion_date: date,
    created_at_date: date,
    daily_target_seconds: int,
    status: str,
    completed_content_seconds: int,
    previous_debt_seconds: int = 0,
    completed_seconds_today: int = 0,
    today: Optional[date] = None,
) -> AdaptivePlanRecommendation:
    """
    Deterministic, explainable adaptive planning calculation.

    Rules:
    - Never changes target_completion_date or original daily_target_seconds.
    - Compares actual recorded study progress against the schedule.
    - Completed plans: status='completed', target=0.
    - Overdue plans (target date in the past): status='behind', is_overdue=True, remaining_days=0.
    - Active plans: spreads remaining content over remaining days.
    - Identifies 'ahead', 'on_track', or 'behind'.
    - Flags unrealistic targets (> 8 hours / day).
    """
    if today is None:
        today = datetime.now(timezone.utc).date()

    # Zero or negative duration defense: immediately completed
    if total_duration_seconds <= 0:
        remaining_days = max(0, (target_completion_date - today).days + 1) if target_completion_date >= today else 0
        return AdaptivePlanRecommendation(
            schedule_status="completed",
            recommended_daily_target_seconds=0,
            pace_difference_seconds=-daily_target_seconds,
            remaining_duration_seconds=0,
            remaining_days=remaining_days,
            total_completed_seconds=0,
            progress_percent=100.0,
            is_overdue=False,
            is_achievable=True,
            explanation="Plan has zero duration. Target achieved.",
            constraint_note=None,
        )

    safe_total = max(1, total_duration_seconds)
    clamped_completed = max(0, min(safe_total, completed_content_seconds))
    remaining_duration = max(0, safe_total - clamped_completed)
    progress_percent = round(min(100.0, (clamped_completed / safe_total) * 100.0), 1)

    # 1. Plan already completed or all content watched
    if status == "completed" or remaining_duration == 0:
        remaining_days = max(0, (target_completion_date - today).days + 1) if target_completion_date >= today else 0
        return AdaptivePlanRecommendation(
            schedule_status="completed",
            recommended_daily_target_seconds=0,
            pace_difference_seconds=-daily_target_seconds,
            remaining_duration_seconds=0,
            remaining_days=remaining_days,
            total_completed_seconds=safe_total,
            progress_percent=100.0,
            is_overdue=False,
            is_achievable=True,
            explanation="Plan is completed! Target achieved.",
            constraint_note=None,
        )

    # 2. Overdue Plan (target completion date has passed)
    if target_completion_date < today:
        return AdaptivePlanRecommendation(
            schedule_status="behind",
            recommended_daily_target_seconds=remaining_duration,
            pace_difference_seconds=remaining_duration - daily_target_seconds,
            remaining_duration_seconds=remaining_duration,
            remaining_days=0,
            total_completed_seconds=clamped_completed,
            progress_percent=progress_percent,
            is_overdue=True,
            is_achievable=False,
            explanation=f"Target completion date ({target_completion_date}) has passed. Plan is overdue with {format_duration_human(remaining_duration)} remaining.",
            constraint_note="Target completion date has passed. To stay on track, consider completing remaining content or updating your schedule.",
        )

    # 3. Active Plan with remaining days >= 1 (includes today)
    remaining_days = (target_completion_date - today).days + 1
    recommended_target = math.ceil(remaining_duration / remaining_days)
    pace_diff = recommended_target - daily_target_seconds

    # Dynamic tolerance (5% of target, bounded between 10s and 60s)
    tolerance = max(10, min(60, int(daily_target_seconds * 0.05)))

    # Schedule status classification:
    # Check if user has unpaid past debt
    unpaid_debt = max(0, previous_debt_seconds - completed_seconds_today)

    if unpaid_debt > 0 or recommended_target > daily_target_seconds + tolerance:
        # User is behind schedule
        schedule_status = "behind"
        if unpaid_debt > 0:
            explanation = (
                f"You are behind schedule with {format_duration_human(unpaid_debt)} catch-up debt. "
                f"Recommended pace is {format_duration_human(recommended_target)}/day "
                f"for the remaining {remaining_days} days to finish by {target_completion_date}."
            )
        else:
            explanation = (
                f"You are behind schedule. Recommended pace is {format_duration_human(recommended_target)}/day "
                f"for the remaining {remaining_days} days to finish by {target_completion_date}."
            )
    elif unpaid_debt == 0 and (recommended_target < daily_target_seconds - tolerance or completed_seconds_today > daily_target_seconds):
        # User is ahead of schedule
        schedule_status = "ahead"
        explanation = (
            f"You are ahead of schedule! Revised pace is {format_duration_human(recommended_target)}/day "
            f"across {remaining_days} days to finish by {target_completion_date}."
        )
    else:
        # User is on track
        schedule_status = "on_track"
        explanation = (
            f"You are on track. Recommended pace is {format_duration_human(recommended_target)}/day "
            f"across {remaining_days} days."
        )

    # Achievability constraint check (8 hours = 28,800s)
    is_achievable = True
    constraint_note = None
    if recommended_target > 28800:
        is_achievable = False
        constraint_note = (
            f"Recommended pace ({format_duration_human(recommended_target)}/day) exceeds 8 hours per day. "
            "Consider extending your target completion date."
        )

    return AdaptivePlanRecommendation(
        schedule_status=schedule_status,
        recommended_daily_target_seconds=recommended_target,
        pace_difference_seconds=pace_diff,
        remaining_duration_seconds=remaining_duration,
        remaining_days=remaining_days,
        total_completed_seconds=clamped_completed,
        progress_percent=progress_percent,
        is_overdue=False,
        is_achievable=is_achievable,
        explanation=explanation,
        constraint_note=constraint_note,
    )


def calculate_plan_milestones(progress_percent: float, is_completed: bool) -> PlanMilestoneInfo:
    """
    Calculate achieved and next milestones for an individual learning plan.
    Milestones: 25%, 50%, 75%, 100%.
    """
    completed = []
    if is_completed or progress_percent >= 100.0:
        completed = [
            "25% Plan Progress",
            "50% Plan Progress",
            "75% Plan Progress",
            "100% Plan Complete",
        ]
        next_m = None
        next_target = None
    elif progress_percent >= 75.0:
        completed = ["25% Plan Progress", "50% Plan Progress", "75% Plan Progress"]
        next_m = "100% Plan Complete"
        next_target = 100.0
    elif progress_percent >= 50.0:
        completed = ["25% Plan Progress", "50% Plan Progress"]
        next_m = "75% Plan Progress"
        next_target = 75.0
    elif progress_percent >= 25.0:
        completed = ["25% Plan Progress"]
        next_m = "50% Plan Progress"
        next_target = 50.0
    else:
        completed = []
        next_m = "25% Plan Progress"
        next_target = 25.0

    return PlanMilestoneInfo(
        completed_milestones=completed,
        next_milestone=next_m,
        next_milestone_target_percent=next_target,
        progress_percent=progress_percent,
    )


async def get_user_milestones_summary(
    db: AsyncSession,
    user_id: uuid.UUID,
    longest_streak: int = 0,
    has_completed_playlist: bool = False,
    has_completed_plan: bool = False,
    max_plan_progress: float = 0.0,
) -> UserMilestonesSummary:
    """
    Derive user-level evidence-based milestones from authoritative database records.
    Ownership-safe, idempotent, and avoids duplicate milestones.
    """
    # 1. Check if user has any recorded study session / daily activity (> 0 seconds)
    act_stmt = select(func.count(LearningDailyActivity.id)).where(
        LearningDailyActivity.user_id == user_id,
        LearningDailyActivity.watched_content_seconds > 0,
    )
    has_activity = (await db.execute(act_stmt)).scalar() or 0
    has_session = has_activity > 0

    # 2. Check if user has completed any video
    vid_stmt = select(func.count(LearningProgress.id)).where(
        LearningProgress.user_id == user_id,
        LearningProgress.content_type == "video",
        LearningProgress.completed == True,
    )
    completed_videos = (await db.execute(vid_stmt)).scalar() or 0
    has_completed_video = completed_videos > 0

    milestones: List[LearningMilestone] = [
        LearningMilestone(
            id="first_session",
            title="First Study Session",
            description="Logged your first recorded study session",
            category="session",
            achieved=has_session,
            current_value=1.0 if has_session else 0.0,
            target_value=1.0,
        ),
        LearningMilestone(
            id="first_video_completed",
            title="First Video Completed",
            description="Completed your first learning video",
            category="video",
            achieved=has_completed_video,
            current_value=float(completed_videos),
            target_value=1.0,
        ),
        LearningMilestone(
            id="plan_progress_25",
            title="Quarter Way There",
            description="Reached 25% completion on a learning plan",
            category="plan",
            achieved=max_plan_progress >= 25.0 or has_completed_plan,
            current_value=100.0 if has_completed_plan else min(100.0, max_plan_progress),
            target_value=25.0,
        ),
        LearningMilestone(
            id="plan_progress_50",
            title="Halfway Mark",
            description="Reached 50% completion on a learning plan",
            category="plan",
            achieved=max_plan_progress >= 50.0 or has_completed_plan,
            current_value=100.0 if has_completed_plan else min(100.0, max_plan_progress),
            target_value=50.0,
        ),
        LearningMilestone(
            id="plan_progress_75",
            title="Three-Quarters Mark",
            description="Reached 75% completion on a learning plan",
            category="plan",
            achieved=max_plan_progress >= 75.0 or has_completed_plan,
            current_value=100.0 if has_completed_plan else min(100.0, max_plan_progress),
            target_value=75.0,
        ),
        LearningMilestone(
            id="plan_completed",
            title="Plan Finisher",
            description="Successfully completed a full learning plan",
            category="plan",
            achieved=has_completed_plan,
            current_value=1.0 if has_completed_plan else 0.0,
            target_value=1.0,
        ),
        LearningMilestone(
            id="first_playlist_completed",
            title="Playlist Master",
            description="Completed all videos in a curated playlist",
            category="playlist",
            achieved=has_completed_playlist,
            current_value=1.0 if has_completed_playlist else 0.0,
            target_value=1.0,
        ),
        LearningMilestone(
            id="streak_3",
            title="3-Day Streak",
            description="Studied 3 consecutive days",
            category="streak",
            achieved=longest_streak >= 3,
            current_value=float(longest_streak),
            target_value=3.0,
        ),
        LearningMilestone(
            id="streak_7",
            title="Weekly Warrior",
            description="Maintained a 7-day study streak",
            category="streak",
            achieved=longest_streak >= 7,
            current_value=float(longest_streak),
            target_value=7.0,
        ),
    ]

    achieved_count = sum(1 for m in milestones if m.achieved)
    total_count = len(milestones)
    next_milestone = next((m for m in milestones if not m.achieved), None)

    return UserMilestonesSummary(
        achieved_count=achieved_count,
        total_count=total_count,
        milestones=milestones,
        next_milestone=next_milestone,
    )


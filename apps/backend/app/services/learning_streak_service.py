import uuid
from datetime import date, datetime, timezone, timedelta
from typing import Set, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.learning_daily_activity import LearningDailyActivity
from app.schemas.learning_streak import StudyStreakInfo


def calculate_streaks_from_dates(
    active_dates: Set[date],
    today: Optional[date] = None
) -> StudyStreakInfo:
    """
    Authoritative pure function to calculate current and longest streaks.

    Active Day Rule:
    An active study day is any calendar date (UTC activity_date) on which the user
    accumulated > 0 seconds of actual recorded watch activity in LearningDailyActivity.
    Page visits, unauthenticated views, and zero-second records are excluded.

    Streak Continuity Rule:
    - If today has activity: current streak includes today and consecutive preceding days.
    - If today has NO activity yet, but yesterday had activity: current streak is preserved
      (anchored at yesterday) because today's study window is still open.
    - If neither today nor yesterday has activity: the streak is broken (0).

    Longest Streak Rule:
    - The maximum length of consecutive daily records across the entire history.
    """
    if today is None:
        today = datetime.now(timezone.utc).date()

    if not active_dates:
        return StudyStreakInfo(
            current_streak=0,
            longest_streak=0,
            today_active=False
        )

    today_active = today in active_dates
    yesterday = today - timedelta(days=1)

    # 1. Current Streak calculation
    current_streak = 0
    if today_active:
        current_streak = 1
        check_date = yesterday
        while check_date in active_dates:
            current_streak += 1
            check_date -= timedelta(days=1)
    elif yesterday in active_dates:
        current_streak = 1
        check_date = yesterday - timedelta(days=1)
        while check_date in active_dates:
            current_streak += 1
            check_date -= timedelta(days=1)
    else:
        current_streak = 0

    # 2. Longest Streak calculation across entire history
    sorted_dates = sorted(active_dates)
    longest_streak = 0
    running_streak = 0
    prev_date: Optional[date] = None

    for d in sorted_dates:
        if prev_date is None:
            running_streak = 1
        elif d == prev_date + timedelta(days=1):
            running_streak += 1
        elif d == prev_date:
            # Duplicate date defense
            pass
        else:
            running_streak = 1

        if running_streak > longest_streak:
            longest_streak = running_streak
        prev_date = d

    return StudyStreakInfo(
        current_streak=current_streak,
        longest_streak=longest_streak,
        today_active=today_active
    )


async def get_user_study_streak(
    db: AsyncSession,
    user_id: uuid.UUID
) -> StudyStreakInfo:
    """
    Fetch all active study dates for a user from LearningDailyActivity
    and calculate their current and longest study streaks with zero N+1 overhead.
    """
    stmt = (
        select(LearningDailyActivity.activity_date)
        .where(
            LearningDailyActivity.user_id == user_id,
            LearningDailyActivity.watched_content_seconds > 0
        )
        .group_by(LearningDailyActivity.activity_date)
        .order_by(LearningDailyActivity.activity_date.asc())
    )
    result = await db.execute(stmt)
    active_dates = set(result.scalars().all())

    today_utc = datetime.now(timezone.utc).date()
    return calculate_streaks_from_dates(active_dates, today=today_utc)


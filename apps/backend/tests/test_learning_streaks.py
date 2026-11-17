import uuid
from datetime import date, timedelta
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.main import app
from app.models.learning_daily_activity import LearningDailyActivity
from app.models.learning_plan import LearningPlan
from app.models.learning_progress import LearningProgress
from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem
from app.services.learning_streak_service import (
    calculate_streaks_from_dates,
    get_user_study_streak,
)


# ---------------------------------------------------------------------------
# Unit tests for streak boundary logic & date transitions (Pure calculation)
# ---------------------------------------------------------------------------

def test_calculate_streaks_empty():
    today = date(2026, 10, 13)
    info = calculate_streaks_from_dates(set(), today=today)
    assert info.current_streak == 0
    assert info.longest_streak == 0
    assert info.today_active is False


def test_calculate_streaks_today_only():
    today = date(2026, 10, 13)
    info = calculate_streaks_from_dates({today}, today=today)
    assert info.current_streak == 1
    assert info.longest_streak == 1
    assert info.today_active is True


def test_calculate_streaks_yesterday_only():
    today = date(2026, 10, 13)
    yesterday = today - timedelta(days=1)
    info = calculate_streaks_from_dates({yesterday}, today=today)
    # Streak is preserved because user hasn't finished today's window
    assert info.current_streak == 1
    assert info.longest_streak == 1
    assert info.today_active is False


def test_calculate_streaks_two_days_ago_broken():
    today = date(2026, 10, 13)
    two_days_ago = today - timedelta(days=2)
    info = calculate_streaks_from_dates({two_days_ago}, today=today)
    # Yesterday was missed, streak is broken
    assert info.current_streak == 0
    assert info.longest_streak == 1
    assert info.today_active is False


def test_calculate_streaks_consecutive_including_today():
    today = date(2026, 10, 13)
    dates = {today - timedelta(days=i) for i in range(5)}  # 5 days: today down to today - 4
    info = calculate_streaks_from_dates(dates, today=today)
    assert info.current_streak == 5
    assert info.longest_streak == 5
    assert info.today_active is True


def test_calculate_streaks_consecutive_ending_yesterday():
    today = date(2026, 10, 13)
    # 4 days: yesterday down to yesterday - 3
    dates = {today - timedelta(days=i) for i in range(1, 5)}
    info = calculate_streaks_from_dates(dates, today=today)
    assert info.current_streak == 4
    assert info.longest_streak == 4
    assert info.today_active is False


def test_calculate_streaks_historical_longest_exceeds_current():
    today = date(2026, 10, 13)
    # 10 days in past: 30 days ago to 21 days ago
    past_cluster = {today - timedelta(days=i) for i in range(21, 31)}
    # 2 days current: yesterday and today
    current_cluster = {today, today - timedelta(days=1)}
    all_dates = past_cluster | current_cluster

    info = calculate_streaks_from_dates(all_dates, today=today)
    assert info.current_streak == 2
    assert info.longest_streak == 10
    assert info.today_active is True


def test_calculate_streaks_multiple_breaks():
    today = date(2026, 10, 13)
    # Cluster A: 3 days (length 3)
    # Gap: 2 days
    # Cluster B: 4 days (length 4)
    # Gap: 3 days
    # Cluster C: 1 day (today)
    d1 = today - timedelta(days=15)
    d2 = today - timedelta(days=14)
    d3 = today - timedelta(days=13)

    d4 = today - timedelta(days=8)
    d5 = today - timedelta(days=7)
    d6 = today - timedelta(days=6)
    d7 = today - timedelta(days=5)

    dates = {d1, d2, d3, d4, d5, d6, d7, today}
    info = calculate_streaks_from_dates(dates, today=today)
    assert info.current_streak == 1
    assert info.longest_streak == 4
    assert info.today_active is True


# ---------------------------------------------------------------------------
# Integration tests with database (active-day rules, isolation, resume context)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_streak_db_integration_and_isolation(client: AsyncClient, db_session: AsyncSession):
    # Register real users for foreign key constraint
    email_a = f"streak_iso_a_{uuid.uuid4().hex[:6]}@example.com"
    email_b = f"streak_iso_b_{uuid.uuid4().hex[:6]}@example.com"
    pwd = "securepassword123"

    res_a = await client.post("/api/v1/auth/register", json={"email": email_a, "password": pwd})
    assert res_a.status_code == 201
    user_a = uuid.UUID(res_a.json()["id"])

    res_b = await client.post("/api/v1/auth/register", json={"email": email_b, "password": pwd})
    assert res_b.status_code == 201
    user_b = uuid.UUID(res_b.json()["id"])

    today = date.today()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)

    # 1. User A has 0 seconds record today (must be ignored)
    zero_activity = LearningDailyActivity(
        id=uuid.uuid4(),
        user_id=user_a,
        content_id="video_zero",
        content_type="video",
        activity_date=today,
        watched_content_seconds=0
    )
    # 2. User A has positive activity yesterday (2 videos on the same day)
    act_y1 = LearningDailyActivity(
        id=uuid.uuid4(),
        user_id=user_a,
        content_id="video_1",
        content_type="video",
        activity_date=yesterday,
        watched_content_seconds=120
    )
    act_y2 = LearningDailyActivity(
        id=uuid.uuid4(),
        user_id=user_a,
        content_id="video_2",
        content_type="video",
        activity_date=yesterday,
        watched_content_seconds=300
    )
    # 3. User A has activity 2 days ago
    act_2d = LearningDailyActivity(
        id=uuid.uuid4(),
        user_id=user_a,
        content_id="video_1",
        content_type="video",
        activity_date=two_days_ago,
        watched_content_seconds=600
    )

    # 4. User B activity today (should NOT bleed into User A)
    act_b = LearningDailyActivity(
        id=uuid.uuid4(),
        user_id=user_b,
        content_id="video_b",
        content_type="video",
        activity_date=today,
        watched_content_seconds=1200
    )

    db_session.add_all([zero_activity, act_y1, act_y2, act_2d, act_b])
    await db_session.commit()

    streak_a = await get_user_study_streak(db_session, user_a)
    assert streak_a.today_active is False
    assert streak_a.current_streak == 2  # yesterday + 2 days ago
    assert streak_a.longest_streak == 2

    streak_b = await get_user_study_streak(db_session, user_b)
    assert streak_b.today_active is True
    assert streak_b.current_streak == 1
    assert streak_b.longest_streak == 1


@pytest.mark.asyncio
async def test_workspace_streak_and_resume_context_endpoint(client: AsyncClient, db_session: AsyncSession):
    # Register test user
    email = f"streak_test_{uuid.uuid4().hex[:6]}@example.com"
    pwd = "securepassword123"
    reg_res = await client.post("/api/v1/auth/register", json={"email": email, "password": pwd})
    assert reg_res.status_code == 201

    login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch user_id
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    user_id = uuid.UUID(me_res.json()["id"])

    # 1. Create a video plan
    video_id = "VTLCoHnyACE"
    target_date = (date.today() + timedelta(days=7)).isoformat()
    plan_res = await client.post(
        "/api/v1/learning/plans",
        headers=headers,
        json={
            "content_id": video_id,
            "content_type": "video",
            "title": "DSA Flowcharts",
            "total_duration_seconds": 3600,
            "target_completion_date": target_date
        }
    )
    assert plan_res.status_code == 201

    # 2. Check initial workspace: no activity, no resume position yet
    ws_res1 = await client.get("/api/v1/learning/workspace", headers=headers)
    assert ws_res1.status_code == 200
    data1 = ws_res1.json()
    assert data1["streak"]["current_streak"] == 0
    assert data1["streak"]["longest_streak"] == 0
    assert data1["streak"]["today_active"] is False
    assert len(data1["active_plans"]) == 1
    # Never fabricate a timestamp!
    assert data1["active_plans"][0]["resume"]["has_saved_position"] is False
    assert data1["active_plans"][0]["resume"]["saved_position_seconds"] == 0

    # 3. Simulate progress: user watched up to 245 seconds
    prog_res = await client.put(
        f"/api/v1/learning/progress/video/{video_id}",
        headers=headers,
        json={
            "content_id": video_id,
            "content_type": "video",
            "progress_seconds": 245,
            "duration_seconds": 3600
        }
    )
    assert prog_res.status_code == 200

    # Record daily activity for today
    today = date.today()
    act = LearningDailyActivity(
        id=uuid.uuid4(),
        user_id=user_id,
        content_id=video_id,
        content_type="video",
        activity_date=today,
        watched_content_seconds=245
    )
    db_session.add(act)
    await db_session.commit()

    # 4. Check workspace again
    ws_res2 = await client.get("/api/v1/learning/workspace", headers=headers)
    assert ws_res2.status_code == 200
    data2 = ws_res2.json()
    # Streak updated
    assert data2["streak"]["current_streak"] == 1
    assert data2["streak"]["longest_streak"] == 1
    assert data2["streak"]["today_active"] is True

    # Resume context updated with exact authoritative timestamp
    plan_item = data2["active_plans"][0]
    assert plan_item["resume"]["has_saved_position"] is True
    assert plan_item["resume"]["saved_position_seconds"] == 245
    assert plan_item["resume"]["video_id"] == video_id

    # 5. Check analytics endpoint also returns streak
    start_str = (today - timedelta(days=7)).isoformat()
    end_str = today.isoformat()
    ana_res = await client.get(
        f"/api/v1/learning/analytics/dashboard?start_date={start_str}&end_date={end_str}",
        headers=headers
    )
    assert ana_res.status_code == 200
    ana_data = ana_res.json()
    assert ana_data["summary"]["current_streak_days"] == 1
    assert ana_data["summary"]["longest_streak_days"] == 1
    assert ana_data["streak"]["current_streak"] == 1

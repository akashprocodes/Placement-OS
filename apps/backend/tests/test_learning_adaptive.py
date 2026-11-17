import pytest
import uuid
from datetime import date, datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.learning_plan import LearningPlan
from app.models.learning_progress import LearningProgress
from app.models.learning_daily_activity import LearningDailyActivity
from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem
from app.services.learning_adaptive_service import (
    calculate_adaptive_plan,
    calculate_plan_milestones,
    get_user_milestones_summary,
    format_duration_human,
)


async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    return resp.json()["access_token"], me_resp.json()["id"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── Pure Calculation Unit Tests ─────────────────────────────────────────────

def test_adaptive_on_track():
    today = date(2026, 10, 15)
    # Plan: 6 days total (Oct 10 - Oct 15), duration 6000s, base target 1000s/day
    # Elapsed: Oct 10-14 (5 days), watched 5000s, 0 debt. Remaining today: 1 day, 1000s.
    res = calculate_adaptive_plan(
        total_duration_seconds=6000,
        target_completion_date=date(2026, 10, 15),
        created_at_date=date(2026, 10, 10),
        daily_target_seconds=1000,
        status="active",
        completed_content_seconds=5000,
        previous_debt_seconds=0,
        completed_seconds_today=0,
        today=today,
    )
    assert res.schedule_status == "on_track"
    assert res.remaining_days == 1
    assert res.remaining_duration_seconds == 1000
    assert res.recommended_daily_target_seconds == 1000
    assert res.pace_difference_seconds == 0
    assert res.is_overdue is False
    assert res.is_achievable is True
    assert "on track" in res.explanation.lower()


def test_adaptive_ahead_of_schedule():
    today = date(2026, 10, 12)
    # Target Oct 15 (4 days left: 12, 13, 14, 15)
    # Total 6000s, base target 1000s. Watched 3600s already (only 2000s expected).
    # Remaining 2400s over 4 days = 600s/day (< 1000s/day base).
    res = calculate_adaptive_plan(
        total_duration_seconds=6000,
        target_completion_date=date(2026, 10, 15),
        created_at_date=date(2026, 10, 10),
        daily_target_seconds=1000,
        status="active",
        completed_content_seconds=3600,
        previous_debt_seconds=0,
        completed_seconds_today=0,
        today=today,
    )
    assert res.schedule_status == "ahead"
    assert res.remaining_days == 4
    assert res.remaining_duration_seconds == 2400
    assert res.recommended_daily_target_seconds == 600
    assert res.pace_difference_seconds == -400
    assert "ahead" in res.explanation.lower()


def test_adaptive_behind_schedule_due_to_unpaid_debt():
    today = date(2026, 10, 13)
    # Target Oct 15 (3 days left: 13, 14, 15)
    # Total 6000s, base target 1000s. Watched only 500s. Debt from previous days = 1500s.
    # Remaining 5500s over 3 days = 1834s/day (> 1000s base).
    res = calculate_adaptive_plan(
        total_duration_seconds=6000,
        target_completion_date=date(2026, 10, 15),
        created_at_date=date(2026, 10, 10),
        daily_target_seconds=1000,
        status="active",
        completed_content_seconds=500,
        previous_debt_seconds=1500,
        completed_seconds_today=0,
        today=today,
    )
    assert res.schedule_status == "behind"
    assert res.remaining_days == 3
    assert res.remaining_duration_seconds == 5500
    assert res.recommended_daily_target_seconds == 1834
    assert res.pace_difference_seconds == 834
    assert "behind" in res.explanation.lower()


def test_adaptive_overdue_plan():
    today = date(2026, 10, 16)
    # Target was Oct 15 (passed yesterday)
    res = calculate_adaptive_plan(
        total_duration_seconds=5000,
        target_completion_date=date(2026, 10, 15),
        created_at_date=date(2026, 10, 10),
        daily_target_seconds=1000,
        status="active",
        completed_content_seconds=3000,
        previous_debt_seconds=1000,
        completed_seconds_today=0,
        today=today,
    )
    assert res.schedule_status == "behind"
    assert res.is_overdue is True
    assert res.remaining_days == 0
    assert res.remaining_duration_seconds == 2000
    assert res.is_achievable is False
    assert res.constraint_note is not None
    assert "passed" in res.explanation.lower()


def test_adaptive_completed_plan():
    today = date(2026, 10, 14)
    res = calculate_adaptive_plan(
        total_duration_seconds=5000,
        target_completion_date=date(2026, 10, 15),
        created_at_date=date(2026, 10, 10),
        daily_target_seconds=1000,
        status="completed",
        completed_content_seconds=5000,
        previous_debt_seconds=0,
        completed_seconds_today=0,
        today=today,
    )
    assert res.schedule_status == "completed"
    assert res.recommended_daily_target_seconds == 0
    assert res.remaining_duration_seconds == 0
    assert res.progress_percent == 100.0
    assert res.is_achievable is True


def test_adaptive_impossible_pace_constraint():
    today = date(2026, 10, 15)
    # Target today (1 day left), but remaining duration is 36,000s (10 hours > 8 hour threshold)
    res = calculate_adaptive_plan(
        total_duration_seconds=40000,
        target_completion_date=today,
        created_at_date=date(2026, 10, 10),
        daily_target_seconds=6667,
        status="active",
        completed_content_seconds=4000,
        previous_debt_seconds=10000,
        completed_seconds_today=0,
        today=today,
    )
    assert res.is_achievable is False
    assert res.recommended_daily_target_seconds == 36000
    assert res.constraint_note is not None
    assert "exceeds 8 hours" in res.constraint_note.lower()


def test_plan_milestones_boundaries():
    # 0%
    m0 = calculate_plan_milestones(progress_percent=0.0, is_completed=False)
    assert m0.completed_milestones == []
    assert m0.next_milestone == "25% Plan Progress"
    assert m0.next_milestone_target_percent == 25.0

    # 24.9%
    m24 = calculate_plan_milestones(progress_percent=24.9, is_completed=False)
    assert m24.completed_milestones == []
    assert m24.next_milestone == "25% Plan Progress"

    # 25.0%
    m25 = calculate_plan_milestones(progress_percent=25.0, is_completed=False)
    assert m25.completed_milestones == ["25% Plan Progress"]
    assert m25.next_milestone == "50% Plan Progress"
    assert m25.next_milestone_target_percent == 50.0

    # 50.0%
    m50 = calculate_plan_milestones(progress_percent=50.0, is_completed=False)
    assert m50.completed_milestones == ["25% Plan Progress", "50% Plan Progress"]
    assert m50.next_milestone == "75% Plan Progress"

    # 75.0%
    m75 = calculate_plan_milestones(progress_percent=75.0, is_completed=False)
    assert m75.completed_milestones == ["25% Plan Progress", "50% Plan Progress", "75% Plan Progress"]
    assert m75.next_milestone == "100% Plan Complete"
    assert m75.next_milestone_target_percent == 100.0

    # 100%
    m100 = calculate_plan_milestones(progress_percent=100.0, is_completed=True)
    assert len(m100.completed_milestones) == 4
    assert m100.next_milestone is None


# ─── API Integration Tests ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_adaptive_plan_endpoint_and_workspace_integration(client: AsyncClient, db_session: AsyncSession):
    token, user_id_str = await register_and_login(client, "adapt_integ@test.com")
    user_id = uuid.UUID(user_id_str)
    today = datetime.now(timezone.utc).date()

    # Create active video plan
    plan_id = uuid.uuid4()
    plan = LearningPlan(
        id=plan_id,
        user_id=user_id,
        content_id="adapt_vid_1",
        content_type="video",
        title="Adaptive Video Test",
        total_duration_seconds=7200,  # 2 hours
        target_completion_date=today + timedelta(days=3),
        daily_target_seconds=1800,  # 30m/day
        status="active",
    )
    plan.created_at = datetime.combine(today, datetime.min.time())
    db_session.add(plan)

    # Record some watch activity and progress (1800s = 25% completed)
    prog = LearningProgress(
        id=uuid.uuid4(),
        user_id=user_id,
        content_id="adapt_vid_1",
        content_type="video",
        progress_seconds=1800,
        duration_seconds=7200,
        progress_percent=25.0,
        completed=False,
    )
    db_session.add(prog)

    act = LearningDailyActivity(
        user_id=user_id,
        content_id="adapt_vid_1",
        content_type="video",
        watched_content_seconds=1800,
        activity_date=today,
    )
    db_session.add(act)
    await db_session.commit()

    # 1. Test GET /plans/{plan_id}/adaptive
    adapt_res = await client.get(f"/api/v1/learning/plans/{plan_id}/adaptive", headers=auth(token))
    assert adapt_res.status_code == 200
    adapt_data = adapt_res.json()
    assert adapt_data["schedule_status"] in {"on_track", "ahead"}
    assert adapt_data["total_completed_seconds"] == 1800
    assert adapt_data["remaining_duration_seconds"] == 5400
    assert adapt_data["progress_percent"] == 25.0

    # 2. Test GET /workspace includes adaptive & milestones
    ws_res = await client.get("/api/v1/learning/workspace", headers=auth(token))
    assert ws_res.status_code == 200
    ws_data = ws_res.json()
    assert len(ws_data["active_plans"]) == 1
    active_plan_item = ws_data["active_plans"][0]
    assert active_plan_item["adaptive"] is not None
    assert active_plan_item["adaptive"]["schedule_status"] in {"on_track", "ahead"}
    assert active_plan_item["milestones"] is not None
    assert "25% Plan Progress" in active_plan_item["milestones"]["completed_milestones"]
    assert active_plan_item["milestones"]["next_milestone"] == "50% Plan Progress"

    # Workspace-level milestones summary
    assert ws_data["milestones"] is not None
    summary = ws_data["milestones"]
    assert summary["achieved_count"] >= 2  # first session + 25% plan progress
    assert summary["total_count"] == 9

    # 3. Test GET /milestones endpoint directly
    m_res = await client.get("/api/v1/learning/milestones", headers=auth(token))
    assert m_res.status_code == 200
    m_data = m_res.json()
    assert m_data["achieved_count"] == summary["achieved_count"]


@pytest.mark.asyncio
async def test_adaptive_and_milestones_cross_user_isolation(client: AsyncClient, db_session: AsyncSession):
    token_a, user_a_str = await register_and_login(client, "user_a_adapt@test.com")
    token_b, user_b_str = await register_and_login(client, "user_b_adapt@test.com")
    user_a = uuid.UUID(user_a_str)
    user_b = uuid.UUID(user_b_str)
    today = datetime.now(timezone.utc).date()

    # User A creates a plan and records activity
    plan_a = LearningPlan(
        id=uuid.uuid4(),
        user_id=user_a,
        content_id="private_vid_a",
        content_type="video",
        title="User A Private Plan",
        total_duration_seconds=3600,
        target_completion_date=today + timedelta(days=2),
        daily_target_seconds=1200,
        status="active",
    )
    plan_a.created_at = datetime.combine(today, datetime.min.time())
    db_session.add(plan_a)

    act_a = LearningDailyActivity(
        user_id=user_a,
        content_id="private_vid_a",
        content_type="video",
        watched_content_seconds=3600,
        activity_date=today,
    )
    db_session.add(act_a)
    await db_session.commit()

    # User B tries to access User A's plan adaptive recommendation -> 403 Forbidden
    res_b = await client.get(f"/api/v1/learning/plans/{plan_a.id}/adaptive", headers=auth(token_b))
    assert res_b.status_code == 403

    # User B's own milestones show 0 achieved (no activity)
    m_b = await client.get("/api/v1/learning/milestones", headers=auth(token_b))
    assert m_b.status_code == 200
    assert m_b.json()["achieved_count"] == 0


@pytest.mark.asyncio
async def test_playlist_completion_milestone(client: AsyncClient, db_session: AsyncSession):
    token, user_id_str = await register_and_login(client, "playlist_m@test.com")
    user_id = uuid.UUID(user_id_str)
    today = datetime.now(timezone.utc).date()

    # Completed playlist plan
    pl_plan = LearningPlan(
        id=uuid.uuid4(),
        user_id=user_id,
        content_id="pl_completed_1",
        content_type="playlist",
        title="Completed Playlist Plan",
        total_duration_seconds=5000,
        target_completion_date=today,
        daily_target_seconds=5000,
        status="completed",
        completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db_session.add(pl_plan)
    await db_session.commit()

    m_res = await client.get("/api/v1/learning/milestones", headers=auth(token))
    assert m_res.status_code == 200
    m_data = m_res.json()
    pl_milestone = next((m for m in m_data["milestones"] if m["id"] == "first_playlist_completed"), None)
    assert pl_milestone is not None
    assert pl_milestone["achieved"] is True


def test_adaptive_zero_or_negative_duration():
    today = date(2026, 10, 15)
    # Zero duration plan
    res_zero = calculate_adaptive_plan(
        total_duration_seconds=0,
        target_completion_date=date(2026, 10, 20),
        created_at_date=date(2026, 10, 10),
        daily_target_seconds=1000,
        status="active",
        completed_content_seconds=0,
        previous_debt_seconds=0,
        completed_seconds_today=0,
        today=today,
    )
    assert res_zero.schedule_status == "completed"
    assert res_zero.remaining_duration_seconds == 0
    assert res_zero.recommended_daily_target_seconds == 0
    assert res_zero.progress_percent == 100.0
    assert res_zero.is_achievable is True

    # Negative duration plan safeguard
    res_neg = calculate_adaptive_plan(
        total_duration_seconds=-50,
        target_completion_date=date(2026, 10, 20),
        created_at_date=date(2026, 10, 10),
        daily_target_seconds=1000,
        status="active",
        completed_content_seconds=0,
        previous_debt_seconds=0,
        completed_seconds_today=0,
        today=today,
    )
    assert res_neg.schedule_status == "completed"
    assert res_neg.remaining_duration_seconds == 0


def test_adaptive_early_in_the_day_user_not_marked_behind():
    today = date(2026, 10, 12)
    # Case A: Brand new plan created today, 0 watch time today, 0 past debt
    res_new = calculate_adaptive_plan(
        total_duration_seconds=3000,
        target_completion_date=date(2026, 10, 15),
        created_at_date=today,
        daily_target_seconds=750,
        status="active",
        completed_content_seconds=0,
        previous_debt_seconds=0,
        completed_seconds_today=0,
        today=today,
    )
    assert res_new.schedule_status == "on_track"
    assert res_new.recommended_daily_target_seconds == 750
    assert res_new.pace_difference_seconds == 0

    # Case B: Multi-day plan, user met past targets fully, 0 past debt, 0 watch time *today* (early morning)
    # Target Oct 15 (4 days: 12, 13, 14, 15). Created Oct 10. Oct 10 & 11 met: 2000s watched out of 6000s.
    # Remaining 4000s / 4 days = 1000s/day. User is on track!
    res_morning = calculate_adaptive_plan(
        total_duration_seconds=6000,
        target_completion_date=date(2026, 10, 15),
        created_at_date=date(2026, 10, 10),
        daily_target_seconds=1000,
        status="active",
        completed_content_seconds=2000,
        previous_debt_seconds=0,
        completed_seconds_today=0,
        today=today,
    )
    assert res_morning.schedule_status == "on_track"
    assert res_morning.recommended_daily_target_seconds == 1000
    assert res_morning.pace_difference_seconds == 0


@pytest.mark.asyncio
async def test_playlist_with_none_duration_items_endpoint(client: AsyncClient, db_session: AsyncSession):
    token, user_id_str = await register_and_login(client, "pl_null_dur@test.com")
    user_id = uuid.UUID(user_id_str)
    today = datetime.now(timezone.utc).date()

    pl_internal_id = uuid.uuid4()
    yt_playlist_id = f"test_pl_null_{uuid.uuid4().hex[:6]}"
    playlist = LearningPlaylist(
        id=pl_internal_id,
        playlist_id=yt_playlist_id,
        title="Playlist with Null Durations",
        channel_title="Test Channel",
        thumbnail_url="https://example.com/thumb.jpg",
        description="Test playlist description",
        item_count=2,
        total_duration_seconds=1200,
        duration_available=True,
    )
    db_session.add(playlist)

    # Item 1 has None duration, Item 2 has 600
    item1 = LearningPlaylistItem(
        id=uuid.uuid4(),
        playlist_internal_id=pl_internal_id,
        video_id="vid_null_1",
        position=1,
        title="Null Dur Video",
        thumbnail_url="https://example.com/v1.jpg",
        duration_seconds=None,
    )
    item2 = LearningPlaylistItem(
        id=uuid.uuid4(),
        playlist_internal_id=pl_internal_id,
        video_id="vid_valid_2",
        position=2,
        title="Valid Dur Video",
        thumbnail_url="https://example.com/v2.jpg",
        duration_seconds=600,
    )
    db_session.add_all([item1, item2])

    plan = LearningPlan(
        id=uuid.uuid4(),
        user_id=user_id,
        content_id=yt_playlist_id,
        content_type="playlist",
        title="Plan for Null Dur Playlist",
        total_duration_seconds=1200,
        target_completion_date=today + timedelta(days=2),
        daily_target_seconds=400,
        status="active",
    )
    plan.created_at = datetime.combine(today, datetime.min.time())
    db_session.add(plan)
    await db_session.commit()

    # Calling adaptive endpoint should handle duration_seconds=None gracefully without 500 error
    res = await client.get(f"/api/v1/learning/plans/{plan.id}/adaptive", headers=auth(token))
    assert res.status_code == 200
    data = res.json()
    assert data["schedule_status"] in {"on_track", "ahead", "behind"}
    assert data["total_completed_seconds"] == 0



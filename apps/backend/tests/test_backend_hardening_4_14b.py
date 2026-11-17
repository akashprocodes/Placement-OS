import pytest
import asyncio
import uuid
from datetime import datetime, timezone, timedelta, date

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.user import User
from app.models.learning_plan import LearningPlan
from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem
from app.models.learning_daily_activity import LearningDailyActivity
from app.models.learning_progress import LearningProgress
from app.schemas.learning import LearningPlanCreate
from app.services.learning_plan_service import create_learning_plan
from app.services.playlist_sync_service import get_or_sync_playlist
from app.services.learning_analytics_service import get_dashboard_analytics
from app.services.learning_debt_service import compute_plan_debt, batch_get_plan_progress
from app.services.learning_plan_completion_service import batch_check_and_update_plan_completions
from app.services.learning_adaptive_service import calculate_adaptive_plan


@pytest.mark.asyncio
async def test_duplicate_active_plan_prevention_concurrent(db_session):
    # 1. Create a test user
    test_user = User(
        id=uuid.uuid4(),
        email=f"plan_test_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="hashed_pw"
    )
    db_session.add(test_user)
    await db_session.commit()

    plan_in = LearningPlanCreate(
        content_id="test_dup_content_123",
        content_type="video",
        title="Test Concurrent Plan",
        total_duration_seconds=3600,
        target_completion_date=datetime.now(timezone.utc).date() + timedelta(days=7)
    )

    # 2. First creation must succeed
    p1 = await create_learning_plan(db_session, test_user.id, plan_in)
    assert p1.id is not None
    assert p1.status == "active"

    # 3. Second attempt for same active content must raise 400
    with pytest.raises(HTTPException) as exc_info:
        await create_learning_plan(db_session, test_user.id, plan_in)
    assert exc_info.value.status_code == 400
    assert "already exists" in exc_info.value.detail.lower()

    # 4. Partial index check: Once completed, user can create a new active plan for the same content
    p1.status = "completed"
    await db_session.commit()

    p2 = await create_learning_plan(db_session, test_user.id, plan_in)
    assert p2.id is not None
    assert p2.status == "active"
    assert p2.id != p1.id


@pytest.mark.asyncio
async def test_playlist_sync_in_place_reconciliation(db_session, monkeypatch):
    pl_id = f"test_pl_{uuid.uuid4().hex[:8]}"

    # Mock fetch_full_playlist_data
    mock_data = {
        "snippet": {"title": "Playlist Title V1", "channelTitle": "Channel 1", "thumbnails": {}},
        "contentDetails": {"itemCount": 2}
    }
    mock_items = [
        {"video_id": "v1", "title": "Video 1 Initial", "position": 0, "duration_iso": "PT10M", "duration_seconds": 600, "thumbnails": {}},
        {"video_id": "v2", "title": "Video 2 Initial", "position": 1, "duration_iso": "PT20M", "duration_seconds": 1200, "thumbnails": {}}
    ]

    async def mock_fetch(p_id):
        return mock_data, mock_items

    monkeypatch.setattr("app.services.playlist_sync_service.fetch_full_playlist_data", mock_fetch)

    # Initial sync
    res1 = await get_or_sync_playlist(db_session, pl_id)
    assert res1.title == "Playlist Title V1"
    assert len(res1.items) == 2
    assert res1.items[0].title == "Video 1 Initial"

    # Simulate updated upstream data: video 1 renamed, video 2 removed, video 3 added
    mock_data["snippet"]["title"] = "Playlist Title V2"
    mock_items = [
        {"video_id": "v1", "title": "Video 1 Updated", "position": 0, "duration_iso": "PT10M", "duration_seconds": 600, "thumbnails": {}},
        {"video_id": "v3", "title": "Video 3 Added", "position": 1, "duration_iso": "PT15M", "duration_seconds": 900, "thumbnails": {}}
    ]

    # Force re-sync by resetting synced_at to past
    stmt = (
        select(LearningPlaylist)
        .options(selectinload(LearningPlaylist.items))
        .where(LearningPlaylist.playlist_id == pl_id)
    )
    pl_obj = (await db_session.execute(stmt)).scalar_one()
    pl_obj.synced_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=25)
    await db_session.commit()

    res2 = await get_or_sync_playlist(db_session, pl_id)
    assert res2.title == "Playlist Title V2"
    assert len(res2.items) == 2
    titles = {it.title for it in res2.items}
    assert "Video 1 Updated" in titles
    assert "Video 3 Added" in titles
    assert "Video 2 Initial" not in titles


@pytest.mark.asyncio
async def test_analytics_resolves_playlist_video_titles(db_session):
    user_id = uuid.uuid4()
    u = User(id=user_id, email=f"analytics_{uuid.uuid4().hex[:8]}@example.com", password_hash="pw")
    db_session.add(u)
    await db_session.commit()

    # Create playlist and items
    pl_internal_id = uuid.uuid4()
    pl = LearningPlaylist(
        id=pl_internal_id,
        playlist_id="pl_analytics_test",
        title="Master Class Playlist",
        channel_title="Master Channel",
        thumbnail_url="https://img/pl_test.jpg",
        description="Master Class Description",
        total_duration_seconds=3600
    )
    db_session.add(pl)

    item1 = LearningPlaylistItem(
        playlist_internal_id=pl_internal_id,
        video_id="vid_authoritative_1",
        title="Chapter 1: The Foundations",
        thumbnail_url="https://img/vid1.jpg",
        position=0,
        duration_seconds=1800
    )
    db_session.add(item1)

    # Create student's playlist plan
    plan = LearningPlan(
        user_id=user_id,
        content_id="pl_analytics_test",
        content_type="playlist",
        title="Master Class Playlist",
        total_duration_seconds=3600,
        target_completion_date=datetime.now(timezone.utc).date() + timedelta(days=10),
        daily_target_seconds=360,
        status="active"
    )
    db_session.add(plan)

    # Record daily activity for the video
    today = datetime.now(timezone.utc).date()
    act = LearningDailyActivity(
        user_id=user_id,
        content_id="vid_authoritative_1",
        content_type="video",
        activity_date=today,
        watched_content_seconds=600
    )
    db_session.add(act)
    await db_session.commit()

    # Fetch analytics
    analytics = await get_dashboard_analytics(db_session, user_id, today - timedelta(days=7), today)
    assert len(analytics.recent_activity) >= 1

    matching_activity = [a for a in analytics.recent_activity if a.content_id == "vid_authoritative_1"]
    assert len(matching_activity) == 1
    # Title must be resolved from LearningPlaylistItem, not generic fallback
    assert matching_activity[0].title == "Chapter 1: The Foundations"


@pytest.mark.asyncio
async def test_batched_workspace_plan_progress_and_completion(db_session):
    user_id = uuid.uuid4()
    u = User(id=user_id, email=f"batch_{uuid.uuid4().hex[:8]}@example.com", password_hash="pw")
    db_session.add(u)
    await db_session.commit()

    today = datetime.now(timezone.utc).date()

    # Plan 1: Active video plan
    p1 = LearningPlan(
        user_id=user_id,
        content_id="v_batch_1",
        content_type="video",
        title="Video Plan 1",
        total_duration_seconds=1200,
        target_completion_date=today + timedelta(days=4),
        daily_target_seconds=300,
        status="active"
    )
    # Plan 2: Video plan where progress is already 100% complete
    p2 = LearningPlan(
        user_id=user_id,
        content_id="v_batch_2",
        content_type="video",
        title="Video Plan 2",
        total_duration_seconds=1000,
        target_completion_date=today + timedelta(days=4),
        daily_target_seconds=250,
        status="active"
    )
    db_session.add_all([p1, p2])

    prog2 = LearningProgress(
        user_id=user_id,
        content_id="v_batch_2",
        content_type="video",
        progress_seconds=1000,
        duration_seconds=1000,
        progress_percent=100.0,
        completed=True
    )
    db_session.add(prog2)
    await db_session.commit()

    # 1. Test batch completion check
    updated_plans = await batch_check_and_update_plan_completions(db_session, user_id, [p1, p2])
    status_map = {p.id: p.status for p in updated_plans}
    assert status_map[p1.id] == "active"
    assert status_map[p2.id] == "completed"

    # 2. Test batch progress calculation on active plan
    active_plans = [p for p in updated_plans if p.status == "active"]
    progress_map = await batch_get_plan_progress(db_session, user_id, active_plans)
    assert p1.id in progress_map
    assert progress_map[p1.id].daily_target_seconds == 300
    assert progress_map[p1.id].status == "active"


def test_bounded_debt_calculation_loop():
    today = date(2026, 10, 13)
    start_date = today - timedelta(days=500)
    target_date = today - timedelta(days=400)

    daily_completed = {
        start_date + timedelta(days=50): 500
    }

    prev_debt, curr_debt = compute_plan_debt(
        daily_target_seconds=100,
        target_completion_date=target_date,
        created_at_date=start_date,
        plan_status="active",
        plan_updated_at_date=start_date,
        daily_completed=daily_completed,
        today=today
    )

    assert prev_debt >= 0
    assert curr_debt >= 0


def test_adaptive_messaging_consistency_with_debt():
    today = date(2026, 10, 13)
    target_date = today + timedelta(days=5)
    start_date = today - timedelta(days=2)

    rec = calculate_adaptive_plan(
        total_duration_seconds=7200,
        target_completion_date=target_date,
        created_at_date=start_date,
        daily_target_seconds=1200,
        status="active",
        completed_content_seconds=1000,
        previous_debt_seconds=1800,
        completed_seconds_today=0,
        today=today
    )

    assert rec.schedule_status == "behind"
    assert "behind" in rec.explanation.lower()
    assert "catch-up debt" in rec.explanation.lower()

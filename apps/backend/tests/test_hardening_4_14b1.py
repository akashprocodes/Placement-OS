import pytest
import asyncio
import uuid
from datetime import datetime, timezone, timedelta, date
from sqlalchemy import select, func
from fastapi import HTTPException
import httpx

from app.models.user import User
from app.models.learning_plan import LearningPlan
from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem
from app.models.learning_progress import LearningProgress
from app.models.learning_daily_activity import LearningDailyActivity
from app.schemas.learning import LearningPlanCreate, LearningSearchResult, YouTubeVideo
from app.services.learning_plan_service import create_learning_plan
from app.services.playlist_sync_service import get_or_sync_playlist
from app.services.learning_debt_service import compute_plan_debt
from app.services.learning_adaptive_service import calculate_adaptive_plan
from app.services.youtube_service import (
    search_learning_content,
    save_search_cache,
    YouTubeQuotaError,
    YouTubeTimeoutError,
    normalize_query
)
from tests.conftest import TestingSessionLocal


# ══════════════════════════════════════════════════════════════════════════════
# 1. PLAYLIST SYNC CONCURRENCY & ISOLATION
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_concurrent_playlist_syncs_prevent_duplicates(monkeypatch):
    """
    Simulate multiple genuinely concurrent worker requests for the same unsynced playlist.
    Verifies that cross-worker advisory locks and in-place reconciliation prevent duplicate items.
    """
    pl_id = f"PL_CONCUR_{uuid.uuid4().hex[:6]}"

    mock_meta = {
        "snippet": {"title": "Concurrent Master Playlist", "channelTitle": "Tech Edu", "thumbnails": {}},
        "contentDetails": {"itemCount": 3}
    }
    mock_items = [
        {"video_id": f"{pl_id}_v1", "title": "Vid 1", "position": 0, "duration_iso": "PT10M", "duration_seconds": 600, "thumbnails": {}},
        {"video_id": f"{pl_id}_v2", "title": "Vid 2", "position": 1, "duration_iso": "PT20M", "duration_seconds": 1200, "thumbnails": {}},
        {"video_id": f"{pl_id}_v3", "title": "Vid 3", "position": 2, "duration_iso": "PT30M", "duration_seconds": 1800, "thumbnails": {}},
    ]

    fetch_call_count = 0
    fetch_lock = asyncio.Lock()

    async def mock_fetch(p_id):
        nonlocal fetch_call_count
        async with fetch_lock:
            fetch_call_count += 1
        await asyncio.sleep(0.05)  # Simulate network latency
        return mock_meta, mock_items

    monkeypatch.setattr("app.services.playlist_sync_service.fetch_full_playlist_data", mock_fetch)

    # Launch 3 concurrent sync calls using separate AsyncSessions
    async def worker_sync():
        async with TestingSessionLocal() as session:
            return await get_or_sync_playlist(session, pl_id)

    results = await asyncio.gather(worker_sync(), worker_sync(), worker_sync())

    # All 3 callers must receive a valid, complete playlist schema
    for res in results:
        assert res.id == pl_id
        assert len(res.items) == 3
        assert res.title == "Concurrent Master Playlist"

    # Upstream fetch should only be invoked once because of mutex & DB serialization
    assert fetch_call_count == 1

    # Verify directly in the database that NO duplicate items were created
    async with TestingSessionLocal() as session:
        stmt_pl = select(LearningPlaylist).where(LearningPlaylist.playlist_id == pl_id)
        pl_row = (await session.execute(stmt_pl)).scalar_one()

        stmt_items = select(LearningPlaylistItem).where(
            LearningPlaylistItem.playlist_internal_id == pl_row.id
        )
        items = (await session.execute(stmt_items)).scalars().all()
        assert len(items) == 3

        item_video_ids = [it.video_id for it in items]
        assert len(item_video_ids) == len(set(item_video_ids)), "Duplicate playlist items detected in DB!"


@pytest.mark.asyncio
async def test_playlist_sync_removes_only_deleted_upstream_items(db_session, monkeypatch):
    """
    Verify in-place reconciliation deletes only items removed upstream, updates modified items,
    and preserves unmodified items.
    """
    pl_id = f"PL_DIFF_{uuid.uuid4().hex[:6]}"

    mock_meta = {
        "snippet": {"title": "Diff Playlist V1", "channelTitle": "Tech Edu", "thumbnails": {}},
        "contentDetails": {"itemCount": 2}
    }
    mock_items_v1 = [
        {"video_id": "diff_v1", "title": "Video 1 Initial", "position": 0, "duration_iso": "PT10M", "duration_seconds": 600, "thumbnails": {}},
        {"video_id": "diff_v2", "title": "Video 2 Old", "position": 1, "duration_iso": "PT20M", "duration_seconds": 1200, "thumbnails": {}},
    ]

    async def mock_fetch_v1(p_id):
        return mock_meta, mock_items_v1

    monkeypatch.setattr("app.services.playlist_sync_service.fetch_full_playlist_data", mock_fetch_v1)
    await get_or_sync_playlist(db_session, pl_id)

    # Now upstream removes diff_v2, renames diff_v1, and adds diff_v3
    mock_items_v2 = [
        {"video_id": "diff_v1", "title": "Video 1 Renamed", "position": 0, "duration_iso": "PT10M", "duration_seconds": 600, "thumbnails": {}},
        {"video_id": "diff_v3", "title": "Video 3 New", "position": 1, "duration_iso": "PT15M", "duration_seconds": 900, "thumbnails": {}},
    ]

    async def mock_fetch_v2(p_id):
        return mock_meta, mock_items_v2

    monkeypatch.setattr("app.services.playlist_sync_service.fetch_full_playlist_data", mock_fetch_v2)

    # Force expiration of cache
    stmt = select(LearningPlaylist).where(LearningPlaylist.playlist_id == pl_id)
    pl_row = (await db_session.execute(stmt)).scalar_one()
    pl_row.synced_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=25)
    await db_session.commit()

    synced = await get_or_sync_playlist(db_session, pl_id)
    titles = {it.title for it in synced.items}
    v_ids = {it.video_id for it in synced.items}

    assert "Video 1 Renamed" in titles
    assert "Video 3 New" in titles
    assert "diff_v2" not in v_ids


# ══════════════════════════════════════════════════════════════════════════════
# 2. ACTIVE LEARNING PLAN RACE & CONCURRENCY
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_genuine_concurrent_active_plan_creation_race():
    """
    Two genuinely concurrent requests to create an active plan for the same (user_id, content_id).
    One MUST succeed, and the other MUST fail with HTTP 400 without corrupting the session.
    """
    async with TestingSessionLocal() as session_setup:
        user = User(
            id=uuid.uuid4(),
            email=f"race_user_{uuid.uuid4().hex[:6]}@example.com",
            password_hash="pw"
        )
        session_setup.add(user)
        await session_setup.commit()
        user_id = user.id

    content_id = f"race_video_{uuid.uuid4().hex[:6]}"
    plan_in = LearningPlanCreate(
        content_id=content_id,
        content_type="video",
        title="Concurrent Race Plan",
        total_duration_seconds=3600,
        target_completion_date=datetime.now(timezone.utc).date() + timedelta(days=5)
    )

    async def create_worker():
        async with TestingSessionLocal() as session:
            try:
                plan = await create_learning_plan(session, user_id, plan_in)
                return ("success", plan.id)
            except HTTPException as e:
                return ("error", e.status_code, e.detail)

    res1, res2 = await asyncio.gather(create_worker(), create_worker())

    statuses = [res1[0], res2[0]]
    assert "success" in statuses, "At least one plan creation should succeed"
    assert "error" in statuses, "Concurrent duplicate creation must be rejected"

    err_res = res1 if res1[0] == "error" else res2
    assert err_res[1] == 400
    assert "already exists" in err_res[2].lower()

    # Verify database state has exactly one active plan
    async with TestingSessionLocal() as session_verify:
        stmt = select(LearningPlan).where(
            LearningPlan.user_id == user_id,
            LearningPlan.content_id == content_id,
            LearningPlan.status == "active"
        )
        plans = (await session_verify.execute(stmt)).scalars().all()
        assert len(plans) == 1


@pytest.mark.asyncio
async def test_active_plan_allowed_after_completion_and_archival(db_session):
    """
    Verify PostgreSQL partial unique index allows a user to have archived and completed plans
    for the same content while strictly limiting active plans to 1.
    """
    user = User(
        id=uuid.uuid4(),
        email=f"multi_plan_{uuid.uuid4().hex[:6]}@example.com",
        password_hash="pw"
    )
    db_session.add(user)
    await db_session.commit()

    content_id = "reusable_content_course"
    plan_in = LearningPlanCreate(
        content_id=content_id,
        content_type="video",
        title="Reusable Plan",
        total_duration_seconds=1800,
        target_completion_date=datetime.now(timezone.utc).date() + timedelta(days=3)
    )

    # 1. Create first plan and complete it
    p1 = await create_learning_plan(db_session, user.id, plan_in)
    p1.status = "completed"
    await db_session.commit()

    # 2. Create second plan and archive it
    p2 = await create_learning_plan(db_session, user.id, plan_in)
    p2.status = "archived"
    await db_session.commit()

    # 3. Create third plan (currently active)
    p3 = await create_learning_plan(db_session, user.id, plan_in)
    assert p3.status == "active"

    # Total plans in DB for this content should be 3
    stmt = select(LearningPlan).where(
        LearningPlan.user_id == user.id,
        LearningPlan.content_id == content_id
    )
    all_plans = (await db_session.execute(stmt)).scalars().all()
    assert len(all_plans) == 3
    statuses = {p.status for p in all_plans}
    assert statuses == {"completed", "archived", "active"}


# ══════════════════════════════════════════════════════════════════════════════
# 3. DEBT CALCULATION BOUNDARIES & EXACTNESS
# ══════════════════════════════════════════════════════════════════════════════

def test_debt_plan_created_today():
    """Plan created today must have exactly 0 previous debt and full base target."""
    today = date(2026, 10, 14)
    target_date = today + timedelta(days=7)

    prev_debt, curr_debt = compute_plan_debt(
        daily_target_seconds=600,
        target_completion_date=target_date,
        created_at_date=today,
        plan_status="active",
        plan_updated_at_date=today,
        daily_completed={},
        today=today
    )
    assert prev_debt == 0
    assert curr_debt == 0


def test_debt_exact_historical_preservation_past_1095_days():
    """
    For a plan created 1,500 days ago, verify that debt is bounded in iterations
    while exact debt accrued prior to 1,095 days is NOT lost or undercounted.
    """
    today = date(2026, 10, 14)
    start_date = today - timedelta(days=1500)
    target_date = today - timedelta(days=1400)  # 101 active days in target range

    prev_debt, curr_debt = compute_plan_debt(
        daily_target_seconds=100,
        target_completion_date=target_date,
        created_at_date=start_date,
        plan_status="active",
        plan_updated_at_date=start_date,
        daily_completed={},
        today=today,
        max_lookback_days=1095
    )
    # 101 active days * 100 sec = 10,100 sec
    assert prev_debt == 10100
    assert curr_debt == 10100


def test_debt_target_date_in_past():
    """Target completion date in the past should stop accruing new base target."""
    today = date(2026, 10, 14)
    start_date = today - timedelta(days=20)
    target_date = today - timedelta(days=10)  # 11 active days (day -20 to day -10)

    prev_debt, curr_debt = compute_plan_debt(
        daily_target_seconds=200,
        target_completion_date=target_date,
        created_at_date=start_date,
        plan_status="active",
        plan_updated_at_date=start_date,
        daily_completed={},
        today=today
    )
    # Exactly 11 days of base target = 2200 sec, none after target date
    assert prev_debt == 2200
    assert curr_debt == 2200


def test_adaptive_zero_and_missing_duration_content():
    """Zero-duration plans should be immediately marked completed without division by zero."""
    today = date(2026, 10, 14)
    rec = calculate_adaptive_plan(
        total_duration_seconds=0,
        target_completion_date=today + timedelta(days=5),
        created_at_date=today,
        daily_target_seconds=0,
        status="active",
        completed_content_seconds=0,
        today=today
    )
    assert rec.schedule_status == "completed"
    assert rec.progress_percent == 100.0
    assert rec.recommended_daily_target_seconds == 0


def test_adaptive_unrealistic_target_flagging():
    """When catch-up debt requires >8h/day, flag as unachievable with constraint note."""
    today = date(2026, 10, 14)
    # 100 hours remaining with only 2 days left -> 50h/day > 8h/day limit
    rec = calculate_adaptive_plan(
        total_duration_seconds=360000,
        target_completion_date=today + timedelta(days=1),
        created_at_date=today - timedelta(days=10),
        daily_target_seconds=36000,
        status="active",
        completed_content_seconds=0,
        previous_debt_seconds=100000,
        today=today
    )
    assert rec.schedule_status == "behind"
    assert rec.is_achievable is False
    assert rec.constraint_note is not None
    assert "8 hours" in rec.constraint_note


# ══════════════════════════════════════════════════════════════════════════════
# 4. SEARCH CACHE FOLLOW-UPS & QUOTA FALLBACK
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_search_serves_stale_cache_on_quota_exhaustion(db_session, monkeypatch):
    """
    When YouTube API returns quotaExceeded (403), verify that a stale cached result
    is served as a graceful fallback instead of failing with 503.
    """
    query = "system design interview"
    norm_q = normalize_query(query)

    # 1. Save an expired search result to cache
    expired_result = LearningSearchResult(
        query=query,
        videos=[
            YouTubeVideo(
                id="stale_v1",
                title="Stale Distributed Systems",
                description="Cached result",
                thumbnailUrl="https://img/stale.jpg",
                channelTitle="Channel",
                publishedAt="2026-01-01T00:00:00Z",
                url="https://www.youtube.com/watch?v=stale_v1"
            )
        ],
        playlists=[],
        nextPageToken=None
    )
    await save_search_cache(db_session, norm_q, "", expired_result)

    # Backdate expires_at to 2 days ago so it's stale
    from app.models.learning_search_cache import LearningSearchCache
    stmt = select(LearningSearchCache).where(LearningSearchCache.query_normalized == norm_q)
    cached_row = (await db_session.execute(stmt)).scalar_one()
    cached_row.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=2)
    await db_session.commit()

    # 2. Mock upstream client to throw YouTubeQuotaError
    class MockClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
        async def get(self, *args, **kwargs):
            mock_res = httpx.Response(
                status_code=403,
                json={"error": {"errors": [{"reason": "quotaExceeded"}], "message": "Quota Exceeded"}},
                request=httpx.Request("GET", "https://test")
            )
            return mock_res

    monkeypatch.setattr("httpx.AsyncClient", lambda *args, **kwargs: MockClient())

    # 3. Perform search - should NOT raise YouTubeQuotaError, should return stale cache
    result = await search_learning_content(query, page_token=None, db=db_session, use_cache=True)
    assert len(result.videos) == 1
    assert result.videos[0].title == "Stale Distributed Systems"


@pytest.mark.asyncio
async def test_search_raises_quota_error_when_no_stale_cache(db_session, monkeypatch):
    """
    When YouTube API quota is exceeded and NO cache exists, YouTubeQuotaError is raised.
    """
    query = f"uncached_query_{uuid.uuid4().hex[:6]}"

    class MockClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
        async def get(self, *args, **kwargs):
            return httpx.Response(
                status_code=403,
                json={"error": {"errors": [{"reason": "quotaExceeded"}]}},
                request=httpx.Request("GET", "https://test")
            )

    monkeypatch.setattr("httpx.AsyncClient", lambda *args, **kwargs: MockClient())

    with pytest.raises(YouTubeQuotaError):
        await search_learning_content(query, page_token=None, db=db_session, use_cache=True)

import pytest
import httpx
from unittest.mock import patch, AsyncMock
from app.services.playlist_sync_service import get_or_sync_playlist
from fastapi import HTTPException

# We will mock fetch_full_playlist_data
from app.services import playlist_sync_service

@pytest.fixture
def mock_fetch():
    with patch("app.services.playlist_sync_service.fetch_full_playlist_data", new_callable=AsyncMock) as m:
        yield m

@pytest.mark.asyncio
async def test_playlist_fetch_success(db_session, mock_fetch):
    mock_fetch.return_value = (
        {"snippet": {"title": "Test Playlist", "channelTitle": "Channel"}, "contentDetails": {"itemCount": 2}},
        [
            {"video_id": "v1", "title": "Video 1", "position": 0, "duration_seconds": 120, "duration_iso": "PT2M", "thumbnails": {}},
            {"video_id": "v2", "title": "Video 2", "position": 1, "duration_seconds": 60, "duration_iso": "PT1M", "thumbnails": {}}
        ]
    )
    
    pl = await get_or_sync_playlist(db_session, "PL_VALID")
    assert pl.title == "Test Playlist"
    assert pl.total_duration_seconds == 180
    assert pl.duration_available == True
    assert len(pl.items) == 2
    assert pl.items[0].video_id == "v1"

@pytest.mark.asyncio
async def test_incomplete_duration(db_session, mock_fetch):
    mock_fetch.return_value = (
        {"snippet": {"title": "Incomplete"}, "contentDetails": {"itemCount": 2}},
        [
            {"video_id": "v1", "title": "Video 1", "position": 0, "duration_seconds": 120, "duration_iso": "PT2M"},
            {"video_id": "v2", "title": "Video 2", "position": 1, "duration_seconds": 0, "duration_iso": ""}
        ]
    )
    
    pl = await get_or_sync_playlist(db_session, "PL_INCOMPLETE")
    assert pl.total_duration_seconds == 120
    assert pl.duration_available == False

@pytest.mark.asyncio
async def test_youtube_api_failure(db_session, mock_fetch):
    mock_fetch.side_effect = ValueError("Playlist not found")
    with pytest.raises(ValueError):
        await get_or_sync_playlist(db_session, "PL_NOT_FOUND")


@pytest.mark.asyncio
async def test_playlist_user_progress_and_isolation(db_session, mock_fetch):
    import uuid
    from datetime import datetime, timezone
    from app.models.user import User
    from app.models.learning_progress import LearningProgress

    # Create User A and User B
    uid_a = uuid.uuid4().hex[:6]
    uid_b = uuid.uuid4().hex[:6]
    user_a = User(id=uuid.uuid4(), email=f"pl_user_a_{uid_a}@example.com", password_hash="pw")
    user_b = User(id=uuid.uuid4(), email=f"pl_user_b_{uid_b}@example.com", password_hash="pw")
    db_session.add_all([user_a, user_b])
    await db_session.flush()

    mock_fetch.return_value = (
        {"snippet": {"title": "Prog Playlist", "channelTitle": "Channel"}, "contentDetails": {"itemCount": 3}},
        [
            {"video_id": "vid_1", "title": "Vid 1", "position": 0, "duration_seconds": 100, "duration_iso": "PT100S", "thumbnails": {}},
            {"video_id": "vid_2", "title": "Vid 2", "position": 1, "duration_seconds": 200, "duration_iso": "PT200S", "thumbnails": {}},
            {"video_id": "vid_3", "title": "Vid 3", "position": 2, "duration_seconds": 300, "duration_iso": "PT300S", "thumbnails": {}},
        ]
    )

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # User A: vid_1 is completed, vid_2 is in-progress (50%), vid_3 is unstarted
    p1 = LearningProgress(
        id=uuid.uuid4(),
        user_id=user_a.id,
        content_id="vid_1",
        content_type="video",
        progress_seconds=100,
        duration_seconds=100,
        progress_percent=100.0,
        completed=True,
        last_watched_at=now
    )
    p2 = LearningProgress(
        id=uuid.uuid4(),
        user_id=user_a.id,
        content_id="vid_2",
        content_type="video",
        progress_seconds=100,
        duration_seconds=200,
        progress_percent=50.0,
        completed=False,
        last_watched_at=now
    )
    db_session.add_all([p1, p2])
    await db_session.commit()

    # 1. User A query
    pl_a = await get_or_sync_playlist(db_session, "PL_PROGRESS", user_id=user_a.id)
    assert pl_a.completed_count == 1
    assert pl_a.total_count == 3
    assert pl_a.next_incomplete_video_id == "vid_2"  # vid_1 is done, vid_2 is next!
    assert pl_a.items[0].completed is True
    assert pl_a.items[0].progress_percent == 100.0
    assert pl_a.items[1].completed is False
    assert pl_a.items[1].progress_percent == 50.0
    assert pl_a.items[2].completed is False
    assert pl_a.items[2].progress_seconds == 0

    # 2. User B query (Isolation check: User B has not started any video)
    pl_b = await get_or_sync_playlist(db_session, "PL_PROGRESS", user_id=user_b.id)
    assert pl_b.completed_count == 0
    assert pl_b.total_count == 3
    assert pl_b.next_incomplete_video_id == "vid_1"  # Starts at first video!
    assert pl_b.items[0].completed is False
    assert pl_b.items[1].completed is False
    assert pl_b.items[2].completed is False

    # 3. Unauthenticated query (user_id is None)
    pl_anon = await get_or_sync_playlist(db_session, "PL_PROGRESS", user_id=None)
    assert pl_anon.completed_count is None
    assert pl_anon.total_count is None
    assert pl_anon.next_incomplete_video_id is None
    assert pl_anon.items[0].completed is None
    assert pl_anon.items[1].completed is None

    # 4. Mark all completed for User A
    p2.completed = True
    p2.progress_percent = 100.0
    p3 = LearningProgress(
        id=uuid.uuid4(),
        user_id=user_a.id,
        content_id="vid_3",
        content_type="video",
        progress_seconds=300,
        duration_seconds=300,
        progress_percent=100.0,
        completed=True,
        last_watched_at=now
    )
    db_session.add(p3)
    await db_session.commit()

    pl_all = await get_or_sync_playlist(db_session, "PL_PROGRESS", user_id=user_a.id)
    assert pl_all.completed_count == 3
    assert pl_all.next_incomplete_video_id is None  # All completed!


@pytest.mark.asyncio
async def test_empty_playlist_handling(db_session, mock_fetch):
    import uuid
    user_id = uuid.uuid4()
    mock_fetch.return_value = (
        {"snippet": {"title": "Empty Playlist", "channelTitle": "Channel"}, "contentDetails": {"itemCount": 0}},
        []
    )
    pl = await get_or_sync_playlist(db_session, "PL_EMPTY", user_id=user_id)
    assert pl.completed_count == 0
    assert pl.total_count == 0
    assert pl.next_incomplete_video_id is None
    assert len(pl.items) == 0


@pytest.mark.asyncio
async def test_playlist_endpoint_auth_and_isolation(client: httpx.AsyncClient, db_session, mock_fetch):
    mock_fetch.return_value = (
        {"snippet": {"title": "API Playlist", "channelTitle": "Channel"}, "contentDetails": {"itemCount": 2}},
        [
            {"video_id": "api_v1", "title": "API Vid 1", "position": 0, "duration_seconds": 60, "duration_iso": "PT60S", "thumbnails": {}},
            {"video_id": "api_v2", "title": "API Vid 2", "position": 1, "duration_seconds": 120, "duration_iso": "PT120S", "thumbnails": {}}
        ]
    )

    # 1. Unauthenticated request to /playlist/{id}
    res_unauth = await client.get("/api/v1/learning/playlist/PL_API_TEST")
    assert res_unauth.status_code == 200
    data_unauth = res_unauth.json()
    assert data_unauth["id"] == "PL_API_TEST"
    assert data_unauth["completed_count"] is None
    assert data_unauth["items"][0]["completed"] is None

    # 2. Register & Login User 1
    await client.post("/api/v1/auth/register", json={"email": "u1_pl@example.com", "password": "password123"})
    login_1 = await client.post("/api/v1/auth/login", json={"email": "u1_pl@example.com", "password": "password123"})
    token_1 = login_1.json()["access_token"]
    headers_1 = {"Authorization": f"Bearer {token_1}"}

    # Record progress for api_v1 as completed for User 1
    await client.put(
        "/api/v1/learning/progress/video/api_v1",
        json={"content_id": "api_v1", "content_type": "video", "progress_seconds": 60, "duration_seconds": 60},
        headers=headers_1
    )

    # 3. Authenticated request for User 1
    res_u1 = await client.get("/api/v1/learning/playlist/PL_API_TEST", headers=headers_1)
    assert res_u1.status_code == 200
    data_u1 = res_u1.json()
    assert data_u1["completed_count"] == 1
    assert data_u1["total_count"] == 2
    assert data_u1["next_incomplete_video_id"] == "api_v2"
    assert data_u1["items"][0]["completed"] is True
    assert data_u1["items"][1]["completed"] is False

    # 4. Register & Login User 2 (Isolation check)
    await client.post("/api/v1/auth/register", json={"email": "u2_pl@example.com", "password": "password123"})
    login_2 = await client.post("/api/v1/auth/login", json={"email": "u2_pl@example.com", "password": "password123"})
    token_2 = login_2.json()["access_token"]
    headers_2 = {"Authorization": f"Bearer {token_2}"}

    res_u2 = await client.get("/api/v1/learning/playlist/PL_API_TEST", headers=headers_2)
    assert res_u2.status_code == 200
    data_u2 = res_u2.json()
    assert data_u2["completed_count"] == 0
    assert data_u2["total_count"] == 2
    assert data_u2["next_incomplete_video_id"] == "api_v1"
    assert data_u2["items"][0]["completed"] is False
    assert data_u2["items"][1]["completed"] is False



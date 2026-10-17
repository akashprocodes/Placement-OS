from datetime import datetime, timezone
import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.learning_session import LearningSession

async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    return resp.json()["access_token"], me_resp.json()["id"]

def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_session_heartbeat(client: AsyncClient, db_session: AsyncSession):
    token, user_id = await register_and_login(client, "session1@test.com")
    session_id = str(uuid.uuid4())
    
    # 1. Initial heartbeat
    payload1 = {
        "session_id": session_id,
        "content_id": "vid1",
        "content_type": "video",
        "sequence": 1,
        "position_seconds": 10,
        "playback_rate": 1.0,
        "played_content_seconds": 10,
        "wall_clock_seconds": 10,
        "status": "active",
        "client_event_at": datetime.now(timezone.utc).isoformat()
    }
    res1 = await client.post("/api/v1/learning/sessions/heartbeat", json=payload1, headers=auth(token))
    assert res1.status_code == 200
    
    # Verify in DB
    result = await db_session.execute(select(LearningSession).where(LearningSession.id == uuid.UUID(session_id)))
    session = result.scalar_one()
    assert session.watched_content_seconds == 10
    
    # 2. Duplicate sequence (should be idempotent / ignored)
    res2 = await client.post("/api/v1/learning/sessions/heartbeat", json=payload1, headers=auth(token))
    assert res2.status_code == 200
    
    await db_session.refresh(session)
    assert session.watched_content_seconds == 10  # STILL 10!
    
    # 3. Next sequence
    payload3 = {**payload1, "sequence": 2, "played_content_seconds": 20, "wall_clock_seconds": 10, "playback_rate": 2.0}
    res3 = await client.post("/api/v1/learning/sessions/heartbeat", json=payload3, headers=auth(token))
    assert res3.status_code == 200
    
    await db_session.refresh(session)
    assert session.watched_content_seconds == 30  # 10 + 20
    assert session.wall_clock_seconds == 20       # 10 + 10

@pytest.mark.asyncio
async def test_session_validation(client: AsyncClient, db_session: AsyncSession):
    token, user_id = await register_and_login(client, "session2@test.com")
    session_id = str(uuid.uuid4())
    
    payload = {
        "session_id": session_id,
        "content_id": "vid1",
        "content_type": "video",
        "sequence": 1,
        "position_seconds": 10,
        "playback_rate": 1.0,
        "played_content_seconds": 10,
        "wall_clock_seconds": 10,
        "status": "active",
        "client_event_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Negative time
    bad_payload = {**payload, "played_content_seconds": -5}
    res = await client.post("/api/v1/learning/sessions/heartbeat", json=bad_payload, headers=auth(token))
    assert res.status_code == 422
    
    # Excessive time (>300s)
    bad_payload = {**payload, "played_content_seconds": 400, "wall_clock_seconds": 400}
    res = await client.post("/api/v1/learning/sessions/heartbeat", json=bad_payload, headers=auth(token))
    assert res.status_code == 422
    
    # Invalid rate
    bad_payload = {**payload, "playback_rate": 5.0, "played_content_seconds": 50}
    res = await client.post("/api/v1/learning/sessions/heartbeat", json=bad_payload, headers=auth(token))
    assert res.status_code == 422
    
    # Math consistency violation (Issue 1)
    bad_payload = {**payload, "playback_rate": 1.0, "played_content_seconds": 50, "wall_clock_seconds": 10}
    res = await client.post("/api/v1/learning/sessions/heartbeat", json=bad_payload, headers=auth(token))
    assert res.status_code == 422
    
    # Valid normal creation
    res = await client.post("/api/v1/learning/sessions/heartbeat", json=payload, headers=auth(token))
    assert res.status_code == 200
    
    # Content mismatch
    valid_payload = {**payload, "sequence": 2, "content_id": "vid2"}
    res_mismatch = await client.post("/api/v1/learning/sessions/heartbeat", json=valid_payload, headers=auth(token))
    assert res_mismatch.status_code == 400

@pytest.mark.asyncio
async def test_session_isolation(client: AsyncClient, db_session: AsyncSession):
    token1, user1 = await register_and_login(client, "iso1@test.com")
    token2, user2 = await register_and_login(client, "iso2@test.com")
    
    session_id = str(uuid.uuid4())
    
    # User 1 creates session
    payload = {
        "session_id": session_id,
        "content_id": "vid1",
        "content_type": "video",
        "sequence": 1,
        "position_seconds": 10,
        "playback_rate": 1.0,
        "played_content_seconds": 10,
        "wall_clock_seconds": 10,
        "status": "active",
        "client_event_at": datetime.now(timezone.utc).isoformat()
    }
    await client.post("/api/v1/learning/sessions/heartbeat", json=payload, headers=auth(token1))
    
    # User 2 tries to modify it
    payload["sequence"] = 2
    res = await client.post("/api/v1/learning/sessions/heartbeat", json=payload, headers=auth(token2))
    assert res.status_code == 403

@pytest.mark.asyncio
async def test_ended_session(client: AsyncClient, db_session: AsyncSession):
    token, user_id = await register_and_login(client, "ended@test.com")
    session_id = str(uuid.uuid4())
    
    payload = {
        "session_id": session_id,
        "content_id": "vid1",
        "content_type": "video",
        "sequence": 1,
        "position_seconds": 10,
        "playback_rate": 1.0,
        "played_content_seconds": 10,
        "wall_clock_seconds": 10,
        "status": "ended",
        "client_event_at": datetime.now(timezone.utc).isoformat()
    }
    res = await client.post("/api/v1/learning/sessions/heartbeat", json=payload, headers=auth(token))
    assert res.status_code == 200
    
    # Try to add more time
    payload["sequence"] = 2
    res = await client.post("/api/v1/learning/sessions/heartbeat", json=payload, headers=auth(token))
    assert res.status_code == 409
    
    # Try duplicate ended request (should be idempotent)
    payload["sequence"] = 1
    res = await client.post("/api/v1/learning/sessions/heartbeat", json=payload, headers=auth(token))
    assert res.status_code == 200


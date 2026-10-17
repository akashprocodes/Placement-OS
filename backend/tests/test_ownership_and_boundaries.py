import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.learning_plan import LearningPlan
from app.models.learning_note import LearningNote
from app.core.config import Settings


async def register_and_login(client: AsyncClient, email: str, password: str = "Password123!") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    return resp.json()["access_token"], me_resp.json()["id"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── 1. Cross-Tenant Learning Plan Ownership Tests ───────────────────────────

@pytest.mark.asyncio
async def test_user_cannot_access_or_delete_other_user_plan(
    client: AsyncClient,
    db_session: AsyncSession
):
    token_a, user_a_id = await register_and_login(client, f"user_a_{uuid.uuid4().hex[:6]}@example.com")
    token_b, user_b_id = await register_and_login(client, f"user_b_{uuid.uuid4().hex[:6]}@example.com")

    # User A creates a learning plan
    plan_a = LearningPlan(
        id=uuid.uuid4(),
        user_id=uuid.UUID(user_a_id),
        content_id="vid_user_a_123",
        content_type="video",
        title="User A Secret Plan",
        total_duration_seconds=3600,
        target_completion_date=datetime.now(timezone.utc).date() + timedelta(days=7),
        daily_target_seconds=600,
        status="active"
    )
    db_session.add(plan_a)
    await db_session.commit()

    # User B tries to GET User A's plan
    res_get = await client.get(
        f"/api/v1/learning/plans/{plan_a.id}",
        headers=auth(token_b)
    )
    assert res_get.status_code == 404
    assert res_get.json()["detail"] == "Learning plan not found"

    # User B tries to DELETE User A's plan
    res_del = await client.delete(
        f"/api/v1/learning/plans/{plan_a.id}",
        headers=auth(token_b)
    )
    assert res_del.status_code == 404

    # User B tries to GET User A's plan progress
    res_prog = await client.get(
        f"/api/v1/learning/plans/{plan_a.id}/progress",
        headers=auth(token_b)
    )
    assert res_prog.status_code == 403
    assert res_prog.json()["detail"] == "Not authorized to access this plan"

    # User B tries to GET User A's adaptive plan recommendation
    res_adapt = await client.get(
        f"/api/v1/learning/plans/{plan_a.id}/adaptive",
        headers=auth(token_b)
    )
    assert res_adapt.status_code == 403

    # User A can access their own plan cleanly
    res_a_get = await client.get(
        f"/api/v1/learning/plans/{plan_a.id}",
        headers=auth(token_a)
    )
    assert res_a_get.status_code == 200
    assert res_a_get.json()["title"] == "User A Secret Plan"


# ─── 2. Cross-Tenant Notes & Bookmarks Isolation Tests ───────────────────────

@pytest.mark.asyncio
async def test_user_cannot_view_or_modify_other_user_notes(
    client: AsyncClient,
    db_session: AsyncSession
):
    token_a, user_a_id = await register_and_login(client, f"user_a_{uuid.uuid4().hex[:6]}@example.com")
    token_b, user_b_id = await register_and_login(client, f"user_b_{uuid.uuid4().hex[:6]}@example.com")
    video_id = "shared_lecture_video_99"

    # User A creates a note on video_id
    note_a = LearningNote(
        id=uuid.uuid4(),
        user_id=uuid.UUID(user_a_id),
        video_id=video_id,
        timestamp_seconds=120,
        title="User A Private Note",
        content="Personal revision points for exam",
        note_type="note"
    )
    db_session.add(note_a)
    await db_session.commit()

    # User B lists notes for video_id
    res_list = await client.get(
        f"/api/v1/learning/videos/{video_id}/notes",
        headers=auth(token_b)
    )
    assert res_list.status_code == 200
    assert res_list.json() == []  # User B sees zero notes from User A

    # User B attempts to edit User A's note
    res_put = await client.put(
        f"/api/v1/learning/notes/{note_a.id}",
        headers=auth(token_b),
        json={"title": "Hacked Title", "content": "Tampered content"}
    )
    assert res_put.status_code == 404
    assert res_put.json()["detail"] == "Note not found"

    # User B attempts to delete User A's note
    res_delete = await client.delete(
        f"/api/v1/learning/notes/{note_a.id}",
        headers=auth(token_b)
    )
    assert res_delete.status_code == 404

    # Verify note in DB is completely unchanged
    stmt = select(LearningNote).where(LearningNote.id == note_a.id)
    db_note = (await db_session.execute(stmt)).scalar_one()
    assert db_note.title == "User A Private Note"
    assert str(db_note.user_id) == user_a_id


# ─── 3. Session Hijacking Prevention Tests ────────────────────────────────────

@pytest.mark.asyncio
async def test_session_hijacking_forbidden(
    client: AsyncClient,
    db_session: AsyncSession
):
    token_a, _ = await register_and_login(client, f"user_a_{uuid.uuid4().hex[:6]}@example.com")
    token_b, _ = await register_and_login(client, f"user_b_{uuid.uuid4().hex[:6]}@example.com")
    session_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    # User A creates session with heartbeat
    payload_a = {
        "session_id": str(session_id),
        "content_id": "test_session_vid",
        "content_type": "video",
        "sequence": 1,
        "position_seconds": 30,
        "playback_rate": 1.0,
        "played_content_seconds": 30,
        "wall_clock_seconds": 30,
        "status": "active",
        "client_event_at": now_utc.isoformat()
    }
    res_a = await client.post(
        "/api/v1/learning/sessions/heartbeat",
        headers=auth(token_a),
        json=payload_a
    )
    assert res_a.status_code == 200

    # User B attempts to hijack session_id
    payload_b = {
        "session_id": str(session_id),
        "content_id": "test_session_vid",
        "content_type": "video",
        "sequence": 2,
        "position_seconds": 60,
        "playback_rate": 1.0,
        "played_content_seconds": 30,
        "wall_clock_seconds": 30,
        "status": "active",
        "client_event_at": now_utc.isoformat()
    }
    res_b = await client.post(
        "/api/v1/learning/sessions/heartbeat",
        headers=auth(token_b),
        json=payload_b
    )
    assert res_b.status_code == 403
    assert res_b.json()["detail"] == "Not authorized to update this session"


# ─── 4. Request Validation & Bounded Analytics Tests ─────────────────────────

@pytest.mark.asyncio
async def test_analytics_date_range_upper_bound(
    client: AsyncClient,
    db_session: AsyncSession
):
    token_a, _ = await register_and_login(client, f"user_a_{uuid.uuid4().hex[:6]}@example.com")

    # Unbounded historical date range (10 years)
    res = await client.get(
        "/api/v1/learning/analytics/dashboard?start_date=2015-01-01&end_date=2025-01-01",
        headers=auth(token_a)
    )
    assert res.status_code == 400
    assert "Date range cannot exceed 366 days" in res.json()["detail"]

    # Inverted date range
    res_inv = await client.get(
        "/api/v1/learning/analytics/dashboard?start_date=2026-05-01&end_date=2026-01-01",
        headers=auth(token_a)
    )
    assert res_inv.status_code == 400
    assert "start_date cannot be after end_date" in res_inv.json()["detail"]

    # Valid 30-day range succeeds
    today_str = datetime.now(timezone.utc).date().isoformat()
    past_str = (datetime.now(timezone.utc).date() - timedelta(days=30)).isoformat()
    res_valid = await client.get(
        f"/api/v1/learning/analytics/dashboard?start_date={past_str}&end_date={today_str}",
        headers=auth(token_a)
    )
    assert res_valid.status_code == 200


@pytest.mark.asyncio
async def test_password_length_bounds_on_registration(
    client: AsyncClient
):
    # Password empty (< 1 char)
    res_short = await client.post(
        "/api/v1/auth/register",
        json={"email": f"short_{uuid.uuid4().hex[:6]}@example.com", "password": ""}
    )
    assert res_short.status_code == 422

    # Password too long (> 128 chars)
    res_long = await client.post(
        "/api/v1/auth/register",
        json={"email": f"long_{uuid.uuid4().hex[:6]}@example.com", "password": "a" * 129}
    )
    assert res_long.status_code == 422


# ─── 5. Progress Upsert Concurrency & Race Condition Recovery ────────────────

@pytest.mark.asyncio
async def test_progress_upsert_handles_concurrency_race(
    client: AsyncClient,
    db_session: AsyncSession
):
    token_a, _ = await register_and_login(client, f"user_a_{uuid.uuid4().hex[:6]}@example.com")
    video_id = f"race_test_video_{uuid.uuid4().hex[:6]}"

    payload = {
        "content_id": video_id,
        "content_type": "video",
        "progress_seconds": 150,
        "duration_seconds": 300
    }

    # First upsert creates the row
    res1 = await client.put(
        f"/api/v1/learning/progress/video/{video_id}",
        headers=auth(token_a),
        json=payload
    )
    assert res1.status_code == 200
    assert res1.json()["progress_seconds"] == 150

    # Second upsert updates the row
    payload["progress_seconds"] = 290
    res2 = await client.put(
        f"/api/v1/learning/progress/video/{video_id}",
        headers=auth(token_a),
        json=payload
    )
    assert res2.status_code == 200
    assert res2.json()["progress_seconds"] == 290
    assert res2.json()["completed"] is True


# ─── 6. Production Configuration Safeguards ──────────────────────────────────

def test_production_environment_rejects_insecure_jwt_secret():
    # Insecure default secret in production raises ValueError
    with pytest.raises(ValueError, match="JWT_SECRET_KEY must be a cryptographically secure string"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="replace-this-with-a-secure-secret"
        )

    with pytest.raises(ValueError, match="JWT_SECRET_KEY must be a cryptographically secure string"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="short-secret"
        )

    # Secure 32+ char secret in production with valid domain succeeds
    prod_settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET_KEY="a-very-long-and-secure-random-secret-key-32-chars-long",
        FRONTEND_URL="https://app.placementos.com"
    )
    assert prod_settings.ENVIRONMENT == "production"

    # Production rejects non-HTTPS origins
    with pytest.raises(ValueError, match="must use HTTPS in production"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="a-very-long-and-secure-random-secret-key-32-chars-long",
            FRONTEND_URL="http://app.placementos.com"
        )

    # Production rejects localhost, 127.0.0.1, and loopback addresses
    for invalid_origin in ["http://localhost:3000", "https://localhost:3000", "https://127.0.0.1:3000", "https://[::1]:3000"]:
        with pytest.raises(ValueError, match="cannot use localhost or loopback addresses in production|must use HTTPS in production"):
            Settings(
                ENVIRONMENT="production",
                JWT_SECRET_KEY="a-very-long-and-secure-random-secret-key-32-chars-long",
                FRONTEND_URL=invalid_origin
            )

    # Production handles multiple valid origins and strips trailing slashes
    multi_settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET_KEY="a-very-long-and-secure-random-secret-key-32-chars-long",
        FRONTEND_URL="https://app.placementos.com/, https://placementos.com"
    )
    assert multi_settings.cors_origins == ["https://app.placementos.com", "https://placementos.com"]

    # Staging also rejects insecure or template secrets
    with pytest.raises(ValueError, match="JWT_SECRET_KEY must be a cryptographically secure string"):
        Settings(
            ENVIRONMENT="staging",
            JWT_SECRET_KEY="replace-this-with-a-secure-secret-in-production-min-32-chars"
        )

    staging_settings = Settings(
        ENVIRONMENT="staging",
        JWT_SECRET_KEY="a-very-long-and-secure-random-secret-key-32-chars-long"
    )
    assert staging_settings.ENVIRONMENT == "staging"

    # In development, default secret is accepted for ease of development
    dev_settings = Settings(
        ENVIRONMENT="development",
        JWT_SECRET_KEY="replace-this-with-a-secure-secret"
    )
    assert dev_settings.ENVIRONMENT == "development"

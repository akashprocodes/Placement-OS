"""
Phase 4.5B — Learning Progress API tests.
Uses the isolated test_placement_os database via conftest.py fixtures.
"""
import pytest
from httpx import AsyncClient


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> str:
    """Register a user and return a bearer token."""
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── GET progress (no saved record) ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_progress_not_found(client: AsyncClient):
    token = await register_and_login(client, "prog_get_missing@test.com")
    resp = await client.get("/api/v1/learning/progress/video/nonexistent-video", headers=auth(token))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_progress_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/v1/learning/progress/video/video-123")
    assert resp.status_code == 401


# ─── PUT (create) ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_progress(client: AsyncClient):
    token = await register_and_login(client, "prog_create@test.com")
    body = {"content_id": "vid-abc", "content_type": "video",
            "progress_seconds": 120, "duration_seconds": 600}
    resp = await client.put("/api/v1/learning/progress/video/vid-abc", json=body, headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["content_id"] == "vid-abc"
    assert data["content_type"] == "video"
    assert data["progress_seconds"] == 120
    assert data["duration_seconds"] == 600
    assert abs(data["progress_percent"] - 20.0) < 0.01
    assert data["completed"] is False


@pytest.mark.asyncio
async def test_create_progress_unauthenticated(client: AsyncClient):
    body = {"content_id": "vid-abc", "content_type": "video",
            "progress_seconds": 10, "duration_seconds": 100}
    resp = await client.put("/api/v1/learning/progress/video/vid-abc", json=body)
    assert resp.status_code == 401


# ─── GET after PUT ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_progress_after_create(client: AsyncClient):
    token = await register_and_login(client, "prog_get_after@test.com")
    body = {"content_id": "vid-get1", "content_type": "video",
            "progress_seconds": 300, "duration_seconds": 900}
    await client.put("/api/v1/learning/progress/video/vid-get1", json=body, headers=auth(token))

    resp = await client.get("/api/v1/learning/progress/video/vid-get1", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["progress_seconds"] == 300


# ─── Update (upsert) ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_progress(client: AsyncClient):
    token = await register_and_login(client, "prog_update@test.com")
    body = {"content_id": "vid-upd", "content_type": "video",
            "progress_seconds": 60, "duration_seconds": 600}
    await client.put("/api/v1/learning/progress/video/vid-upd", json=body, headers=auth(token))

    body["progress_seconds"] = 200
    resp = await client.put("/api/v1/learning/progress/video/vid-upd", json=body, headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["progress_seconds"] == 200

    # Verify no duplicate row was created
    get_resp = await client.get("/api/v1/learning/progress/video/vid-upd", headers=auth(token))
    assert get_resp.status_code == 200
    assert get_resp.json()["progress_seconds"] == 200


# ─── Completion rule ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_completion_at_95_percent(client: AsyncClient):
    token = await register_and_login(client, "prog_complete@test.com")
    body = {"content_id": "vid-done", "content_type": "video",
            "progress_seconds": 950, "duration_seconds": 1000}  # 95%
    resp = await client.put("/api/v1/learning/progress/video/vid-done", json=body, headers=auth(token))
    assert resp.json()["completed"] is True
    assert resp.json()["progress_percent"] >= 95.0


@pytest.mark.asyncio
async def test_not_completed_below_95(client: AsyncClient):
    token = await register_and_login(client, "prog_incomplete@test.com")
    body = {"content_id": "vid-ndone", "content_type": "video",
            "progress_seconds": 940, "duration_seconds": 1000}  # 94%
    resp = await client.put("/api/v1/learning/progress/video/vid-ndone", json=body, headers=auth(token))
    assert resp.json()["completed"] is False


@pytest.mark.asyncio
async def test_progress_percent_clamped(client: AsyncClient):
    """progress_seconds > duration_seconds should be clamped by schema."""
    token = await register_and_login(client, "prog_clamp@test.com")
    body = {"content_id": "vid-clamp", "content_type": "video",
            "progress_seconds": 2000, "duration_seconds": 1000}
    resp = await client.put("/api/v1/learning/progress/video/vid-clamp", json=body, headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["progress_percent"] == 100.0
    assert resp.json()["progress_seconds"] == 1000  # clamped by schema validator


@pytest.mark.asyncio
async def test_null_duration_safe(client: AsyncClient):
    """Progress with no duration_seconds should store 0.0 percent safely."""
    token = await register_and_login(client, "prog_noduration@test.com")
    body = {"content_id": "vid-nodur", "content_type": "video",
            "progress_seconds": 300}
    resp = await client.put("/api/v1/learning/progress/video/vid-nodur", json=body, headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["progress_percent"] == 0.0
    assert resp.json()["duration_seconds"] is None
    assert resp.json()["completed"] is False


# ─── Validation errors ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invalid_negative_progress(client: AsyncClient):
    token = await register_and_login(client, "prog_neg@test.com")
    body = {"content_id": "vid-neg", "content_type": "video",
            "progress_seconds": -10, "duration_seconds": 600}
    resp = await client.put("/api/v1/learning/progress/video/vid-neg", json=body, headers=auth(token))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invalid_zero_duration(client: AsyncClient):
    token = await register_and_login(client, "prog_zdur@test.com")
    body = {"content_id": "vid-zdur", "content_type": "video",
            "progress_seconds": 10, "duration_seconds": 0}
    resp = await client.put("/api/v1/learning/progress/video/vid-zdur", json=body, headers=auth(token))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invalid_content_type(client: AsyncClient):
    token = await register_and_login(client, "prog_ctype@test.com")
    body = {"content_id": "vid-ct", "content_type": "podcast",
            "progress_seconds": 10}
    resp = await client.put("/api/v1/learning/progress/podcast/vid-ct", json=body, headers=auth(token))
    assert resp.status_code == 422


# ─── Ownership isolation ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ownership_isolation_get(client: AsyncClient):
    """User B cannot see User A's progress."""
    token_a = await register_and_login(client, "owner_a@test.com")
    token_b = await register_and_login(client, "owner_b@test.com")

    body = {"content_id": "video-shared", "content_type": "video",
            "progress_seconds": 500, "duration_seconds": 1000}
    await client.put("/api/v1/learning/progress/video/video-shared", json=body, headers=auth(token_a))

    resp = await client.get("/api/v1/learning/progress/video/video-shared", headers=auth(token_b))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_ownership_isolation_update(client: AsyncClient):
    """User B updating the same content_id only affects their own row."""
    token_a = await register_and_login(client, "iso_a@test.com")
    token_b = await register_and_login(client, "iso_b@test.com")

    body_a = {"content_id": "vid-iso", "content_type": "video",
              "progress_seconds": 300, "duration_seconds": 1000}
    await client.put("/api/v1/learning/progress/video/vid-iso", json=body_a, headers=auth(token_a))

    body_b = {"content_id": "vid-iso", "content_type": "video",
              "progress_seconds": 50, "duration_seconds": 1000}
    resp_b = await client.put("/api/v1/learning/progress/video/vid-iso", json=body_b, headers=auth(token_b))
    assert resp_b.status_code == 200

    # User A's progress is unchanged
    resp_a = await client.get("/api/v1/learning/progress/video/vid-iso", headers=auth(token_a))
    assert resp_a.json()["progress_seconds"] == 300


@pytest.mark.asyncio
async def test_duplicate_upserts_no_duplicate_row(client: AsyncClient):
    """Calling PUT twice with same content should produce exactly one row (upsert)."""
    token = await register_and_login(client, "prog_dedup@test.com")
    body = {"content_id": "vid-dedup", "content_type": "video",
            "progress_seconds": 100, "duration_seconds": 1000}
    await client.put("/api/v1/learning/progress/video/vid-dedup", json=body, headers=auth(token))
    body["progress_seconds"] = 200
    await client.put("/api/v1/learning/progress/video/vid-dedup", json=body, headers=auth(token))
    body["progress_seconds"] = 300
    r = await client.put("/api/v1/learning/progress/video/vid-dedup", json=body, headers=auth(token))
    assert r.status_code == 200
    assert r.json()["progress_seconds"] == 300

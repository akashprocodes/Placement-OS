"""
Phase 4.5B — Session/Cookie Authentication tests.
Tests the dual-token path: Bearer header (existing) + HttpOnly cookie (new).

Cookie approach: pass a raw `Cookie:` header so httpx domain-matching is bypassed.
This mirrors what browsers do (they always send matching cookies as a header).
"""
import pytest
from httpx import AsyncClient


async def get_token(client: AsyncClient, email: str, password: str = "sessionpass1") -> str:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def cookie(token: str) -> dict:
    """Send the access_token as a raw Cookie header — how browsers send HttpOnly cookies."""
    return {"Cookie": f"access_token={token}"}


# ─── Existing Bearer header path ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_me_via_bearer_header(client: AsyncClient):
    token = await get_token(client, "session_bearer@test.com")
    resp = await client.get("/api/v1/auth/me", headers=bearer(token))
    assert resp.status_code == 200
    assert resp.json()["email"] == "session_bearer@test.com"


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


# ─── Cookie-based authentication path ────────────────────────────────────────

@pytest.mark.asyncio
async def test_me_via_cookie(client: AsyncClient):
    """Cookie header should authenticate /me without an Authorization header."""
    token = await get_token(client, "session_cookie@test.com")
    resp = await client.get("/api/v1/auth/me", headers=cookie(token))
    assert resp.status_code == 200
    assert resp.json()["email"] == "session_cookie@test.com"


@pytest.mark.asyncio
async def test_me_invalid_cookie(client: AsyncClient):
    """A malformed cookie token must be rejected with 401."""
    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Cookie": "access_token=not-a-valid-jwt"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_bearer_takes_priority_over_cookie(client: AsyncClient):
    """When both Bearer header and cookie are present, Bearer wins."""
    token_a = await get_token(client, "prio_a@test.com")
    token_b = await get_token(client, "prio_b@test.com")

    # Send valid bearer for prio_a, valid cookie for prio_b — bearer must win
    resp = await client.get(
        "/api/v1/auth/me",
        headers={**bearer(token_a), **cookie(token_b)},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "prio_a@test.com"


# ─── Logout ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_logout_returns_ok(client: AsyncClient):
    token = await get_token(client, "session_logout@test.com")
    resp = await client.post("/api/v1/auth/logout", headers=bearer(token))
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


# ─── Progress via cookie ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_progress_put_via_cookie(client: AsyncClient):
    """PUT progress with cookie auth should create progress and return 200."""
    token = await get_token(client, "cookie_prog_put@test.com")
    body = {
        "content_id": "vid-cookie-1",
        "content_type": "video",
        "progress_seconds": 200,
        "duration_seconds": 1000,
    }
    resp = await client.put(
        "/api/v1/learning/progress/video/vid-cookie-1",
        json=body,
        headers=cookie(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["progress_seconds"] == 200
    assert abs(data["progress_percent"] - 20.0) < 0.01
    assert data["completed"] is False


@pytest.mark.asyncio
async def test_progress_get_via_cookie(client: AsyncClient):
    """GET progress with cookie auth returns the saved record."""
    token = await get_token(client, "cookie_prog_get@test.com")
    body = {
        "content_id": "vid-cookie-2",
        "content_type": "video",
        "progress_seconds": 960,
        "duration_seconds": 1000,
    }
    # Create via bearer
    await client.put(
        "/api/v1/learning/progress/video/vid-cookie-2",
        json=body,
        headers=bearer(token),
    )
    # Read via cookie header
    resp = await client.get(
        "/api/v1/learning/progress/video/vid-cookie-2",
        headers=cookie(token),
    )
    assert resp.status_code == 200
    assert resp.json()["completed"] is True  # 96% >= 95%


@pytest.mark.asyncio
async def test_progress_unauthenticated_cookie_rejected(client: AsyncClient):
    """No cookie and no bearer → 401 on progress endpoint."""
    resp = await client.get("/api/v1/learning/progress/video/vid-noauth")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_progress_invalid_cookie_rejected(client: AsyncClient):
    """Garbage cookie value → 401 on progress endpoint."""
    resp = await client.put(
        "/api/v1/learning/progress/video/vid-badcookie",
        json={"content_id": "vid-badcookie", "content_type": "video", "progress_seconds": 1},
        headers={"Cookie": "access_token=garbage-token"},
    )
    assert resp.status_code == 401

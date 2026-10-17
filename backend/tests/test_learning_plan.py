import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone

async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    return resp.json()["access_token"], me_resp.json()["id"]

def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_create_learning_plan_success(client: AsyncClient, db_session: AsyncSession):
    token, user_id = await register_and_login(client, "plan_success@example.com")
    future_date = (datetime.now(timezone.utc) + timedelta(days=10)).date().isoformat()
    payload = {
        "content_id": "test_vid_123",
        "content_type": "video",
        "title": "Test Video",
        "total_duration_seconds": 3600,
        "target_completion_date": future_date
    }
    
    response = await client.post("/api/v1/learning/plans", json=payload, headers=auth(token))
    assert response.status_code == 201
    data = response.json()
    assert data["content_id"] == "test_vid_123"
    assert "id" in data
    assert data["user_id"] == user_id
    assert data["daily_target_seconds"] > 0

@pytest.mark.asyncio
async def test_create_learning_plan_duplicate(client: AsyncClient, db_session: AsyncSession):
    token, user_id = await register_and_login(client, "dup@ex.com")
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).date().isoformat()
    payload = {
        "content_id": "duplicate_vid",
        "content_type": "video",
        "title": "Dup Video",
        "total_duration_seconds": 3600,
        "target_completion_date": future_date
    }
    
    res1 = await client.post("/api/v1/learning/plans", json=payload, headers=auth(token))
    assert res1.status_code == 201
    
    res2 = await client.post("/api/v1/learning/plans", json=payload, headers=auth(token))
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]

@pytest.mark.asyncio
async def test_create_learning_plan_past_date(client: AsyncClient, db_session: AsyncSession):
    token, user_id = await register_and_login(client, "past@ex.com")
    past_date = (datetime.now(timezone.utc) - timedelta(days=5)).date().isoformat()
    payload = {
        "content_id": "past_vid",
        "content_type": "video",
        "title": "Past Video",
        "total_duration_seconds": 3600,
        "target_completion_date": past_date
    }
    
    res = await client.post("/api/v1/learning/plans", json=payload, headers=auth(token))
    assert res.status_code == 400
    assert "past" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_learning_plans(client: AsyncClient, db_session: AsyncSession):
    token, user_id = await register_and_login(client, "get@ex.com")
    future_date = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()
    await client.post("/api/v1/learning/plans", json={
        "content_id": "list_vid",
        "content_type": "video",
        "title": "List Video",
        "total_duration_seconds": 3600,
        "target_completion_date": future_date
    }, headers=auth(token))
    
    res = await client.get("/api/v1/learning/plans", headers=auth(token))
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["user_id"] == user_id

@pytest.mark.asyncio
async def test_delete_learning_plan(client: AsyncClient, db_session: AsyncSession):
    token, user_id = await register_and_login(client, "del@ex.com")
    future_date = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()
    create_res = await client.post("/api/v1/learning/plans", json={
        "content_id": "delete_vid",
        "content_type": "video",
        "title": "Delete Video",
        "total_duration_seconds": 3600,
        "target_completion_date": future_date
    }, headers=auth(token))
    
    plan_id = create_res.json()["id"]
    
    del_res = await client.delete(f"/api/v1/learning/plans/{plan_id}", headers=auth(token))
    assert del_res.status_code == 204
    
    get_res = await client.get(f"/api/v1/learning/plans/{plan_id}", headers=auth(token))
    assert get_res.status_code == 404

@pytest.mark.asyncio
async def test_user_ownership_isolation(client: AsyncClient, db_session: AsyncSession):
    token_a, user_a = await register_and_login(client, "user_a@ex.com")
    token_b, user_b = await register_and_login(client, "user_b@ex.com")
    
    # User A creates plan
    future_date = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()
    create_res = await client.post("/api/v1/learning/plans", json={
        "content_id": "iso_vid",
        "content_type": "video",
        "title": "ISO Video",
        "total_duration_seconds": 3600,
        "target_completion_date": future_date
    }, headers=auth(token_a))
    
    plan_id = create_res.json()["id"]
    
    # User B tries to get plan -> 404
    get_b_res = await client.get(f"/api/v1/learning/plans/{plan_id}", headers=auth(token_b))
    assert get_b_res.status_code == 404
    
    # User B tries to delete plan -> 404
    del_b_res = await client.delete(f"/api/v1/learning/plans/{plan_id}", headers=auth(token_b))
    assert del_b_res.status_code == 404


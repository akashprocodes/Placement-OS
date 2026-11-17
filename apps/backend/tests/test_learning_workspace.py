import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from app.models.learning_plan import LearningPlan
from app.models.learning_progress import LearningProgress

async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    return resp.json()["access_token"], me_resp.json()["id"]

def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_workspace_unauthenticated(client: AsyncClient):
    res = await client.get("/api/v1/learning/workspace")
    assert res.status_code == 401

@pytest.mark.asyncio
async def test_workspace_zero_plans(client: AsyncClient):
    token, _ = await register_and_login(client, "zero@plans.com")
    res = await client.get("/api/v1/learning/workspace", headers=auth(token))
    assert res.status_code == 200
    data = res.json()
    assert data["active_plans"] == []
    assert data["completed_plans"] == []

@pytest.mark.asyncio
async def test_workspace_active_and_completed_plans(client: AsyncClient, db_session: AsyncSession):
    # Register two users to test isolation
    token1, u1_id = await register_and_login(client, "user1@workspace.com")
    token2, u2_id = await register_and_login(client, "user2@workspace.com")
    
    future_date = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()
    
    # Create active plan for user 1
    await client.post("/api/v1/learning/plans", json={
        "content_id": "active_vid",
        "content_type": "video",
        "title": "Active Video",
        "total_duration_seconds": 3600,
        "target_completion_date": future_date
    }, headers=auth(token1))
    
    # Create plan to be completed for user 1
    res2 = await client.post("/api/v1/learning/plans", json={
        "content_id": "completed_vid",
        "content_type": "video",
        "title": "Completed Video",
        "total_duration_seconds": 1000,
        "target_completion_date": future_date
    }, headers=auth(token1))
    plan2_id = res2.json()["id"]
    
    # Manually insert progress to complete plan 2
    prog = LearningProgress(
        user_id=u1_id,
        content_id="completed_vid",
        content_type="video",
        progress_seconds=950, # >= 95%
        duration_seconds=1000,
        completed=True
    )
    db_session.add(prog)
    await db_session.commit()
    
    # Create a plan for user 2 to test isolation
    await client.post("/api/v1/learning/plans", json={
        "content_id": "u2_vid",
        "content_type": "video",
        "title": "U2 Video",
        "total_duration_seconds": 3600,
        "target_completion_date": future_date
    }, headers=auth(token2))
    
    # Fetch workspace for user 1
    res = await client.get("/api/v1/learning/workspace", headers=auth(token1))
    assert res.status_code == 200
    data = res.json()
    
    assert len(data["active_plans"]) == 1
    assert data["active_plans"][0]["plan"]["content_id"] == "active_vid"
    assert "progress" in data["active_plans"][0]
    assert data["active_plans"][0]["progress"]["required_seconds_today"] >= 0
    
    assert len(data["completed_plans"]) == 1
    assert data["completed_plans"][0]["content_id"] == "completed_vid"
    assert data["completed_plans"][0]["status"] == "completed"
    assert data["completed_plans"][0]["completed_at"] is not None
    
    # Test Isolation: user 2
    res_u2 = await client.get("/api/v1/learning/workspace", headers=auth(token2))
    data_u2 = res_u2.json()
    assert len(data_u2["active_plans"]) == 1
    assert data_u2["active_plans"][0]["plan"]["content_id"] == "u2_vid"
    assert len(data_u2["completed_plans"]) == 0

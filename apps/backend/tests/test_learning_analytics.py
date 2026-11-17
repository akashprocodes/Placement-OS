import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta, date
from app.models.learning_plan import LearningPlan
from app.models.learning_progress import LearningProgress
from app.models.learning_daily_activity import LearningDailyActivity

async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    return resp.json()["access_token"], me_resp.json()["id"]

def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_analytics_unauthenticated(client: AsyncClient):
    res = await client.get("/api/v1/learning/analytics/dashboard")
    assert res.status_code == 401

@pytest.mark.asyncio
async def test_analytics_zero_activity_but_has_plan(client: AsyncClient):
    token, _ = await register_and_login(client, "zero@analytics.com")
    # Add a plan but no watch time
    future = (datetime.now(timezone.utc) + timedelta(days=10)).date().isoformat()
    await client.post("/api/v1/learning/plans", json={
        "content_id": "vid0",
        "content_type": "video",
        "title": "Vid 0 Plan",
        "total_duration_seconds": 3600,
        "target_completion_date": future
    }, headers=auth(token))
    
    res = await client.get("/api/v1/learning/analytics/dashboard", headers=auth(token))
    assert res.status_code == 200
    data = res.json()
    assert data["summary"]["total_watched_seconds"] == 0
    assert data["summary"]["active_plans_count"] == 1
    assert data["summary"]["completed_plans_count"] == 0

@pytest.mark.asyncio
async def test_analytics_invalid_range(client: AsyncClient):
    token, _ = await register_and_login(client, "invalid@analytics.com")
    today = datetime.now(timezone.utc).date()
    # start > end
    res = await client.get(f"/api/v1/learning/analytics/dashboard?start_date={today.isoformat()}&end_date={(today - timedelta(days=1)).isoformat()}", headers=auth(token))
    assert res.status_code == 400

@pytest.mark.asyncio
async def test_analytics_aggregation_respects_range(client: AsyncClient, db_session: AsyncSession):
    token, u_id = await register_and_login(client, "agg_range@analytics.com")
    
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)
    ten_days_ago = today - timedelta(days=10) # Outside the 7-day range we will query
    
    # 10 days ago (should be excluded)
    act1 = LearningDailyActivity(
        user_id=u_id, content_id="vid1", content_type="video",
        activity_date=ten_days_ago, watched_content_seconds=1000
    )
    # Yesterday (included)
    act2 = LearningDailyActivity(
        user_id=u_id, content_id="vid1", content_type="video",
        activity_date=yesterday, watched_content_seconds=2000
    )
    db_session.add_all([act1, act2])
    await db_session.commit()
    
    # Create plan to test plan performance range
    future = (today + timedelta(days=10)).isoformat()
    await client.post("/api/v1/learning/plans", json={
        "content_id": "vid1",
        "content_type": "video",
        "title": "Vid 1 Plan",
        "total_duration_seconds": 3600,
        "target_completion_date": future
    }, headers=auth(token))
    
    # Query last 7 days (including today)
    start_date = (today - timedelta(days=6)).isoformat()
    end_date = today.isoformat()
    res = await client.get(f"/api/v1/learning/analytics/dashboard?start_date={start_date}&end_date={end_date}", headers=auth(token))
    
    assert res.status_code == 200
    data = res.json()
    
    # Summary should only include 'yesterday'
    assert data["summary"]["total_watched_seconds"] == 2000
    assert data["summary"]["total_active_days"] == 1
    assert data["summary"]["active_plans_count"] == 1
    
    # Plan performance should only include 'yesterday' (2000, not 3000)
    assert len(data["plan_performance"]) == 1
    assert data["plan_performance"][0]["total_watched_seconds"] == 2000
    
    # Recent activity should exclude the one 10 days ago
    assert len(data["recent_activity"]) == 1
    assert data["recent_activity"][0]["watched_seconds"] == 2000
    # Should use the actual plan title
    assert data["recent_activity"][0]["title"] == "Vid 1 Plan"

@pytest.mark.asyncio
async def test_analytics_recent_activity_title_fallback(client: AsyncClient, db_session: AsyncSession):
    token, u_id = await register_and_login(client, "fallback@analytics.com")
    today = datetime.now(timezone.utc).date()
    
    # Add activity without a corresponding plan
    act1 = LearningDailyActivity(
        user_id=u_id, content_id="stand-alone-vid", content_type="video",
        activity_date=today, watched_content_seconds=500
    )
    db_session.add(act1)
    await db_session.commit()
    
    res = await client.get("/api/v1/learning/analytics/dashboard", headers=auth(token))
    assert res.status_code == 200
    data = res.json()
    
    assert len(data["recent_activity"]) == 1
    # Fallback title should be factual
    assert data["recent_activity"][0]["title"] == "Video • ID: stand-alone-vid"

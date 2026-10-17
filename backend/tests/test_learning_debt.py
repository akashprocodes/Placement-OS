import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timezone, timedelta, date

from app.models.learning_plan import LearningPlan
from app.models.learning_session import LearningSession
from app.models.learning_daily_activity import LearningDailyActivity

async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    return resp.json()["access_token"], me_resp.json()["id"]

def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_learning_debt_aggregation(client: AsyncClient, db_session: AsyncSession):
    token, user_id_str = await register_and_login(client, "debt1@test.com")
    user_id = uuid.UUID(user_id_str)
    
    # Create plan manually in DB to control created_at
    plan_id = uuid.uuid4()
    content_id = "debt_vid_1"
    
    today = datetime.now(timezone.utc).date()
    day_minus_2 = today - timedelta(days=2)
    day_minus_1 = today - timedelta(days=1)
    target_date = today + timedelta(days=3)
    
    plan = LearningPlan(
        id=plan_id,
        user_id=user_id,
        content_id=content_id,
        content_type="video",
        title="Test Plan",
        total_duration_seconds=36000, # 10h
        target_completion_date=target_date,
        daily_target_seconds=7200, # 2h/day
        status="active"
    )
    # Set created_at explicitly
    plan.created_at = datetime.combine(day_minus_2, datetime.min.time())
    db_session.add(plan)
    
    # Sessions:
    # Day -2: 0 hours completed (Debt = 7200)
    # Day -1: 3600 seconds completed (1 hour)
    # Target was 7200, carried debt 7200 = required 14400.
    # Deficit = 14400 - 3600 = 10800 (3 hours debt)
    
    activity1 = LearningDailyActivity(
        user_id=user_id,
        content_id=content_id,
        content_type="video",
        watched_content_seconds=3600,
        activity_date=day_minus_1
    )
    activity1.created_at = datetime.combine(day_minus_1, datetime.min.time())
    
    db_session.add(activity1)
    await db_session.commit()
    
    res = await client.get(f"/api/v1/learning/plans/{plan_id}/progress", headers=auth(token))
    assert res.status_code == 200
    data = res.json()
    
    assert data["daily_target_seconds"] == 7200
    assert data["previous_debt_seconds"] == 10800 # 3h
    assert data["required_seconds_today"] == 18000 # 2h base + 3h debt = 5h
    assert data["completed_seconds_today"] == 0
    assert data["remaining_seconds_today"] == 18000
    assert data["current_debt_seconds"] == 18000
    
    # Now simulate adding a session today
    activity2 = LearningDailyActivity(
        user_id=user_id,
        content_id=content_id,
        content_type="video",
        watched_content_seconds=7200,
        activity_date=today
    )
    db_session.add(activity2)
    await db_session.commit()
    
    res2 = await client.get(f"/api/v1/learning/plans/{plan_id}/progress", headers=auth(token))
    data2 = res2.json()
    
    assert data2["previous_debt_seconds"] == 10800
    assert data2["required_seconds_today"] == 18000
    assert data2["completed_seconds_today"] == 7200
    assert data2["remaining_seconds_today"] == 10800
    
@pytest.mark.asyncio
async def test_learning_debt_isolation(client: AsyncClient, db_session: AsyncSession):
    token1, user1 = await register_and_login(client, "debt_iso1@test.com")
    token2, user2 = await register_and_login(client, "debt_iso2@test.com")
    
    plan_id = uuid.uuid4()
    plan = LearningPlan(
        id=plan_id,
        user_id=uuid.UUID(user1),
        content_id="iso_vid",
        content_type="video",
        title="Iso Plan",
        total_duration_seconds=3600,
        target_completion_date=datetime.now(timezone.utc).date() + timedelta(days=1),
        daily_target_seconds=1800,
        status="active"
    )
    db_session.add(plan)
    await db_session.commit()
    
    # User 2 tries to read
    res = await client.get(f"/api/v1/learning/plans/{plan_id}/progress", headers=auth(token2))
    assert res.status_code == 403
    
    # User 1 reads successfully
    res1 = await client.get(f"/api/v1/learning/plans/{plan_id}/progress", headers=auth(token1))
    assert res1.status_code == 200
    
@pytest.mark.asyncio
async def test_learning_debt_different_content(client: AsyncClient, db_session: AsyncSession):
    token, user_id_str = await register_and_login(client, "debt_diff@test.com")
    user_id = uuid.UUID(user_id_str)
    
    plan_id = uuid.uuid4()
    today = datetime.now(timezone.utc).date()
    
    plan = LearningPlan(
        id=plan_id,
        user_id=user_id,
        content_id="vid_A",
        content_type="video",
        title="Plan A",
        total_duration_seconds=3600,
        target_completion_date=today + timedelta(days=1),
        daily_target_seconds=1800,
        status="active"
    )
    plan.created_at = datetime.combine(today, datetime.min.time())
    db_session.add(plan)
    
    # Watch vid_B
    activity = LearningDailyActivity(
        user_id=user_id,
        content_id="vid_B",
        content_type="video",
        watched_content_seconds=1800,
        activity_date=today
    )
    db_session.add(activity)
    await db_session.commit()
    
    res = await client.get(f"/api/v1/learning/plans/{plan_id}/progress", headers=auth(token))
    data = res.json()
    assert data["completed_seconds_today"] == 0 # vid_B shouldn't count towards vid_A

@pytest.mark.asyncio
async def test_learning_debt_over_completion(client: AsyncClient, db_session: AsyncSession):
    token, user_id_str = await register_and_login(client, "debt_over@test.com")
    user_id = uuid.UUID(user_id_str)
    
    plan_id = uuid.uuid4()
    today = datetime.now(timezone.utc).date()
    day_minus_1 = today - timedelta(days=1)
    
    plan = LearningPlan(
        id=plan_id,
        user_id=user_id,
        content_id="vid_over",
        content_type="video",
        title="Plan Over",
        total_duration_seconds=7200,
        target_completion_date=today + timedelta(days=1),
        daily_target_seconds=3600,
        status="active"
    )
    plan.created_at = datetime.combine(day_minus_1, datetime.min.time())
    db_session.add(plan)
    
    # Yesterday watched 5000s (Target 3600, so exceeded by 1400)
    activity = LearningDailyActivity(
        user_id=user_id,
        content_id="vid_over",
        content_type="video",
        watched_content_seconds=5000,
        activity_date=day_minus_1
    )
    db_session.add(activity)
    await db_session.commit()
    
    res = await client.get(f"/api/v1/learning/plans/{plan_id}/progress", headers=auth(token))
    data = res.json()
    
    # Over-completion doesn't create negative debt! So previous debt should be 0.
    assert data["previous_debt_seconds"] == 0
    assert data["required_seconds_today"] == 3600


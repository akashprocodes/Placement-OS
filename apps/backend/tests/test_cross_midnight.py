import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from unittest.mock import patch

from app.models.learning_daily_activity import LearningDailyActivity

async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    return resp.json()["access_token"], me_resp.json()["id"]

def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_cross_midnight_splitting(client: AsyncClient, db_session: AsyncSession):
    token, user_id = await register_and_login(client, "midnight@test.com")
    
    # Target midnight: 2026-01-02 00:00:00
    mock_now = datetime(2026, 1, 2, 0, 0, 5, tzinfo=timezone.utc)
    
    # Client event is at 2026-01-02 00:00:10.
    # wall_clock is 20s. So interval_start = 2026-01-01 23:59:50.
    client_event_at = datetime(2026, 1, 2, 0, 0, 10, tzinfo=timezone.utc)
    
    payload = {
        "session_id": str(uuid.uuid4()),
        "content_id": "midnight_vid",
        "content_type": "video",
        "sequence": 1,
        "position_seconds": 20,
        "playback_rate": 1.0,
        "played_content_seconds": 20,
        "wall_clock_seconds": 20,
        "status": "active",
        "client_event_at": client_event_at.isoformat()
    }
    
    # We patch datetime in learning_session_service
    with patch("app.services.learning_session_service.datetime") as mock_dt:
        mock_dt.now.return_value = mock_now
        mock_dt.combine.side_effect = datetime.combine
        mock_dt.min = datetime.min
        
        res = await client.post("/api/v1/learning/sessions/heartbeat", json=payload, headers=auth(token))
        assert res.status_code == 200, res.text

    # Verify DB splits
    stmt = select(LearningDailyActivity).where(LearningDailyActivity.user_id == uuid.UUID(user_id))
    result = await db_session.execute(stmt)
    activities = result.scalars().all()
    
    assert len(activities) == 2
    
    # Sort by date
    activities.sort(key=lambda a: a.activity_date)
    
    assert activities[0].activity_date.isoformat() == "2026-01-01"
    assert activities[0].watched_content_seconds == 10
    
    assert activities[1].activity_date.isoformat() == "2026-01-02"
    assert activities[1].watched_content_seconds == 10

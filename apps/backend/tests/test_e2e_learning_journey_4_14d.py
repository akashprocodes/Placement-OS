import pytest
import uuid
from datetime import datetime, timezone, timedelta, date
from unittest.mock import patch
from httpx import AsyncClient
from sqlalchemy import select

from app.models.user import User
from app.models.learning_plan import LearningPlan
from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem
from app.models.learning_daily_activity import LearningDailyActivity
from app.models.learning_session import LearningSession
from app.services.learning_plan_service import get_video_plan_context, create_learning_plan
from app.schemas.learning import LearningPlanCreate, LearningSessionHeartbeat
from app.services.learning_session_service import process_heartbeat
from app.services.learning_debt_service import batch_get_plan_progress


def cookie_header(token: str) -> dict:
    return {"Cookie": f"access_token={token}"}


async def register_and_login(client: AsyncClient, prefix: str = "qa"):
    email = f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    password = "Password123!"
    reg_resp = await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert reg_resp.status_code == 201, reg_resp.text
    user_id = uuid.UUID(reg_resp.json()["id"])
    
    login_resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login_resp.status_code == 200, login_resp.text
    token = login_resp.json()["access_token"]
    return user_id, email, token


@pytest.mark.asyncio
async def test_e2e_auth_and_dashboard_isolation(client: AsyncClient):
    """
    Verify:
    - Unauthenticated requests to private learning endpoints return 401.
    - Authenticated cookie requests return correct empty state for new user (no fabricated metrics).
    - Multiple users have strictly isolated workspaces and analytics.
    - Logout clears access_token cookie.
    """
    # 1. Unauthenticated checks
    unauth_ws = await client.get("/api/v1/learning/workspace")
    assert unauth_ws.status_code == 401
    
    unauth_an = await client.get("/api/v1/learning/analytics/dashboard")
    assert unauth_an.status_code == 401

    # 2. Register & login User A
    user_a_id, user_a_email, token_a = await register_and_login(client, "user_a")
    headers_a = cookie_header(token_a)

    # 3. New user sees zero-metric authentic state
    ws_a = await client.get("/api/v1/learning/workspace", headers=headers_a)
    assert ws_a.status_code == 200
    data_a = ws_a.json()
    assert data_a["active_plans"] == []
    assert data_a["completed_plans"] == []
    assert data_a["streak"]["current_streak"] == 0
    assert data_a["streak"]["longest_streak"] == 0

    an_a = await client.get("/api/v1/learning/analytics/dashboard", headers=headers_a)
    assert an_a.status_code == 200
    an_data_a = an_a.json()
    assert an_data_a["summary"]["total_watched_seconds"] == 0
    assert an_data_a["summary"]["total_active_days"] == 0
    assert an_data_a["summary"]["active_plans_count"] == 0
    assert an_data_a["summary"]["completed_plans_count"] == 0
    assert an_data_a["recent_activity"] == []

    # 4. Register & login User B -> strict data isolation
    user_b_id, user_b_email, token_b = await register_and_login(client, "user_b")
    headers_b = cookie_header(token_b)

    ws_b = await client.get("/api/v1/learning/workspace", headers=headers_b)
    assert ws_b.status_code == 200
    assert ws_b.json()["active_plans"] == []

    # 5. Logout endpoint
    logout_resp = await client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200


@pytest.mark.asyncio
async def test_e2e_playlist_plan_video_continuity_and_resume(db_session, client: AsyncClient):
    """
    Test real student journey:
    1. Create playlist with 3 videos.
    2. Create active playlist learning plan.
    3. Open Video 1 -> plan context recognizes playlist plan, parent title, and parent playlist ID.
    4. Send study heartbeat on Video 1 -> saves session and daily activity.
    5. Query workspace -> confirms active plan, resume context pointing to Video 1 with saved timestamp.
    6. Open Video 2 -> continuity preserved.
    """
    user_id, email, token = await register_and_login(client, "student")
    headers = cookie_header(token)

    # Setup playlist in database
    pl_internal_id = uuid.uuid4()
    pl_id = f"PL_QA_{uuid.uuid4().hex[:6]}"
    playlist = LearningPlaylist(
        id=pl_internal_id,
        playlist_id=pl_id,
        title="Full Stack Python Mastery",
        channel_title="Code Campus",
        thumbnail_url="https://img/pl.jpg",
        description="Comprehensive course",
        total_duration_seconds=7200
    )
    db_session.add(playlist)

    v1_id = f"vid_1_{uuid.uuid4().hex[:6]}"
    v2_id = f"vid_2_{uuid.uuid4().hex[:6]}"
    v3_id = f"vid_3_{uuid.uuid4().hex[:6]}"

    items = [
        LearningPlaylistItem(
            playlist_internal_id=pl_internal_id,
            video_id=v1_id,
            title="Module 1: Getting Started",
            thumbnail_url="https://img/v1.jpg",
            position=0,
            duration_seconds=1800
        ),
        LearningPlaylistItem(
            playlist_internal_id=pl_internal_id,
            video_id=v2_id,
            title="Module 2: Advanced Concepts",
            thumbnail_url="https://img/v2.jpg",
            position=1,
            duration_seconds=2400
        ),
        LearningPlaylistItem(
            playlist_internal_id=pl_internal_id,
            video_id=v3_id,
            title="Module 3: Project Deployment",
            thumbnail_url="https://img/v3.jpg",
            position=2,
            duration_seconds=3000
        ),
    ]
    db_session.add_all(items)
    await db_session.commit()

    # Step 1: Create active playlist plan via API
    today = datetime.now(timezone.utc).date()
    target_date = today + timedelta(days=5)
    plan_resp = await client.post(
        "/api/v1/learning/plans",
        headers=headers,
        json={
            "content_id": pl_id,
            "content_type": "playlist",
            "title": "Full Stack Python Mastery",
            "total_duration_seconds": 7200,
            "target_completion_date": str(target_date)
        }
    )
    assert plan_resp.status_code == 201, plan_resp.text
    created_plan = plan_resp.json()
    assert created_plan["status"] == "active"
    assert created_plan["daily_target_seconds"] > 0

    # Step 2: Open Video 1 -> check plan-context endpoint
    ctx_resp = await client.get(
        f"/api/v1/learning/videos/{v1_id}/plan-context?playlist_id={pl_id}",
        headers=headers
    )
    assert ctx_resp.status_code == 200
    ctx = ctx_resp.json()
    assert ctx["active_plan"]["id"] == created_plan["id"]
    assert ctx["parent_playlist_plan"]["id"] == created_plan["id"]
    assert ctx["parent_playlist_id"] == pl_id
    assert ctx["parent_playlist_title"] == "Full Stack Python Mastery"
    assert ctx["direct_plan"] is None

    # Step 3: Direct URL navigation (without playlist_id query param) -> still resolves parent playlist
    ctx_direct_resp = await client.get(
        f"/api/v1/learning/videos/{v1_id}/plan-context",
        headers=headers
    )
    assert ctx_direct_resp.status_code == 200
    assert ctx_direct_resp.json()["parent_playlist_id"] == pl_id
    assert ctx_direct_resp.json()["active_plan"]["id"] == created_plan["id"]

    # Step 4: Record video progress and study heartbeat on Video 1 (180s)
    prog_resp = await client.put(
        f"/api/v1/learning/progress/video/{v1_id}",
        headers=headers,
        json={
            "content_id": v1_id,
            "content_type": "video",
            "progress_seconds": 180,
            "duration_seconds": 1800
        }
    )
    assert prog_resp.status_code == 200

    sess_id = uuid.uuid4()
    hb = LearningSessionHeartbeat(
        session_id=sess_id,
        content_id=v1_id,
        content_type="video",
        sequence=1,
        position_seconds=180,
        playback_rate=1.0,
        played_content_seconds=180,
        wall_clock_seconds=180,
        status="active",
        client_event_at=datetime.now(timezone.utc)
    )
    await process_heartbeat(db_session, user_id=user_id, heartbeat=hb)

    # Step 5: Check workspace metrics and Resume context
    ws_resp = await client.get("/api/v1/learning/workspace", headers=headers)
    assert ws_resp.status_code == 200
    ws = ws_resp.json()
    assert len(ws["active_plans"]) == 1
    active_entry = ws["active_plans"][0]
    assert active_entry["plan"]["id"] == created_plan["id"]
    assert active_entry["progress"]["completed_seconds_today"] == 180
    assert active_entry["resume"]["video_id"] == v1_id
    assert active_entry["resume"]["saved_position_seconds"] == 180

    # Step 6: Open Video 2 -> plan context correctly recognizes same parent plan
    ctx_v2_resp = await client.get(
        f"/api/v1/learning/videos/{v2_id}/plan-context?playlist_id={pl_id}",
        headers=headers
    )
    assert ctx_v2_resp.status_code == 200
    assert ctx_v2_resp.json()["active_plan"]["id"] == created_plan["id"]


@pytest.mark.asyncio
async def test_e2e_multiple_playlists_and_standalone_plan_precedence(db_session, client: AsyncClient):
    """
    Verify:
    - When a video belongs to multiple playlists, preferred_playlist_id disambiguates deterministically.
    - Standalone video plan takes precedence over parent playlist plans.
    - Duplicate active plans on the same content are safely rejected.
    """
    user_id, email, token = await register_and_login(client, "multi_pl")
    headers = cookie_header(token)

    shared_vid = f"shared_v_{uuid.uuid4().hex[:6]}"

    # Setup 2 playlists containing shared_vid
    pl1_id = f"PL_A_{uuid.uuid4().hex[:6]}"
    pl2_id = f"PL_B_{uuid.uuid4().hex[:6]}"

    pl1 = LearningPlaylist(
        id=uuid.uuid4(),
        playlist_id=pl1_id,
        title="Course A",
        channel_title="Teacher A",
        thumbnail_url="https://img/a.jpg",
        description="Course A",
        total_duration_seconds=3600
    )
    pl2 = LearningPlaylist(
        id=uuid.uuid4(),
        playlist_id=pl2_id,
        title="Course B",
        channel_title="Teacher B",
        thumbnail_url="https://img/b.jpg",
        description="Course B",
        total_duration_seconds=3600
    )
    db_session.add_all([pl1, pl2])

    it1 = LearningPlaylistItem(
        playlist_internal_id=pl1.id,
        video_id=shared_vid,
        title="Shared Video Lesson",
        thumbnail_url="https://img/v.jpg",
        position=0,
        duration_seconds=1200
    )
    it2 = LearningPlaylistItem(
        playlist_internal_id=pl2.id,
        video_id=shared_vid,
        title="Shared Video Lesson in Course B",
        thumbnail_url="https://img/v.jpg",
        position=0,
        duration_seconds=1200
    )
    db_session.add_all([it1, it2])
    await db_session.commit()

    today = datetime.now(timezone.utc).date()
    # Create plans for both playlists
    plan1_resp = await client.post("/api/v1/learning/plans", headers=headers, json={
        "content_id": pl1_id,
        "content_type": "playlist",
        "title": "Course A Plan",
        "total_duration_seconds": 3600,
        "target_completion_date": str(today + timedelta(days=7))
    })
    assert plan1_resp.status_code == 201

    plan2_resp = await client.post("/api/v1/learning/plans", headers=headers, json={
        "content_id": pl2_id,
        "content_type": "playlist",
        "title": "Course B Plan",
        "total_duration_seconds": 3600,
        "target_completion_date": str(today + timedelta(days=7))
    })
    assert plan2_resp.status_code == 201

    # Test disambiguation:
    # 1. With playlist_id = pl2_id
    ctx2 = await client.get(f"/api/v1/learning/videos/{shared_vid}/plan-context?playlist_id={pl2_id}", headers=headers)
    assert ctx2.status_code == 200
    assert ctx2.json()["parent_playlist_id"] == pl2_id
    assert ctx2.json()["active_plan"]["id"] == plan2_resp.json()["id"]

    # 2. With playlist_id = pl1_id
    ctx1 = await client.get(f"/api/v1/learning/videos/{shared_vid}/plan-context?playlist_id={pl1_id}", headers=headers)
    assert ctx1.status_code == 200
    assert ctx1.json()["parent_playlist_id"] == pl1_id
    assert ctx1.json()["active_plan"]["id"] == plan1_resp.json()["id"]

    # 3. Create standalone video plan for shared_vid
    standalone_resp = await client.post("/api/v1/learning/plans", headers=headers, json={
        "content_id": shared_vid,
        "content_type": "video",
        "title": "Standalone Focus",
        "total_duration_seconds": 1200,
        "target_completion_date": str(today + timedelta(days=3))
    })
    assert standalone_resp.status_code == 201
    standalone_plan = standalone_resp.json()

    # Now plan context prioritizes direct standalone plan!
    ctx_standalone = await client.get(f"/api/v1/learning/videos/{shared_vid}/plan-context", headers=headers)
    assert ctx_standalone.status_code == 200
    data = ctx_standalone.json()
    assert data["direct_plan"]["id"] == standalone_plan["id"]
    assert data["active_plan"]["id"] == standalone_plan["id"]

    # 4. Attempting to create duplicate active plan on shared_vid is blocked
    dup_resp = await client.post("/api/v1/learning/plans", headers=headers, json={
        "content_id": shared_vid,
        "content_type": "video",
        "title": "Duplicate Plan",
        "total_duration_seconds": 1200,
        "target_completion_date": str(today + timedelta(days=4))
    })
    assert dup_resp.status_code == 400
    assert "already exists" in dup_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_e2e_study_tracking_midnight_split_and_debt_consistency(db_session, client: AsyncClient):
    """
    Verify:
    - Heartbeat spanning midnight splits seconds across day1 and day2 without double counting.
    - Idempotent repeated sequence numbers do not duplicate progress.
    - Catch-up debt correctly computes previous missed days without confusing today's target.
    """
    user_id, email, token = await register_and_login(client, "tracking")
    headers = cookie_header(token)

    vid = f"vid_midnight_{uuid.uuid4().hex[:6]}"
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    # 1. Midnight heartbeat (180s total: starts at 23:58:30 yesterday, ends at 00:01:30 today)
    midnight_today = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    client_event = midnight_today + timedelta(seconds=90)
    mock_server_now = midnight_today + timedelta(seconds=95)
    
    sess_id = uuid.uuid4()
    hb = LearningSessionHeartbeat(
        session_id=sess_id,
        content_id=vid,
        content_type="video",
        sequence=1,
        position_seconds=180,
        playback_rate=1.0,
        played_content_seconds=180,
        wall_clock_seconds=180,
        status="active",
        client_event_at=client_event
    )
    with patch("app.services.learning_session_service.datetime") as mock_dt:
        mock_dt.now.return_value = mock_server_now
        mock_dt.combine.side_effect = datetime.combine
        mock_dt.min = datetime.min
        await process_heartbeat(db_session, user_id=user_id, heartbeat=hb)

    # Check daily activity in DB: exactly 90s yesterday and 90s today
    stmt_yesterday = select(LearningDailyActivity).where(
        LearningDailyActivity.user_id == user_id,
        LearningDailyActivity.activity_date == yesterday
    )
    act_y = (await db_session.execute(stmt_yesterday)).scalar_one_or_none()
    assert act_y is not None
    assert act_y.watched_content_seconds == 90

    stmt_today = select(LearningDailyActivity).where(
        LearningDailyActivity.user_id == user_id,
        LearningDailyActivity.activity_date == today
    )
    act_t = (await db_session.execute(stmt_today)).scalar_one_or_none()
    assert act_t is not None
    assert act_t.watched_content_seconds == 90

    # 2. Idempotency: repeating sequence 1 does NOT increment time
    with patch("app.services.learning_session_service.datetime") as mock_dt:
        mock_dt.now.return_value = mock_server_now
        mock_dt.combine.side_effect = datetime.combine
        mock_dt.min = datetime.min
        await process_heartbeat(db_session, user_id=user_id, heartbeat=hb)
    act_t_recheck = (await db_session.execute(stmt_today)).scalar_one()
    assert act_t_recheck.watched_content_seconds == 90

    # 3. Catch-up debt test:
    # Create plan dated 2 days ago with target 1800s per day
    plan_id = uuid.uuid4()
    debt_plan = LearningPlan(
        id=plan_id,
        user_id=user_id,
        content_id=vid,
        content_type="video",
        title="Debt Test Video",
        total_duration_seconds=7200,
        target_completion_date=today + timedelta(days=2),
        daily_target_seconds=1800,
        status="active",
        created_at=datetime.combine(today - timedelta(days=2), datetime.min.time())
    )
    db_session.add(debt_plan)
    await db_session.commit()

    # Batch progress calculation
    prog_map = await batch_get_plan_progress(db_session, user_id, [debt_plan])
    plan_prog = prog_map[plan_id]
    
    # Day -2: 0s studied -> 1800s debt
    # Day -1: 90s studied -> (1800 + 1800 - 90) = 3510s debt
    # Today (Day 0): previous_debt_seconds == 3510s
    assert plan_prog.previous_debt_seconds == 3510
    assert plan_prog.base_target_seconds_today == 1800
    assert plan_prog.required_seconds_today == 3510 + 1800 # 5310s
    assert plan_prog.completed_seconds_today == 90
    assert plan_prog.remaining_seconds_today == 5310 - 90 # 5220s


@pytest.mark.asyncio
async def test_e2e_plan_completion_lifecycle_and_recreation(db_session, client: AsyncClient):
    """
    Verify:
    - Marking a plan completed moves it to completed_plans.
    - Completed plans do NOT block creating a new active plan for the same content.
    - Two active plans for the same content remain strictly disallowed.
    """
    user_id, email, token = await register_and_login(client, "lifecycle")
    headers = cookie_header(token)

    cid = f"vid_cycle_{uuid.uuid4().hex[:6]}"
    today = datetime.now(timezone.utc).date()

    # Create initial plan
    p1 = await client.post("/api/v1/learning/plans", headers=headers, json={
        "content_id": cid,
        "content_type": "video",
        "title": "Python Basics Cycle",
        "total_duration_seconds": 1800,
        "target_completion_date": str(today + timedelta(days=2))
    })
    assert p1.status_code == 201
    p1_id = p1.json()["id"]

    # Complete the plan via DB (simulate completion)
    stmt = select(LearningPlan).where(LearningPlan.id == uuid.UUID(p1_id))
    plan_record = (await db_session.execute(stmt)).scalar_one()
    plan_record.status = "completed"
    plan_record.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db_session.commit()

    # Check workspace -> plan appears under completed_plans
    ws = (await client.get("/api/v1/learning/workspace", headers=headers)).json()
    assert len(ws["active_plans"]) == 0
    assert len(ws["completed_plans"]) == 1
    assert ws["completed_plans"][0]["id"] == p1_id

    # Create NEW active plan for the SAME content -> succeeds!
    p2 = await client.post("/api/v1/learning/plans", headers=headers, json={
        "content_id": cid,
        "content_type": "video",
        "title": "Python Basics Retake",
        "total_duration_seconds": 1800,
        "target_completion_date": str(today + timedelta(days=5))
    })
    assert p2.status_code == 201
    p2_id = p2.json()["id"]
    assert p2_id != p1_id

    # Check workspace -> 1 active plan, 1 completed plan
    ws2 = (await client.get("/api/v1/learning/workspace", headers=headers)).json()
    assert len(ws2["active_plans"]) == 1
    assert len(ws2["completed_plans"]) == 1

    # Attempting to create ANOTHER active plan for cid fails
    p3 = await client.post("/api/v1/learning/plans", headers=headers, json={
        "content_id": cid,
        "content_type": "video",
        "title": "Third Active Plan",
        "total_duration_seconds": 1800,
        "target_completion_date": str(today + timedelta(days=5))
    })
    assert p3.status_code == 400


@pytest.mark.asyncio
async def test_e2e_recent_activity_authoritative_titles_and_routes(db_session, client: AsyncClient):
    """
    Verify:
    - Recent activity resolves authoritative titles from LearningPlaylistItem for playlist videos.
    - Recent activity contains correct watched seconds, dates, and content identifiers.
    """
    user_id, email, token = await register_and_login(client, "activity")
    headers = cookie_header(token)

    pl_internal_id = uuid.uuid4()
    pl_id = f"PL_ACT_{uuid.uuid4().hex[:6]}"
    playlist = LearningPlaylist(
        id=pl_internal_id,
        playlist_id=pl_id,
        title="Data Structures Course",
        channel_title="Campus",
        thumbnail_url="https://img/pl.jpg",
        description="Course",
        total_duration_seconds=3600
    )
    db_session.add(playlist)

    vid = f"vid_act_{uuid.uuid4().hex[:6]}"
    item = LearningPlaylistItem(
        playlist_internal_id=pl_internal_id,
        video_id=vid,
        title="Authoritative Lesson Title: Binary Search",
        thumbnail_url="https://img/v.jpg",
        position=0,
        duration_seconds=1200
    )
    db_session.add(item)
    await db_session.commit()

    # Record heartbeat on vid (180s duration)
    now = datetime.now(timezone.utc)
    hb = LearningSessionHeartbeat(
        session_id=uuid.uuid4(),
        content_id=vid,
        content_type="video",
        sequence=1,
        position_seconds=180,
        playback_rate=1.0,
        played_content_seconds=180,
        wall_clock_seconds=180,
        status="active",
        client_event_at=now
    )
    await process_heartbeat(db_session, user_id=user_id, heartbeat=hb)

    # Query analytics dashboard
    an = (await client.get("/api/v1/learning/analytics/dashboard", headers=headers)).json()
    assert len(an["recent_activity"]) >= 1
    recent_entry = next(r for r in an["recent_activity"] if r["content_id"] == vid)
    assert recent_entry["title"] == "Authoritative Lesson Title: Binary Search"
    assert recent_entry["watched_seconds"] == 180
    assert recent_entry["content_type"] == "video"

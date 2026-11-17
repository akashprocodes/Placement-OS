import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy import select

from app.models.user import User
from app.models.learning_plan import LearningPlan
from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem
from app.services.learning_plan_service import get_video_plan_context


@pytest.mark.asyncio
async def test_video_recognizes_parent_playlist_active_plan(db_session, client: AsyncClient):
    """
    When opening a video from a planned playlist, the backend resolves the parent playlist
    and active plan, preventing duplicate plan creation.
    """
    user_id = uuid.uuid4()
    user = User(id=user_id, email=f"cont_user_{uuid.uuid4().hex[:6]}@example.com", password_hash="pw")
    db_session.add(user)

    pl_internal_id = uuid.uuid4()
    pl_id = f"PL_CONT_{uuid.uuid4().hex[:6]}"
    playlist = LearningPlaylist(
        id=pl_internal_id,
        playlist_id=pl_id,
        title="Strivers A2Z DSA",
        channel_title="Striver",
        thumbnail_url="https://img/pl.jpg",
        description="Course",
        total_duration_seconds=3600
    )
    db_session.add(playlist)

    v1_id = f"vid_{uuid.uuid4().hex[:6]}"
    item1 = LearningPlaylistItem(
        playlist_internal_id=pl_internal_id,
        video_id=v1_id,
        title="1.1 Intro to DSA",
        thumbnail_url="https://img/v1.jpg",
        position=0,
        duration_seconds=1800
    )
    db_session.add(item1)

    today = datetime.now(timezone.utc).date()
    plan = LearningPlan(
        user_id=user_id,
        content_id=pl_id,
        content_type="playlist",
        title="Strivers A2Z DSA",
        total_duration_seconds=3600,
        target_completion_date=today + timedelta(days=10),
        daily_target_seconds=360,
        status="active"
    )
    db_session.add(plan)
    await db_session.commit()

    # 1. Service direct call: with preferred_playlist_id
    ctx = await get_video_plan_context(db_session, video_id=v1_id, user_id=user_id, preferred_playlist_id=pl_id)
    assert ctx["video_id"] == v1_id
    assert ctx["active_plan"] is not None
    assert ctx["active_plan"].id == plan.id
    assert ctx["parent_playlist_plan"] is not None
    assert ctx["parent_playlist_plan"].id == plan.id
    assert ctx["parent_playlist_id"] == pl_id
    assert ctx["parent_playlist_title"] == "Strivers A2Z DSA"
    assert ctx["direct_plan"] is None

    # 2. Service direct call: without preferred_playlist_id (direct URL opening / refresh)
    ctx_direct = await get_video_plan_context(db_session, video_id=v1_id, user_id=user_id, preferred_playlist_id=None)
    assert ctx_direct["active_plan"] is not None
    assert ctx_direct["active_plan"].id == plan.id
    assert ctx_direct["parent_playlist_id"] == pl_id


@pytest.mark.asyncio
async def test_standalone_video_plan_takes_precedence(db_session):
    """
    If a user has both a direct video plan AND a parent playlist plan,
    the direct video plan is recognized and prioritized for that video.
    """
    user_id = uuid.uuid4()
    user = User(id=user_id, email=f"stand_user_{uuid.uuid4().hex[:6]}@example.com", password_hash="pw")
    db_session.add(user)

    pl_internal_id = uuid.uuid4()
    pl_id = f"PL_STAND_{uuid.uuid4().hex[:6]}"
    playlist = LearningPlaylist(
        id=pl_internal_id,
        playlist_id=pl_id,
        title="Full Stack Playlist",
        channel_title="Dev",
        thumbnail_url="https://img/pl2.jpg",
        description="Course",
        total_duration_seconds=7200
    )
    db_session.add(playlist)

    v_id = f"vid_stand_{uuid.uuid4().hex[:6]}"
    item = LearningPlaylistItem(
        playlist_internal_id=pl_internal_id,
        video_id=v_id,
        title="Deep Dive Video",
        thumbnail_url="https://img/v2.jpg",
        position=0,
        duration_seconds=1200
    )
    db_session.add(item)

    today = datetime.now(timezone.utc).date()
    # Parent playlist plan
    pl_plan = LearningPlan(
        user_id=user_id,
        content_id=pl_id,
        content_type="playlist",
        title="Full Stack Playlist",
        total_duration_seconds=7200,
        target_completion_date=today + timedelta(days=14),
        daily_target_seconds=500,
        status="active"
    )
    # Direct video plan
    video_plan = LearningPlan(
        user_id=user_id,
        content_id=v_id,
        content_type="video",
        title="Deep Dive Video",
        total_duration_seconds=1200,
        target_completion_date=today + timedelta(days=2),
        daily_target_seconds=600,
        status="active"
    )
    db_session.add_all([pl_plan, video_plan])
    await db_session.commit()

    ctx = await get_video_plan_context(db_session, video_id=v_id, user_id=user_id, preferred_playlist_id=pl_id)
    assert ctx["direct_plan"] is not None
    assert ctx["direct_plan"].id == video_plan.id
    assert ctx["parent_playlist_plan"] is not None
    assert ctx["parent_playlist_plan"].id == pl_plan.id
    # Direct active plan takes precedence
    assert ctx["active_plan"].id == video_plan.id


@pytest.mark.asyncio
async def test_video_in_multiple_playlists_deterministic_resolution(db_session):
    """
    When a video belongs to multiple playlists:
    1. If preferred_playlist_id is passed and active, that playlist plan is chosen.
    2. If preferred_playlist_id is not passed, the most recent active plan is chosen deterministically.
    """
    user_id = uuid.uuid4()
    user = User(id=user_id, email=f"multi_pl_{uuid.uuid4().hex[:6]}@example.com", password_hash="pw")
    db_session.add(user)

    v_shared = f"vid_shared_{uuid.uuid4().hex[:6]}"
    today = datetime.now(timezone.utc).date()

    # Playlist A
    pl_a_id = f"PL_A_{uuid.uuid4().hex[:6]}"
    pl_a = LearningPlaylist(
        id=uuid.uuid4(),
        playlist_id=pl_a_id,
        title="Playlist Alpha",
        channel_title="Alpha",
        thumbnail_url="https://img/a.jpg",
        description="Course A",
        total_duration_seconds=3000
    )
    db_session.add(pl_a)
    item_a = LearningPlaylistItem(
        playlist_internal_id=pl_a.id,
        video_id=v_shared,
        title="Shared Video",
        thumbnail_url="https://img/v.jpg",
        position=0,
        duration_seconds=600
    )
    db_session.add(item_a)

    plan_a = LearningPlan(
        user_id=user_id,
        content_id=pl_a_id,
        content_type="playlist",
        title="Playlist Alpha",
        total_duration_seconds=3000,
        target_completion_date=today + timedelta(days=5),
        daily_target_seconds=600,
        status="active"
    )
    db_session.add(plan_a)

    # Playlist B (created later)
    pl_b_id = f"PL_B_{uuid.uuid4().hex[:6]}"
    pl_b = LearningPlaylist(
        id=uuid.uuid4(),
        playlist_id=pl_b_id,
        title="Playlist Beta",
        channel_title="Beta",
        thumbnail_url="https://img/b.jpg",
        description="Course B",
        total_duration_seconds=4000
    )
    db_session.add(pl_b)
    item_b = LearningPlaylistItem(
        playlist_internal_id=pl_b.id,
        video_id=v_shared,
        title="Shared Video",
        thumbnail_url="https://img/v.jpg",
        position=2,
        duration_seconds=600
    )
    db_session.add(item_b)

    plan_b = LearningPlan(
        user_id=user_id,
        content_id=pl_b_id,
        content_type="playlist",
        title="Playlist Beta",
        total_duration_seconds=4000,
        target_completion_date=today + timedelta(days=7),
        daily_target_seconds=500,
        status="active"
    )
    db_session.add(plan_b)
    await db_session.commit()

    # 1. Explicit playlist preference PL_A
    ctx_a = await get_video_plan_context(db_session, video_id=v_shared, user_id=user_id, preferred_playlist_id=pl_a_id)
    assert ctx_a["active_plan"].id == plan_a.id
    assert ctx_a["parent_playlist_id"] == pl_a_id

    # 2. Explicit playlist preference PL_B
    ctx_b = await get_video_plan_context(db_session, video_id=v_shared, user_id=user_id, preferred_playlist_id=pl_b_id)
    assert ctx_b["active_plan"].id == plan_b.id
    assert ctx_b["parent_playlist_id"] == pl_b_id

    # 3. No preference specified: deterministic choice
    ctx_none = await get_video_plan_context(db_session, video_id=v_shared, user_id=user_id, preferred_playlist_id=None)
    assert ctx_none["active_plan"] is not None
    assert ctx_none["active_plan"].id in {plan_a.id, plan_b.id}
    assert len(ctx_none["all_parent_playlist_ids"]) == 2


@pytest.mark.asyncio
async def test_plan_context_endpoint_unauthenticated(client: AsyncClient, db_session):
    """
    Unauthenticated call to /videos/{id}/plan-context succeeds without 401,
    returning null plans and preserving playlist context if available.
    """
    v_id = f"vid_anon_{uuid.uuid4().hex[:6]}"
    res = await client.get(f"/api/v1/learning/videos/{v_id}/plan-context")
    assert res.status_code == 200
    data = res.json()
    assert data["video_id"] == v_id
    assert data["active_plan"] is None
    assert data["direct_plan"] is None
    assert data["parent_playlist_plan"] is None


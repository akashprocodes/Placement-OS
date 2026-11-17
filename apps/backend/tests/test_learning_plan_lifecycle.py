import pytest
import uuid
from datetime import datetime, timezone, timedelta
from app.models.learning_plan import LearningPlan
from app.models.learning_progress import LearningProgress
from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem
from app.services.learning_plan_completion_service import check_and_update_plan_completion

from app.models.user import User



@pytest.mark.asyncio
async def test_video_plan_completion(db_session):
    u = User(id=uuid.uuid4(), email="test1@test.com", password_hash="pw")
    db_session.add(u)
    await db_session.commit()
    test_user = u

    # 1. Create a video plan
    plan_id = uuid.uuid4()
    plan = LearningPlan(
        id=plan_id,
        user_id=test_user.id,
        content_id="vid_1",
        content_type="video",
        title="Test Video",
        total_duration_seconds=100,
        target_completion_date=datetime.now(timezone.utc).date() + timedelta(days=5),
        daily_target_seconds=20,
        status="active"
    )
    db_session.add(plan)
    await db_session.commit()
    
    # 2. Before progress, plan is active
    updated_plan = await check_and_update_plan_completion(db_session, test_user.id, plan_id)
    assert updated_plan.status == "active"
    assert updated_plan.completed_at is None
    
    # 3. Add incomplete progress
    prog = LearningProgress(
        user_id=test_user.id,
        content_id="vid_1",
        content_type="video",
        progress_seconds=50,
        progress_percent=50.0,
        completed=False
    )
    db_session.add(prog)
    await db_session.commit()
    
    updated_plan = await check_and_update_plan_completion(db_session, test_user.id, plan_id)
    assert updated_plan.status == "active"
    
    # 4. Complete the progress
    prog.completed = True
    prog.progress_percent = 96.0
    await db_session.commit()
    
    updated_plan = await check_and_update_plan_completion(db_session, test_user.id, plan_id)
    assert updated_plan.status == "completed"
    assert updated_plan.completed_at is not None

@pytest.mark.asyncio
async def test_playlist_plan_completion(db_session):
    u = User(id=uuid.uuid4(), email="test2@test.com", password_hash="pw")
    db_session.add(u)
    await db_session.commit()
    test_user = u
    # 1. Create playlist + items
    pl = LearningPlaylist(
            playlist_id="pl_1",
            title="Test Playlist",
            channel_title="Test Channel",
            thumbnail_url="http://example.com/thumb.jpg",
            description="Desc",
            total_duration_seconds=300,
            item_count=2,
            duration_available=True
        )
    db_session.add(pl)
    await db_session.commit()
    await db_session.refresh(pl)
    
    item1 = LearningPlaylistItem(
        playlist_internal_id=pl.id,
        video_id="v1",
        title="Video 1",
        position=0, thumbnail_url="thumb.jpg",
        duration_seconds=100
    )
    item2 = LearningPlaylistItem(
        playlist_internal_id=pl.id,
        video_id="v2",
        title="Video 2",
        position=1, thumbnail_url="thumb.jpg",
        duration_seconds=200
    )
    db_session.add_all([item1, item2])
    await db_session.commit()
    
    # 2. Create playlist plan
    plan_id = uuid.uuid4()
    plan = LearningPlan(
        id=plan_id,
        user_id=test_user.id,
        content_id="pl_1",
        content_type="playlist",
        title="Test Playlist Plan",
        total_duration_seconds=300,
        target_completion_date=datetime.now(timezone.utc).date() + timedelta(days=5),
        daily_target_seconds=60,
        status="active"
    )
    db_session.add(plan)
    await db_session.commit()
    
    # 3. Complete first video
    p1 = LearningProgress(
        user_id=test_user.id,
        content_id="v1",
        content_type="video",
        progress_seconds=100,
        progress_percent=100.0,
        completed=True
    )
    db_session.add(p1)
    await db_session.commit()
    
    updated_plan = await check_and_update_plan_completion(db_session, test_user.id, plan_id)
    assert updated_plan.status == "active"  # Only 1 of 2 completed
    
    # 4. Complete second video
    p2 = LearningProgress(
        user_id=test_user.id,
        content_id="v2",
        content_type="video",
        progress_seconds=200,
        progress_percent=100.0,
        completed=True
    )
    db_session.add(p2)
    await db_session.commit()
    
    updated_plan = await check_and_update_plan_completion(db_session, test_user.id, plan_id)
    assert updated_plan.status == "completed"
    assert updated_plan.completed_at is not None


@pytest.mark.asyncio
async def test_retake_learning_plan_preserves_history_and_remains_active(db_session):
    from app.services.learning_plan_completion_service import batch_check_and_update_plan_completions
    from app.services import learning_plan_service
    from app.schemas.learning import LearningPlanCreate

    u = User(id=uuid.uuid4(), email="retake_user@test.com", password_hash="pw")
    db_session.add(u)
    await db_session.commit()

    # 1. Historical plan created and completed yesterday
    yesterday = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    old_plan = LearningPlan(
        id=uuid.uuid4(),
        user_id=u.id,
        content_id="vid_retake_1",
        content_type="video",
        title="Historical Video Plan",
        total_duration_seconds=200,
        target_completion_date=datetime.now(timezone.utc).date() + timedelta(days=2),
        daily_target_seconds=100,
        status="completed",
        completed_at=yesterday,
        created_at=yesterday - timedelta(days=2),
    )
    # Historical progress completed yesterday
    prog = LearningProgress(
        user_id=u.id,
        content_id="vid_retake_1",
        content_type="video",
        progress_seconds=200,
        duration_seconds=200,
        progress_percent=100.0,
        completed=True,
        last_watched_at=yesterday,
    )
    db_session.add_all([old_plan, prog])
    await db_session.commit()

    # 2. Today: User retakes the video by creating a new active plan
    new_plan_in = LearningPlanCreate(
        content_id="vid_retake_1",
        content_type="video",
        title="Retake Video Plan",
        total_duration_seconds=200,
        target_completion_date=datetime.now(timezone.utc).date() + timedelta(days=3),
    )
    new_plan = await learning_plan_service.create_learning_plan(db_session, u.id, new_plan_in)
    assert new_plan.status == "active"
    assert new_plan.id != old_plan.id

    # 3. Batch check plan completions: New plan MUST stay active because completion was before new_plan.created_at
    all_plans = await learning_plan_service.get_learning_plans(db_session, u.id)
    evaluated = await batch_check_and_update_plan_completions(db_session, u.id, all_plans)

    # Check both plans exist and their statuses
    plan_map = {p.id: p for p in evaluated}
    assert plan_map[old_plan.id].status == "completed"
    assert plan_map[old_plan.id].completed_at == yesterday
    assert plan_map[new_plan.id].status == "active"
    assert plan_map[new_plan.id].completed_at is None



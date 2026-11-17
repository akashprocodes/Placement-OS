import math
from datetime import date, datetime, timezone
import uuid
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.learning_plan import LearningPlan
from app.schemas.learning import LearningPlanCreate

async def create_learning_plan(
    db: AsyncSession,
    user_id: uuid.UUID,
    plan_in: LearningPlanCreate
) -> LearningPlan:
    # 1. Reject past dates
    today = datetime.now(timezone.utc).date()
    if plan_in.target_completion_date < today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target completion date cannot be in the past"
        )
    
    # 2. Prevent duplicate active plan for same content
    stmt = select(LearningPlan).where(
        LearningPlan.user_id == user_id,
        LearningPlan.content_id == plan_in.content_id,
        LearningPlan.status == "active"
    )
    result = await db.execute(stmt)
    existing_plan = result.scalar_one_or_none()
    
    if existing_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An active learning plan already exists for this content"
        )
    
    # 3. Calculate daily target
    available_days = (plan_in.target_completion_date - today).days + 1
    # Minimum 1 day
    available_days = max(1, available_days)
    daily_target_seconds = math.ceil(plan_in.total_duration_seconds / available_days)
    
    # 4. Create plan
    plan = LearningPlan(
        user_id=user_id,
        content_id=plan_in.content_id,
        content_type=plan_in.content_type,
        title=plan_in.title,
        total_duration_seconds=plan_in.total_duration_seconds,
        target_completion_date=plan_in.target_completion_date,
        daily_target_seconds=daily_target_seconds,
        status="active"
    )
    db.add(plan)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An active learning plan already exists for this content"
        )
    await db.refresh(plan)
    
    return plan

async def get_learning_plans(
    db: AsyncSession,
    user_id: uuid.UUID
) -> List[LearningPlan]:
    stmt = select(LearningPlan).where(LearningPlan.user_id == user_id).order_by(LearningPlan.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())

async def get_learning_plan(
    db: AsyncSession,
    user_id: uuid.UUID,
    plan_id: uuid.UUID
) -> LearningPlan:
    stmt = select(LearningPlan).where(
        LearningPlan.id == plan_id,
        LearningPlan.user_id == user_id
    )
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Learning plan not found"
        )
    return plan

async def delete_learning_plan(
    db: AsyncSession,
    user_id: uuid.UUID,
    plan_id: uuid.UUID
) -> None:
    plan = await get_learning_plan(db, user_id, plan_id)
    await db.delete(plan)
    await db.commit()


async def get_video_plan_context(
    db: AsyncSession,
    video_id: str,
    user_id: Optional[uuid.UUID] = None,
    preferred_playlist_id: Optional[str] = None
) -> dict:
    """
    Resolves the learning plan context for a video.
    Identifies direct video plans and parent playlist plans deterministically.
    """
    from app.models.learning_playlist import LearningPlaylist
    from app.models.learning_playlist_item import LearningPlaylistItem

    direct_plan = None
    parent_playlist_plan = None
    chosen_playlist = None

    # 1. Check for active direct plan on this video if authenticated
    if user_id:
        stmt = select(LearningPlan).where(
            LearningPlan.user_id == user_id,
            LearningPlan.content_id == video_id,
            LearningPlan.content_type == "video",
            LearningPlan.status == "active"
        )
        direct_plan = (await db.execute(stmt)).scalar_one_or_none()

    # 2. Find all playlists containing this video
    pl_stmt = (
        select(LearningPlaylist)
        .join(LearningPlaylistItem, LearningPlaylistItem.playlist_internal_id == LearningPlaylist.id)
        .where(LearningPlaylistItem.video_id == video_id)
    )
    playlists = (await db.execute(pl_stmt)).scalars().all()
    all_parent_pl_ids = [pl.playlist_id for pl in playlists]

    # 3. If authenticated and video belongs to playlists, check for active playlist plans
    if user_id and all_parent_pl_ids:
        plan_stmt = select(LearningPlan).where(
            LearningPlan.user_id == user_id,
            LearningPlan.content_id.in_(all_parent_pl_ids),
            LearningPlan.content_type == "playlist",
            LearningPlan.status == "active"
        ).order_by(LearningPlan.created_at.desc(), LearningPlan.id.asc())
        active_pl_plans = (await db.execute(plan_stmt)).scalars().all()

        if active_pl_plans:
            # Deterministically match: preferred_playlist_id if provided and matches, else most recent active
            if preferred_playlist_id:
                for p in active_pl_plans:
                    if p.content_id == preferred_playlist_id:
                        parent_playlist_plan = p
                        break
            if not parent_playlist_plan:
                parent_playlist_plan = active_pl_plans[0]

            for pl in playlists:
                if pl.playlist_id == parent_playlist_plan.content_id:
                    chosen_playlist = pl
                    break

    # 4. If no active playlist plan found, still resolve chosen playlist for navigation
    if not chosen_playlist:
        if preferred_playlist_id:
            for pl in playlists:
                if pl.playlist_id == preferred_playlist_id:
                    chosen_playlist = pl
                    break
        elif playlists:
            chosen_playlist = playlists[0]

    # 5. Direct active plan takes precedence if present; otherwise parent playlist plan
    active_plan = direct_plan if direct_plan else parent_playlist_plan

    return {
        "video_id": video_id,
        "active_plan": active_plan,
        "direct_plan": direct_plan,
        "parent_playlist_plan": parent_playlist_plan,
        "parent_playlist_id": chosen_playlist.playlist_id if chosen_playlist else preferred_playlist_id,
        "parent_playlist_title": chosen_playlist.title if chosen_playlist else None,
        "all_parent_playlist_ids": all_parent_pl_ids,
    }



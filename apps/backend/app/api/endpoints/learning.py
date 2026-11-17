from fastapi import APIRouter, Query, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from app.services.youtube_service import (
    search_learning_content,
    YouTubeQuotaError,
    YouTubeTimeoutError
)
from app.schemas.learning import (
    LearningSearchResult, YouTubeVideo, YouTubePlaylist, YouTubePlaylistDetailed,
    LearningProgressUpsert, LearningProgressResponse, COMPLETION_THRESHOLD,
    VideoPlanContextResponse
)
from app.models.learning_progress import LearningProgress
from typing import Optional
from app.core.database import get_db
from app.api.deps import get_current_user, get_optional_current_user
from app.models.user import User
import uuid
import logging
from datetime import datetime, UTC

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── YouTube routes (existing, unchanged) ────────────────────────────────────

@router.get("/search", response_model=LearningSearchResult)
async def search_learning(
    q: str = Query(..., min_length=1),
    pageToken: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await search_learning_content(q, page_token=pageToken, db=db)
        return result
    except YouTubeQuotaError as e:
        logger.error(f"YouTube quota error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YouTube API quota exceeded. Please try again later.",
        )
    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to search YouTube right now. Please try again later.",
        )
    except Exception as e:
        logger.error(f"Unexpected error in search_learning: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to search YouTube right now. Please try again later.",
        )


@router.get("/video/{video_id}", response_model=YouTubeVideo)
async def get_video(
    video_id: str,
    db: AsyncSession = Depends(get_db)
):
    from app.services.youtube_service import get_video_details
    from app.models.learning_playlist_item import LearningPlaylistItem
    from sqlalchemy.orm import selectinload

    # 1. Check if video exists in synced playlist items to avoid unnecessary YouTube quota usage
    try:
        stmt = (
            select(LearningPlaylistItem)
            .options(selectinload(LearningPlaylistItem.playlist))
            .where(LearningPlaylistItem.video_id == video_id)
        )
        result = await db.execute(stmt)
        item = result.scalars().first()
        if item:
            duration_str = f"PT{item.duration_seconds}S" if item.duration_seconds else None
            channel_title = item.playlist.channel_title if item.playlist else ""
            return YouTubeVideo(
                id=item.video_id,
                title=item.title,
                description="",
                thumbnailUrl=item.thumbnail_url or "",
                channelTitle=channel_title,
                publishedAt=datetime.now(UTC).isoformat(),
                duration=duration_str,
                url=f"https://www.youtube.com/watch?v={item.video_id}"
            )
    except Exception as e:
        logger.warning(f"Error checking local playlist items for video {video_id}: {str(e)}")

    # 2. Fallback to upstream YouTube API
    try:
        return await get_video_details(video_id)
    except YouTubeQuotaError as e:
        logger.error(f"YouTube quota error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YouTube API quota exceeded. Please try again later.",
        )
    except YouTubeTimeoutError as e:
        logger.error(f"YouTube timeout error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="YouTube API timed out. Please try again later.",
        )
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Video not found")
        logger.error(f"Configuration error: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unavailable.")
    except Exception as e:
        logger.error(f"Error fetching video: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unavailable.")


@router.get("/videos/{video_id}/plan-context", response_model=VideoPlanContextResponse)
async def get_video_plan_context_endpoint(
    video_id: str,
    playlist_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Retrieve learning plan context for a video, including active direct plan and parent playlist plan."""
    from app.services import learning_plan_service
    user_id = current_user.id if current_user else None
    return await learning_plan_service.get_video_plan_context(
        db=db,
        video_id=video_id,
        user_id=user_id,
        preferred_playlist_id=playlist_id
    )


@router.get("/playlist/{playlist_id}", response_model=YouTubePlaylistDetailed)
async def get_playlist(
    playlist_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    from app.services.playlist_sync_service import get_or_sync_playlist
    user_id = current_user.id if current_user else None
    try:
        return await get_or_sync_playlist(db, playlist_id, user_id=user_id)
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Playlist not found")
        raise HTTPException(status_code=503, detail="Service unavailable.")
    except Exception as e:
        logger.error(f"Error fetching playlist: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unavailable.")


# ─── Progress routes (authenticated) ─────────────────────────────────────────

def _calculate_percent(progress_seconds: int, duration_seconds: int | None) -> float:
    """Calculate progress percentage, clamped 0–100."""
    if not duration_seconds or duration_seconds <= 0:
        return 0.0
    percent = (progress_seconds / duration_seconds) * 100.0
    return max(0.0, min(100.0, percent))


@router.get("/progress/{content_type}/{content_id}", response_model=LearningProgressResponse)
async def get_progress(
    content_type: str,
    content_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LearningProgress).where(
            LearningProgress.user_id == current_user.id,
            LearningProgress.content_id == content_id,
            LearningProgress.content_type == content_type,
        )
    )
    progress = result.scalar_one_or_none()
    if progress is None:
        raise HTTPException(status_code=404, detail="No progress found for this content.")
    return progress


@router.put("/progress/{content_type}/{content_id}", response_model=LearningProgressResponse)
async def upsert_progress(
    content_type: str,
    content_id: str,
    body: LearningProgressUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate path content_type matches body (belt-and-suspenders)
    if body.content_type != content_type:
        raise HTTPException(status_code=422, detail="content_type in URL and body must match.")
    if body.content_id != content_id:
        raise HTTPException(status_code=422, detail="content_id in URL and body must match.")

    # Server-side: calculate percentage and completed flag
    percent = _calculate_percent(body.progress_seconds, body.duration_seconds)
    completed = percent >= COMPLETION_THRESHOLD

    result = await db.execute(
        select(LearningProgress).where(
            LearningProgress.user_id == current_user.id,
            LearningProgress.content_id == content_id,
            LearningProgress.content_type == content_type,
        )
    )
    progress = result.scalar_one_or_none()

    now = datetime.now(UTC).replace(tzinfo=None)  # store as naive UTC matching DB convention

    if progress is None:
        progress = LearningProgress(
            id=uuid.uuid4(),
            user_id=current_user.id,
            content_id=content_id,
            content_type=content_type,
            progress_seconds=body.progress_seconds,
            duration_seconds=body.duration_seconds,
            progress_percent=percent,
            completed=completed,
            last_watched_at=now,
        )
        db.add(progress)
    else:
        progress.progress_seconds = body.progress_seconds
        if body.duration_seconds is not None:
            progress.duration_seconds = body.duration_seconds
        progress.progress_percent = percent
        progress.completed = completed
        progress.last_watched_at = now
        progress.updated_at = now

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing_stmt = select(LearningProgress).where(
            LearningProgress.user_id == current_user.id,
            LearningProgress.content_id == content_id,
            LearningProgress.content_type == content_type,
        )
        res = await db.execute(existing_stmt)
        progress = res.scalar_one()
        progress.progress_seconds = body.progress_seconds
        if body.duration_seconds is not None:
            progress.duration_seconds = body.duration_seconds
        progress.progress_percent = percent
        progress.completed = completed
        progress.last_watched_at = now
        progress.updated_at = now
        await db.commit()

    await db.refresh(progress)

    # Hook: re-evaluate completion for all active plans for this user
    
    active_plans_stmt = select(LearningPlan.id).where(
        LearningPlan.user_id == current_user.id,
        LearningPlan.status == "active"
    )
    active_plans_res = await db.execute(active_plans_stmt)
    for p_id in active_plans_res.scalars().all():
        await check_and_update_plan_completion(db, current_user.id, p_id)
        
    return progress

# ─── Learning Plans routes ───────────────────────────────────────────────────

from typing import List
from app.schemas.learning import LearningPlanCreate, LearningPlanResponse
from app.services import learning_plan_service
from app.services.learning_plan_completion_service import check_and_update_plan_completion
from app.models.learning_plan import LearningPlan

@router.post("/plans", response_model=LearningPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_learning_plan_endpoint(
    plan_in: LearningPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await learning_plan_service.create_learning_plan(db, current_user.id, plan_in)

from app.schemas.learning_workspace import (
    LearningWorkspaceResponse,
    LearningPlanWithProgress,
    PlanResumeContext,
)
from app.schemas.learning_adaptive import (
    AdaptivePlanRecommendation,
    PlanMilestoneInfo,
    UserMilestonesSummary,
)
from app.services.learning_streak_service import get_user_study_streak
from app.services import learning_adaptive_service
from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem
from sqlalchemy.orm import selectinload

@router.get("/workspace", response_model=LearningWorkspaceResponse)
async def get_learning_workspace_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.services import learning_plan_service, learning_debt_service
    from app.services.learning_plan_completion_service import batch_check_and_update_plan_completions
    
    # 1. Fetch study streak
    streak_info = await get_user_study_streak(db, current_user.id)

    # 2. Fetch all plans and batch-check completions in single operation
    all_plans = await learning_plan_service.get_learning_plans(db, current_user.id)
    all_plans = await batch_check_and_update_plan_completions(db, current_user.id, all_plans)

    completed_plans = [p for p in all_plans if p.status == "completed"]
    active_plans_list = [p for p in all_plans if p.status == "active"]

    # Batch-calculate progress/debt for all active plans (no N+1 queries)
    progress_map = await learning_debt_service.batch_get_plan_progress(db, current_user.id, active_plans_list)
    evaluated_active = [(p, progress_map[p.id]) for p in active_plans_list if p.id in progress_map]

    # 3. Batch-fetch progress for active plans to determine resume context without N+1 queries
    video_plan_ids = [p.content_id for p, _ in evaluated_active if p.content_type == "video"]
    playlist_plan_ids = [p.content_id for p, _ in evaluated_active if p.content_type == "playlist"]

    # 3a. Batch video progress
    video_prog_map = {}
    if video_plan_ids:
        v_stmt = select(LearningProgress).where(
            LearningProgress.user_id == current_user.id,
            LearningProgress.content_id.in_(video_plan_ids),
            LearningProgress.content_type == "video"
        )
        for vp in (await db.execute(v_stmt)).scalars().all():
            video_prog_map[vp.content_id] = vp

    # 3b. Batch playlist items and their video progress
    playlist_obj_map = {}
    playlist_item_prog_map = {}
    if playlist_plan_ids:
        pl_stmt = (
            select(LearningPlaylist)
            .options(selectinload(LearningPlaylist.items))
            .where(LearningPlaylist.playlist_id.in_(playlist_plan_ids))
        )
        pl_results = (await db.execute(pl_stmt)).scalars().all()
        all_pl_video_ids = []
        for pl_obj in pl_results:
            playlist_obj_map[pl_obj.playlist_id] = pl_obj
            for item in pl_obj.items:
                all_pl_video_ids.append(item.video_id)

        if all_pl_video_ids:
            pl_prog_stmt = select(LearningProgress).where(
                LearningProgress.user_id == current_user.id,
                LearningProgress.content_id.in_(all_pl_video_ids),
                LearningProgress.content_type == "video"
            )
            for p in (await db.execute(pl_prog_stmt)).scalars().all():
                playlist_item_prog_map[p.content_id] = p

    # 4. Build active plans with resume context, adaptive recommendations, and milestones
    active_plans = []
    max_plan_progress = 100.0 if completed_plans else 0.0

    for updated_plan, prog in evaluated_active:
        resume_ctx: Optional[PlanResumeContext] = None
        completed_content_seconds = 0

        if updated_plan.content_type == "video":
            vp = video_prog_map.get(updated_plan.content_id)
            saved_sec = vp.progress_seconds if (vp and vp.progress_seconds > 0 and not vp.completed) else 0
            has_saved = saved_sec > 0
            resume_ctx = PlanResumeContext(
                video_id=updated_plan.content_id,
                video_title=updated_plan.title,
                saved_position_seconds=saved_sec,
                duration_seconds=vp.duration_seconds if vp else updated_plan.total_duration_seconds,
                playlist_id=None,
                has_saved_position=has_saved
            )
            if vp:
                completed_content_seconds = updated_plan.total_duration_seconds if vp.completed else vp.progress_seconds
        elif updated_plan.content_type == "playlist":
            pl_obj = playlist_obj_map.get(updated_plan.content_id)
            if pl_obj and pl_obj.items:
                sorted_items = sorted(pl_obj.items, key=lambda x: x.position)
                # Select the next incomplete video using authoritative playlist progress
                next_item = None
                for it in sorted_items:
                    it_p = playlist_item_prog_map.get(it.video_id)
                    is_completed = it_p.completed if it_p else False
                    if not is_completed:
                        next_item = it
                        break

                if next_item:
                    it_prog = playlist_item_prog_map.get(next_item.video_id)
                    it_saved = it_prog.progress_seconds if (it_prog and it_prog.progress_seconds > 0 and not it_prog.completed) else 0
                    has_saved = it_saved > 0
                    resume_ctx = PlanResumeContext(
                        video_id=next_item.video_id,
                        video_title=next_item.title,
                        saved_position_seconds=it_saved,
                        duration_seconds=next_item.duration_seconds,
                        playlist_id=updated_plan.content_id,
                        has_saved_position=has_saved
                    )

                for item in sorted_items:
                    it_p = playlist_item_prog_map.get(item.video_id)
                    item_dur = item.duration_seconds or 0
                    if item_dur > 0 and it_p:
                        if it_p.completed:
                            completed_content_seconds += item_dur
                        else:
                            completed_content_seconds += min(it_p.progress_seconds, item_dur)

        adaptive_rec = learning_adaptive_service.calculate_adaptive_plan(
            total_duration_seconds=updated_plan.total_duration_seconds,
            target_completion_date=updated_plan.target_completion_date,
            created_at_date=updated_plan.created_at.date(),
            daily_target_seconds=updated_plan.daily_target_seconds,
            status=updated_plan.status,
            completed_content_seconds=completed_content_seconds,
            previous_debt_seconds=prog.previous_debt_seconds,
            completed_seconds_today=prog.completed_seconds_today,
            today=prog.current_date,
        )

        plan_milestones = learning_adaptive_service.calculate_plan_milestones(
            progress_percent=adaptive_rec.progress_percent,
            is_completed=(updated_plan.status == "completed"),
        )

        max_plan_progress = max(max_plan_progress, adaptive_rec.progress_percent)

        active_plans.append(
            LearningPlanWithProgress(
                plan=updated_plan,
                progress=prog,
                resume=resume_ctx,
                adaptive=adaptive_rec,
                milestones=plan_milestones,
            )
        )

    # 5. Build user-level milestones summary
    has_completed_playlist = any(p.content_type == "playlist" for p in completed_plans)
    has_completed_plan = len(completed_plans) > 0
    user_milestones = await learning_adaptive_service.get_user_milestones_summary(
        db=db,
        user_id=current_user.id,
        longest_streak=streak_info.longest_streak if streak_info else 0,
        has_completed_playlist=has_completed_playlist,
        has_completed_plan=has_completed_plan,
        max_plan_progress=max_plan_progress,
    )

    return LearningWorkspaceResponse(
        active_plans=active_plans,
        completed_plans=completed_plans,
        streak=streak_info,
        milestones=user_milestones,
    )

@router.get("/plans/{plan_id}/adaptive", response_model=AdaptivePlanRecommendation)
async def get_plan_adaptive_recommendation_endpoint(
    plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve deterministic, explainable adaptive plan recommendation for a specific plan."""
    prog = await learning_debt_service.get_plan_progress(db, current_user.id, plan_id)
    if prog.adaptive is None:
        raise HTTPException(status_code=404, detail="Adaptive recommendation not available")
    return prog.adaptive

@router.get("/milestones", response_model=UserMilestonesSummary)
async def get_user_milestones_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve user-specific learning milestones summary derived from authoritative records."""
    from app.services import learning_streak_service
    streak_info = await learning_streak_service.get_user_study_streak(db, current_user.id)
    all_plans = await learning_plan_service.get_learning_plans(db, current_user.id)
    has_completed_pl = any(p.status == "completed" and p.content_type == "playlist" for p in all_plans)
    has_completed_pln = any(p.status == "completed" for p in all_plans)
    max_prog = 100.0 if has_completed_pln else 0.0

    if not has_completed_pln and all_plans:
        # Efficiently derive max progress without N+1 queries
        vp_stmt = select(func.max(LearningProgress.progress_percent)).where(
            LearningProgress.user_id == current_user.id
        )
        db_max = (await db.execute(vp_stmt)).scalar()
        if db_max is not None:
            max_prog = max(max_prog, float(db_max))

    return await learning_adaptive_service.get_user_milestones_summary(
        db=db,
        user_id=current_user.id,
        longest_streak=streak_info.longest_streak if streak_info else 0,
        has_completed_playlist=has_completed_pl,
        has_completed_plan=has_completed_pln,
        max_plan_progress=max_prog,
    )

@router.get("/plans", response_model=List[LearningPlanResponse])
async def get_learning_plans_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await learning_plan_service.get_learning_plans(db, current_user.id)

@router.get("/plans/{plan_id}", response_model=LearningPlanResponse)
async def get_learning_plan_endpoint(
    plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await learning_plan_service.get_learning_plan(db, current_user.id, plan_id)

@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_learning_plan_endpoint(
    plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await learning_plan_service.delete_learning_plan(db, current_user.id, plan_id)

# ─── Learning Session routes ─────────────────────────────────────────────────

from app.schemas.learning import LearningSessionHeartbeat
from app.services import learning_session_service

@router.post("/sessions/heartbeat", status_code=status.HTTP_200_OK)
async def heartbeat_endpoint(
    heartbeat: LearningSessionHeartbeat,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await learning_session_service.process_heartbeat(db, current_user.id, heartbeat)
    return {"status": "ok"}

# ─── Learning Plan Debt routes ───────────────────────────────────────────────

from app.schemas.learning import LearningPlanProgress
from app.services import learning_debt_service

@router.get("/plans/{plan_id}/progress", response_model=LearningPlanProgress)
async def get_learning_plan_progress(
    plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await learning_debt_service.get_plan_progress(db, current_user.id, plan_id)


# ─── Learning Notes & Bookmarks routes ──────────────────────────────────────

from app.schemas.learning_note import LearningNoteCreate, LearningNoteUpdate, LearningNoteResponse
from app.services import learning_notes_service

@router.get("/videos/{video_id}/notes", response_model=List[LearningNoteResponse])
async def get_video_notes_endpoint(
    video_id: str,
    note_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve timestamped notes and bookmarks for a video owned by the authenticated user."""
    return await learning_notes_service.list_video_notes(
        db, current_user.id, video_id, note_type=note_type
    )

@router.post("/notes", response_model=LearningNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note_endpoint(
    data: LearningNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new timestamped personal note or bookmark for a video."""
    return await learning_notes_service.create_note(db, current_user.id, data)

@router.put("/notes/{note_id}", response_model=LearningNoteResponse)
async def update_note_endpoint(
    note_id: uuid.UUID,
    data: LearningNoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a timestamped note or bookmark owned by the authenticated user."""
    updated = await learning_notes_service.update_note(db, current_user.id, note_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Note not found")
    return updated

@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note_endpoint(
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a timestamped note or bookmark owned by the authenticated user."""
    deleted = await learning_notes_service.delete_note(db, current_user.id, note_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")

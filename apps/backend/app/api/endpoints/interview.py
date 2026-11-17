import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.interview import (
    InterviewSessionCreate,
    InterviewSessionUpdate,
    InterviewSessionResponse,
    InterviewSessionListResponse,
    ResumeCreateRequest,
    ResumeResponse,
)
from app.services import interview_service, resume_service

router = APIRouter()


def _to_session_response(session, turn_count: int = 0) -> InterviewSessionResponse:
    """Helper to serialize an InterviewSession model to response schema without triggering async lazy loads."""
    if "turns" in session.__dict__ and session.__dict__["turns"] is not None:
        turn_count = len(session.__dict__["turns"])

    return InterviewSessionResponse(
        id=session.id,
        user_id=session.user_id,
        title=session.title,
        interview_type=session.interview_type,
        status=session.status,
        target_role=session.target_role,
        experience_level=session.experience_level,
        difficulty=session.difficulty,
        selected_stages=session.selected_stages if isinstance(session.selected_stages, list) else [],
        duration_minutes=session.duration_minutes,
        current_stage=session.current_stage,
        resume_id=session.resume_id,
        turn_count=turn_count,
        created_at=session.created_at,
        updated_at=session.updated_at,
        completed_at=session.completed_at,
    )


@router.post("", response_model=InterviewSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(
    data: InterviewSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new interview session with validated configuration and user ownership."""
    session = await interview_service.create_interview_session(db, current_user.id, data)
    return _to_session_response(session)


@router.get("", response_model=InterviewSessionListResponse)
async def list_interviews(
    status: Optional[str] = Query(default=None, description="Filter sessions by status (draft, in_progress, completed, abandoned)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all interview sessions owned by the authenticated user."""
    sessions, total = await interview_service.list_interview_sessions(db, current_user.id, status_filter=status)
    return InterviewSessionListResponse(
        sessions=[_to_session_response(s) for s in sessions],
        total=total,
    )


@router.get("/resumes", response_model=List[ResumeResponse])
async def list_resumes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all uploaded resumes owned by the authenticated user."""
    resumes = await resume_service.list_user_resumes(db, current_user.id)
    return resumes


@router.post("/resumes", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    payload: ResumeCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Safely ingest and validate candidate resume content without external AI calls."""
    resume = await resume_service.create_resume_from_payload(
        db=db,
        user_id=current_user.id,
        filename=payload.filename,
        file_type=payload.file_type,
        raw_text=payload.raw_text,
        content_base64=payload.content_base64,
    )
    return resume


@router.get("/{session_id}", response_model=InterviewSessionResponse)
async def get_interview(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve an interview session by ID with ownership enforcement."""
    session = await interview_service.get_interview_session(db, current_user.id, session_id)
    return _to_session_response(session)


@router.patch("/{session_id}", response_model=InterviewSessionResponse)
async def update_interview(
    session_id: uuid.UUID,
    data: InterviewSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update title, status, or current stage for an interview session."""
    session = await interview_service.update_interview_session(db, current_user.id, session_id, data)
    return _to_session_response(session)


@router.post("/{session_id}/abandon", response_model=InterviewSessionResponse)
async def abandon_interview(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark an active or draft interview session as abandoned."""
    session = await interview_service.abandon_interview_session(db, current_user.id, session_id)
    return _to_session_response(session)

import uuid
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.interview_session import InterviewSession
from app.models.interview_turn import InterviewTurn
from app.schemas.interview import (
    InterviewSessionCreate,
    InterviewSessionUpdate,
    InterviewStatus,
    InterviewType,
)
from app.services import resume_service


async def create_interview_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: InterviewSessionCreate,
) -> InterviewSession:
    """Create a new validated interview session with user ownership."""

    # 1. Validate resume ownership and extractable content
    if data.resume_id:
        resume = await resume_service.get_user_resume_by_id(db, user_id, data.resume_id)
        if not resume:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Referenced resume not found or does not belong to you."
            )
        if data.interview_type == InterviewType.RESUME_BASED:
            if not resume.extracted_text or not resume.extracted_text.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Selected resume has no extractable text. Please upload a text-based resume."
                )
    elif data.interview_type == InterviewType.RESUME_BASED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid resume must be selected for a resume-based interview."
        )

    # 2. Derive human-friendly title if none provided
    session_title = data.title.strip() if data.title and data.title.strip() else (
        f"{data.target_role} ({data.experience_level.value.title()}) Mock Interview"
    )

    # 3. Initial active stage is the first selected stage
    initial_stage = data.selected_stages[0].value if data.selected_stages else "hr"

    # Convert stage enums to string values for JSON serialization
    stages_list = [s.value for s in data.selected_stages]

    session = InterviewSession(
        id=uuid.uuid4(),
        user_id=user_id,
        resume_id=data.resume_id,
        title=session_title,
        interview_type=data.interview_type.value,
        status=InterviewStatus.DRAFT.value,
        target_role=data.target_role,
        experience_level=data.experience_level.value,
        difficulty=data.difficulty.value,
        selected_stages=stages_list,
        duration_minutes=data.duration_minutes,
        current_stage=initial_stage,
    )

    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_interview_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
) -> InterviewSession:
    """Retrieve an interview session with strict user ownership enforcement."""
    stmt = (
        select(InterviewSession)
        .options(selectinload(InterviewSession.turns))
        .where(InterviewSession.id == session_id)
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview session not found."
        )

    if session.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this interview session."
        )

    return session


async def list_interview_sessions(
    db: AsyncSession,
    user_id: uuid.UUID,
    status_filter: Optional[str] = None,
) -> Tuple[List[InterviewSession], int]:
    """Retrieve all interview sessions for the authenticated user."""
    stmt = (
        select(InterviewSession)
        .options(selectinload(InterviewSession.turns))
        .where(InterviewSession.user_id == user_id)
    )

    if status_filter:
        stmt = stmt.where(InterviewSession.status == status_filter)

    stmt = stmt.order_by(InterviewSession.created_at.desc())
    result = await db.execute(stmt)
    sessions = list(result.scalars().all())

    return sessions, len(sessions)


async def update_interview_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    data: InterviewSessionUpdate,
) -> InterviewSession:
    """Update interview session title, status, or current stage with lifecycle validation."""
    session = await get_interview_session(db, user_id, session_id)

    if data.title is not None and data.title.strip():
        session.title = data.title.strip()

    if data.current_stage is not None:
        session.current_stage = data.current_stage.value

    if data.status is not None:
        new_status = data.status.value
        # Prevent reverting a completed interview back to draft
        if session.status == InterviewStatus.COMPLETED.value and new_status == InterviewStatus.DRAFT.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot revert a completed interview session to draft."
            )

        if new_status == InterviewStatus.COMPLETED.value and session.status != InterviewStatus.COMPLETED.value:
            session.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)

        session.status = new_status

    await db.commit()
    await db.refresh(session)
    return session


async def abandon_interview_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
) -> InterviewSession:
    """Mark an interview session as abandoned."""
    session = await get_interview_session(db, user_id, session_id)
    session.status = InterviewStatus.ABANDONED.value
    await db.commit()
    await db.refresh(session)
    return session


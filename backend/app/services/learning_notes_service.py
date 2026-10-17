import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.learning_note import LearningNote
from app.schemas.learning_note import LearningNoteCreate, LearningNoteUpdate


async def list_video_notes(
    db: AsyncSession,
    user_id: uuid.UUID,
    video_id: str,
    note_type: Optional[str] = None
) -> List[LearningNote]:
    """Retrieve all notes/bookmarks for a video belonging strictly to the authenticated user."""
    stmt = (
        select(LearningNote)
        .where(
            LearningNote.user_id == user_id,
            LearningNote.video_id == video_id
        )
    )
    if note_type:
        stmt = stmt.where(LearningNote.note_type == note_type)

    stmt = stmt.order_by(LearningNote.timestamp_seconds.asc(), LearningNote.created_at.asc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def get_note_by_id(
    db: AsyncSession,
    user_id: uuid.UUID,
    note_id: uuid.UUID
) -> Optional[LearningNote]:
    """Retrieve a single note by ID with user ownership check."""
    stmt = select(LearningNote).where(
        LearningNote.id == note_id,
        LearningNote.user_id == user_id
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def create_note(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: LearningNoteCreate
) -> LearningNote:
    """Create a timestamped personal note or bookmark for a video."""
    note = LearningNote(
        id=uuid.uuid4(),
        user_id=user_id,
        video_id=data.video_id,
        timestamp_seconds=data.timestamp_seconds,
        title=data.title,
        content=data.content,
        note_type=data.note_type,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


async def update_note(
    db: AsyncSession,
    user_id: uuid.UUID,
    note_id: uuid.UUID,
    data: LearningNoteUpdate
) -> Optional[LearningNote]:
    """Update an existing note/bookmark if owned by the user."""
    note = await get_note_by_id(db, user_id, note_id)
    if not note:
        return None

    if data.timestamp_seconds is not None:
        note.timestamp_seconds = data.timestamp_seconds
    if data.title is not None:
        note.title = data.title
    if data.content is not None:
        note.content = data.content
    if data.note_type is not None:
        note.note_type = data.note_type

    await db.commit()
    await db.refresh(note)
    return note


async def delete_note(
    db: AsyncSession,
    user_id: uuid.UUID,
    note_id: uuid.UUID
) -> bool:
    """Delete a note/bookmark if owned by the user."""
    note = await get_note_by_id(db, user_id, note_id)
    if not note:
        return False

    await db.delete(note)
    await db.commit()
    return True


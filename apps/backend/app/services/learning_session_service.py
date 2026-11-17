import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from fastapi import HTTPException, status

from app.models.learning_session import LearningSession
from app.models.learning_daily_activity import LearningDailyActivity
from app.schemas.learning import LearningSessionHeartbeat

async def process_heartbeat(
    db: AsyncSession,
    user_id: uuid.UUID,
    heartbeat: LearningSessionHeartbeat
) -> LearningSession:
    
    # 1. Validate Timestamps
    server_now = datetime.now(timezone.utc).replace(tzinfo=None)
    client_event_at = heartbeat.client_event_at.replace(tzinfo=None)
    
    if abs((server_now - client_event_at).total_seconds()) > 600:
        raise HTTPException(status_code=422, detail="Client timestamp too far out of sync with server")
        
    interval_end = client_event_at
    interval_start = interval_end - timedelta(seconds=heartbeat.wall_clock_seconds)
    
    # 2. Split activity across midnight
    day1 = interval_start.date()
    day2 = interval_end.date()
    
    splits = []
    if day1 == day2:
        splits.append((day1, heartbeat.played_content_seconds))
    else:
        midnight = datetime.combine(day2, datetime.min.time())
        duration_day1 = (midnight - interval_start).total_seconds()
        duration_day2 = (interval_end - midnight).total_seconds()
        
        total = duration_day1 + duration_day2
        if total > 0:
            ratio1 = duration_day1 / total
            content1 = int(heartbeat.played_content_seconds * ratio1)
            content2 = heartbeat.played_content_seconds - content1
            if content1 > 0:
                splits.append((day1, content1))
            if content2 > 0:
                splits.append((day2, content2))
        else:
            splits.append((day2, heartbeat.played_content_seconds))

    # 3. Fetch existing session
    stmt = select(LearningSession).where(LearningSession.id == heartbeat.session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    is_new = False
    
    if not session:
        session = LearningSession(
            id=heartbeat.session_id,
            user_id=user_id,
            content_id=heartbeat.content_id,
            content_type=heartbeat.content_type,
            started_at=interval_start, # start of first interval
            last_event_at=server_now,
            watched_content_seconds=heartbeat.played_content_seconds,
            wall_clock_seconds=heartbeat.wall_clock_seconds,
            last_position_seconds=heartbeat.position_seconds,
            last_sequence=heartbeat.sequence,
            status=heartbeat.status
        )
        db.add(session)
        is_new = True
    else:
        # Security check
        if session.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this session")

        # Content match check
        if session.content_id != heartbeat.content_id or session.content_type != heartbeat.content_type:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session content mismatch")
            
        # Idempotency / ordering check
        if heartbeat.sequence <= session.last_sequence:
            return session
            
        # Ended session check
        if session.status == "ended":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot update an ended session")
            
        # Increment times
        session.watched_content_seconds += heartbeat.played_content_seconds
        session.wall_clock_seconds += heartbeat.wall_clock_seconds
        session.last_position_seconds = heartbeat.position_seconds
        session.last_sequence = heartbeat.sequence
        session.status = heartbeat.status
        session.last_event_at = server_now

    # 4. Atomically Upsert Daily Activity
    for activity_date, content_seconds in splits:
        if content_seconds <= 0:
            continue
            
        insert_stmt = insert(LearningDailyActivity).values(
            user_id=user_id,
            content_id=heartbeat.content_id,
            content_type=heartbeat.content_type,
            activity_date=activity_date,
            watched_content_seconds=content_seconds,
            created_at=server_now,
            updated_at=server_now
        )
        
        upsert_stmt = insert_stmt.on_conflict_do_update(
            constraint="uq_user_content_date",
            set_={
                "watched_content_seconds": LearningDailyActivity.watched_content_seconds + insert_stmt.excluded.watched_content_seconds,
                "updated_at": server_now
            }
        )
        await db.execute(upsert_stmt)

    await db.commit()
    await db.refresh(session)
    return session

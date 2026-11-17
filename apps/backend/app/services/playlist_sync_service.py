import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem
from app.schemas.learning import YouTubePlaylistDetailed, YouTubePlaylistItem
from app.services.youtube_service_extensions import fetch_full_playlist_data

# Concurrency locks per playlist to prevent duplicate concurrent synchronizations
_playlist_sync_locks: Dict[str, asyncio.Lock] = {}
_playlist_locks_mutex = asyncio.Lock()


async def _get_playlist_lock(playlist_id: str) -> asyncio.Lock:
    """Get or create an in-flight mutex lock for identical playlist sync requests."""
    async with _playlist_locks_mutex:
        if playlist_id not in _playlist_sync_locks:
            _playlist_sync_locks[playlist_id] = asyncio.Lock()
        return _playlist_sync_locks[playlist_id]


async def get_or_sync_playlist(
    db: AsyncSession,
    playlist_id: str,
    user_id: Optional[uuid.UUID] = None
) -> YouTubePlaylistDetailed:
    stmt = (
        select(LearningPlaylist)
        .options(selectinload(LearningPlaylist.items))
        .where(LearningPlaylist.playlist_id == playlist_id)
    )
    result = await db.execute(stmt)
    playlist_db = result.scalar_one_or_none()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Cache for 24 hours
    needs_sync = True
    if playlist_db:
        if playlist_db.synced_at and (now - playlist_db.synced_at) < timedelta(hours=24):
            needs_sync = False

    if not needs_sync and playlist_db:
        return await _build_schema(db, playlist_db, user_id)

    # Concurrency-safe synchronization under playlist-specific lock
    lock = await _get_playlist_lock(playlist_id)
    async with lock:
        # Cross-worker concurrency protection via PostgreSQL transaction-level advisory lock
        if db.bind and db.bind.dialect.name == "postgresql":
            from sqlalchemy import text
            await db.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:pl_id))"),
                {"pl_id": playlist_id}
            )

        # Re-check database inside lock in case another concurrent request or worker just completed the sync
        stmt = (
            select(LearningPlaylist)
            .options(selectinload(LearningPlaylist.items))
            .execution_options(populate_existing=True)
            .where(LearningPlaylist.playlist_id == playlist_id)
        )
        result = await db.execute(stmt)
        playlist_db = result.scalar_one_or_none()

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if playlist_db and playlist_db.synced_at and (now - playlist_db.synced_at) < timedelta(hours=24):
            return await _build_schema(db, playlist_db, user_id)

        try:
            meta, items_data = await fetch_full_playlist_data(playlist_id)
        except Exception as e:
            # If YouTube API fails, fallback to DB if exists
            if playlist_db:
                return await _build_schema(db, playlist_db, user_id)
            raise e

        # Transform items
        snippet = meta.get("snippet", {})
        content_details = meta.get("contentDetails", {})
        thumbnails = snippet.get("thumbnails", {})
        thumbnail_url = (
            thumbnails.get("high", {}).get("url") or 
            thumbnails.get("medium", {}).get("url") or 
            thumbnails.get("default", {}).get("url", "")
        )

        total_duration = 0
        all_durations_available = True

        # Calculate totals
        for item in items_data:
            if not item.get("duration_iso"):
                all_durations_available = False
            else:
                total_duration += item.get("duration_seconds", 0)

        if not playlist_db:
            playlist_db = LearningPlaylist(playlist_id=playlist_id)
            db.add(playlist_db)

        playlist_db.title = snippet.get("title", "")
        playlist_db.description = snippet.get("description", "")
        playlist_db.channel_title = snippet.get("channelTitle", "")
        playlist_db.thumbnail_url = thumbnail_url
        playlist_db.item_count = content_details.get("itemCount", len(items_data))
        playlist_db.total_duration_seconds = total_duration
        playlist_db.duration_available = all_durations_available
        playlist_db.synced_at = now

        await db.flush()

        # In-place atomic reconciliation:
        # Reconcile existing items via explicit query to avoid lazy load issues across transactions
        stmt_existing = select(LearningPlaylistItem).where(
            LearningPlaylistItem.playlist_internal_id == playlist_db.id
        )
        existing_items = (await db.execute(stmt_existing)).scalars().all()
        existing_items_map = {item.video_id: item for item in existing_items}
        incoming_video_ids = set()

        for item_data in items_data:
            v_id = item_data["video_id"]
            incoming_video_ids.add(v_id)
            i_thumbnails = item_data.get("thumbnails", {})
            i_thumb_url = (
                i_thumbnails.get("high", {}).get("url") or 
                i_thumbnails.get("medium", {}).get("url") or 
                i_thumbnails.get("default", {}).get("url", "")
            )
            pos = item_data["position"]
            dur = item_data.get("duration_seconds")
            title = item_data["title"]

            if v_id in existing_items_map:
                # Update in-place
                db_item = existing_items_map[v_id]
                db_item.title = title
                db_item.thumbnail_url = i_thumb_url
                db_item.position = pos
                db_item.duration_seconds = dur
            else:
                # Insert new item
                db_item = LearningPlaylistItem(
                    playlist_internal_id=playlist_db.id,
                    video_id=v_id,
                    title=title,
                    thumbnail_url=i_thumb_url,
                    position=pos,
                    duration_seconds=dur
                )
                db.add(db_item)

        # Delete only items that were removed upstream
        for v_id, old_item in existing_items_map.items():
            if v_id not in incoming_video_ids:
                await db.delete(old_item)

        await db.commit()
        await db.refresh(playlist_db, ["items"])

    return await _build_schema(db, playlist_db, user_id)


async def _build_schema(
    db: AsyncSession,
    db_obj: LearningPlaylist,
    user_id: Optional[uuid.UUID] = None
) -> YouTubePlaylistDetailed:
    items_schema = []
    sorted_items = sorted(db_obj.items, key=lambda x: x.position)
    video_ids = [db_item.video_id for db_item in sorted_items]

    # Batch-fetch progress for authenticated user
    progress_map = {}
    if user_id and video_ids:
        from app.models.learning_progress import LearningProgress
        prog_stmt = select(LearningProgress).where(
            LearningProgress.user_id == user_id,
            LearningProgress.content_id.in_(video_ids),
            LearningProgress.content_type == "video"
        )
        prog_res = await db.execute(prog_stmt)
        for p in prog_res.scalars().all():
            progress_map[p.content_id] = p

    completed_count = 0
    next_incomplete_video_id = None

    for item in sorted_items:
        if user_id:
            prog = progress_map.get(item.video_id)
            is_completed = prog.completed if prog else False
            if is_completed:
                completed_count += 1
            elif next_incomplete_video_id is None:
                next_incomplete_video_id = item.video_id

            prog_seconds = prog.progress_seconds if prog else 0
            prog_percent = prog.progress_percent if prog else 0.0
        else:
            is_completed = None
            prog_seconds = None
            prog_percent = None

        items_schema.append(YouTubePlaylistItem(
            video_id=item.video_id,
            title=item.title,
            thumbnail_url=item.thumbnail_url,
            position=item.position,
            duration_seconds=item.duration_seconds,
            video_url=f"https://www.youtube.com/watch?v={item.video_id}",
            progress_seconds=prog_seconds,
            progress_percent=prog_percent,
            completed=is_completed
        ))

    return YouTubePlaylistDetailed(
        id=db_obj.playlist_id,
        title=db_obj.title,
        description=db_obj.description,
        thumbnailUrl=db_obj.thumbnail_url,
        channelTitle=db_obj.channel_title,
        itemCount=db_obj.item_count,
        url=f"https://www.youtube.com/playlist?list={db_obj.playlist_id}",
        total_duration_seconds=db_obj.total_duration_seconds,
        duration_available=db_obj.duration_available,
        synced_at=db_obj.synced_at,
        items=items_schema,
        completed_count=completed_count if user_id else None,
        total_count=len(sorted_items) if user_id else None,
        next_incomplete_video_id=next_incomplete_video_id if user_id else None
    )

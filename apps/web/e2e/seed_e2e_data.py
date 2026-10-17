import asyncio
import uuid
import sys
import os
from datetime import datetime, timezone, timedelta

# Ensure backend app is on sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Ensure E2E database isolation: always use test_placement_os
target_db = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://placement_os:placement_os_dev@localhost:5434/test_placement_os"
)
if "test_placement_os" not in target_db:
    raise RuntimeError(
        f"SAFETY GUARD: E2E seed script must ONLY target 'test_placement_os'. Target was: {target_db}"
    )
os.environ["DATABASE_URL"] = target_db

from sqlalchemy import select, delete
from app.core.database import AsyncSessionLocal, engine
from app.models.base import Base
# Import all models to ensure metadata registration
import app.models.user
import app.models.learning_progress
import app.models.learning_plan
import app.models.learning_session
import app.models.learning_daily_activity
import app.models.learning_playlist
import app.models.learning_playlist_item
import app.models.learning_note
import app.models.interview_session
import app.models.interview_turn
import app.models.resume
import app.models.learning_search_cache

from app.models.learning_playlist import LearningPlaylist
from app.models.learning_playlist_item import LearningPlaylistItem
from app.models.learning_search_cache import LearningSearchCache

PLAYLIST_ID = "PL_E2E_PLAYWRIGHT_COURSE"
VIDEO_1_ID = "VID_E2E_P01"
VIDEO_2_ID = "VID_E2E_P02"
QUERY = "playwright e2e"

async def seed():
    # 0. Ensure schema exists in test database
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. Clean existing test playlist if any
        stmt = select(LearningPlaylist).where(LearningPlaylist.playlist_id == PLAYLIST_ID)
        res = await session.execute(stmt)
        existing_pl = res.scalars().first()
        if existing_pl:
            await session.delete(existing_pl)
            await session.commit()

        # 2. Insert playlist
        pl_internal_id = uuid.uuid4()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        
        pl = LearningPlaylist(
            id=pl_internal_id,
            playlist_id=PLAYLIST_ID,
            title="Playwright E2E Masterclass",
            channel_title="Antigravity QA",
            thumbnail_url="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
            description="Deterministic playlist for E2E tests.",
            total_duration_seconds=1800,
            item_count=2,
            duration_available=True,
            synced_at=now,
        )
        session.add(pl)

        item1 = LearningPlaylistItem(
            id=uuid.uuid4(),
            playlist_internal_id=pl_internal_id,
            video_id=VIDEO_1_ID,
            title="01 - Introduction to E2E Verification",
            thumbnail_url="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
            position=0,
            duration_seconds=600,
        )
        item2 = LearningPlaylistItem(
            id=uuid.uuid4(),
            playlist_internal_id=pl_internal_id,
            video_id=VIDEO_2_ID,
            title="02 - Full Regression Testing",
            thumbnail_url="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
            position=1,
            duration_seconds=1200,
        )
        session.add(item1)
        session.add(item2)

        # 3. Clean and seed search cache
        await session.execute(
            delete(LearningSearchCache).where(LearningSearchCache.query_normalized == QUERY)
        )
        cache_entry = LearningSearchCache(
            query_normalized=QUERY,
            page_token="",
            response_data={
                "query": QUERY,
                "videos": [],
                "playlists": [
                    {
                        "id": PLAYLIST_ID,
                        "title": "Playwright E2E Masterclass",
                        "description": "Deterministic playlist for E2E tests.",
                        "thumbnailUrl": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
                        "channelTitle": "Antigravity QA",
                        "itemCount": 2,
                        "url": f"https://www.youtube.com/playlist?list={PLAYLIST_ID}",
                    }
                ],
                "nextPageToken": None,
            },
            cached_at=now,
            expires_at=now + timedelta(days=7),
        )
        session.add(cache_entry)
        await session.commit()
        print("Successfully seeded E2E test data into database.")

if __name__ == "__main__":
    asyncio.run(seed())

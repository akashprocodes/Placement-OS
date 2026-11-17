import asyncio
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
import logging
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.schemas.learning import LearningSearchResult, YouTubeVideo, YouTubePlaylist
from app.models.learning_search_cache import LearningSearchCache

YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3"
TIMEOUT_SECONDS = 10.0
CACHE_TTL_HOURS = 24

logger = logging.getLogger(__name__)


# ─── Custom Exceptions ───────────────────────────────────────────────────────

class YouTubeServiceError(Exception):
    """Base exception for YouTube API request failures."""
    pass


class YouTubeQuotaError(YouTubeServiceError):
    """Raised when YouTube API quota is exceeded."""
    pass


class YouTubeTimeoutError(YouTubeServiceError):
    """Raised when request to YouTube API times out or network connection fails."""
    pass


# ─── Query Normalization & Concurrency Controls ──────────────────────────────

def normalize_query(query: str) -> str:
    """Normalize query by stripping whitespace, collapsing multiple spaces, and lowercasing."""
    if not query:
        return ""
    return " ".join(query.strip().lower().split())


_inflight_locks: Dict[str, asyncio.Lock] = {}
_locks_mutex = asyncio.Lock()


async def _get_inflight_lock(key: str) -> asyncio.Lock:
    """Get or create an in-flight mutex lock for identical concurrent query requests."""
    async with _locks_mutex:
        if key not in _inflight_locks:
            _inflight_locks[key] = asyncio.Lock()
        return _inflight_locks[key]


# ─── Cache Management ────────────────────────────────────────────────────────

async def get_cached_search(
    db: AsyncSession,
    query_normalized: str,
    page_token: str = ""
) -> Optional[LearningSearchResult]:
    """Retrieve non-expired search results from PostgreSQL cache."""
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        stmt = (
            select(LearningSearchCache)
            .where(
                LearningSearchCache.query_normalized == query_normalized,
                LearningSearchCache.page_token == page_token,
                LearningSearchCache.expires_at > now,
            )
        )
        res = await db.execute(stmt)
        record = res.scalars().first()
        if record and record.response_data:
            return LearningSearchResult.model_validate(record.response_data)
        return None
    except Exception as e:
        logger.warning(f"Error reading search cache: {str(e)}")
        return None


async def get_stale_cached_search(
    db: AsyncSession,
    query_normalized: str,
    page_token: str = ""
) -> Optional[LearningSearchResult]:
    """Retrieve stale (even if expired) search results from PostgreSQL cache during upstream quota exhaustion."""
    try:
        stmt = (
            select(LearningSearchCache)
            .where(
                LearningSearchCache.query_normalized == query_normalized,
                LearningSearchCache.page_token == page_token,
            )
            .order_by(LearningSearchCache.cached_at.desc())
        )
        res = await db.execute(stmt)
        record = res.scalars().first()
        if record and record.response_data:
            return LearningSearchResult.model_validate(record.response_data)
        return None
    except Exception as e:
        logger.warning(f"Error reading stale search cache: {str(e)}")
        return None


async def save_search_cache(
    db: AsyncSession,
    query_normalized: str,
    page_token: str,
    result: LearningSearchResult
) -> None:
    """Save or update search results in PostgreSQL cache with 24-hour TTL."""
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expires_at = now + timedelta(hours=CACHE_TTL_HOURS)

        stmt = select(LearningSearchCache).where(
            LearningSearchCache.query_normalized == query_normalized,
            LearningSearchCache.page_token == page_token
        )
        res = await db.execute(stmt)
        record = res.scalars().first()

        data_dict = result.model_dump()
        if record:
            record.response_data = data_dict
            record.cached_at = now
            record.expires_at = expires_at
        else:
            record = LearningSearchCache(
                query_normalized=query_normalized,
                page_token=page_token,
                response_data=data_dict,
                cached_at=now,
                expires_at=expires_at
            )
            db.add(record)
        await db.commit()
    except Exception as e:
        logger.warning(f"Error saving search cache: {str(e)}")
        try:
            await db.rollback()
        except Exception:
            pass


async def invalidate_search_cache(
    db: AsyncSession,
    query: str
) -> int:
    """Explicitly invalidate search cache entries for a given query."""
    try:
        normalized = normalize_query(query)
        stmt = delete(LearningSearchCache).where(
            LearningSearchCache.query_normalized == normalized
        )
        res = await db.execute(stmt)
        await db.commit()
        return res.rowcount or 0
    except Exception as e:
        logger.warning(f"Error invalidating search cache: {str(e)}")
        try:
            await db.rollback()
        except Exception:
            pass
        return 0


# ─── Batched Duration Enrichment ─────────────────────────────────────────────

async def _enrich_video_durations(
    client: httpx.AsyncClient,
    api_key: str,
    videos: List[YouTubeVideo]
) -> None:
    """Enrich video items with ISO durations via a single batched videos.list call."""
    if not videos:
        return

    video_ids = [v.id for v in videos[:50] if v.id]
    if not video_ids:
        return

    url = f"{YOUTUBE_API_URL}/videos"
    params = {
        "part": "contentDetails",
        "id": ",".join(video_ids),
        "key": api_key
    }

    try:
        response = await client.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            duration_map: Dict[str, str] = {}
            for item in data.get("items", []):
                vid = item.get("id")
                dur = item.get("contentDetails", {}).get("duration")
                if isinstance(vid, str) and dur:
                    duration_map[vid] = dur

            for video in videos:
                if video.id in duration_map:
                    video.duration = duration_map[video.id]
        else:
            logger.warning(f"Video duration enrichment returned status {response.status_code}")
    except Exception as exc:
        logger.warning(f"Video duration enrichment failed: {str(exc)}")


# ─── Search Learning Content ─────────────────────────────────────────────────

async def search_learning_content(
    query: str,
    page_token: Optional[str] = None,
    db: Optional[AsyncSession] = None,
    use_cache: bool = True
) -> LearningSearchResult:
    settings = get_settings()
    api_key = settings.YOUTUBE_API_KEY

    if not api_key:
        raise ValueError("YOUTUBE_API_KEY is not configured.")

    token = (page_token or "").strip()
    norm_query = normalize_query(query)

    # 1. Check database cache if db session is provided
    if db is not None and use_cache and norm_query:
        cached = await get_cached_search(db, norm_query, token)
        if cached is not None:
            return cached

    # 2. In-flight mutex deduplication for concurrent identical requests
    lock_key = f"{norm_query}:{token}"
    lock = await _get_inflight_lock(lock_key)

    async with lock:
        # Check cache again inside lock in case another task just populated it
        if db is not None and use_cache and norm_query:
            cached = await get_cached_search(db, norm_query, token)
            if cached is not None:
                return cached

        # 3. Call upstream YouTube API
        search_url = f"{YOUTUBE_API_URL}/search"
        params = {
            "part": "snippet",
            "q": query,
            "type": "video,playlist",
            "maxResults": 12,
            "key": api_key,
            "safeSearch": "moderate"
        }
        if token:
            params["pageToken"] = token

        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                try:
                    response = await client.get(search_url, params=params)
                    if response.status_code == 403:
                        try:
                            err_data = response.json()
                            errors = err_data.get("error", {}).get("errors", [])
                            reasons = [e.get("reason", "") for e in errors]
                            if "quotaExceeded" in reasons or "quotaExceeded" in response.text:
                                logger.error("YouTube Data API quota exceeded")
                                raise YouTubeQuotaError("YouTube API quota exceeded")
                        except YouTubeQuotaError:
                            raise
                        except Exception:
                            pass
                    response.raise_for_status()
                    data = response.json()
                except YouTubeQuotaError:
                    raise
                except httpx.HTTPStatusError as exc:
                    status_code = exc.response.status_code if exc.response else "unknown"
                    logger.error(f"YouTube API error: {status_code}")
                    if exc.response and ("quotaExceeded" in exc.response.text or exc.response.status_code == 403):
                        raise YouTubeQuotaError("YouTube API quota exceeded")
                    raise YouTubeServiceError("YouTube API request failed")
                except httpx.RequestError as exc:
                    logger.error(f"YouTube API request error: {type(exc).__name__}")
                    raise YouTubeTimeoutError("Failed to connect to YouTube API")

                videos: List[YouTubeVideo] = []
                playlists: List[YouTubePlaylist] = []

                for item in data.get("items", []):
                    snippet = item.get("snippet", {})
                    item_id = item.get("id", {})

                    thumbnails = snippet.get("thumbnails", {})
                    thumbnail_url = (
                        thumbnails.get("high", {}).get("url") or 
                        thumbnails.get("medium", {}).get("url") or 
                        thumbnails.get("default", {}).get("url", "")
                    )

                    title = snippet.get("title", "")
                    description = snippet.get("description", "")
                    channel_title = snippet.get("channelTitle", "")
                    published_at = snippet.get("publishedAt", "")

                    kind = item_id.get("kind", "")

                    if kind == "youtube#video":
                        video_id = item_id.get("videoId")
                        if video_id:
                            videos.append(YouTubeVideo(
                                id=video_id,
                                title=title,
                                description=description,
                                thumbnailUrl=thumbnail_url,
                                channelTitle=channel_title,
                                publishedAt=published_at,
                                url=f"https://www.youtube.com/watch?v={video_id}"
                            ))
                    elif kind == "youtube#playlist":
                        playlist_id = item_id.get("playlistId")
                        if playlist_id:
                            playlists.append(YouTubePlaylist(
                                id=playlist_id,
                                title=title,
                                description=description,
                                thumbnailUrl=thumbnail_url,
                                channelTitle=channel_title,
                                itemCount=None,
                                url=f"https://www.youtube.com/playlist?list={playlist_id}"
                            ))

                # 4. Batched Duration Enrichment (1 batch request for up to 50 videos)
                await _enrich_video_durations(client, api_key, videos)

                next_page_token = data.get("nextPageToken")

                result = LearningSearchResult(
                    query=query,
                    videos=videos,
                    playlists=playlists,
                    nextPageToken=next_page_token
                )

                # 5. Save to PostgreSQL search cache
                if db is not None and use_cache and norm_query:
                    await save_search_cache(db, norm_query, token, result)

                return result
        except YouTubeQuotaError:
            if db is not None and norm_query:
                stale = await get_stale_cached_search(db, norm_query, token)
                if stale is not None:
                    logger.warning(f"YouTube quota exceeded. Serving stale cached search for: '{norm_query}'")
                    return stale
            raise


async def get_video_details(video_id: str) -> YouTubeVideo:
    settings = get_settings()
    api_key = settings.YOUTUBE_API_KEY
    if not api_key:
        raise ValueError("YOUTUBE_API_KEY is not configured.")

    url = f"{YOUTUBE_API_URL}/videos"
    params = {
        "part": "snippet,contentDetails",
        "id": video_id,
        "key": api_key
    }

    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        try:
            response = await client.get(url, params=params)
            if response.status_code == 403 and "quotaExceeded" in response.text:
                raise YouTubeQuotaError("YouTube API quota exceeded")
            response.raise_for_status()
            data = response.json()
        except YouTubeQuotaError:
            raise
        except (httpx.TimeoutException, httpx.ConnectTimeout):
            raise YouTubeTimeoutError("Failed to connect to YouTube API")
        except httpx.HTTPError:
            raise Exception("Failed to fetch video details")

    items = data.get("items", [])
    if not items:
        raise ValueError(f"Video {video_id} not found")
        
    item = items[0]
    snippet = item.get("snippet", {})
    content_details = item.get("contentDetails", {})
    thumbnails = snippet.get("thumbnails", {})
    thumbnail_url = (
        thumbnails.get("high", {}).get("url") or 
        thumbnails.get("medium", {}).get("url") or 
        thumbnails.get("default", {}).get("url", "")
    )
    
    return YouTubeVideo(
        id=video_id,
        title=snippet.get("title", ""),
        description=snippet.get("description", ""),
        thumbnailUrl=thumbnail_url,
        channelTitle=snippet.get("channelTitle", ""),
        publishedAt=snippet.get("publishedAt", ""),
        duration=content_details.get("duration"),
        url=f"https://www.youtube.com/watch?v={video_id}"
    )

async def get_playlist_details(playlist_id: str) -> YouTubePlaylist:
    settings = get_settings()
    api_key = settings.YOUTUBE_API_KEY
    if not api_key:
        raise ValueError("YOUTUBE_API_KEY is not configured.")

    url = f"{YOUTUBE_API_URL}/playlists"
    params = {
        "part": "snippet,contentDetails",
        "id": playlist_id,
        "key": api_key
    }

    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError:
            raise Exception("Failed to fetch playlist details")

    items = data.get("items", [])
    if not items:
        raise ValueError(f"Playlist {playlist_id} not found")
        
    item = items[0]
    snippet = item.get("snippet", {})
    content_details = item.get("contentDetails", {})
    
    thumbnails = snippet.get("thumbnails", {})
    thumbnail_url = (
        thumbnails.get("high", {}).get("url") or 
        thumbnails.get("medium", {}).get("url") or 
        thumbnails.get("default", {}).get("url", "")
    )
    
    return YouTubePlaylist(
        id=playlist_id,
        title=snippet.get("title", ""),
        description=snippet.get("description", ""),
        thumbnailUrl=thumbnail_url,
        channelTitle=snippet.get("channelTitle", ""),
        itemCount=content_details.get("itemCount"),
        url=f"https://www.youtube.com/playlist?list={playlist_id}"
    )

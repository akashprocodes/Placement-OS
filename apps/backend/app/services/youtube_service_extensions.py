import re
import math
import httpx
from typing import List, Dict, Any, Tuple
from app.core.config import get_settings
from app.schemas.learning import YouTubePlaylistDetailed, YouTubePlaylistItem
import logging

YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3"
TIMEOUT_SECONDS = 30.0

logger = logging.getLogger(__name__)

def parse_iso_duration(duration_str: str) -> int:
    if not duration_str:
        return 0
    # A simple regex for ISO 8601 duration: PT1H2M10S
    match = re.match(r'^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$', duration_str)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds

async def fetch_full_playlist_data(playlist_id: str) -> Tuple[Dict, List[Dict]]:
    settings = get_settings()
    api_key = settings.YOUTUBE_API_KEY
    if not api_key:
        raise ValueError("YOUTUBE_API_KEY is not configured.")

    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        # 1. Fetch Playlist Metadata
        pl_url = f"{YOUTUBE_API_URL}/playlists"
        pl_params = {"part": "snippet,contentDetails", "id": playlist_id, "key": api_key}
        
        pl_res = await client.get(pl_url, params=pl_params)
        pl_res.raise_for_status()
        pl_data = pl_res.json()
        
        items = pl_data.get("items", [])
        if not items:
            raise ValueError(f"Playlist {playlist_id} not found")
        playlist_meta = items[0]
        
        # 2. Fetch Playlist Items Paginated
        items_url = f"{YOUTUBE_API_URL}/playlistItems"
        page_token = None
        all_playlist_items = []
        
        while True:
            params = {
                "part": "snippet",
                "playlistId": playlist_id,
                "maxResults": 50,
                "key": api_key
            }
            if page_token:
                params["pageToken"] = page_token
                
            res = await client.get(items_url, params=params)
            res.raise_for_status()
            data = res.json()
            
            for item in data.get("items", []):
                snippet = item.get("snippet", {})
                # only keep videos (e.g. might be a deleted video)
                video_id = snippet.get("resourceId", {}).get("videoId")
                if video_id:
                    all_playlist_items.append({
                        "video_id": video_id,
                        "title": snippet.get("title", ""),
                        "position": snippet.get("position", 0),
                        "thumbnails": snippet.get("thumbnails", {})
                    })
            
            page_token = data.get("nextPageToken")
            if not page_token:
                break
                
        # 3. Batch fetch video durations
        # we can request up to 50 videos at a time
        durations_map = {}
        video_ids = [item["video_id"] for item in all_playlist_items]
        
        videos_url = f"{YOUTUBE_API_URL}/videos"
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i:i+50]
            v_params = {
                "part": "contentDetails",
                "id": ",".join(batch),
                "key": api_key
            }
            v_res = await client.get(videos_url, params=v_params)
            if v_res.status_code == 200:
                v_data = v_res.json()
                for v_item in v_data.get("items", []):
                    v_id = v_item.get("id")
                    dur = v_item.get("contentDetails", {}).get("duration", "")
                    durations_map[v_id] = dur

        for item in all_playlist_items:
            item["duration_iso"] = durations_map.get(item["video_id"], "")
            item["duration_seconds"] = parse_iso_duration(item["duration_iso"])
            
        return playlist_meta, all_playlist_items


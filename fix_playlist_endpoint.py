import re

with open("backend/app/api/endpoints/learning.py", "r") as f:
    text = f.read()

replacement = """@router.get("/playlist/{playlist_id}", response_model=YouTubePlaylistDetailed)
async def get_playlist(
    playlist_id: str,
    db: AsyncSession = Depends(get_db)
):
    from app.services.playlist_sync_service import get_or_sync_playlist
    try:
        return await get_or_sync_playlist(db, playlist_id)
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Playlist not found")
        raise HTTPException(status_code=503, detail="Service unavailable.")
    except Exception as e:
        logger.error(f"Error fetching playlist: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unavailable.")"""

text = re.sub(r'@router\.get\("/playlist/\{playlist_id\}", response_model=YouTubePlaylist\).*?raise HTTPException\(status_code=503, detail="Service unavailable."\)', replacement, text, flags=re.DOTALL)

with open("backend/app/api/endpoints/learning.py", "w") as f:
    f.write(text)

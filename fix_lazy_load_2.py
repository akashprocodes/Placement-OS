import re

with open("backend/app/services/playlist_sync_service.py", "r") as f:
    text = f.read()

replacement = """        for item_data in items_data:
            i_thumbnails = item_data.get("thumbnails", {})
            i_thumb_url = (
                i_thumbnails.get("high", {}).get("url") or 
                i_thumbnails.get("medium", {}).get("url") or 
                i_thumbnails.get("default", {}).get("url", "")
            )
            
            db_item = LearningPlaylistItem(
                playlist_internal_id=playlist_db.id,
                video_id=item_data["video_id"],
                title=item_data["title"],
                thumbnail_url=i_thumb_url,
                position=item_data["position"],
                duration_seconds=item_data.get("duration_seconds")
            )
            db.add(db_item)
            
        await db.commit()
        await db.refresh(playlist_db, ["items"])"""

text = re.sub(r'        for item_data in items_data:.*await db\.refresh\(playlist_db, \["items"\]\)', replacement, text, flags=re.DOTALL)

with open("backend/app/services/playlist_sync_service.py", "w") as f:
    f.write(text)

import re

with open("backend/app/services/playlist_sync_service.py", "r") as f:
    text = f.read()

replacement = """        # Sync items
        await db.flush()
        
        # Explicit delete to avoid lazy load issues on new/flushed objects
        from sqlalchemy import delete
        await db.execute(delete(LearningPlaylistItem).where(LearningPlaylistItem.playlist_internal_id == playlist_db.id))
        
        # We also need to clear it from the session if it was loaded, but 
        # since we just deleted from db, it's safer to just set the list to empty
        # or we just let SQLAlchemy handle it.
        # But we can just create new ones.
        for item_data in items_data:"""

text = re.sub(r'# Sync items.*?for item_data in items_data:', replacement, text, flags=re.DOTALL)

with open("backend/app/services/playlist_sync_service.py", "w") as f:
    f.write(text)

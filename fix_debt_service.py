import re

with open("backend/app/services/learning_debt_service.py", "r") as f:
    text = f.read()

replacement = """    if plan.content_type == "playlist":
        from app.models.learning_playlist import LearningPlaylist
        from app.models.learning_playlist_item import LearningPlaylistItem
        
        # Get all video IDs in this playlist
        video_ids_stmt = select(LearningPlaylistItem.video_id).join(
            LearningPlaylist, LearningPlaylist.id == LearningPlaylistItem.playlist_internal_id
        ).where(LearningPlaylist.playlist_id == plan.content_id)
        video_ids = (await db.execute(video_ids_stmt)).scalars().all()
        
        if not video_ids:
            daily_completed = {}
        else:
            session_stmt = select(
                LearningDailyActivity.activity_date,
                func.sum(LearningDailyActivity.watched_content_seconds).label("watched_content_seconds")
            ).where(
                LearningDailyActivity.user_id == user_id,
                LearningDailyActivity.content_id.in_(video_ids),
                LearningDailyActivity.content_type == "video"
            ).group_by(LearningDailyActivity.activity_date)
            session_result = await db.execute(session_stmt)
            daily_completed = {row.activity_date: row.watched_content_seconds for row in session_result.all()}
    else:
        # 2. Fetch Sessions grouped by Date from Daily Activity Ledger
        session_stmt = select(
            LearningDailyActivity.activity_date,
            func.sum(LearningDailyActivity.watched_content_seconds).label("watched_content_seconds")
        ).where(
            LearningDailyActivity.user_id == user_id,
            LearningDailyActivity.content_id == plan.content_id,
            LearningDailyActivity.content_type == plan.content_type
        ).group_by(LearningDailyActivity.activity_date)
        
        session_result = await db.execute(session_stmt)
        daily_completed = {row.activity_date: row.watched_content_seconds for row in session_result.all()}"""

text = re.sub(r'# 2\. Fetch Sessions grouped by Date from Daily Activity Ledger.*?daily_completed = \{row\.activity_date: row\.watched_content_seconds for row in session_result\.all\(\)\}', replacement, text, flags=re.DOTALL)

with open("backend/app/services/learning_debt_service.py", "w") as f:
    f.write(text)

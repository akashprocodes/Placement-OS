import re

with open("backend/tests/test_learning_plan_lifecycle.py", "r") as f:
    text = f.read()

replacement = """pl = LearningPlaylist(
            playlist_id="pl_1",
            title="Test Playlist",
            channel_title="Test Channel",
            thumbnail_url="http://example.com/thumb.jpg",
            description="Desc",
            total_duration_seconds=300,
            item_count=2,
            duration_available=True
        )"""

text = re.sub(r'pl = LearningPlaylist\([^\)]+\)', replacement, text)

with open("backend/tests/test_learning_plan_lifecycle.py", "w") as f:
    f.write(text)

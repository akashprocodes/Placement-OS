with open("backend/app/schemas/learning.py", "r") as f:
    text = f.read()

replacement = """class YouTubePlaylistItem(BaseModel):
    video_id: str
    title: str
    thumbnail_url: str
    position: int
    duration_seconds: Optional[int] = None
    video_url: str

class YouTubePlaylistDetailed(BaseModel):
    id: str
    title: str
    description: str
    thumbnailUrl: str
    channelTitle: str
    itemCount: Optional[int] = None
    url: str
    total_duration_seconds: int = 0
    duration_available: bool = False
    synced_at: Optional[datetime] = None
    items: List[YouTubePlaylistItem] = []

class YouTubePlaylist(BaseModel):
"""

import re
if "class YouTubePlaylistDetailed" not in text:
    text = text.replace("class YouTubePlaylist(BaseModel):", replacement)

# ensure datetime is imported
if "from datetime import datetime" not in text:
    text = text.replace("from typing import List, Optional, Any", "from typing import List, Optional, Any\nfrom datetime import datetime")

with open("backend/app/schemas/learning.py", "w") as f:
    f.write(text)

import re

with open("backend/app/models/learning_progress.py", "r") as f:
    text = f.read()

replacement = """    last_watched_at: Mapped[datetime] = mapped_column(server_default=text("now()"), onupdate=text("now()"))"""

text = re.sub(r'    last_watched_at: Mapped\[datetime\] = mapped_column\(server_default="now\(\)", onupdate="now\(\)"\)', replacement, text)

if "from sqlalchemy import text" not in text and "from sqlalchemy import " in text:
    text = text.replace("from sqlalchemy import ", "from sqlalchemy import text, ")

with open("backend/app/models/learning_progress.py", "w") as f:
    f.write(text)

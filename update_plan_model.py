import re

with open("backend/app/models/learning_plan.py", "r") as f:
    text = f.read()

replacement = """    status: Mapped[str] = mapped_column(String(50), default="active")
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)"""

text = re.sub(r'    status: Mapped\[str\] = mapped_column\(String\(50\), default="active"\)', replacement, text)

with open("backend/app/models/learning_plan.py", "w") as f:
    f.write(text)

import re

with open("backend/app/schemas/learning.py", "r") as f:
    text = f.read()

replacement = """class LearningPlanProgress(BaseModel):
    plan_id: str
    target_completion_date: str
    daily_target_seconds: int
    completed_seconds_today: int
    base_target_seconds_today: int
    previous_debt_seconds: int
    required_seconds_today: int
    remaining_seconds_today: int
    current_debt_seconds: int
    current_date: str
    status: str
    completed_at: Optional[datetime] = None"""

text = re.sub(r'class LearningPlanProgress\(BaseModel\):.*?current_date: str', replacement, text, flags=re.DOTALL)

with open("backend/app/schemas/learning.py", "w") as f:
    f.write(text)

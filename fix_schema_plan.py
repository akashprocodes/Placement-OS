import re

with open("backend/app/schemas/learning.py", "r") as f:
    text = f.read()

replacement = """class LearningPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    content_id: str
    content_type: str
    title: str
    total_duration_seconds: int
    target_completion_date: date
    daily_target_seconds: int
    status: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime"""

text = re.sub(r'class LearningPlanResponse\(BaseModel\):.*?updated_at: datetime', replacement, text, flags=re.DOTALL)

with open("backend/app/schemas/learning.py", "w") as f:
    f.write(text)

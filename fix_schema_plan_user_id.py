import re

with open("backend/app/schemas/learning.py", "r") as f:
    text = f.read()

replacement = """class LearningPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    content_id: str"""

text = re.sub(r'class LearningPlanResponse\(BaseModel\):\n    model_config = ConfigDict\(from_attributes=True\)\n    id: uuid.UUID\n    content_id: str', replacement, text)

with open("backend/app/schemas/learning.py", "w") as f:
    f.write(text)

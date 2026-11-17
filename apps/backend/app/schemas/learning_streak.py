from pydantic import BaseModel, ConfigDict
from typing import Optional


class StudyStreakInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    current_streak: int = 0
    longest_streak: int = 0
    today_active: bool = False


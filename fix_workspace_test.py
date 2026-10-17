import re

with open("backend/tests/test_learning_workspace.py", "r") as f:
    text = f.read()

replacement = """import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from app.models.learning_plan import LearningPlan
from app.models.learning_progress import LearningProgress

async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password
    })
    response = await client.post("/api/v1/auth/login", data={
        "username": email,
        "password": password
    })
    data = response.json()
    return data["access_token"], data["user_id"]

def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}"""

text = re.sub(r'import pytest\nfrom httpx import AsyncClient\nfrom sqlalchemy\.ext\.asyncio import AsyncSession\nfrom datetime import datetime, timezone, timedelta\nfrom app\.models\.learning_plan import LearningPlan\nfrom app\.models\.learning_progress import LearningProgress\nfrom tests\.utils import register_and_login, auth', replacement, text)

with open("backend/tests/test_learning_workspace.py", "w") as f:
    f.write(text)

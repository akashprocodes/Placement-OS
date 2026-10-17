import re

with open("backend/app/api/__init__.py", "r") as f:
    text = f.read()

replacement = """from app.api.endpoints import learning, auth, health, learning_analytics

router = APIRouter()
router.include_router(learning.router, prefix="/learning", tags=["learning"])
router.include_router(learning_analytics.router, prefix="/learning/analytics", tags=["learning-analytics"])
"""

text = re.sub(r'from app\.api\.endpoints import learning, auth, health\n\nrouter = APIRouter\(\)\nrouter\.include_router\(learning\.router, prefix="/learning", tags=\["learning"\]\)', replacement, text)

with open("backend/app/api/__init__.py", "w") as f:
    f.write(text)

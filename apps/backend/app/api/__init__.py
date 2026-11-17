from fastapi import APIRouter
from app.api.endpoints import learning, auth, health, learning_analytics, interview

router = APIRouter()
router.include_router(learning.router, prefix="/learning", tags=["learning"])
router.include_router(learning_analytics.router, prefix="/learning/analytics", tags=["learning-analytics"])
router.include_router(interview.router, prefix="/interviews", tags=["interviews"])

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(health.router, prefix="/health", tags=["health"])

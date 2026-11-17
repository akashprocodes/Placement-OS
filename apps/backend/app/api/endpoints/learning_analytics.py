from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date, timedelta, datetime, timezone
import uuid

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.learning_analytics import LearningAnalyticsResponse
from app.services import learning_analytics_service

router = APIRouter()

@router.get("/dashboard", response_model=LearningAnalyticsResponse)
async def get_analytics_dashboard(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today = datetime.now(timezone.utc).date()
    
    if not end_date:
        end_date = today
    if not start_date:
        # Default 30 days including today
        start_date = end_date - timedelta(days=29)
        
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be after end_date"
        )

    if (end_date - start_date).days > 366:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date range cannot exceed 366 days"
        )
        
    return await learning_analytics_service.get_dashboard_analytics(
        db=db,
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date
    )

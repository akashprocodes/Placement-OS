from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter()

@router.api_route("", methods=["GET", "HEAD"])
@router.api_route("/", methods=["GET", "HEAD"])
async def health_check():
    return {"status": "ok"}

@router.api_route("/db", methods=["GET", "HEAD"])
async def health_db(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": "disconnected"}

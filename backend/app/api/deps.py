import uuid
from typing import Optional
from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User

settings = get_settings()

# auto_error=False so we can fall through to cookie if no Bearer header present
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def _resolve_token(
    bearer_token: Optional[str] = Depends(oauth2_scheme),
    access_token: Optional[str] = Cookie(default=None),
) -> Optional[str]:
    """
    Accepts JWT from either:
    1. Authorization: Bearer <token>  (test suite, API clients, curl)
    2. HttpOnly cookie 'access_token'  (browser session via Next.js login)
    Bearer header always takes priority.
    """
    return bearer_token or access_token


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = Depends(_resolve_token),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception

        try:
            user_id = uuid.UUID(user_id_str)
        except ValueError:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    try:
        result = await db.execute(select(User).where(User.id == user_id))
    except DBAPIError:
        raise credentials_exception

    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def get_optional_current_user(
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = Depends(_resolve_token),
) -> Optional[User]:
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            return None

        try:
            user_id = uuid.UUID(user_id_str)
        except ValueError:
            return None

    except JWTError:
        return None

    try:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    except DBAPIError:
        return None


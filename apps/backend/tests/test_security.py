import pytest
from app.core.security import verify_password, get_password_hash, create_access_token
from jose import jwt
from app.core.config import get_settings

settings = get_settings()

def test_password_hashing():
    password = "supersecretpassword"
    hashed = get_password_hash(password)
    
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_create_access_token():
    user_id = "test-user-id"
    token = create_access_token(subject=user_id)
    
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == user_id
    assert "exp" in payload

import pytest
from httpx import AsyncClient
from app.core.security import create_access_token

@pytest.mark.asyncio
async def test_health_liveness(client: AsyncClient):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_health_db(client: AsyncClient):
    response = await client.get("/api/v1/health/db")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    response = await client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "strongpassword"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "password" not in data
    assert "password_hash" not in data

@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "dup@example.com",
        "password": "p1"
    })
    response = await client.post("/api/v1/auth/register", json={
        "email": "dup@example.com",
        "password": "p2"
    })
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"]

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "login@example.com",
        "password": "mypassword"
    })
    response = await client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "mypassword"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "wrong@example.com",
        "password": "correct"
    })
    response = await client.post("/api/v1/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrong"
    })
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_unauthenticated_me(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_authenticated_me(client: AsyncClient):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "me@example.com",
        "password": "pw"
    })
    login = await client.post("/api/v1/auth/login", json={
        "email": "me@example.com",
        "password": "pw"
    })
    token = login.json()["access_token"]
    
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"
    assert "password_hash" not in response.json()

@pytest.mark.asyncio
async def test_malformed_jwt(client: AsyncClient):
    response = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_invalid_uuid_subject(client: AsyncClient):
    token = create_access_token(subject="not-a-uuid")
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401

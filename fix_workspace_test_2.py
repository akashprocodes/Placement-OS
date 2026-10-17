import re

with open("backend/tests/test_learning_workspace.py", "r") as f:
    text = f.read()

replacement = """async def register_and_login(client: AsyncClient, email: str, password: str = "testpass123") -> tuple[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    return resp.json()["access_token"], me_resp.json()["id"]"""

text = re.sub(r'async def register_and_login[\s\S]*?return data\["access_token"\], data\["user_id"\]', replacement, text)

with open("backend/tests/test_learning_workspace.py", "w") as f:
    f.write(text)

with open("backend/tests/test_learning_session.py", "r") as f:
    text = f.read()
text = text.replace(
    'await client.post("/api/v1/learning/sessions/heartbeat", json=payload, headers=auth(token2))',
    'res = await client.post("/api/v1/learning/sessions/heartbeat", json=payload, headers=auth(token2))\n    assert res.status_code >= 400'
)
with open("backend/tests/test_learning_session.py", "w") as f:
    f.write(text)

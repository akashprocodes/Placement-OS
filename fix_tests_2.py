import re

with open("backend/tests/test_learning_plan_lifecycle.py", "r") as f:
    text = f.read()

replacement = """@pytest.mark.asyncio
async def test_video_plan_completion(db_session):
    u = User(id=uuid.uuid4(), email="test1@test.com", name="Test", hashed_password="pw")
    db_session.add(u)
    await db_session.commit()
    test_user = u"""

text = re.sub(r'@pytest\.mark\.asyncio\s*async def test_video_plan_completion\(db_session, my_test_user\):\s*test_user = my_test_user', replacement, text)

replacement_2 = """@pytest.mark.asyncio
async def test_playlist_plan_completion(db_session):
    u = User(id=uuid.uuid4(), email="test2@test.com", name="Test", hashed_password="pw")
    db_session.add(u)
    await db_session.commit()
    test_user = u"""

text = re.sub(r'@pytest\.mark\.asyncio\s*async def test_playlist_plan_completion\(db_session, my_test_user\):\s*test_user = my_test_user', replacement_2, text)
text = re.sub(r'@pytest\.fixture\s*async def my_test_user.*?return u', '', text, flags=re.DOTALL)

with open("backend/tests/test_learning_plan_lifecycle.py", "w") as f:
    f.write(text)

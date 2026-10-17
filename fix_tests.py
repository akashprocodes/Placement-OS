import re

with open("backend/tests/test_learning_plan_lifecycle.py", "r") as f:
    text = f.read()

replacement = """from app.models.user import User

@pytest.fixture
async def my_test_user(db_session):
    u = User(
        id=uuid.uuid4(),
        email="test@test.com",
        name="Test",
        hashed_password="pw"
    )
    db_session.add(u)
    await db_session.commit()
    return u

@pytest.mark.asyncio
async def test_video_plan_completion(db_session, my_test_user):
    test_user = my_test_user
"""

text = re.sub(r'@pytest\.mark\.asyncio\s*async def test_video_plan_completion\(db_session, test_user\):', replacement, text)
text = re.sub(r'async def test_playlist_plan_completion\(db_session, test_user\):', r'async def test_playlist_plan_completion(db_session, my_test_user):\n    test_user = my_test_user', text)

with open("backend/tests/test_learning_plan_lifecycle.py", "w") as f:
    f.write(text)

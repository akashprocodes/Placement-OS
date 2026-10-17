import re

with open("backend/tests/test_learning_plan_lifecycle.py", "r") as f:
    text = f.read()

text = re.sub(r'u = User\(id=uuid\.uuid4\(\), email="test1@test\.com", name="Test", hashed_password="pw"\)', 'u = User(id=uuid.uuid4(), email="test1@test.com", password_hash="pw")', text)
text = re.sub(r'u = User\(id=uuid\.uuid4\(\), email="test2@test\.com", name="Test", hashed_password="pw"\)', 'u = User(id=uuid.uuid4(), email="test2@test.com", password_hash="pw")', text)

with open("backend/tests/test_learning_plan_lifecycle.py", "w") as f:
    f.write(text)

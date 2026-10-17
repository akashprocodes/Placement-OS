import re

with open("backend/tests/test_learning_plan_lifecycle.py", "r") as f:
    text = f.read()

text = re.sub(r'position=0,', r'position=0, thumbnail_url="thumb.jpg",', text)
text = re.sub(r'position=1,', r'position=1, thumbnail_url="thumb.jpg",', text)

with open("backend/tests/test_learning_plan_lifecycle.py", "w") as f:
    f.write(text)

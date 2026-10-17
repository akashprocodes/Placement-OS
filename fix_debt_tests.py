import re

with open('backend/tests/test_learning_debt.py', 'r') as f:
    text = f.read()

text = text.replace('from app.models.learning_session import LearningSession', 'from app.models.learning_session import LearningSession\nfrom app.models.learning_daily_activity import LearningDailyActivity')

# Replace session = LearningSession(...) with activity = LearningDailyActivity(..., activity_date=...)
# Day -1:
text = text.replace(
    'session1 = LearningSession(\n        user_id=user_id,\n        content_id=content_id,\n        content_type="video",\n        watched_content_seconds=3600,\n        wall_clock_seconds=3600\n    )\n    session1.created_at = datetime.combine(day_minus_1, datetime.min.time())\n    \n    db_session.add(session1)',
    'activity1 = LearningDailyActivity(\n        user_id=user_id,\n        content_id=content_id,\n        content_type="video",\n        watched_content_seconds=3600,\n        activity_date=day_minus_1\n    )\n    activity1.created_at = datetime.combine(day_minus_1, datetime.min.time())\n    \n    db_session.add(activity1)'
)

# Day 0:
text = text.replace(
    'session2 = LearningSession(\n        user_id=user_id,\n        content_id=content_id,\n        content_type="video",\n        watched_content_seconds=7200, # 2h today\n        wall_clock_seconds=7200\n    )\n    session2.created_at = datetime.now(timezone.utc).replace(tzinfo=None)\n    db_session.add(session2)',
    'activity2 = LearningDailyActivity(\n        user_id=user_id,\n        content_id=content_id,\n        content_type="video",\n        watched_content_seconds=7200,\n        activity_date=today\n    )\n    db_session.add(activity2)'
)

# Vid B:
text = text.replace(
    'session = LearningSession(\n        user_id=user_id,\n        content_id="vid_B",\n        content_type="video",\n        watched_content_seconds=1800,\n        wall_clock_seconds=1800\n    )\n    db_session.add(session)',
    'activity = LearningDailyActivity(\n        user_id=user_id,\n        content_id="vid_B",\n        content_type="video",\n        watched_content_seconds=1800,\n        activity_date=today\n    )\n    db_session.add(activity)'
)

# Vid over:
text = text.replace(
    'session = LearningSession(\n        user_id=user_id,\n        content_id="vid_over",\n        content_type="video",\n        watched_content_seconds=5000,\n        wall_clock_seconds=5000\n    )\n    session.created_at = datetime.combine(day_minus_1, datetime.min.time())\n    db_session.add(session)',
    'activity = LearningDailyActivity(\n        user_id=user_id,\n        content_id="vid_over",\n        content_type="video",\n        watched_content_seconds=5000,\n        activity_date=day_minus_1\n    )\n    db_session.add(activity)'
)

with open('backend/tests/test_learning_debt.py', 'w') as f:
    f.write(text)

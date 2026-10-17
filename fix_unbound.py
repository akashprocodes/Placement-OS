import re

with open("backend/app/api/endpoints/learning.py", "r") as f:
    text = f.read()

# Remove the local imports from upsert_progress
text = text.replace("    from app.services.learning_plan_completion_service import check_and_update_plan_completion\n    from app.models.learning_plan import LearningPlan\n    from sqlalchemy import select\n", "")

# Ensure check_and_update_plan_completion is imported at the top
if "from app.services.learning_plan_completion_service import check_and_update_plan_completion" not in text:
    text = text.replace("from app.services import learning_plan_service", "from app.services import learning_plan_service\nfrom app.services.learning_plan_completion_service import check_and_update_plan_completion\nfrom app.models.learning_plan import LearningPlan")

# Remove the local import from get_learning_plan_progress_endpoint
text = text.replace("    from app.services.learning_plan_completion_service import check_and_update_plan_completion\n", "")

with open("backend/app/api/endpoints/learning.py", "w") as f:
    f.write(text)

import re

with open("backend/app/services/learning_debt_service.py", "r") as f:
    text = f.read()

replacement = """    return LearningPlanProgress(
        plan_id=plan.id,
        target_completion_date=plan.target_completion_date,
        daily_target_seconds=plan.daily_target_seconds,
        completed_seconds_today=completed_today,
        base_target_seconds_today=base_target_today,
        previous_debt_seconds=previous_debt,
        required_seconds_today=required_today,
        remaining_seconds_today=remaining_today,
        current_debt_seconds=remaining_today,
        current_date=today,
        status=plan.status,
        completed_at=plan.completed_at
    )"""

text = re.sub(r'    return LearningPlanProgress\([^)]+\)', replacement, text, flags=re.DOTALL)

with open("backend/app/services/learning_debt_service.py", "w") as f:
    f.write(text)

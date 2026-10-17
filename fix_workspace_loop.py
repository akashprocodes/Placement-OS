import re

with open("backend/app/api/endpoints/learning.py", "r") as f:
    text = f.read()

replacement = """    for plan in all_plans:
        # Re-evaluate completion for safety
        updated_plan = await check_and_update_plan_completion(db, current_user.id, plan.id)
        if not updated_plan:
            continue
            
        if updated_plan.status == "completed":
            completed_plans.append(updated_plan)
        elif updated_plan.status == "active":
            prog = await learning_debt_service.get_plan_progress(db, current_user.id, updated_plan.id)
            active_plans.append(LearningPlanWithProgress(plan=updated_plan, progress=prog))"""

text = re.sub(r'    for plan in all_plans:\s*# Re-evaluate completion for safety\s*await check_and_update_plan_completion\(db, current_user\.id, plan\.id\)\s*if plan\.status == "completed":\s*completed_plans\.append\(plan\)\s*elif plan\.status == "active":\s*prog = await learning_debt_service\.get_plan_progress\(db, current_user\.id, plan\.id\)\s*active_plans\.append\(LearningPlanWithProgress\(plan=plan, progress=prog\)\)', replacement, text)

with open("backend/app/api/endpoints/learning.py", "w") as f:
    f.write(text)

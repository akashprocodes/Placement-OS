import re

with open("backend/app/api/endpoints/learning.py", "r") as f:
    text = f.read()

replacement = """        db.add(progress)

    await db.commit()

    # Hook: re-evaluate completion for all active plans for this user
    from app.services.learning_plan_completion_service import check_and_update_plan_completion
    from app.models.learning_plan import LearningPlan
    from sqlalchemy import select
    
    active_plans_stmt = select(LearningPlan.id).where(
        LearningPlan.user_id == current_user.id,
        LearningPlan.status == "active"
    )
    active_plans_res = await db.execute(active_plans_stmt)
    for p_id in active_plans_res.scalars().all():
        await check_and_update_plan_completion(db, current_user.id, p_id)
        
    return {"status": "ok"}"""

text = re.sub(r'        db\.add\(progress\)\s*await db\.commit\(\)\s*return \{"status": "ok"\}', replacement, text)

with open("backend/app/api/endpoints/learning.py", "w") as f:
    f.write(text)

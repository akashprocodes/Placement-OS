import re

with open("backend/app/api/endpoints/learning.py", "r") as f:
    text = f.read()

replacement = """@router.get("/plans/{plan_id}/progress", response_model=LearningPlanProgress)
async def get_learning_plan_progress_endpoint(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        plan_uuid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid plan ID")

    # Hook: Re-evaluate completion before fetching progress
    from app.services.learning_plan_completion_service import check_and_update_plan_completion
    await check_and_update_plan_completion(db, current_user.id, plan_uuid)

    from app.services import learning_debt_service
    return await learning_debt_service.get_plan_progress(db, current_user.id, plan_uuid)"""

text = re.sub(r'@router\.get\("/plans/\{plan_id\}/progress".*?return await learning_debt_service\.get_plan_progress\(db, current_user\.id, plan_uuid\)', replacement, text, flags=re.DOTALL)

with open("backend/app/api/endpoints/learning.py", "w") as f:
    f.write(text)

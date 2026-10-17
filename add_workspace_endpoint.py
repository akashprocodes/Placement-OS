import re

with open("backend/app/api/endpoints/learning.py", "r") as f:
    text = f.read()

replacement = """from app.schemas.learning_workspace import LearningWorkspaceResponse, LearningPlanWithProgress

@router.get("/workspace", response_model=LearningWorkspaceResponse)
async def get_learning_workspace_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.services import learning_plan_service, learning_debt_service
    
    # 1. Fetch all plans
    all_plans = await learning_plan_service.get_learning_plans(db, current_user.id)
    
    active_plans = []
    completed_plans = []
    
    for plan in all_plans:
        # Re-evaluate completion for safety
        await check_and_update_plan_completion(db, current_user.id, plan.id)
        
        if plan.status == "completed":
            completed_plans.append(plan)
        elif plan.status == "active":
            prog = await learning_debt_service.get_plan_progress(db, current_user.id, plan.id)
            active_plans.append(LearningPlanWithProgress(plan=plan, progress=prog))
            
    return LearningWorkspaceResponse(
        active_plans=active_plans,
        completed_plans=completed_plans
    )

@router.get("/plans", response_model=List[LearningPlanResponse])"""

text = re.sub(r'@router\.get\("/plans", response_model=List\[LearningPlanResponse\]\)', replacement, text)

with open("backend/app/api/endpoints/learning.py", "w") as f:
    f.write(text)

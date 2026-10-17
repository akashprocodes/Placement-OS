import re

with open("apps/web/src/features/learning/components/LearningPlanCTA.tsx", "r") as f:
    text = f.read()

replacement = """  const existingPlan = plans.find(
    (p) => p.content_id === contentId
  );
  
  if (!isAuthenticated) return null; // Don't show CTA if unauthenticated
  if (isLoading) return null; // Wait until we know if there is a plan

  if (existingPlan?.status === "completed") {
    return (
      <div className="flex flex-col gap-3 p-4 bg-[#25343F]/50 border border-[#FF9B51]/20 rounded-xl items-center text-center">
        <div className="w-10 h-10 rounded-full bg-[#FF9B51]/10 flex items-center justify-center mb-1">
          <Calendar className="w-5 h-5 text-[#FF9B51]" />
        </div>
        <h3 className="text-[#EAEFEF] font-bold">Learning plan completed</h3>
        {existingPlan.completed_at && (
          <p className="text-xs text-[#BFC9D1]">
            Completed on {new Date(existingPlan.completed_at).toLocaleDateString()}
          </p>
        )}
      </div>
    );
  }

  if (existingPlan?.status === "active") {
    return <LearningPlanProgress planId={existingPlan.id} />;
  }"""

text = re.sub(r'  const activePlan = plans\.find\(.*?\);.*?if \(activePlan\) \{\s*return <LearningPlanProgress planId=\{activePlan\.id\} />;\s*\}', replacement, text, flags=re.DOTALL)

with open("apps/web/src/features/learning/components/LearningPlanCTA.tsx", "w") as f:
    f.write(text)

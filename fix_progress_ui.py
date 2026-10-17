import re

with open("apps/web/src/features/learning/components/LearningPlanProgress.tsx", "r") as f:
    text = f.read()

replacement = """  if (!progress) return null;

  if (progress.status === "completed") {
    return (
      <div className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#BFC9D1]/10 flex items-center justify-between bg-[#BFC9D1]/5">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#FF9B51]" />
            <h3 className="font-semibold text-[#EAEFEF] text-sm tracking-wide uppercase">Learning Plan</h3>
          </div>
          {progress.completed_at && (
            <div className="flex items-center gap-1.5 text-xs text-[#BFC9D1]">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(progress.completed_at.split('T')[0])}</span>
            </div>
          )}
        </div>
        <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#FF9B51]/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-[#FF9B51]" />
          </div>
          <div>
            <h4 className="text-[#EAEFEF] font-bold text-lg">Plan Completed</h4>
            <p className="text-sm text-[#BFC9D1] mt-1 max-w-[200px] mx-auto">
              You have successfully completed all the required content for this plan.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isComplete = progress.remaining_seconds_today === 0 && progress.required_seconds_today > 0;"""

text = re.sub(r'  if \(!progress\) return null;\s*const isComplete = progress\.remaining_seconds_today === 0 && progress\.required_seconds_today > 0;', replacement, text, flags=re.DOTALL)

with open("apps/web/src/features/learning/components/LearningPlanProgress.tsx", "w") as f:
    f.write(text)

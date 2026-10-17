import re

with open("apps/web/src/features/learning/components/LearningWorkspace.tsx", "r") as f:
    text = f.read()

replacement = """      {/* Continue Learning */}
      {mainPlan && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#EAEFEF] flex items-center gap-2">
              Continue Learning
            </h2>
            <Link 
              href="/learning/analytics" 
              className="text-xs font-medium text-[#BFC9D1] hover:text-[#FF9B51] transition-colors"
            >
              View Analytics →
            </Link>
          </div>
          <div className="w-full">
            <LearningPlanCard plan={mainPlan.plan} progress={mainPlan.progress} isMain={true} />
          </div>
        </section>
      )}"""

text = re.sub(r'      \{\/\* Continue Learning \*\/.*?<LearningPlanCard plan=\{mainPlan\.plan\} progress=\{mainPlan\.progress\} isMain=\{true\} \/>\s*</div>\s*</section>\s*\)}', replacement, text, flags=re.DOTALL)

with open("apps/web/src/features/learning/components/LearningWorkspace.tsx", "w") as f:
    f.write(text)

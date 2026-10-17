import re

with open("apps/web/src/app/(dashboard)/learning/page.tsx", "r") as f:
    text = f.read()

# Add import
if "LearningWorkspace" not in text:
    text = text.replace('import { SearchResults } from "@/features/learning/components/SearchResults";', 'import { SearchResults } from "@/features/learning/components/SearchResults";\nimport { LearningWorkspace } from "@/features/learning/components/LearningWorkspace";')

replacement = """        <section className="flex flex-col gap-10">
          <div className="flex items-center justify-between">
            <h2 className="text-h4 font-bold text-text-primary">My Learning</h2>
          </div>
          <LearningWorkspace />
        </section>"""

text = re.sub(r'<section className="flex flex-col gap-16">\s*<div className="flex items-center justify-between">\s*<h2 className="text-h4 font-bold text-text-primary">Current Learning</h2>\s*</div>.*?<div className="flex flex-col items-center justify-center p-40 sm:p-64 text-center border border-border-default border-dashed rounded-2xl bg-bg-surface/30">.*?</div>\s*</section>', replacement, text, flags=re.DOTALL)

with open("apps/web/src/app/(dashboard)/learning/page.tsx", "w") as f:
    f.write(text)

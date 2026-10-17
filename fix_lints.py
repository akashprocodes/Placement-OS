import re

# 1. page.tsx
with open("apps/web/src/app/(dashboard)/learning/page.tsx", "r") as f:
    text = f.read()
text = text.replace("import { BookOpen, Target, Loader2, AlertCircle } from \"lucide-react\";", "import { BookOpen, Loader2, AlertCircle } from \"lucide-react\";")
with open("apps/web/src/app/(dashboard)/learning/page.tsx", "w") as f:
    f.write(text)

# 2. LearningPlanCard.tsx
with open("apps/web/src/features/learning/components/LearningPlanCard.tsx", "r") as f:
    text = f.read()
text = text.replace("Today's Progress", "Today&apos;s Progress")
with open("apps/web/src/features/learning/components/LearningPlanCard.tsx", "w") as f:
    f.write(text)

# 3. LearningWorkspace.tsx
with open("apps/web/src/features/learning/components/LearningWorkspace.tsx", "r") as f:
    text = f.read()
text = text.replace("catch (err) {", "catch (err: unknown) {")
with open("apps/web/src/features/learning/components/LearningWorkspace.tsx", "w") as f:
    f.write(text)


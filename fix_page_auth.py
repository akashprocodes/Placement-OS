import re

with open("apps/web/src/app/(dashboard)/learning/page.tsx", "r") as f:
    text = f.read()

# Add cookies import
if 'import { cookies }' not in text:
    text = text.replace('import { SearchResults } from "@/features/learning/components/SearchResults";', 'import { cookies } from "next/headers";\nimport { SearchResults } from "@/features/learning/components/SearchResults";')

# Read cookie
replacement_cookie = """export default async function LearningPage(props: LearningPageProps) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;

  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has("access_token");"""

text = re.sub(r'export default async function LearningPage\(props: LearningPageProps\) {\s*const searchParams = await props\.searchParams;\s*const q = typeof searchParams\.q === "string" \? searchParams\.q : undefined;', replacement_cookie, text)

# Pass to LearningWorkspace
text = text.replace("<LearningWorkspace />", "<LearningWorkspace isAuthenticated={isAuthenticated} />")

with open("apps/web/src/app/(dashboard)/learning/page.tsx", "w") as f:
    f.write(text)

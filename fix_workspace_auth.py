import re

with open("apps/web/src/features/learning/services/learningService.ts", "r") as f:
    text = f.read()

replacement = """export async function getLearningWorkspace(): Promise<import("../types").LearningWorkspaceResponse> {
  const url = `${BACKEND_URL}/api/v1/learning/workspace`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    credentials: "include",
  });
  if (response.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) throw new Error("Failed to fetch learning workspace");
  return response.json();
}"""

text = re.sub(r'export async function getLearningWorkspace\(\): Promise<import\("../types"\)\.LearningWorkspaceResponse> \{[\s\S]*?return response\.json\(\);\n\}', replacement, text)

with open("apps/web/src/features/learning/services/learningService.ts", "w") as f:
    f.write(text)

import re

with open("apps/web/src/features/learning/components/LearningWorkspace.tsx", "r") as f:
    text = f.read()

replacement = """import { Loader2, Target, Trophy, Lock } from "lucide-react";

export function LearningWorkspace({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [data, setData] = useState<LearningWorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    async function loadWorkspace() {
      try {
        const workspace = await getLearningWorkspace();
        setData(workspace);
      } catch (_err) {
        if (_err instanceof Error && _err.message === "Unauthorized") {
          // Handled by isAuthenticated ideally, but fallback
          setError("Your session has expired. Please sign in again.");
        } else {
          setError("Unable to load your learning workspace.");
        }
      } finally {
        setLoading(false);
      }
    }
    void loadWorkspace();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center p-12 sm:p-24 text-center border border-[#BFC9D1]/10 border-dashed rounded-2xl bg-[#25343F]/30 mt-8">
        <div className="w-20 h-20 rounded-full bg-[#BFC9D1]/5 flex items-center justify-center mb-8">
          <Lock className="w-10 h-10 text-[#BFC9D1]/50" />
        </div>
        <h3 className="text-lg font-semibold text-[#EAEFEF] mb-3">
          Sign in to track your learning
        </h3>
        <p className="text-sm text-[#BFC9D1] max-w-sm mb-6">
          Create an account or sign in to save learning plans, track your daily progress, and stay organized.
        </p>
        <a 
          href="/login?callbackUrl=/learning"
          className="px-6 py-2.5 bg-[#FF9B51] hover:bg-[#e88a44] text-[#25343F] text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40"
        >
          Sign In
        </a>
      </div>
    );
  }"""

# Replace imports
text = re.sub(r'import { Loader2, Target, Trophy } from "lucide-react";', '', text)
text = re.sub(r'export function LearningWorkspace\(\) {[\s\S]*?}, \[\]\);', replacement, text)

# Just in case import gets duplicated
text = text.replace('import { Loader2, Target, Trophy, Lock } from "lucide-react";\n\nimport { Loader2, Target, Trophy, Lock } from "lucide-react";', 'import { Loader2, Target, Trophy, Lock } from "lucide-react";')

with open("apps/web/src/features/learning/components/LearningWorkspace.tsx", "w") as f:
    f.write(text)

import React, { Suspense } from "react";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { LearningSearch } from "@/features/learning/components/LearningSearch";
import { cookies } from "next/headers";
import { SearchResults } from "@/features/learning/components/SearchResults";
import { LearningWorkspace } from "@/features/learning/components/LearningWorkspace";
import { searchLearningContent } from "@/features/learning/services/learningService";

const POPULAR_TOPICS = [
  "System Design",
  "React",
  "Data Structures",
  "Python",
  "Machine Learning",
  "SQL",
];

export const metadata = {
  title: "Guided Learning | Placement OS",
  description: "Find what you want to learn from YouTube and turn it into a structured learning plan.",
};

interface LearningPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LearningPage(props: LearningPageProps) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;

  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has("access_token");

  return (
    <div className="w-full min-h-full bg-bg-app pb-32">
      <div className="mx-auto max-w-layout-max px-layout-px py-8 flex flex-col gap-12 sm:gap-16">
        {/* Simple & Clean Hero Section */}
        <section className="flex flex-col items-center justify-center text-center pt-6 pb-2">
          {!q && (
            <>
              <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-3">
                Guided Learning
              </h1>

              <p className="text-sm sm:text-base text-text-secondary max-w-lg mb-8 leading-relaxed">
                Search any topic you want to learn. Find top lectures and turn them into a structured daily plan.
              </p>
            </>
          )}

          {/* Search Component */}
          <div className="w-full max-w-2xl">
            <Suspense fallback={<SearchFallback />}>
              <LearningSearch />
            </Suspense>
          </div>

          {/* Minimal Popular Topic Pills */}
          {!q && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              <span className="text-xs text-text-muted mr-1">Popular:</span>
              {POPULAR_TOPICS.map((topic) => (
                <Link
                  key={topic}
                  href={`/learning?q=${encodeURIComponent(topic)}`}
                  className="px-3.5 py-1 rounded-full bg-bg-surface border border-border-default hover:border-brand-primary/50 hover:bg-bg-surface-elevated text-text-secondary hover:text-text-primary text-xs transition-colors"
                >
                  {topic}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Dynamic Content Area */}
        {q ? (
          <section className="flex flex-col w-full">
            <Suspense fallback={<LoadingResults query={q} />}>
              <AsyncSearchResults query={q} />
            </Suspense>
          </section>
        ) : (
          <section className="flex flex-col gap-6">
            <LearningWorkspace isAuthenticated={isAuthenticated} />
          </section>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// Sub-components for Async loading and error handling
// ---------------------------------------------------------

function SearchFallback() {
  return (
    <div className="w-full h-14 bg-bg-surface border border-border-default rounded-xl" />
  );
}

function LoadingResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-text-primary">
          Searching for &quot;{query}&quot;
        </p>
        <p className="text-xs text-text-muted">
          Finding the best learning materials...
        </p>
      </div>
    </div>
  );
}

async function AsyncSearchResults({ query }: { query: string }) {
  let results;
  try {
    results = await searchLearningContent(query);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "";
    const isQuotaError = errorMessage.toLowerCase().includes("quota");

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border border-status-error/20 bg-status-error/5 rounded-2xl mt-6 max-w-xl mx-auto w-full p-8">
        <AlertCircle className="w-10 h-10 text-status-error mb-4" />
        <h2 className="text-base font-bold text-status-error mb-2">
          {isQuotaError ? "YouTube search temporarily unavailable" : "Something went wrong while searching"}
        </h2>
        <p className="text-xs text-text-muted mb-6 max-w-md leading-relaxed">
          {isQuotaError
            ? "YouTube API daily quota is currently exhausted. Please try again later or search for an already cached topic."
            : `We encountered an issue fetching results for "${query}".`}
        </p>
        <Link 
          href="/learning"
          className="px-5 py-2.5 bg-bg-surface hover:bg-bg-surface-elevated border border-border-default text-text-primary text-xs font-semibold rounded-xl transition-colors shadow-subtle"
        >
          Try a different search
        </Link>
      </div>
    );
  }
  
  return (
    <div className="w-full">
      <SearchResults results={results} />
    </div>
  );
}

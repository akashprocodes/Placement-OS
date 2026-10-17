import React, { Suspense } from "react";
import { BookOpen, Loader2, AlertCircle } from "lucide-react";
import { LearningSearch } from "@/features/learning/components/LearningSearch";
import { cookies } from "next/headers";
import { SearchResults } from "@/features/learning/components/SearchResults";
import { LearningWorkspace } from "@/features/learning/components/LearningWorkspace";
import { searchLearningContent } from "@/features/learning/services/learningService";

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
    <div className="flex flex-col gap-32 p-8 max-w-[1200px] mx-auto w-full">
      
      {/* Learning Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-40 sm:py-64 glass-panel border border-border-subtle rounded-2xl px-16 shadow-subtle">
        {!q && (
          <>
            <div className="w-48 h-48 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-16">
              <BookOpen className="w-24 h-24" />
            </div>
            <h1 className="text-h2 sm:text-h1 font-bold text-text-primary tracking-tight mb-16">
              Guided Learning
            </h1>
            <p className="text-body-large text-text-secondary max-w-2xl mb-40 leading-relaxed">
              Search anything you want to learn. Find relevant YouTube videos and turn them into a structured learning plan.
            </p>
          </>
        )}
        
        {/* Search Component */}
        <div className="w-full">
          <Suspense fallback={<SearchFallback />}>
            <LearningSearch />
          </Suspense>
        </div>
      </section>

      {/* Dynamic Content Area */}
      {q ? (
        <section className="flex flex-col w-full">
          <Suspense fallback={<LoadingResults query={q} />}>
            <AsyncSearchResults query={q} />
          </Suspense>
        </section>
      ) : (
                <section className="flex flex-col gap-10">
          <div className="flex items-center justify-between">
            <h2 className="text-h4 font-bold text-text-primary">My Learning</h2>
          </div>
          <LearningWorkspace isAuthenticated={isAuthenticated} />
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// Sub-components for Async loading and error handling
// ---------------------------------------------------------

function SearchFallback() {
  return (
    <div className="w-full h-56 max-w-2xl mx-auto glass-panel border border-border-default rounded-xl flex items-center pl-48 opacity-70">
      <Loader2 className="w-20 h-20 animate-spin text-text-muted absolute left-16" />
    </div>
  );
}

function LoadingResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-64 text-center border border-border-subtle rounded-xl glass-panel mt-16 w-full gap-16">
      <Loader2 className="w-32 h-32 animate-spin text-brand-primary" />
      <div className="flex flex-col gap-4">
        <p className="text-body font-medium text-text-primary">
          Searching for &quot;{query}&quot;
        </p>
        <p className="text-body-small text-text-muted">
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
      <div className="flex flex-col items-center justify-center p-32 text-center border border-status-error/20 bg-status-error/5 rounded-xl mt-16 max-w-4xl mx-auto w-full">
        <AlertCircle className="w-32 h-32 text-status-error mb-16" />
        <h2 className="text-h4 font-bold text-status-error mb-8">
          {isQuotaError ? "YouTube search temporarily unavailable" : "Something went wrong while searching"}
        </h2>
        <p className="text-body-small text-text-muted mb-16 max-w-md">
          {isQuotaError
            ? "YouTube API daily quota is currently exhausted. Please try again later or search for an already cached topic."
            : `We encountered an issue fetching results for "${query}".`}
        </p>
        <label 
          htmlFor="learning-search"
          className="cursor-pointer px-16 py-8 bg-bg-surface border border-border-default hover:bg-bg-muted text-text-primary text-body-small font-medium rounded-lg transition-colors focus:outline-none shadow-subtle inline-block"
        >
          Try a different search
        </label>
      </div>
    );
  }
  
  return (
    <div className="w-full">
      <SearchResults results={results} />
    </div>
  );
}

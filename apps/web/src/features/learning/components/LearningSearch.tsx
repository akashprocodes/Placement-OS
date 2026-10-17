"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function LearningSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(queryParam);
  const [prevQueryParam, setPrevQueryParam] = useState(queryParam);
  const [isNavigating, setIsNavigating] = useState(false);

  if (queryParam !== prevQueryParam) {
    setQuery(queryParam);
    setPrevQueryParam(queryParam);
    setIsNavigating(false);
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsNavigating(true);
    router.push(`/learning?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-2xl mx-auto">
      <label htmlFor="learning-search" className="sr-only">
        Search for learning topics
      </label>
      <div className="relative flex items-center w-full">
        <div className="absolute left-16 text-text-muted pointer-events-none">
          <Search className="w-20 h-20" aria-hidden="true" />
        </div>
        <input
          id="learning-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isNavigating}
          placeholder="Search for a topic (e.g. DBMS normalization, React Hooks...)"
          className="w-full h-56 pl-48 pr-16 bg-bg-surface border border-border-default rounded-xl text-body text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-all shadow-subtle disabled:opacity-70 disabled:cursor-not-allowed"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isNavigating || !query.trim()}
          className="absolute right-8 px-16 h-40 bg-brand-primary hover:bg-brand-hover text-text-inverse font-medium text-body-small rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-bg-app disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isNavigating ? "Searching..." : "Find"}
        </button>
      </div>
    </form>
  );
}

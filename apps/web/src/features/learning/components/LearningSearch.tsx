"use client";

import React, { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Sparkles, X, ArrowRight } from "lucide-react";
import { StarBorder } from "@/components/ui/StarBorder";

const SUGGESTIONS = [
  "React 19 tutorial",
  "System Design basics",
  "Python for beginners",
  "Data Structures & Algorithms",
  "Kubernetes course",
];

export function LearningSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(queryParam);
  const [prevQueryParam, setPrevQueryParam] = useState(queryParam);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Adjust state during render (React docs recommendation)
  if (queryParam !== prevQueryParam) {
    setQuery(queryParam);
    setPrevQueryParam(queryParam);
    setIsNavigating(false);
    setSelectedIndex(-1);
    setShowSuggestions(queryParam.length > 0);
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsNavigating(true);
    router.push(`/learning?q=${encodeURIComponent(query.trim())}`);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setIsNavigating(true);
    router.push(`/learning?q=${encodeURIComponent(suggestion.trim())}`);
  };

  const filteredSuggestions = SUGGESTIONS.filter((s) =>
    s.toLowerCase().includes(query.trim().toLowerCase())
  );

  const clearQuery = () => {
    setQuery("");
    inputRef.current?.focus();
    setShowSuggestions(false);
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full">
      <label htmlFor="learning-search" className="sr-only">
        Search for learning topics
      </label>
      <div className="relative flex items-center w-full group">
        <div className="absolute left-4.5 text-text-muted group-focus-within:text-brand-primary transition-colors pointer-events-none">
          <Search className="w-5 h-5" aria-hidden="true" />
        </div>
        <input
          ref={inputRef}
          id="learning-search"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          disabled={isNavigating}
          placeholder="Search for a topic (e.g. System Design, React Hooks, LeetCode...)"
          className="w-full h-14 pl-14 pr-32 bg-bg-surface border border-border-default hover:border-brand-primary/40 focus:border-brand-primary focus:bg-bg-elevated rounded-2xl text-sm sm:text-base text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all shadow-subtle disabled:opacity-70 disabled:cursor-not-allowed"
          autoComplete="off"
        />

        {query && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="Clear search input"
            className="absolute right-28 text-text-muted hover:text-text-primary transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <StarBorder
          as="button"
          type="submit"
          disabled={isNavigating}
          color="#FF9B51"
          trailColor="#FFAE70"
          className="absolute right-2.5 h-10 px-5 font-semibold text-xs sm:text-sm rounded-xl shadow-sm cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
        >
          <span>{isNavigating ? "Searching..." : "Search"}</span>
          <ArrowRight className="w-3.5 h-3.5 opacity-75" />
        </StarBorder>
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-bg-surface/95 border border-border-default rounded-2xl shadow-elevated overflow-hidden z-50 backdrop-blur-2xl">
          <div className="px-4 py-2.5 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Suggestions</span>
            </div>
            <span className="text-[10px] text-text-muted/60">Press Enter ↵</span>
          </div>
          <ul>
            {filteredSuggestions.map((suggestion, idx) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition-colors ${
                    idx === selectedIndex
                      ? "bg-brand-primary/10 text-brand-primary"
                      : "hover:bg-bg-muted text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Search className="w-4 h-4 opacity-50 shrink-0" />
                    <span className="text-body-small font-medium">{suggestion}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

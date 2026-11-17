"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

export function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // Navigate to learning search with exact query
    router.push(`/learning?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <header className="h-layout-header glass-header sticky top-0 z-sticky border-b border-border-default flex items-center px-8 shrink-0">
      {/* Search Field */}
      <div className="flex-1 max-w-md">
        <form onSubmit={handleSearch} className="relative group flex items-center">
          <label htmlFor="header-search" className="sr-only">Search</label>
          <Search className="w-5 h-5 text-text-muted absolute left-3 pointer-events-none" />
          <input
            id="header-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search learning topics..."
            className="w-full h-10 pl-10 pr-12 bg-bg-muted border border-transparent rounded-lg text-body-small focus:outline-none focus:border-brand-primary focus:bg-bg-surface transition-colors placeholder:text-text-muted text-text-primary"
          />
          <div className="absolute right-3 flex items-center gap-1 pointer-events-none">
            <kbd className="hidden sm:inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium text-text-muted bg-bg-surface border border-border-subtle rounded rounded-sm">
              ↵
            </kbd>
          </div>
        </form>
      </div>
    </header>
  );
}

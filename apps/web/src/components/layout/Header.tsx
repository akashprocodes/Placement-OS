"use client";

import React, { useState } from "react";
import { Search, Bell, ChevronDown } from "lucide-react";
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
    <header className="h-layout-header glass-header sticky top-0 z-sticky border-b border-border-default flex items-center justify-between px-8 shrink-0">
      {/* Left Area: Search Field */}
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

      {/* Right Area: Actions */}
      <div className="flex items-center gap-6 ml-auto pl-4">
        {/* Notification */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative p-2 text-text-secondary hover:bg-bg-muted hover:text-text-primary rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <Bell className="w-5 h-5" />
          {/* Notification indicator dot */}
          <span className="absolute top-2 right-2 w-2 h-2 bg-brand-primary rounded-full border-2 border-bg-surface" />
        </button>

        <div className="w-px h-8 bg-border-subtle mx-1 hidden sm:block" />

        {/* Profile Dropdown */}
        <button
          type="button"
          aria-label="User profile"
          className="flex items-center gap-3 hover:bg-bg-muted p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <div className="w-9 h-9 rounded-full bg-brand-subtle flex items-center justify-center text-brand-primary overflow-hidden shrink-0">
            {/* Fallback avatar visual */}
            <span className="font-semibold text-body-small">A</span>
          </div>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-body-small font-semibold text-text-primary leading-tight">
              Akash
            </span>
            <span className="text-caption text-text-muted leading-tight">
              B.Tech CSE
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-text-muted hidden sm:block" />
        </button>
      </div>
    </header>
  );
}

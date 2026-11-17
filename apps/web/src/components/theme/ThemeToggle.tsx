"use client";

import React, { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  className?: string;
}

const emptySubscribe = () => () => {};

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // During SSR and initial mount, render a placeholder of identical dimensions to prevent layout shift
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        disabled
        className={`relative p-2 text-text-secondary rounded-lg transition-colors opacity-50 ${className}`}
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`relative p-2 text-text-secondary hover:bg-bg-muted hover:text-text-primary rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary active:scale-95 cursor-pointer ${className}`}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-brand-primary transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="w-5 h-5 text-text-secondary transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}

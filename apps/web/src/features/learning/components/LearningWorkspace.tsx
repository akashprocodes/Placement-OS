"use client";

import React, { useEffect, useState } from "react";
import { getLearningWorkspace } from "../services/learningService";
import { LearningWorkspaceResponse } from "../types";
import { LearningPlanCard } from "./LearningPlanCard";

import Link from "next/link";
import { StarBorder } from "@/components/ui/StarBorder";
import { Loader2, Trophy, Lock, Flame, ArrowRight } from "lucide-react";

const CURATED_ROADMAPS = [
  {
    title: "System Design for Placements",
    query: "System Design",
    category: "Architecture",
    duration: "24h • 12 Modules",
    description: "Distributed systems, caching, message queues, sharding, and real-world system architecture interview questions.",
  },
  {
    title: "Data Structures & LeetCode Patterns",
    query: "Data Structures & Algorithms",
    category: "Problem Solving",
    duration: "40h • 20 Modules",
    description: "Sliding window, two pointers, graphs, dynamic programming, and binary search patterns asked by top product companies.",
  },
  {
    title: "Full-Stack React 19 & Next.js",
    query: "React 19 tutorial",
    category: "Frontend",
    duration: "18h • 8 Modules",
    description: "Server components, streaming, optimistic updates, database integrations, and modern web application development.",
  },
  {
    title: "Backend Engineering & Microservices",
    query: "Backend engineering guide",
    category: "Backend",
    duration: "28h • 14 Modules",
    description: "RESTful APIs, gRPC, concurrency models, database connection pooling, and low-latency backend architectures.",
  },
  {
    title: "Machine Learning & AI Engineering",
    query: "Machine Learning basics",
    category: "AI / ML",
    duration: "32h • 16 Modules",
    description: "Fundamentals of supervised learning, neural networks, PyTorch, LLM agents, and vector database architectures.",
  },
  {
    title: "SQL & Relational Databases",
    query: "SQL database course",
    category: "Databases",
    duration: "14h • 6 Modules",
    description: "Indexing strategies, query optimization, ACID transactions, and database schema normalization.",
  },
];

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
      <div className="flex flex-col gap-8 w-full">
        {/* Compact Auth Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-bg-surface border border-border-default shadow-subtle">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-brand-primary" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm sm:text-base font-semibold text-text-primary">
                Track Your Roadmaps & Daily Study Goals
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Sign in to save learning plans, track daily watch targets, and maintain your streak.
              </p>
            </div>
          </div>
          <StarBorder
            href="/login?callbackUrl=/learning"
            color="#FF9B51"
            trailColor="#FFAE70"
            className="px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl shadow-subtle shrink-0 inline-flex items-center gap-1.5"
          >
            <span>Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </StarBorder>
        </div>

        {/* Featured Roadmaps Grid */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-brand-primary rounded-full" />
              <h3 className="text-sm sm:text-base font-bold text-text-primary">
                Featured Roadmaps
              </h3>
            </div>
            <span className="text-xs text-text-muted">Curated for tech placements</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CURATED_ROADMAPS.map((item) => (
              <Link
                key={item.title}
                href={`/learning?q=${encodeURIComponent(item.query)}`}
                className="group flex flex-col justify-between p-5 rounded-2xl bg-bg-surface border border-border-default hover:border-brand-primary/50 hover:bg-bg-surface-elevated transition-all duration-200 hover:-translate-y-0.5 shadow-subtle"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                      {item.category}
                    </span>
                    <span className="text-[11px] text-text-muted">{item.duration}</span>
                  </div>
                  <h4 className="text-sm font-bold text-text-primary group-hover:text-brand-primary transition-colors leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-border-subtle text-xs font-semibold text-text-muted group-hover:text-brand-primary transition-colors">
                  <span>Start Learning</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[300px]">
        <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
        </div>
        <p className="text-xs text-text-muted">Loading your workspace...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 border border-status-error/20 bg-status-error/5 rounded-2xl text-center flex flex-col items-center justify-center gap-4 backdrop-blur-md">
        <p className="text-status-error text-xs sm:text-sm">{error || "Failed to load workspace."}</p>
        {error?.includes("session has expired") && (
          <Link
            href="/login?callbackUrl=/learning"
            className="px-6 py-2 bg-brand-primary hover:bg-brand-hover text-text-inverse text-xs font-semibold rounded-lg transition-colors shadow-sm"
          >
            Sign In Again
          </Link>
        )}
      </div>
    );
  }

  const { active_plans, completed_plans, streak, milestones } = data;

  if (active_plans.length === 0 && completed_plans.length === 0) {
    return (
      <div className="flex flex-col gap-8 w-full">
        {streak && (
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-bg-surface border border-border-default text-xs w-fit shadow-subtle">
            <Flame className={`w-4 h-4 ${streak.current_streak > 0 ? "text-brand-primary" : "text-text-muted"}`} />
            <span className="font-bold text-text-primary">
              {streak.current_streak} {streak.current_streak === 1 ? "Day" : "Days"} Streak
            </span>
            <span className="text-text-muted/40">•</span>
            <span className="text-text-secondary">
              Best: <strong className="text-text-primary font-medium">{streak.longest_streak}</strong> days
            </span>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-brand-primary rounded-full" />
              <h3 className="text-sm sm:text-base font-bold text-text-primary">
                Featured Roadmaps to Get Started
              </h3>
            </div>
            <span className="text-xs text-text-muted">Curated for tech placements</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CURATED_ROADMAPS.map((item) => (
              <Link
                key={item.title}
                href={`/learning?q=${encodeURIComponent(item.query)}`}
                className="group flex flex-col justify-between p-5 rounded-2xl bg-bg-surface border border-border-default hover:border-brand-primary/50 hover:bg-bg-surface-elevated transition-all duration-200 hover:-translate-y-0.5 shadow-subtle"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                      {item.category}
                    </span>
                    <span className="text-[11px] text-text-muted">{item.duration}</span>
                  </div>
                  <h4 className="text-sm font-bold text-text-primary group-hover:text-brand-primary transition-colors leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-border-subtle text-xs font-semibold text-text-muted group-hover:text-brand-primary transition-colors">
                  <span>Start Roadmap</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Sort active plans for "Continue Learning"
  const sortedActive = [...active_plans].sort((a, b) => {
    const aDebt = a.progress.previous_debt_seconds > 0;
    const bDebt = b.progress.previous_debt_seconds > 0;
    if (aDebt && !bDebt) return -1;
    if (!aDebt && bDebt) return 1;

    const aRem = a.progress.remaining_seconds_today > 0;
    const bRem = b.progress.remaining_seconds_today > 0;
    if (aRem && !bRem) return -1;
    if (!aRem && bRem) return 1;

    return new Date(a.plan.created_at).getTime() - new Date(b.plan.created_at).getTime();
  });

  const mainPlan = sortedActive.length > 0 ? sortedActive[0] : null;
  const otherActive = sortedActive.slice(1);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Restrained Study Streak Header Pill */}
      {streak && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-bg-surface border border-border-default shadow-subtle">
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
            <div className="relative">
              <Flame className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${streak.current_streak > 0 ? "text-brand-primary drop-shadow-[0_0_8px_rgba(255,155,81,0.6)]" : "text-text-muted"}`} />
              {streak.current_streak > 0 && (
                <span className="absolute inset-0 animate-pulse blur-sm bg-brand-primary/40 rounded-full" />
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-bold text-text-primary leading-tight">
                {streak.current_streak} {streak.current_streak === 1 ? "Day" : "Days"} Streak
              </span>
              <span className="text-[11px] text-text-muted leading-tight mt-0.5 sm:mt-0">
                Personal best: <strong className="text-text-primary font-semibold">{streak.longest_streak} days</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {streak.today_active ? (
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-lg bg-brand-primary/15 text-brand-primary border border-brand-primary/20 shadow-[0_0_12px_rgba(255,155,81,0.15)]">
                Studied Today
              </span>
            ) : streak.current_streak > 0 ? (
              <span className="text-[11px] sm:text-xs font-medium text-text-muted">
                Study today to maintain streak
              </span>
            ) : null}

            <Link
              href="/learning/analytics"
              className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-brand-primary transition-colors px-2.5 py-1 rounded-lg hover:bg-white/[0.04]"
            >
              <span>Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Restrained Learning Milestones Overview */}
      {milestones && milestones.total_count > 0 && (
        <div className="flex flex-col gap-4 p-5 rounded-2xl bg-bg-surface border border-border-default shadow-subtle">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-4 h-4 text-brand-primary" />
              <span className="font-bold text-text-primary text-xs sm:text-sm">Learning Milestones</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-semibold border border-brand-primary/20">
                {milestones.achieved_count} / {milestones.total_count} Completed
              </span>
            </div>
            {milestones.next_milestone && (
              <span className="text-xs text-text-secondary">
                Next: <strong className="text-text-primary font-medium">{milestones.next_milestone.title}</strong>
              </span>
            )}
          </div>

          {/* Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {milestones.milestones.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${
                  m.achieved
                    ? "bg-brand-primary/10 border-brand-primary/30"
                    : "bg-bg-muted border-border-subtle"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold truncate ${
                    m.achieved ? "text-brand-primary" : "text-text-secondary"
                  }`}>
                    {m.title}
                  </span>
                  {m.achieved && (
                    <span className="text-brand-primary text-sm leading-none font-bold">✓</span>
                  )}
                </div>
                <span className="text-[11px] line-clamp-2 text-text-muted">
                  {m.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Continue Learning */}
      {mainPlan && (
        <section className="flex flex-col gap-4 mt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
              <div className="w-1.5 h-4 bg-brand-primary rounded-full" />
              Continue Learning
            </h2>
            {!streak && (
              <Link
                href="/learning/analytics"
                className="text-xs font-medium text-text-muted hover:text-brand-primary transition-colors"
              >
                View Analytics →
              </Link>
            )}
          </div>
          <div className="w-full">
            <LearningPlanCard
              plan={mainPlan.plan}
              progress={mainPlan.progress}
              resume={mainPlan.resume}
              adaptive={mainPlan.adaptive}
              milestones={mainPlan.milestones}
              isMain={true}
            />
          </div>
        </section>
      )}

      {/* Active Plans */}
      {otherActive.length > 0 && (
        <section className="flex flex-col gap-4 mt-4">
          <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
            <span className="w-1.5 h-4 bg-brand-primary rounded-full" />
            Active Roadmaps ({otherActive.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {otherActive.map((item) => (
              <LearningPlanCard
                key={item.plan.id}
                plan={item.plan}
                progress={item.progress}
                resume={item.resume}
                adaptive={item.adaptive}
                milestones={item.milestones}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed Plans */}
      {completed_plans.length > 0 && (
        <section className="flex flex-col gap-4 mt-6 pt-6 border-t border-border-subtle">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-4 h-4 text-brand-primary" />
            <h2 className="text-base sm:text-lg font-bold text-text-primary">Completed Roadmaps</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 opacity-85 hover:opacity-100 transition-opacity">
            {completed_plans.map((plan) => (
              <LearningPlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { getLearningWorkspace } from "../services/learningService";
import { LearningWorkspaceResponse } from "../types";
import { LearningPlanCard } from "./LearningPlanCard";

import Link from "next/link";
import { Loader2, Target, Trophy, Lock, Flame } from "lucide-react";

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
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-32 min-h-[400px]">
        <Loader2 className="w-12 h-12 text-[#FF9B51] animate-spin mb-4" />
        <p className="text-[#BFC9D1] text-sm">Loading your workspace...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-16 border border-status-error/20 bg-status-error/5 rounded-xl text-center flex flex-col items-center justify-center gap-12">
        <p className="text-status-error text-sm">{error || "Failed to load workspace."}</p>
        {error?.includes("session has expired") && (
          <Link
            href="/login?callbackUrl=/learning"
            className="px-16 py-8 bg-brand-primary hover:bg-brand-hover text-text-inverse text-body-small font-semibold rounded-lg transition-colors focus:outline-none"
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
      <div className="flex flex-col gap-6 w-full">
        {streak && (
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#25343F] border border-[#BFC9D1]/15 text-xs w-fit">
            <Flame className={`w-4 h-4 ${streak.current_streak > 0 ? "text-[#FF9B51]" : "text-[#BFC9D1]/40"}`} />
            <span className="font-bold text-[#EAEFEF]">
              {streak.current_streak} {streak.current_streak === 1 ? "Day" : "Days"} Streak
            </span>
            <span className="text-[#BFC9D1]/30">•</span>
            <span className="text-[#BFC9D1]">
              Best: <strong className="text-[#EAEFEF] font-medium">{streak.longest_streak}</strong> {streak.longest_streak === 1 ? "day" : "days"}
            </span>
          </div>
        )}
        <div className="flex flex-col items-center justify-center p-12 sm:p-24 text-center border border-[#BFC9D1]/10 border-dashed rounded-2xl bg-[#25343F]/30">
          <div className="w-20 h-20 rounded-full bg-[#BFC9D1]/5 flex items-center justify-center mb-8">
            <Target className="w-10 h-10 text-[#BFC9D1]/50" />
          </div>
          <h3 className="text-lg font-semibold text-[#EAEFEF] mb-3">
            No active learning plans yet
          </h3>
          <p className="text-sm text-[#BFC9D1] max-w-sm">
            Search for a topic above and start a learning plan to begin your journey.
          </p>
        </div>
      </div>
    );
  }

  // Sort active plans for "Continue Learning"
  // Priority: 1. Has debt, 2. Has remaining today, 3. Date
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
    <div className="flex flex-col gap-8 w-full">
      {/* Restrained Study Streak Header Pill */}
      {streak && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-3 sm:px-4 sm:py-2.5 rounded-xl bg-[#25343F] border border-[#BFC9D1]/15">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm">
            <Flame className={`w-4 h-4 shrink-0 ${streak.current_streak > 0 ? "text-[#FF9B51]" : "text-[#BFC9D1]/40"}`} />
            <span className="font-bold text-[#EAEFEF]">
              {streak.current_streak} {streak.current_streak === 1 ? "Day" : "Days"} Streak
            </span>
            <span className="text-[#BFC9D1]/30">•</span>
            <span className="text-xs text-[#BFC9D1]">
              Best: <strong className="text-[#EAEFEF] font-semibold">{streak.longest_streak}</strong> {streak.longest_streak === 1 ? "day" : "days"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {streak.today_active ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FF9B51]/15 text-[#FF9B51] border border-[#FF9B51]/20">
                Studied Today
              </span>
            ) : streak.current_streak > 0 ? (
              <span className="text-[11px] font-medium text-[#BFC9D1]/70">
                Study today to maintain streak
              </span>
            ) : null}

            <Link 
              href="/learning/analytics" 
              className="text-xs font-medium text-[#BFC9D1] hover:text-[#FF9B51] transition-colors"
            >
              Analytics →
            </Link>
          </div>
        </div>
      )}

      {/* Restrained Learning Milestones Overview */}
      {milestones && milestones.total_count > 0 && (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-[#25343F] border border-[#BFC9D1]/15">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#FF9B51]" />
              <span className="font-bold text-[#EAEFEF] text-sm">Learning Milestones</span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#FF9B51]/15 text-[#FF9B51] font-semibold">
                {milestones.achieved_count} / {milestones.total_count} Earned
              </span>
            </div>
            {milestones.next_milestone && (
              <span className="text-xs text-[#BFC9D1]">
                Next: <strong className="text-[#EAEFEF] font-semibold">{milestones.next_milestone.title}</strong>
              </span>
            )}
          </div>

          {/* Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {milestones.milestones.map((m) => (
              <div
                key={m.id}
                className={`p-2.5 rounded-lg border flex flex-col gap-1 transition-all ${
                  m.achieved
                    ? "bg-[#FF9B51]/5 border-[#FF9B51]/25 text-[#EAEFEF]"
                    : "bg-[#25343F]/40 border-[#BFC9D1]/10 text-[#BFC9D1]/60"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-semibold truncate ${m.achieved ? "text-[#FF9B51]" : "text-[#BFC9D1]"}`}>
                    {m.title}
                  </span>
                  {m.achieved && <span className="text-[10px] text-[#FF9B51] font-bold">✓</span>}
                </div>
                <span className="text-[10px] line-clamp-1 opacity-70">
                  {m.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Continue Learning */}
      {mainPlan && (
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#EAEFEF] flex items-center gap-2">
              Continue Learning
            </h2>
            {!streak && (
              <Link 
                href="/learning/analytics" 
                className="text-xs font-medium text-[#BFC9D1] hover:text-[#FF9B51] transition-colors"
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
        <section className="flex flex-col gap-5 mt-2">
          <h2 className="text-lg font-bold text-[#EAEFEF]">Active Plans</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
        <section className="flex flex-col gap-6 mt-8 pt-8 border-t border-[#BFC9D1]/10">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-[#FF9B51]" />
            <h2 className="text-lg font-bold text-[#EAEFEF]">Completed Learning</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 opacity-80 hover:opacity-100 transition-opacity">
            {completed_plans.map((plan) => (
              <LearningPlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

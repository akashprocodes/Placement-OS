import React from "react";
import { TrendingUp, Flame, Lock, AlertCircle, ArrowRight, Award } from "lucide-react";
import Link from "next/link";
import { StudyStreakInfo, AnalyticsSummary } from "@/features/learning/types";
import { formatDuration } from "@/features/learning/utils/duration";

export interface ProgressSummaryProps {
  isAuthenticated?: boolean;
  streak?: StudyStreakInfo | null;
  analyticsSummary?: AnalyticsSummary | null;
  completedPlansCount?: number;
  error?: boolean;
}

export function ProgressSummary({
  isAuthenticated = false,
  streak,
  analyticsSummary,
  completedPlansCount = 0,
  error = false,
}: ProgressSummaryProps) {
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col p-20 bg-bg-surface border border-border-default rounded-xl shadow-subtle gap-16 justify-between h-full min-h-[200px]">
        <div className="flex justify-between items-center">
          <h3 className="text-label font-semibold text-text-primary">Your Progress</h3>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
          <Lock className="w-24 h-24 text-text-muted mb-8 opacity-50" />
          <p className="text-body-small font-medium text-text-primary mb-4">
            Track streaks & milestones
          </p>
          <p className="text-caption text-text-muted mb-12">
            Sign in to track study streaks, active days, and completed courses.
          </p>
          <Link
            href="/login?callbackUrl=/"
            className="px-16 py-6 bg-brand-primary hover:bg-brand-hover text-text-inverse text-caption font-semibold rounded-lg transition-colors inline-block"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col p-20 bg-bg-surface border border-border-default rounded-xl shadow-subtle gap-16 justify-between h-full min-h-[200px]">
        <div className="flex justify-between items-center">
          <h3 className="text-label font-semibold text-text-primary">Your Progress</h3>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
          <AlertCircle className="w-24 h-24 text-brand-primary mb-8 opacity-80" />
          <p className="text-body-small font-medium text-text-primary mb-4">
            Unable to load progress
          </p>
          <p className="text-caption text-text-muted">
            Could not retrieve analytics data. Please refresh or try again later.
          </p>
        </div>
      </div>
    );
  }

  const currentStreak = streak?.current_streak ?? analyticsSummary?.current_streak_days ?? 0;
  const longestStreak = streak?.longest_streak ?? analyticsSummary?.longest_streak_days ?? 0;
  const isTodayActive = streak?.today_active ?? false;
  const totalCompletedPlans = typeof completedPlansCount === "number" ? completedPlansCount : (analyticsSummary?.completed_plans_count ?? 0);
  const totalWatchedSeconds = analyticsSummary?.total_watched_seconds ?? 0;
  const activeDays = analyticsSummary?.total_active_days ?? 0;

  return (
    <div className="flex flex-col p-20 bg-bg-surface border border-border-default rounded-xl shadow-subtle gap-16 justify-between h-full min-h-[200px]">
      <div className="flex justify-between items-center">
        <h3 className="text-label font-semibold text-text-primary">Your Progress</h3>
        <Link
          href="/learning/analytics"
          className="text-caption text-text-secondary hover:text-brand-primary font-medium flex items-center gap-4 transition-colors"
        >
          <span>Analytics</span>
          <ArrowRight className="w-12 h-12" />
        </Link>
      </div>

      <div className="flex flex-col gap-14 flex-1 justify-between">
        {/* Streak highlight */}
        <div className="flex items-center justify-between p-12 bg-bg-muted/40 border border-border-subtle rounded-xl">
          <div className="flex items-center gap-10">
            <div className="w-36 h-36 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
              <Flame className="w-20 h-20 fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-h4 font-bold text-text-primary leading-tight">
                {currentStreak} {currentStreak === 1 ? "Day" : "Days"}
              </span>
              <span className="text-caption text-text-muted">Current Study Streak</span>
            </div>
          </div>
          <div className="text-right">
            {isTodayActive ? (
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-8 py-2 rounded-md">
                Active Today 🔥
              </span>
            ) : (
              <span className="text-caption text-text-muted">
                Best: {longestStreak}d
              </span>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-10">
          <div className="flex items-center gap-8 p-10 bg-bg-muted/20 border border-border-subtle rounded-lg">
            <Award className="w-16 h-16 text-brand-primary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-body-small font-bold text-text-primary">
                {totalCompletedPlans}
              </span>
              <span className="text-[11px] text-text-muted truncate">Completed Plans</span>
            </div>
          </div>

          <div className="flex items-center gap-8 p-10 bg-bg-muted/20 border border-border-subtle rounded-lg">
            <TrendingUp className="w-16 h-16 text-brand-primary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-body-small font-bold text-text-primary">
                {activeDays}
              </span>
              <span className="text-[11px] text-text-muted truncate">Active Days</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-border-subtle flex items-center justify-between text-caption text-text-muted">
          <span>Total watched: {formatDuration(totalWatchedSeconds)}</span>
          <span className="text-brand-primary font-medium hover:underline">
            <Link href="/learning/analytics">View Report</Link>
          </span>
        </div>
      </div>
    </div>
  );
}

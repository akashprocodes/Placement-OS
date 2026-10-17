import React from "react";
import { BookOpen, Lock, AlertCircle, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { LearningPlanWithProgress } from "@/features/learning/types";
import { formatDuration } from "@/features/learning/utils/duration";

export interface LearningSummaryProps {
  isAuthenticated?: boolean;
  activePlans?: LearningPlanWithProgress[];
  error?: boolean;
}

export function LearningSummary({
  isAuthenticated = false,
  activePlans = [],
  error = false,
}: LearningSummaryProps) {
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col p-20 bg-bg-surface border border-border-default rounded-xl shadow-subtle gap-16 justify-between h-full min-h-[200px]">
        <div className="flex justify-between items-center">
          <h3 className="text-label font-semibold text-text-primary">Learning Summary</h3>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
          <Lock className="w-24 h-24 text-text-muted mb-8 opacity-50" />
          <p className="text-body-small font-medium text-text-primary mb-4">
            Sign in to track progress
          </p>
          <p className="text-caption text-text-muted mb-12">
            Track daily study goals, active learning plans, and course debt.
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
          <h3 className="text-label font-semibold text-text-primary">Learning Summary</h3>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
          <AlertCircle className="w-24 h-24 text-brand-primary mb-8 opacity-80" />
          <p className="text-body-small font-medium text-text-primary mb-4">
            Unable to load summary
          </p>
          <p className="text-caption text-text-muted">
            Could not retrieve learning data. Please refresh or try again later.
          </p>
        </div>
      </div>
    );
  }

  if (activePlans.length === 0) {
    return (
      <div className="flex flex-col p-20 bg-bg-surface border border-border-default rounded-xl shadow-subtle gap-16 justify-between h-full min-h-[200px]">
        <div className="flex justify-between items-center">
          <h3 className="text-label font-semibold text-text-primary">Learning Summary</h3>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
          <BookOpen className="w-24 h-24 text-text-muted mb-8 opacity-50" />
          <p className="text-body-small font-medium text-text-primary mb-4">
            No active plans
          </p>
          <p className="text-caption text-text-muted mb-12">
            Search videos to set up your structured learning schedule.
          </p>
          <Link
            href="/learning"
            className="px-16 py-6 bg-brand-primary hover:bg-brand-hover text-text-inverse text-caption font-medium rounded-lg transition-colors inline-block"
          >
            Find Content
          </Link>
        </div>
      </div>
    );
  }

  const totalRequiredToday = activePlans.reduce(
    (sum, p) => sum + (p.progress?.required_seconds_today ?? 0),
    0
  );
  const totalCompletedToday = activePlans.reduce(
    (sum, p) => sum + (p.progress?.completed_seconds_today ?? 0),
    0
  );
  const totalDebt = activePlans.reduce(
    (sum, p) => sum + (p.progress?.previous_debt_seconds ?? 0),
    0
  );
  const isBehind = activePlans.some(
    (p) => p.adaptive?.schedule_status === "behind"
  );
  const isAllCompleted =
    totalRequiredToday > 0 && totalCompletedToday >= totalRequiredToday;
  const todayProgressPercent =
    totalRequiredToday > 0
      ? Math.min(100, Math.round((totalCompletedToday / totalRequiredToday) * 100))
      : isAllCompleted
      ? 100
      : 0;

  return (
    <div className="flex flex-col p-20 bg-bg-surface border border-border-default rounded-xl shadow-subtle gap-16 justify-between h-full min-h-[200px]">
      <div className="flex justify-between items-center">
        <h3 className="text-label font-semibold text-text-primary">Learning Summary</h3>
        <Link
          href="/learning"
          className="text-caption text-text-secondary hover:text-brand-primary font-medium flex items-center gap-4 transition-colors"
        >
          <span>Workspace</span>
          <ArrowRight className="w-12 h-12" />
        </Link>
      </div>

      <div className="flex flex-col gap-14 flex-1 justify-between">
        {/* Active Plans & Status Badge */}
        <div className="flex items-center justify-between gap-8 flex-wrap">
          <span className="text-body-small font-medium text-text-secondary">
            {activePlans.length} active {activePlans.length === 1 ? "plan" : "plans"}
          </span>
          <span
            className={`text-[11px] font-medium px-8 py-2 rounded-md ${
              isBehind
                ? "text-brand-primary bg-brand-primary/10 border border-brand-primary/20"
                : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
            }`}
          >
            {isBehind ? "Behind Schedule" : "On Track"}
          </span>
        </div>

        {/* Today's Goal Progress */}
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center text-caption font-medium">
            <span className="text-text-muted">Today&apos;s Target</span>
            <span className="text-text-primary font-semibold">
              {formatDuration(totalCompletedToday)} / {formatDuration(totalRequiredToday)}
            </span>
          </div>
          <div className="w-full h-6 bg-bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-primary rounded-full transition-all duration-300"
              style={{ width: `${todayProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Debt and Progress status footer */}
        <div className="pt-8 border-t border-border-subtle flex items-center justify-between text-caption">
          {totalDebt > 0 ? (
            <div className="flex items-center gap-6 text-brand-primary font-medium">
              <Clock className="w-14 h-14 shrink-0" />
              <span>{formatDuration(totalDebt)} catch-up debt</span>
            </div>
          ) : (
            <div className="flex items-center gap-6 text-emerald-400 font-medium">
              <CheckCircle2 className="w-14 h-14 shrink-0" />
              <span>No catch-up debt</span>
            </div>
          )}
          <span className="text-text-muted">{todayProgressPercent}% completed</span>
        </div>
      </div>
    </div>
  );
}

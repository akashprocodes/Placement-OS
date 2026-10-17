import React from "react";
import { BookOpen, Play, Calendar, Lock, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { LearningPlanWithProgress } from "@/features/learning/types";
import { formatDuration } from "@/features/learning/utils/duration";
import { formatTimestamp } from "@/features/learning/utils/timestamp";

interface ContinueLearningProps {
  isAuthenticated?: boolean;
  activePlans?: LearningPlanWithProgress[];
}

export function ContinueLearning({ isAuthenticated = false, activePlans = [] }: ContinueLearningProps) {
  if (!isAuthenticated) {
    return (
      <section aria-labelledby="continue-learning-heading" className="flex flex-col gap-16 w-full">
        <div className="flex justify-between items-center">
          <h2 id="continue-learning-heading" className="text-h4 font-bold text-text-primary">
            Continue Learning
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center p-32 sm:p-48 text-center border border-border-default border-dashed rounded-2xl bg-bg-surface/30">
          <div className="w-48 h-48 rounded-full bg-bg-muted flex items-center justify-center mb-16">
            <Lock className="w-24 h-24 text-text-muted" />
          </div>
          <h3 className="text-body-large font-semibold text-text-primary mb-8">
            Sign in to track your learning
          </h3>
          <p className="text-body-small text-text-muted max-w-sm mb-24">
            Create an account or sign in to save learning plans, track your daily goals, and resume videos right where you left off.
          </p>
          <Link
            href="/login?callbackUrl=/"
            className="px-24 py-12 bg-brand-primary hover:bg-brand-hover text-text-inverse text-body-small font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/40 shadow-subtle inline-block"
          >
            Sign In
          </Link>
        </div>
      </section>
    );
  }

  if (activePlans.length === 0) {
    return (
      <section aria-labelledby="continue-learning-heading" className="flex flex-col gap-16 w-full">
        <div className="flex justify-between items-center">
          <h2 id="continue-learning-heading" className="text-h4 font-bold text-text-primary">
            Continue Learning
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center p-32 sm:p-48 text-center border border-border-default border-dashed rounded-2xl bg-bg-surface/30">
          <div className="w-48 h-48 rounded-full bg-bg-muted flex items-center justify-center mb-16">
            <BookOpen className="w-24 h-24 text-text-muted" />
          </div>
          <h3 className="text-body-large font-semibold text-text-primary mb-8">
            No active learning yet
          </h3>
          <p className="text-body-small text-text-muted max-w-sm mb-24">
            Search for a topic to start your guided learning journey and create your first plan.
          </p>
          <Link
            href="/learning"
            className="px-24 py-12 bg-brand-primary hover:bg-brand-hover text-text-inverse text-body-small font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/40 shadow-subtle inline-block"
          >
            Start Learning
          </Link>
        </div>
      </section>
    );
  }

  const sortedActive = [...activePlans].sort((a, b) => {
    const aDebt = (a.progress?.previous_debt_seconds ?? 0) > 0;
    const bDebt = (b.progress?.previous_debt_seconds ?? 0) > 0;
    if (aDebt && !bDebt) return -1;
    if (!aDebt && bDebt) return 1;

    const aRem = (a.progress?.remaining_seconds_today ?? 0) > 0;
    const bRem = (b.progress?.remaining_seconds_today ?? 0) > 0;
    if (aRem && !bRem) return -1;
    if (!aRem && bRem) return 1;

    return new Date(a.plan.created_at).getTime() - new Date(b.plan.created_at).getTime();
  });

  const primary = sortedActive[0];
  const { plan, progress, resume, adaptive } = primary;

  let resumeHref = plan.content_type === "playlist"
    ? `/learning/playlist/${plan.content_id}`
    : `/learning/video/${plan.content_id}`;

  if (resume?.video_id) {
    const params = new URLSearchParams();
    if (resume.playlist_id) {
      params.set("playlistId", resume.playlist_id);
    }
    if (resume.saved_position_seconds > 0) {
      params.set("t", String(resume.saved_position_seconds));
    }
    const qs = params.toString();
    resumeHref = `/learning/video/${resume.video_id}${qs ? `?${qs}` : ""}`;
  }

  const progressPercent = adaptive?.progress_percent ?? 0;
  const isGoalMet = progress.remaining_seconds_today === 0;

  return (
    <section aria-labelledby="continue-learning-heading" className="flex flex-col gap-16 w-full">
      <div className="flex justify-between items-center">
        <h2 id="continue-learning-heading" className="text-h4 font-bold text-text-primary">
          Continue Learning
        </h2>
        <Link
          href="/learning"
          className="text-body-small text-text-secondary hover:text-brand-primary font-medium flex items-center gap-4 transition-colors"
        >
          <span>Workspace</span>
          <ArrowRight className="w-16 h-16" />
        </Link>
      </div>

      <div className="p-24 sm:p-32 bg-bg-surface border border-border-default rounded-2xl shadow-subtle flex flex-col gap-20">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-12">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-8 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-8 py-2 rounded-md">
                {plan.content_type === "playlist" ? "Playlist Course" : "Video Plan"}
              </span>
              {adaptive?.schedule_status && (
                <span
                  className={`text-[11px] font-medium px-8 py-2 rounded-md capitalize ${
                    adaptive.schedule_status === "behind"
                      ? "text-brand-primary bg-brand-primary/10 border border-brand-primary/20"
                      : adaptive.schedule_status === "ahead"
                      ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                      : "text-text-muted bg-bg-muted"
                  }`}
                >
                  {adaptive.schedule_status === "behind"
                    ? "Behind Schedule"
                    : adaptive.schedule_status === "ahead"
                    ? "Ahead of Schedule"
                    : "On Track"}
                </span>
              )}
            </div>
            <h3 className="text-h3 font-bold text-text-primary line-clamp-1">{plan.title}</h3>
          </div>

          <div className="flex items-center gap-6 text-caption text-text-muted">
            <Calendar className="w-16 h-16 shrink-0" />
            <span>Target: {new Date(plan.target_completion_date).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center text-body-small font-medium">
            <span className="text-text-secondary">Overall Progress</span>
            <span className="text-text-primary font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full h-8 bg-bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-primary rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>

        {/* Daily Goal and Debt Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 pt-8 border-t border-border-subtle">
          <div className="flex items-center gap-10">
            {isGoalMet ? (
              <CheckCircle2 className="w-20 h-20 text-emerald-400 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand-primary shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="text-caption text-text-muted">Today&apos;s Target</span>
              <span className="text-body-small font-semibold text-text-primary">
                {isGoalMet ? "Goal completed! 🎉" : `${formatDuration(progress.remaining_seconds_today)} remaining`}
              </span>
            </div>
          </div>

          {progress.previous_debt_seconds > 0 && (
            <div className="flex items-center gap-10">
              <div className="w-10 h-10 rounded-full bg-brand-primary/80 shrink-0" />
              <div className="flex flex-col">
                <span className="text-caption text-text-muted">Catch-Up Debt</span>
                <span className="text-body-small font-semibold text-brand-primary">
                  {formatDuration(progress.previous_debt_seconds)} to catch up
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Primary CTA Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-12 pt-12">
          {resume?.video_title && (
            <div className="flex items-center gap-8 text-body-small text-text-muted truncate max-w-md">
              <Play className="w-16 h-16 text-brand-primary shrink-0" />
              <span className="truncate">Up next: <strong className="text-text-secondary font-medium">{resume.video_title}</strong></span>
              {resume.saved_position_seconds > 0 && (
                <span className="text-caption text-text-muted shrink-0">
                  ({formatTimestamp(resume.saved_position_seconds)})
                </span>
              )}
            </div>
          )}

          <Link
            href={resumeHref}
            className="px-24 py-12 bg-brand-primary hover:bg-brand-hover text-text-inverse font-semibold text-body-small rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/40 shadow-subtle inline-flex items-center justify-center gap-8 ml-auto"
          >
            <Play className="w-16 h-16 fill-current" />
            <span>Resume Learning</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

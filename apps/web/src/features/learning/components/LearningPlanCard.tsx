"use client";

import React from "react";
import Link from "next/link";
import { Play, ListVideo, Calendar, CheckCircle2, AlertCircle, TrendingUp, Target, ArrowRight } from "lucide-react";
import {
  LearningPlanResponse,
  LearningPlanProgress,
  PlanResumeContext,
  AdaptivePlanRecommendation,
  PlanMilestoneInfo,
} from "../types";
import { formatTimestamp } from "../utils/timestamp";

interface Props {
  plan: LearningPlanResponse;
  progress?: LearningPlanProgress;
  resume?: PlanResumeContext | null;
  adaptive?: AdaptivePlanRecommendation | null;
  milestones?: PlanMilestoneInfo | null;
  isMain?: boolean;
}

function formatDuration(seconds: number) {
  if (seconds === 0) return "0h";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatDate(isoDate: string) {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  const dateObj = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return dateObj.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function LearningPlanCard({
  plan,
  progress,
  resume,
  adaptive,
  milestones,
  isMain = false,
}: Props) {
  const isPlaylist = plan.content_type === "playlist";
  const Icon = isPlaylist ? ListVideo : Play;
  const defaultHref = `/learning/${isPlaylist ? "playlist" : "video"}/${plan.content_id}`;
  
  const isCompleted = plan.status === "completed";
  const effectiveAdaptive = adaptive || progress?.adaptive;

  if (isCompleted) {
    return (
      <Link href={defaultHref} className="group block h-full">
        <div className="bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.08] hover:border-brand-primary/40 rounded-2xl p-5 sm:p-6 transition-all duration-300 h-full flex flex-col justify-between gap-4 backdrop-blur-md hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed</span>
              </div>
            </div>
            <h3 className="font-bold text-text-primary text-sm sm:text-base line-clamp-2 leading-snug group-hover:text-brand-primary transition-colors">
              {plan.title}
            </h3>
            <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mt-2">
              {isPlaylist ? "Curated Playlist" : "Lecture"} • {formatDuration(plan.total_duration_seconds)}
            </div>
          </div>
          
          {plan.completed_at && (
            <div className="text-xs text-text-muted flex items-center gap-1.5 pt-3 border-t border-white/[0.06]">
              <Calendar className="w-3.5 h-3.5 text-brand-primary/80" />
              <span>Finished on {formatDate(plan.completed_at.split('T')[0])}</span>
            </div>
          )}
        </div>
      </Link>
    );
  }

  // Determine Resume Target URL
  let resumeUrl = defaultHref;
  const hasSavedPosition = Boolean(resume && resume.has_saved_position && resume.saved_position_seconds > 0);

  if (resume) {
    const videoTarget = resume.video_id;
    if (resume.playlist_id) {
      if (hasSavedPosition) {
        resumeUrl = `/learning/video/${videoTarget}?playlistId=${resume.playlist_id}&t=${resume.saved_position_seconds}`;
      } else {
        resumeUrl = `/learning/video/${videoTarget}?playlistId=${resume.playlist_id}`;
      }
    } else {
      if (hasSavedPosition) {
        resumeUrl = `/learning/video/${videoTarget}?t=${resume.saved_position_seconds}`;
      } else {
        resumeUrl = `/learning/video/${videoTarget}`;
      }
    }
  }

  // Active Plan rendering
  const pct = progress 
    ? (progress.required_seconds_today > 0 
        ? Math.min((progress.completed_seconds_today / progress.required_seconds_today) * 100, 100) 
        : (progress.base_target_seconds_today === 0 && progress.previous_debt_seconds === 0 ? 100 : 0))
    : 0;

  const hasDebt = progress && progress.previous_debt_seconds > 0;
  const isDoneToday = progress && progress.remaining_seconds_today === 0 && progress.required_seconds_today > 0;

  return (
    <div
      className={`group relative bg-gradient-to-b from-white/[0.04] via-white/[0.015] to-transparent border rounded-2xl p-5 sm:p-6 transition-all duration-300 h-full flex flex-col justify-between gap-5 backdrop-blur-xl ${
        isMain
          ? "border-brand-primary/40 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_24px_rgba(255,155,81,0.12)]"
          : "border-white/[0.08] hover:border-brand-primary/40 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      }`}
    >
      {/* Decorative top accent line on main card */}
      {isMain && (
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand-primary/60 to-transparent" />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-text-secondary group-hover:text-brand-primary transition-colors">
              <Icon className="w-5 h-5" />
            </div>
            {effectiveAdaptive && (
              <div>
                {effectiveAdaptive.schedule_status === "ahead" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-lg border border-brand-primary/20">
                    <TrendingUp className="w-3 h-3" />
                    <span>Ahead</span>
                  </span>
                )}
                {effectiveAdaptive.schedule_status === "behind" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border text-status-warning bg-status-warning/10 border-status-warning/20">
                    <AlertCircle className="w-3 h-3" />
                    <span>{effectiveAdaptive.is_overdue ? "Overdue" : "Behind"}</span>
                  </span>
                )}
                {effectiveAdaptive.schedule_status === "on_track" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary bg-white/[0.04] px-2 py-0.5 rounded-lg border border-white/[0.08]">
                    <CheckCircle2 className="w-3 h-3 text-brand-primary" />
                    <span>On Track</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Calendar className="w-3.5 h-3.5" />
            <span>Target: {formatDate(plan.target_completion_date)}</span>
          </div>
        </div>

        <Link href={resumeUrl} className="group/card">
          <h3 className={`font-bold text-text-primary line-clamp-2 leading-snug group-hover/card:text-brand-primary transition-colors ${isMain ? "text-base sm:text-lg" : "text-sm sm:text-base"}`}>
            {plan.title}
          </h3>
        </Link>

        {isPlaylist && resume?.video_title && (
          <p className="text-xs text-text-muted truncate">
            Up next: <span className="text-text-secondary font-medium">{resume.video_title}</span>
          </p>
        )}
      </div>

      {/* Progress & Adaptive Section */}
      <div className="flex flex-col gap-3.5 mt-auto">
        {progress && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end gap-3 flex-wrap">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-0.5">Today&apos;s Target</span>
                <span className="text-xs sm:text-sm font-bold text-text-primary">
                  {formatDuration(progress.completed_seconds_today)}{" "}
                  <span className="text-xs font-normal text-text-muted">/ {formatDuration(progress.required_seconds_today)}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isDoneToday && (
                  <div className="flex items-center gap-1 text-brand-primary text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Goal Met</span>
                  </div>
                )}
                {hasDebt && !isDoneToday && (
                  <div className="flex items-center gap-1 text-status-warning text-xs font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Catch-up</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  isDoneToday 
                    ? "bg-gradient-to-r from-brand-primary to-[#FFAE70] shadow-[0_0_10px_rgba(255,155,81,0.5)]" 
                    : "bg-gradient-to-r from-white/70 to-white/40"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Adaptive Recommendation & Explanation */}
        {effectiveAdaptive && (
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.06] flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="font-semibold text-text-primary">
                Target Pace: <strong className="text-brand-primary font-bold">{formatDuration(effectiveAdaptive.recommended_daily_target_seconds)}/day</strong>
              </span>
              <span className="text-[11px] text-text-muted">
                {effectiveAdaptive.remaining_days > 0
                  ? `${effectiveAdaptive.remaining_days} ${effectiveAdaptive.remaining_days === 1 ? "day" : "days"} left`
                  : "Overdue"}
              </span>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              {effectiveAdaptive.explanation}
            </p>
            {effectiveAdaptive.constraint_note && (
              <div className="text-[11px] text-status-warning bg-status-warning/10 p-2 rounded-lg border border-status-warning/20 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{effectiveAdaptive.constraint_note}</span>
              </div>
            )}
          </div>
        )}

        {/* Plan Milestones */}
        {milestones && (milestones.completed_milestones.length > 0 || milestones.next_milestone) && (
          <div className="flex flex-col gap-1.5 text-xs pt-0.5">
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span className="flex items-center gap-1.5 text-text-secondary font-medium">
                <Target className="w-3 h-3 text-brand-primary" />
                <span>Next: {milestones.next_milestone || "Plan Complete"}</span>
              </span>
              <span className="text-text-muted font-medium">{Math.round(milestones.progress_percent)}%</span>
            </div>
            {milestones.completed_milestones.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {milestones.completed_milestones.map((cm) => (
                  <span
                    key={cm}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/15"
                  >
                    ✓ {cm.replace(" Plan Progress", "").replace(" Plan Complete", "")}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Resume Action */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-white/[0.06] flex-wrap">
          {hasSavedPosition ? (
            <Link
              href={resumeUrl}
              className={`inline-flex items-center gap-2 rounded-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary ${
                isMain
                  ? "px-4 py-2 bg-gradient-to-r from-brand-primary to-[#FF8438] hover:from-[#FF8438] hover:to-brand-primary text-text-inverse text-xs sm:text-sm shadow-[0_0_20px_rgba(255,155,81,0.3)] hover:shadow-[0_0_25px_rgba(255,155,81,0.5)] active:scale-95"
                  : "px-3 py-1.5 bg-brand-primary/15 hover:bg-brand-primary/25 text-brand-primary text-xs"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume at {formatTimestamp(resume!.saved_position_seconds)}</span>
            </Link>
          ) : (
            <Link
              href={resumeUrl}
              className={`inline-flex items-center gap-1.5 rounded-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary ${
                isMain
                  ? "px-4 py-2 bg-gradient-to-r from-brand-primary to-[#FF8438] hover:from-[#FF8438] hover:to-brand-primary text-text-inverse text-xs sm:text-sm shadow-[0_0_20px_rgba(255,155,81,0.3)] hover:shadow-[0_0_25px_rgba(255,155,81,0.5)] active:scale-95"
                  : "px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-text-primary text-xs"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isPlaylist ? "Start Next Video" : "Start Video"}</span>
            </Link>
          )}

          {isPlaylist && (
            <Link
              href={defaultHref}
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <span>View Outline</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

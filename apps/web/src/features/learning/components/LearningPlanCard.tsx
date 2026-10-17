"use client";

import React from "react";
import Link from "next/link";
import { Play, ListVideo, Calendar, CheckCircle2, AlertCircle, TrendingUp, Target } from "lucide-react";
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
        <div className="bg-[#25343F]/50 border border-[#BFC9D1]/10 hover:border-[#FF9B51]/30 rounded-xl p-5 transition-all h-full flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF9B51]/10 flex items-center justify-center text-[#FF9B51]">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#FF9B51] bg-[#FF9B51]/10 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed</span>
              </div>
            </div>
            <h3 className="font-semibold text-[#EAEFEF] text-base line-clamp-2 leading-tight group-hover:text-[#FF9B51] transition-colors">
              {plan.title}
            </h3>
            <div className="text-xs text-[#BFC9D1] uppercase tracking-wider font-medium mt-2">
              {isPlaylist ? "Playlist" : "Video"} • {formatDuration(plan.total_duration_seconds)}
            </div>
          </div>
          
          {plan.completed_at && (
            <div className="text-xs text-[#BFC9D1] flex items-center gap-1.5 pt-3 border-t border-[#BFC9D1]/10">
              <Calendar className="w-3.5 h-3.5" />
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
      className={`bg-[#25343F] border border-[#BFC9D1]/10 hover:border-[#FF9B51]/50 rounded-xl p-5 transition-all h-full flex flex-col justify-between gap-5 ${
        isMain ? 'ring-1 ring-[#FF9B51]/20 shadow-[0_0_20px_rgba(255,155,81,0.05)]' : ''
      }`}
    >
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#BFC9D1]/5 flex items-center justify-center text-[#BFC9D1]">
              <Icon className="w-5 h-5" />
            </div>
            {effectiveAdaptive && (
              <div>
                {effectiveAdaptive.schedule_status === "ahead" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF9B51] bg-[#FF9B51]/10 px-2 py-0.5 rounded border border-[#FF9B51]/20">
                    <TrendingUp className="w-3 h-3" />
                    <span>Ahead</span>
                  </span>
                )}
                {effectiveAdaptive.schedule_status === "behind" && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${
                    effectiveAdaptive.is_overdue
                      ? "text-[#FF9B51] bg-[#FF9B51]/15 border-[#FF9B51]/30"
                      : "text-[#FF9B51] bg-[#FF9B51]/10 border-[#FF9B51]/20"
                  }`}>
                    <AlertCircle className="w-3 h-3" />
                    <span>{effectiveAdaptive.is_overdue ? "Overdue" : "Behind"}</span>
                  </span>
                )}
                {effectiveAdaptive.schedule_status === "on_track" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#BFC9D1] bg-[#BFC9D1]/10 px-2 py-0.5 rounded border border-[#BFC9D1]/15">
                    <CheckCircle2 className="w-3 h-3 text-[#BFC9D1]" />
                    <span>On Track</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#BFC9D1]">
            <Calendar className="w-3.5 h-3.5" />
            <span>Target: {formatDate(plan.target_completion_date)}</span>
          </div>
        </div>
        
        <Link href={resumeUrl} className="group">
          <h3 className={`font-semibold text-[#EAEFEF] line-clamp-2 leading-tight group-hover:text-[#FF9B51] transition-colors ${isMain ? 'text-lg' : 'text-base'}`}>
            {plan.title}
          </h3>
        </Link>

        {/* Playlist next video hint if available */}
        {isPlaylist && resume?.video_title && (
          <p className="text-xs text-[#BFC9D1]/80 truncate">
            Up next: <span className="text-[#EAEFEF] font-medium">{resume.video_title}</span>
          </p>
        )}
      </div>

      {/* Progress & Adaptive Section */}
      <div className="flex flex-col gap-3.5 mt-auto">
        {progress && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-[#BFC9D1] font-semibold mb-1">Today&apos;s Progress</span>
                <span className="text-sm font-bold text-[#EAEFEF]">
                  {formatDuration(progress.completed_seconds_today)} <span className="text-xs font-normal text-[#BFC9D1]">/ {formatDuration(progress.required_seconds_today)}</span>
                </span>
              </div>
              
              {isDoneToday && (
                <div className="flex items-center gap-1 text-[#FF9B51] text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Done</span>
                </div>
              )}
              {hasDebt && !isDoneToday && (
                <div className="flex items-center gap-1 text-[#FF9B51] text-xs font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Catch-up</span>
                </div>
              )}
            </div>

            <div className="w-full h-1.5 bg-[#BFC9D1]/10 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${isDoneToday ? 'bg-[#FF9B51]' : 'bg-[#EAEFEF]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Adaptive Recommendation & Explanation */}
        {effectiveAdaptive && (
          <div className="bg-[#BFC9D1]/5 rounded-lg p-2.5 border border-[#BFC9D1]/10 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between text-[#BFC9D1]">
              <span className="font-semibold text-[#EAEFEF]">
                Target Pace: <strong className="text-[#FF9B51] font-bold">{formatDuration(effectiveAdaptive.recommended_daily_target_seconds)}/day</strong>
              </span>
              <span className="text-[11px] text-[#BFC9D1]/70">
                {effectiveAdaptive.remaining_days > 0 
                  ? `${effectiveAdaptive.remaining_days} ${effectiveAdaptive.remaining_days === 1 ? 'day' : 'days'} left` 
                  : 'Overdue'}
              </span>
            </div>
            <p className="text-[11px] text-[#BFC9D1]/80 leading-relaxed">
              {effectiveAdaptive.explanation}
            </p>
            {effectiveAdaptive.constraint_note && (
              <div className="text-[11px] text-[#FF9B51] bg-[#FF9B51]/10 p-2 rounded border border-[#FF9B51]/20 flex items-start gap-1.5 mt-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{effectiveAdaptive.constraint_note}</span>
              </div>
            )}
          </div>
        )}

        {/* Plan Milestones */}
        {milestones && (milestones.completed_milestones.length > 0 || milestones.next_milestone) && (
          <div className="flex flex-col gap-1.5 text-xs pt-0.5">
            <div className="flex items-center justify-between text-[11px] text-[#BFC9D1]">
              <span className="flex items-center gap-1.5 text-[#EAEFEF] font-medium">
                <Target className="w-3 h-3 text-[#FF9B51]" />
                <span>Next: {milestones.next_milestone || "Plan Complete"}</span>
              </span>
              <span className="text-[#BFC9D1]/70">{Math.round(milestones.progress_percent)}%</span>
            </div>
            {milestones.completed_milestones.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {milestones.completed_milestones.map((cm) => (
                  <span
                    key={cm}
                    className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#FF9B51]/10 text-[#FF9B51] border border-[#FF9B51]/15"
                  >
                    ✓ {cm.replace(" Plan Progress", "").replace(" Plan Complete", "")}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Resume Action — Only display "Resume at MM:SS" when a genuine saved position exists */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#BFC9D1]/10 flex-wrap">
          {hasSavedPosition ? (
            <Link
              href={resumeUrl}
              className={`inline-flex items-center gap-2 rounded-lg font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/50 ${
                isMain
                  ? "px-4 py-2 bg-[#FF9B51] hover:bg-[#e88a44] text-[#25343F] text-xs sm:text-sm shadow-sm"
                  : "px-3 py-1.5 bg-[#FF9B51]/15 hover:bg-[#FF9B51]/25 text-[#FF9B51] text-xs"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume at {formatTimestamp(resume!.saved_position_seconds)}</span>
            </Link>
          ) : (
            <Link
              href={resumeUrl}
              className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/50 ${
                isMain
                  ? "px-4 py-2 bg-[#FF9B51] hover:bg-[#e88a44] text-[#25343F] text-xs sm:text-sm shadow-sm"
                  : "px-3 py-1.5 bg-[#BFC9D1]/10 hover:bg-[#BFC9D1]/20 text-[#EAEFEF] text-xs"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isPlaylist ? "Start Next Video" : "Start Video"}</span>
            </Link>
          )}

          {isPlaylist && (
            <Link
              href={defaultHref}
              className="text-[11px] text-[#BFC9D1] hover:text-[#EAEFEF] transition-colors"
            >
              View Playlist →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

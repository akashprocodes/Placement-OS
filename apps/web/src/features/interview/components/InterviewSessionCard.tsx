import React from "react";
import Link from "next/link";
import {
  MessageSquare,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { InterviewSessionResponse } from "../types";

interface InterviewSessionCardProps {
  session: InterviewSessionResponse;
}

export function InterviewSessionCard({ session }: InterviewSessionCardProps) {
  const isResumeBased = session.interview_type === "resume_based";

  const statusStyles: Record<string, string> = {
    draft: "bg-bg-muted text-text-secondary border-border-default",
    in_progress: "bg-brand-primary/10 text-brand-primary border-brand-primary/20",
    completed: "bg-status-success/10 text-status-success border-status-success/20",
    abandoned: "bg-status-error/10 text-status-error border-status-error/20",
  };

  const statusLabels: Record<string, string> = {
    draft: "Draft Setup",
    in_progress: "In Progress",
    completed: "Completed",
    abandoned: "Abandoned",
  };

  const formattedDate = new Date(session.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-5 flex flex-col justify-between gap-4 transition-all hover:border-brand-primary/40 shadow-subtle">
      {/* Top Header */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                statusStyles[session.status] || statusStyles.draft
              }`}
            >
              {statusLabels[session.status] || session.status}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-bg-muted text-text-secondary flex items-center gap-1">
              {isResumeBased ? (
                <>
                  <FileText className="w-3 h-3 text-brand-primary" />
                  <span>Resume-Based</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-brand-primary" />
                  <span>Role-Based</span>
                </>
              )}
            </span>
          </div>

          <span className="text-xs text-text-muted">{formattedDate}</span>
        </div>

        <h3 className="text-base font-bold text-text-primary line-clamp-1">
          {session.title}
        </h3>

        <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <span className="capitalize">{session.experience_level} Level</span>
          <span>•</span>
          <span className="capitalize">{session.difficulty} Difficulty</span>
          {session.duration_minutes && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-text-muted" />
                <span>{session.duration_minutes}m</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Selected Stages Tags */}
      {session.selected_stages && session.selected_stages.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {session.selected_stages.map((stg) => (
            <span
              key={stg}
              className="text-[10px] font-medium px-2 py-0.5 rounded bg-bg-muted text-text-secondary border border-border-subtle uppercase tracking-wider"
            >
              {stg.replace("_", " ")}
            </span>
          ))}
        </div>
      )}

      {/* Bottom Action */}
      <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
        <span className="text-xs text-text-muted flex items-center gap-1">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{session.turn_count} turns</span>
        </span>

        <Link
          href={`/interviews/${session.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:text-brand-hover transition-colors"
        >
          <span>Open Session</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}


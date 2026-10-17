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
    draft: "bg-[#BFC9D1]/10 text-[#BFC9D1] border-[#BFC9D1]/20",
    in_progress: "bg-[#FF9B51]/15 text-[#FF9B51] border-[#FF9B51]/30",
    completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    abandoned: "bg-red-500/10 text-red-400 border-red-500/20",
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
    <div className="bg-[#25343F] border border-[#BFC9D1]/15 rounded-xl p-5 flex flex-col justify-between gap-4 transition-all hover:border-[#BFC9D1]/30 shadow-sm">
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
            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#BFC9D1]/10 text-[#BFC9D1] flex items-center gap-1">
              {isResumeBased ? (
                <>
                  <FileText className="w-3 h-3 text-[#FF9B51]" />
                  <span>Resume-Based</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-[#FF9B51]" />
                  <span>Role-Based</span>
                </>
              )}
            </span>
          </div>

          <span className="text-xs text-[#BFC9D1]/60">{formattedDate}</span>
        </div>

        <h3 className="text-base font-bold text-[#EAEFEF] line-clamp-1">
          {session.title}
        </h3>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[#BFC9D1]">
          <span className="capitalize">{session.experience_level} Level</span>
          <span>•</span>
          <span className="capitalize">{session.difficulty} Difficulty</span>
          {session.duration_minutes && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
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
              className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#BFC9D1]/5 text-[#BFC9D1] border border-[#BFC9D1]/10 uppercase tracking-wider"
            >
              {stg.replace("_", " ")}
            </span>
          ))}
        </div>
      )}

      {/* Bottom Action */}
      <div className="pt-3 border-t border-[#BFC9D1]/10 flex items-center justify-between">
        <span className="text-xs text-[#BFC9D1]/70 flex items-center gap-1">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{session.turn_count} turns</span>
        </span>

        <Link
          href={`/interviews/${session.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF9B51] hover:text-[#FF9B51]/80 transition-colors"
        >
          <span>Open Session</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}


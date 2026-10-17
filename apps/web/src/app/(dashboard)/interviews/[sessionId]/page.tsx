import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  ArrowLeft,
  Briefcase,
  Clock,
  Sparkles,
  Layers,
  FileText,
} from "lucide-react";
import { getInterviewSession } from "@/features/interview/services/interviewService";

interface SessionPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function InterviewSessionDetailPage(props: SessionPageProps) {
  const { sessionId } = await props.params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  let session;
  try {
    session = await getInterviewSession(sessionId, cookieHeader);
  } catch {
    return notFound();
  }

  const statusStyles: Record<string, string> = {
    draft: "bg-[#BFC9D1]/10 text-[#BFC9D1] border-[#BFC9D1]/20",
    in_progress: "bg-[#FF9B51]/15 text-[#FF9B51] border-[#FF9B51]/30",
    completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    abandoned: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 gap-6">
      {/* Back navigation */}
      <Link
        href="/interviews"
        className="inline-flex items-center gap-2 text-sm text-[#BFC9D1] hover:text-[#FF9B51] transition-colors w-fit focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40 rounded"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Interviews</span>
      </Link>

      {/* Main Session Card */}
      <div className="bg-[#25343F] border border-[#BFC9D1]/15 rounded-2xl p-6 sm:p-8 flex flex-col gap-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full border uppercase tracking-wider ${
                statusStyles[session.status] || statusStyles.draft
              }`}
            >
              {session.status.replace("_", " ")}
            </span>
            <span className="text-xs text-[#BFC9D1] px-2.5 py-1 rounded bg-[#BFC9D1]/10 flex items-center gap-1.5 font-medium">
              {session.interview_type === "resume_based" ? (
                <>
                  <FileText className="w-3.5 h-3.5 text-[#FF9B51]" />
                  <span>Resume-Based</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#FF9B51]" />
                  <span>Role-Based</span>
                </>
              )}
            </span>
          </div>

          <span className="text-xs text-[#BFC9D1]/60">
            Session ID: {session.id.slice(0, 8)}...
          </span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#EAEFEF] tracking-tight">
            {session.title}
          </h1>
          <p className="text-sm text-[#BFC9D1] mt-1">
            Targeted for <span className="text-[#FF9B51] font-semibold">{session.target_role}</span> ({session.experience_level} level)
          </p>
        </div>

        {/* Configuration Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#BFC9D1]/5 border border-[#BFC9D1]/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#FF9B51]/15 text-[#FF9B51] shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-[#BFC9D1]/70 uppercase tracking-wider">Difficulty</div>
              <div className="text-sm font-bold text-[#EAEFEF] capitalize">{session.difficulty}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#FF9B51]/15 text-[#FF9B51] shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-[#BFC9D1]/70 uppercase tracking-wider">Duration</div>
              <div className="text-sm font-bold text-[#EAEFEF]">{session.duration_minutes || 30} Minutes</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#FF9B51]/15 text-[#FF9B51] shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-[#BFC9D1]/70 uppercase tracking-wider">Current Stage</div>
              <div className="text-sm font-bold text-[#EAEFEF] uppercase">{session.current_stage || "HR"}</div>
            </div>
          </div>
        </div>

        {/* Stages Progression */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold text-[#BFC9D1] uppercase tracking-wider">
            Configured Stages
          </h3>
          <div className="flex flex-wrap gap-2">
            {session.selected_stages.map((stage, idx) => (
              <span
                key={stage}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#BFC9D1]/10 text-[#EAEFEF] border border-[#BFC9D1]/15 font-medium flex items-center gap-2"
              >
                <span className="w-4 h-4 rounded-full bg-[#FF9B51] text-[#25343F] font-bold text-[10px] flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="capitalize">{stage.replace("_", " ")}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Phase 5.1 Foundation Notice */}
        <div className="p-4 rounded-xl bg-[#FF9B51]/10 border border-[#FF9B51]/20 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-[#FF9B51] shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-[#EAEFEF]">
            <span className="font-bold text-[#FF9B51]">Phase 5.1 Architecture Active: </span>
            This interview session is registered in the database with strict cross-user isolation and validated stage parameters.
            Live multi-turn conversation generation, streaming audio, and automated rubrics will be enabled in Phase 5.2.
          </div>
        </div>
      </div>
    </div>
  );
}

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
    draft: "bg-bg-muted text-text-secondary border-border-default",
    in_progress: "bg-brand-primary/10 text-brand-primary border-brand-primary/20",
    completed: "bg-status-success/10 text-status-success border-status-success/20",
    abandoned: "bg-status-error/10 text-status-error border-status-error/20",
  };

  return (
    <div className="w-full min-h-full bg-bg-app pb-32">
      <div className="mx-auto max-w-layout-max px-layout-px py-8 flex flex-col gap-6">
        {/* Back navigation */}
      <Link
        href="/interviews"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-brand-primary transition-colors w-fit focus:outline-none focus:ring-2 focus:ring-brand-primary/40 rounded"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Interviews</span>
      </Link>

      {/* Main Session Card */}
      <div className="bg-bg-surface border border-border-default rounded-2xl p-6 sm:p-8 flex flex-col gap-6 shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full border uppercase tracking-wider ${
                statusStyles[session.status] || statusStyles.draft
              }`}
            >
              {session.status.replace("_", " ")}
            </span>
            <span className="text-xs text-text-secondary px-2.5 py-1 rounded bg-bg-muted flex items-center gap-1.5 font-medium border border-border-subtle">
              {session.interview_type === "resume_based" ? (
                <>
                  <FileText className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Resume-Based</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Role-Based</span>
                </>
              )}
            </span>
          </div>

          <span className="text-xs text-text-muted">
            Session ID: {session.id.slice(0, 8)}...
          </span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            {session.title}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Targeted for <span className="text-brand-primary font-semibold">{session.target_role}</span> ({session.experience_level} level)
          </p>
        </div>

        {/* Configuration Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-bg-muted border border-border-default">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-primary/10 text-brand-primary shrink-0 border border-brand-primary/20">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-text-muted uppercase tracking-wider">Difficulty</div>
              <div className="text-sm font-bold text-text-primary capitalize">{session.difficulty}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-primary/10 text-brand-primary shrink-0 border border-brand-primary/20">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-text-muted uppercase tracking-wider">Duration</div>
              <div className="text-sm font-bold text-text-primary">{session.duration_minutes || 30} Minutes</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-primary/10 text-brand-primary shrink-0 border border-brand-primary/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-text-muted uppercase tracking-wider">Current Stage</div>
              <div className="text-sm font-bold text-text-primary uppercase">{session.current_stage || "HR"}</div>
            </div>
          </div>
        </div>

        {/* Stages Progression */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Configured Stages
          </h3>
          <div className="flex flex-wrap gap-2">
            {session.selected_stages.map((stage, idx) => (
              <span
                key={stage}
                className="text-xs px-3 py-1.5 rounded-lg bg-bg-muted text-text-primary border border-border-default font-medium flex items-center gap-2"
              >
                <span className="w-4 h-4 rounded-full bg-brand-primary text-text-inverse font-bold text-[10px] flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="capitalize">{stage.replace("_", " ")}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Phase 5.1 Foundation Notice */}
        <div className="p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-text-primary">
            <span className="font-bold text-brand-primary">Phase 5.1 Architecture Active: </span>
            This interview session is registered in the database with strict cross-user isolation and validated stage parameters.
            Live multi-turn conversation generation, streaming audio, and automated rubrics will be enabled in Phase 5.2.
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

import React from "react";
import { cookies } from "next/headers";
import {
  MessageSquare,
  Sparkles,
  History,
  ShieldCheck,
} from "lucide-react";
import { InterviewSetupForm } from "@/features/interview/components/InterviewSetupForm";
import { InterviewSessionCard } from "@/features/interview/components/InterviewSessionCard";
import { listInterviewSessions, listUserResumes } from "@/features/interview/services/interviewService";

import { InterviewSessionResponse, ResumeResponse } from "@/features/interview/types";

export const metadata = {
  title: "AI Mock Interviews | Placement OS",
  description: "Contextual behavioral and technical mock interviews adapted to your resume and target role.",
};

export default async function InterviewsPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const isAuthenticated = cookieStore.has("access_token");

  let sessions: InterviewSessionResponse[] = [];
  let resumes: ResumeResponse[] = [];

  if (isAuthenticated) {
    try {
      const [sessionsRes, resumesRes] = await Promise.all([
        listInterviewSessions(undefined, cookieHeader),
        listUserResumes(cookieHeader),
      ]);
      sessions = sessionsRes.sessions;
      resumes = resumesRes;
    } catch {
      sessions = [];
      resumes = [];
    }
  }

  return (
    <div className="w-full min-h-full bg-bg-app pb-32">
      <div className="mx-auto max-w-layout-max px-layout-px py-8 flex flex-col gap-8">
        {/* Hero Banner */}
      <section className="flex flex-col gap-3 p-6 sm:p-8 bg-bg-surface border border-border-default rounded-2xl shadow-subtle">
        <div className="flex items-center gap-2.5 text-xs font-semibold text-brand-primary uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Placement OS Core Engine 2</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
          AI Resume-Based Interview
        </h1>
        <p className="text-sm sm:text-base text-text-secondary max-w-2xl leading-relaxed">
          Simulate realistic hiring conversations adapted to your target job profile and resume.
          Conduct HR, technical, and project discussions with structured assessment.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-brand-primary" />
            <span>Strict Cross-User Isolation</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-brand-primary" />
            <span>Multi-Stage Conversation Scaffolding</span>
          </div>
        </div>
      </section>

      {/* Main Setup Experience */}
      <section className="w-full">
        <InterviewSetupForm initialResumes={resumes} />
      </section>

      {/* Existing Sessions History */}
      {sessions.length > 0 && (
        <section className="flex flex-col gap-4 pt-4 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-brand-primary" />
              <h2 className="text-lg font-bold text-text-primary">
                Your Interview Sessions ({sessions.length})
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((session) => (
              <InterviewSessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}

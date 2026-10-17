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
    <div className="flex flex-col w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 gap-8">
      {/* Hero Banner */}
      <section className="flex flex-col gap-3 p-6 sm:p-8 bg-[#25343F] border border-[#BFC9D1]/15 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5 text-xs font-semibold text-[#FF9B51] uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Placement OS Core Engine 2</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#EAEFEF] tracking-tight">
          AI Resume-Based Interview
        </h1>
        <p className="text-sm sm:text-base text-[#BFC9D1] max-w-2xl leading-relaxed">
          Simulate realistic hiring conversations adapted to your target job profile and resume.
          Conduct HR, technical, and project discussions with structured assessment.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[#BFC9D1]/80">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#FF9B51]" />
            <span>Strict Cross-User Isolation</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-[#FF9B51]" />
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
        <section className="flex flex-col gap-4 pt-4 border-t border-[#BFC9D1]/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#FF9B51]" />
              <h2 className="text-lg font-bold text-[#EAEFEF]">
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
  );
}

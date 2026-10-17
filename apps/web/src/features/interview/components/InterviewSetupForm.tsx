"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Briefcase,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  Loader2,
  Upload,
} from "lucide-react";
import {
  InterviewType,
  InterviewStage,
  ExperienceLevel,
  InterviewDifficulty,
  ResumeResponse,
} from "../types";
import { createInterviewSession, uploadResume } from "../services/interviewService";

interface InterviewSetupFormProps {
  initialResumes?: ResumeResponse[];
  onSuccess?: (sessionId: string) => void;
}

const COMMON_ROLES = [
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Developer",
  "System Design Engineer",
  "DevOps Engineer",
  "Data Engineer",
];

const STAGE_OPTIONS: { id: InterviewStage; label: string; desc: string }[] = [
  {
    id: "hr",
    label: "HR & Behavioral",
    desc: "Communication, culture alignment, teamwork, and situational questions.",
  },
  {
    id: "technical",
    label: "Technical Core",
    desc: "Language mechanics, architectural concepts, algorithms, and tradeoffs.",
  },
  {
    id: "project_discussion",
    label: "Project Deep Dive",
    desc: "System design decisions, complex bugs solved, and impact analysis.",
  },
];

export function InterviewSetupForm({ initialResumes = [] }: InterviewSetupFormProps) {
  const router = useRouter();

  // Form State
  const [interviewType, setInterviewType] = useState<InterviewType>("role_based");
  const [targetRole, setTargetRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("entry");
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("medium");
  const [selectedStages, setSelectedStages] = useState<InterviewStage[]>([
    "hr",
    "technical",
    "project_discussion",
  ]);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);

  // Resume Upload / Selection State
  const [resumes, setResumes] = useState<ResumeResponse[]>(initialResumes);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(
    initialResumes.length > 0 ? initialResumes[0].id : null
  );
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle stage selection
  const handleToggleStage = (stage: InterviewStage) => {
    setSelectedStages((prev) => {
      if (prev.includes(stage)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter((s) => s !== stage);
      } else {
        return [...prev, stage];
      }
    });
  };

  // Handle local file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingResume(true);
    setResumeError(null);

    try {
      const isText = file.type === "text/plain" || file.name.endsWith(".txt");
      let rawText: string | undefined;
      let base64: string | undefined;

      if (isText) {
        rawText = await file.text();
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64 = btoa(binary);
      }

      const uploaded = await uploadResume({
        filename: file.name,
        file_type: file.type || "application/pdf",
        raw_text: rawText,
        content_base64: base64,
      });

      setResumes((prev) => [uploaded, ...prev]);
      setSelectedResumeId(uploaded.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload resume";
      setResumeError(msg);
    } finally {
      setUploadingResume(false);
    }
  };

  // Submit session creation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetRole.trim()) {
      setError("Please specify a target role for this interview.");
      return;
    }

    if (selectedStages.length === 0) {
      setError("Please select at least one interview stage.");
      return;
    }

    if (interviewType === "resume_based" && !selectedResumeId) {
      setError("Please upload or select a resume for a resume-based interview.");
      return;
    }

    setSubmitting(true);
    try {
      const session = await createInterviewSession({
        interview_type: interviewType,
        target_role: targetRole.trim(),
        experience_level: experienceLevel,
        difficulty,
        selected_stages: selectedStages,
        duration_minutes: durationMinutes,
        resume_id: interviewType === "resume_based" ? selectedResumeId : null,
      });

      router.push(`/interviews/${session.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initialize interview";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#25343F] border border-[#BFC9D1]/15 rounded-2xl p-6 sm:p-8 flex flex-col gap-8 shadow-sm"
    >
      {/* Header Info */}
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#FF9B51]">
          <Sparkles className="w-4 h-4" />
          <span>Interview Configuration</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#EAEFEF]">
          Set Up Your AI Mock Interview
        </h2>
        <p className="text-sm text-[#BFC9D1] leading-relaxed">
          Configure interview depth, stages, and context. In Phase 5.1, this establishes your session parameters.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-sm text-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Interview Mode Switcher */}
      <div className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-[#EAEFEF]">
          Interview Mode
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setInterviewType("role_based")}
            className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
              interviewType === "role_based"
                ? "bg-[#FF9B51]/10 border-[#FF9B51] shadow-sm"
                : "bg-[#BFC9D1]/5 border-[#BFC9D1]/15 hover:bg-[#BFC9D1]/10"
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                interviewType === "role_based"
                  ? "bg-[#FF9B51] text-[#25343F]"
                  : "bg-[#BFC9D1]/15 text-[#BFC9D1]"
              }`}
            >
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#EAEFEF]">Role-Based Interview</div>
              <div className="text-xs text-[#BFC9D1] mt-0.5 leading-relaxed">
                Standard technical & behavioral interview tailored to target role fundamentals.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setInterviewType("resume_based")}
            className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
              interviewType === "resume_based"
                ? "bg-[#FF9B51]/10 border-[#FF9B51] shadow-sm"
                : "bg-[#BFC9D1]/5 border-[#BFC9D1]/15 hover:bg-[#BFC9D1]/10"
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                interviewType === "resume_based"
                  ? "bg-[#FF9B51] text-[#25343F]"
                  : "bg-[#BFC9D1]/15 text-[#BFC9D1]"
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#EAEFEF]">Resume-Based Interview</div>
              <div className="text-xs text-[#BFC9D1] mt-0.5 leading-relaxed">
                Personalized questions generated from your projects, competencies, and experience.
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Resume Ingestion (Only if resume_based) */}
      {interviewType === "resume_based" && (
        <div className="flex flex-col gap-3 p-5 rounded-xl bg-[#BFC9D1]/5 border border-[#BFC9D1]/15">
          <label className="text-sm font-semibold text-[#EAEFEF] flex items-center justify-between">
            <span>Select or Upload Resume</span>
            <span className="text-xs text-[#BFC9D1] font-normal">Max 5MB (.pdf, .docx, .txt)</span>
          </label>

          {resumeError && (
            <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{resumeError}</span>
            </div>
          )}

          {/* Existing resumes list */}
          {resumes.length > 0 && (
            <div className="flex flex-col gap-2">
              {resumes.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer text-xs transition-colors ${
                    selectedResumeId === r.id
                      ? "bg-[#FF9B51]/15 border-[#FF9B51] text-[#EAEFEF]"
                      : "bg-[#25343F] border-[#BFC9D1]/15 text-[#BFC9D1] hover:bg-[#BFC9D1]/10"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <input
                      type="radio"
                      name="resumeSelect"
                      checked={selectedResumeId === r.id}
                      onChange={() => setSelectedResumeId(r.id)}
                      className="accent-[#FF9B51]"
                    />
                    <FileText className="w-4 h-4 text-[#FF9B51] shrink-0" />
                    <span className="font-medium truncate">{r.filename}</span>
                  </div>
                  <span className="text-[11px] text-[#BFC9D1]/70 shrink-0">
                    {(r.file_size_bytes / 1024).toFixed(0)} KB
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Quick upload input */}
          <div className="mt-1">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25343F] border border-dashed border-[#BFC9D1]/30 hover:border-[#FF9B51] text-xs text-[#EAEFEF] cursor-pointer transition-colors">
              {uploadingResume ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#FF9B51]" />
              ) : (
                <Upload className="w-4 h-4 text-[#FF9B51]" />
              )}
              <span>{uploadingResume ? "Processing Resume..." : "Upload New Resume File"}</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileUpload}
                disabled={uploadingResume}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* 3. Target Role & Quick Recommendations */}
      <div className="flex flex-col gap-3">
        <label htmlFor="targetRoleInput" className="text-sm font-semibold text-[#EAEFEF]">
          Target Role *
        </label>
        <input
          id="targetRoleInput"
          type="text"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          placeholder="e.g. Senior Frontend Engineer"
          maxLength={100}
          className="w-full bg-[#25343F] border border-[#BFC9D1]/20 rounded-xl px-4 py-2.5 text-sm text-[#EAEFEF] placeholder-[#BFC9D1]/50 focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/50"
        />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-[#BFC9D1]/70">Popular:</span>
          {COMMON_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setTargetRole(role)}
              className="text-xs px-2.5 py-1 rounded-md bg-[#BFC9D1]/10 hover:bg-[#BFC9D1]/20 text-[#BFC9D1] hover:text-[#EAEFEF] transition-colors"
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Experience Level & Difficulty */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Experience Level */}
        <div className="flex flex-col gap-2.5">
          <label className="text-sm font-semibold text-[#EAEFEF]">
            Experience Level
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "entry", label: "Entry (0–2y)" },
              { id: "mid", label: "Mid (2–5y)" },
              { id: "senior", label: "Senior (5–8y)" },
              { id: "lead", label: "Lead (8+y)" },
            ].map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setExperienceLevel(lvl.id as ExperienceLevel)}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-colors ${
                  experienceLevel === lvl.id
                    ? "bg-[#FF9B51]/15 border-[#FF9B51] text-[#FF9B51] font-semibold"
                    : "bg-[#25343F] border-[#BFC9D1]/15 text-[#BFC9D1] hover:bg-[#BFC9D1]/10"
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="flex flex-col gap-2.5">
          <label className="text-sm font-semibold text-[#EAEFEF]">
            Difficulty Setting
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "easy", label: "Easy" },
              { id: "medium", label: "Medium" },
              { id: "hard", label: "Hard" },
            ].map((diff) => (
              <button
                key={diff.id}
                type="button"
                onClick={() => setDifficulty(diff.id as InterviewDifficulty)}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-colors ${
                  difficulty === diff.id
                    ? "bg-[#FF9B51]/15 border-[#FF9B51] text-[#FF9B51] font-semibold"
                    : "bg-[#25343F] border-[#BFC9D1]/15 text-[#BFC9D1] hover:bg-[#BFC9D1]/10"
                }`}
              >
                {diff.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Interview Stages Multi-Select */}
      <div className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-[#EAEFEF]">
          Interview Stages <span className="text-xs text-[#BFC9D1]/70 font-normal">(Select all that apply)</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {STAGE_OPTIONS.map((stg) => {
            const isChecked = selectedStages.includes(stg.id);
            return (
              <button
                key={stg.id}
                type="button"
                onClick={() => handleToggleStage(stg.id)}
                className={`p-4 rounded-xl border text-left transition-colors flex flex-col justify-between gap-2 ${
                  isChecked
                    ? "bg-[#FF9B51]/10 border-[#FF9B51]/80 text-[#EAEFEF]"
                    : "bg-[#25343F] border-[#BFC9D1]/15 text-[#BFC9D1] hover:bg-[#BFC9D1]/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{stg.label}</span>
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      isChecked ? "text-[#FF9B51]" : "text-[#BFC9D1]/30"
                    }`}
                  />
                </div>
                <p className="text-xs text-[#BFC9D1]/80 leading-relaxed">
                  {stg.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Estimated Duration */}
      <div className="flex flex-col gap-2.5">
        <label className="text-sm font-semibold text-[#EAEFEF] flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#FF9B51]" />
          <span>Target Duration</span>
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          {[15, 30, 45, 60].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setDurationMinutes(mins)}
              className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${
                durationMinutes === mins
                  ? "bg-[#FF9B51]/15 border-[#FF9B51] text-[#FF9B51] font-semibold"
                  : "bg-[#25343F] border-[#BFC9D1]/15 text-[#BFC9D1] hover:bg-[#BFC9D1]/10"
              }`}
            >
              {mins} minutes
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-4 border-t border-[#BFC9D1]/10 flex items-center justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF9B51] text-[#25343F] hover:bg-[#FF9B51]/90 font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/50 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Initializing Session...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Initialize Interview Session</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}


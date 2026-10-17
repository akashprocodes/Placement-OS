import React from "react";
import { MessageSquare } from "lucide-react";

export function InterviewSummary() {
  return (
    <div className="flex flex-col p-20 bg-bg-surface border border-border-default rounded-xl shadow-subtle gap-16 justify-between h-full min-h-[200px]">
      <div className="flex justify-between items-center">
        <h3 className="text-label font-semibold text-text-primary">Interview Preparation</h3>
      </div>
      <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
        <MessageSquare className="w-24 h-24 text-text-muted mb-8 opacity-50" />
        <p className="text-body-small font-medium text-text-primary mb-4">AI Interviews</p>
        <p className="text-caption text-text-muted mb-16">
          Practice realistic interviews based on your resume and target role.
        </p>
        <button disabled className="w-full py-8 px-12 bg-bg-muted text-text-muted text-caption font-semibold rounded-lg flex justify-center items-center cursor-not-allowed">
          Coming Soon
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { getLearningPlanProgress } from "../services/learningService";
import { LearningPlanProgress as LearningPlanProgressType } from "../types";
import { Loader2, Calendar, Target, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  planId: string;
  showContinueButton?: boolean;
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

export function LearningPlanProgress({ planId, showContinueButton = false }: Props) {
  const [progress, setProgress] = useState<LearningPlanProgressType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      setError(null);
      const data = await getLearningPlanProgress(planId);
      setProgress(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("401") || msg.includes("403")) {
        setError("You don't have access to this plan.");
      } else if (msg.includes("404")) {
        setError("Learning plan not found.");
      } else {
        setError("Failed to load progress. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProgress();
    
    const handleProgressUpdate = () => {
      void fetchProgress();
    };

    window.addEventListener("learning-progress-updated", handleProgressUpdate);
    return () => {
      window.removeEventListener("learning-progress-updated", handleProgressUpdate);
    };
  }, [fetchProgress]);

  if (loading) {
    return (
      <div className="bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-xl p-6 flex flex-col items-center justify-center min-h-[200px] gap-3">
        <Loader2 className="w-6 h-6 text-[#FF9B51] animate-spin" />
        <span className="text-sm text-[#BFC9D1]">Loading progress...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-xl p-6 flex flex-col items-center justify-center min-h-[200px] gap-3">
        <AlertCircle className="w-8 h-8 text-[#FF9B51]" />
        <span className="text-sm text-[#EAEFEF] font-medium">{error}</span>
      </div>
    );
  }

  if (!progress) return null;

  if (progress.status === "completed") {
    return (
      <div className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#BFC9D1]/10 flex items-center justify-between bg-[#BFC9D1]/5">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#FF9B51]" />
            <h3 className="font-semibold text-[#EAEFEF] text-sm tracking-wide uppercase">Learning Plan</h3>
          </div>
          {progress.completed_at && (
            <div className="flex items-center gap-1.5 text-xs text-[#BFC9D1]">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(progress.completed_at.split('T')[0])}</span>
            </div>
          )}
        </div>
        <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#FF9B51]/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-[#FF9B51]" />
          </div>
          <div>
            <h4 className="text-[#EAEFEF] font-bold text-lg">Plan Completed</h4>
            <p className="text-sm text-[#BFC9D1] mt-1 max-w-[200px] mx-auto">
              You have successfully completed all the required content for this plan.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isComplete = progress.remaining_seconds_today === 0 && progress.required_seconds_today > 0;
  
  const percentage = progress.required_seconds_today > 0 
    ? Math.min((progress.completed_seconds_today / progress.required_seconds_today) * 100, 100) 
    : (progress.base_target_seconds_today === 0 && progress.previous_debt_seconds === 0 ? 100 : 0);

  return (
    <div className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl flex flex-col overflow-hidden">
      <div className="p-4 border-b border-[#BFC9D1]/10 flex items-center justify-between bg-[#BFC9D1]/5">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[#FF9B51]" />
          <h3 className="font-semibold text-[#EAEFEF] text-sm tracking-wide uppercase">Learning Plan</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#BFC9D1]">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(progress.target_completion_date)}</span>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[11px] font-medium text-[#BFC9D1] uppercase tracking-wider mb-1">
                Completed Today
              </p>
              <p className="text-2xl font-bold text-[#EAEFEF]">
                {formatDuration(progress.completed_seconds_today)}
              </p>
            </div>
            
            {isComplete && (
              <div className="flex items-center gap-1.5 text-[#FF9B51] bg-[#FF9B51]/10 px-2.5 py-1 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Done for today</span>
              </div>
            )}
          </div>

          <div className="w-full h-2 bg-[#BFC9D1]/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#FF9B51] transition-all duration-500 ease-out motion-reduce:transition-none rounded-full"
              style={{ width: `${percentage}%` }}
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Daily learning progress"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#BFC9D1]">Daily Target</span>
            <span className="text-sm font-medium text-[#EAEFEF]">
              {formatDuration(progress.base_target_seconds_today)}
            </span>
          </div>
          
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#BFC9D1]">Required Today</span>
            <span className="text-sm font-medium text-[#EAEFEF]">
              {formatDuration(progress.required_seconds_today)}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#BFC9D1]">Previous Debt</span>
            <span className="text-sm font-medium text-[#EAEFEF]">
              {formatDuration(progress.previous_debt_seconds)}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#BFC9D1]">Remaining Today</span>
            <span className="text-sm font-medium text-[#FF9B51]">
              {formatDuration(progress.remaining_seconds_today)}
            </span>
          </div>
        </div>
        
        {progress.previous_debt_seconds > 0 && (
          <div className="mt-1 bg-[#FF9B51]/10 border border-[#FF9B51]/20 rounded-lg p-3 text-xs text-[#EAEFEF]">
            <span className="font-medium text-[#FF9B51]">{formatDuration(progress.previous_debt_seconds)} carry-over</span> from previous days. Today&apos;s required study time is {formatDuration(progress.required_seconds_today)}.
          </div>
        )}
        
        {showContinueButton && (
          <button 
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              // Also try to focus iframe if available
              const iframe = document.querySelector('iframe');
              if (iframe) iframe.focus();
            }}
            className="w-full mt-2 py-3 px-4 bg-[#FF9B51] hover:bg-[#e88a44] text-[#25343F] font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#FF9B51]/20"
          >
            Continue Learning
          </button>
        )}
      </div>
    </div>
  );
}

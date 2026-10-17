"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { createLearningPlan } from "../services/learningService";
import { LearningPlanResponse } from "../types";
import { X, Calendar, Clock, Target, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface LearningPlanCreateModalProps {
  contentId: string;
  contentType: "video" | "playlist";
  title: string;
  durationSeconds: number;
  thumbnailUrl: string;
  onClose: () => void;
  onSuccess?: (plan: LearningPlanResponse) => void;
}

function formatDurationHuman(seconds: number): string {
  if (!seconds || seconds <= 0) return "Unknown length";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function LearningPlanCreateModal({
  contentId,
  contentType,
  title,
  durationSeconds,
  thumbnailUrl,
  onClose,
  onSuccess,
}: LearningPlanCreateModalProps) {
  const router = useRouter();
  
  // Initialize with tomorrow as default target date (giving at least 2 days)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = new Date().toISOString().split("T")[0]; // today
  const defaultDateStr = tomorrow.toISOString().split("T")[0];

  const [targetDate, setTargetDate] = useState(defaultDateStr);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successPlan, setSuccessPlan] = useState<LearningPlanResponse | null>(null);

  // Derived state for preview
  const estimatedDailyTarget = useMemo(() => {
    if (!targetDate) return 0;
    
    // Parse target date and current date in local time (ignoring time component)
    const [tYear, tMonth, tDay] = targetDate.split("-").map(Number);
    const [cYear, cMonth, cDay] = minDateStr.split("-").map(Number);
    
    const tDate = new Date(tYear, tMonth - 1, tDay);
    const cDate = new Date(cYear, cMonth - 1, cDay);
    
    const diffTime = tDate.getTime() - cDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // At least 1 day (today)
    const availableDays = Math.max(1, diffDays + 1);
    
    return Math.ceil(durationSeconds / availableDays);
  }, [targetDate, durationSeconds, minDateStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDate) {
      setError("Please select a target completion date.");
      return;
    }
    
    if (targetDate < minDateStr) {
      setError("Target date cannot be in the past.");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const plan = await createLearningPlan({
        content_id: contentId,
        content_type: contentType,
        title,
        total_duration_seconds: durationSeconds,
        target_completion_date: targetDate,
      });
      setSuccessPlan(plan);
      if (onSuccess) onSuccess(plan);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create learning plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#25343F]/80 backdrop-blur-sm">
      <div className="bg-[#25343F] border border-[#BFC9D1]/20 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#BFC9D1]/10">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#FF9B51] uppercase">Learning Plan</p>
            <h2 className="text-lg font-medium text-[#EAEFEF]">Plan your learning</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[#BFC9D1] hover:text-[#EAEFEF] hover:bg-[#BFC9D1]/10 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto p-4 sm:p-6">
          
          {successPlan ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-16 h-16 bg-[#FF9B51]/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-[#FF9B51]" />
              </div>
              <h3 className="text-xl font-medium text-[#EAEFEF] mb-2">Learning plan active</h3>
              <p className="text-[#BFC9D1] text-sm mb-6">
                You&apos;re all set! We&apos;ve saved your target and will help you stay on track.
              </p>
              
              <div className="w-full bg-[#BFC9D1]/5 rounded-xl p-4 border border-[#BFC9D1]/10 mb-6 flex divide-x divide-[#BFC9D1]/10">
                <div className="flex-1 flex flex-col items-center px-2">
                  <span className="text-xs text-[#BFC9D1] mb-1 uppercase tracking-wider">Total</span>
                  <span className="text-[#EAEFEF] font-medium">{formatDurationHuman(successPlan.total_duration_seconds)}</span>
                </div>
                <div className="flex-1 flex flex-col items-center px-2">
                  <span className="text-xs text-[#BFC9D1] mb-1 uppercase tracking-wider">Daily Target</span>
                  <span className="text-[#FF9B51] font-medium">{formatDurationHuman(successPlan.daily_target_seconds)}/day</span>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="w-full py-3 px-4 bg-[#FF9B51] text-[#25343F] font-medium rounded-lg hover:bg-[#FF9B51]/90 transition-colors"
              >
                Start Learning Now
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              
              <p className="text-[#BFC9D1] text-sm">
                Set a target date and we&apos;ll calculate the daily learning target for you.
              </p>

              {/* Content Summary Card */}
              <div className="flex gap-4 p-3 bg-[#BFC9D1]/5 rounded-xl border border-[#BFC9D1]/10 items-center">
                <div className="relative w-24 h-16 rounded-md overflow-hidden shrink-0 bg-[#25343F]">
                  <Image 
                    src={thumbnailUrl}
                    alt="Thumbnail"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <h4 className="text-[#EAEFEF] font-medium text-sm truncate" title={title}>
                    {title}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#BFC9D1]">
                    <span className="capitalize">{contentType}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDurationHuman(durationSeconds)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Date Input */}
              <div className="space-y-2">
                <label htmlFor="targetDate" className="block text-sm font-medium text-[#EAEFEF]">
                  Target completion date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-[#BFC9D1]" />
                  </div>
                  <input
                    type="date"
                    id="targetDate"
                    name="targetDate"
                    min={minDateStr}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    required
                    disabled={loading}
                    className="block w-full pl-10 pr-3 py-2 border border-[#BFC9D1]/20 rounded-lg bg-[#25343F] text-[#EAEFEF] focus:outline-none focus:ring-1 focus:ring-[#FF9B51] focus:border-[#FF9B51] sm:text-sm disabled:opacity-50 [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Preview UI */}
              <div className="bg-[#BFC9D1]/5 rounded-xl p-4 border border-[#BFC9D1]/10 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#FF9B51]/10 flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5 text-[#FF9B51]" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[#EAEFEF]">Estimated daily target</h4>
                  <p className="text-xs text-[#BFC9D1] mt-0.5">
                    You&apos;ll need to learn <strong className="text-[#FF9B51] font-medium">{formatDurationHuman(estimatedDailyTarget)}</strong> per day to finish on time.
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-transparent border border-[#BFC9D1]/20 text-[#EAEFEF] text-sm font-medium rounded-lg hover:bg-[#BFC9D1]/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !targetDate}
                  className="flex-1 py-2.5 px-4 bg-[#FF9B51] text-[#25343F] text-sm font-medium rounded-lg hover:bg-[#FF9B51]/90 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Learning Plan"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

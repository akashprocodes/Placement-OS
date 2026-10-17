"use client";

import { useEffect, useState, useCallback } from "react";
import { YouTubeLearningPlayer } from "./YouTubeLearningPlayer";
import { getVideoProgress, upsertVideoProgress } from "../services/learningService";
import { useLearningSessionTracker } from "../hooks/useLearningSessionTracker";
import { LearningProgressResponse } from "../types";
import { CheckCircle2, PlayCircle, Clock } from "lucide-react";

interface VideoProgressTrackerProps {
  videoId: string;
  /** True when the server detected an authenticated session (cookie present). */
  isAuthenticated: boolean;
  /** Optional explicit playhead timestamp (e.g. from Resume action or ?t= URL parameter). */
  initialTime?: number;
}

type ProgressStatus = "idle" | "started" | "completed";

function getStatus(progress: LearningProgressResponse | null): ProgressStatus {
  if (!progress) return "idle";
  if (progress.completed) return "completed";
  if (progress.progress_seconds > 0) return "started";
  return "idle";
}

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoProgressTracker({ videoId, isAuthenticated, initialTime }: VideoProgressTrackerProps) {
  const [savedProgress, setSavedProgress] = useState<LearningProgressResponse | null>(null);
  const [status, setStatus] = useState<ProgressStatus>("idle");
  // hasFetched is set true only inside async callbacks, never synchronously in an effect body
  const [hasFetched, setHasFetched] = useState(false);
  const loadingProgress = isAuthenticated && !hasFetched;

  const tracker = useLearningSessionTracker({
    contentId: videoId,
    contentType: "video",
    isAuthenticated
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getVideoProgress(videoId)
      .then((p) => {
        if (cancelled) return;
        setSavedProgress(p);
        setStatus(getStatus(p));
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setHasFetched(true); });
    return () => { cancelled = true; };
  }, [videoId, isAuthenticated]);

  const handleProgress = useCallback(
    (progressSeconds: number, durationSeconds: number) => {
      tracker.handleTick(progressSeconds);
      if (!isAuthenticated) return;
      upsertVideoProgress(videoId, progressSeconds, durationSeconds)
        .then((updated) => {
          setSavedProgress(updated);
          setStatus(getStatus(updated));
        })
        .catch(() => { /* silent — don't interrupt the viewer */ });
    },
    [videoId, isAuthenticated, tracker]
  );

  // Unauthenticated: plain iframe (no YT API tracking needed)
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-6">
        <div className="w-full aspect-video bg-[#25343F] rounded-2xl overflow-hidden border border-[#BFC9D1]/15">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
        <div className="p-5 bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-xl">
          <p className="text-sm text-[#BFC9D1]">
            <span className="font-medium text-[#EAEFEF]">Sign in</span> to track your progress and resume where you left off.
          </p>
        </div>
      </div>
    );
  }

  const progressPct = Math.round(savedProgress?.progress_percent ?? 0);
  const effectiveStartSeconds =
    initialTime && initialTime > 0
      ? initialTime
      : (savedProgress?.progress_seconds ?? 0);

  return (
    <div className="flex flex-col gap-6">
      {/* YouTube Player */}
      <YouTubeLearningPlayer
        videoId={videoId}
        initialProgressSeconds={effectiveStartSeconds}
        onProgress={handleProgress}
        onPlay={tracker.handlePlay}
        onPause={tracker.handlePause}
        onEnded={tracker.handleEnded}
        onRateChange={tracker.handleRateChange}
      />

      {/* Progress Bar + Status — inline below player, not in a sidebar */}
      <div className="flex flex-col gap-3 p-5 bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FF9B51]/10 flex items-center justify-center shrink-0">
              {status === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-[#FF9B51]" />
              ) : status === "started" ? (
                <PlayCircle className="w-4 h-4 text-[#FF9B51]" />
              ) : (
                <Clock className="w-4 h-4 text-[#BFC9D1]" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#EAEFEF]">
                {status === "completed" ? "Completed" : status === "started" ? "In Progress" : "Not Started"}
              </p>
              {savedProgress && savedProgress.progress_seconds > 0 && (
                <p className="text-xs text-[#BFC9D1]">
                  {formatSeconds(savedProgress.progress_seconds)}
                  {savedProgress.duration_seconds ? ` / ${formatSeconds(savedProgress.duration_seconds)}` : ""}
                </p>
              )}
            </div>
          </div>
          <span className="text-sm font-semibold text-[#FF9B51] shrink-0">{progressPct}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#BFC9D1]/10 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[#FF9B51] h-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {loadingProgress && (
          <div className="h-4 bg-[#BFC9D1]/10 rounded animate-pulse w-1/3" />
        )}

        {status === "idle" && !loadingProgress && (
          <p className="text-xs text-[#BFC9D1]">Progress saves automatically as you watch.</p>
        )}
      </div>
    </div>
  );
}

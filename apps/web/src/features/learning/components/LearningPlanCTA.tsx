"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getLearningPlans } from "../services/learningService";
import { LearningPlanResponse, VideoPlanContextResponse } from "../types";
import { LearningPlanCreateModal } from "./LearningPlanCreateModal";
import { LearningPlanProgress } from "./LearningPlanProgress";
import { Calendar } from "lucide-react";

interface LearningPlanCTAProps {
  contentId: string;
  contentType: "video" | "playlist";
  title: string;
  durationSeconds?: number | null;
  thumbnailUrl: string;
  isAuthenticated: boolean;
  showContinueButton?: boolean;
  planContext?: VideoPlanContextResponse | null;
}

export function LearningPlanCTA({
  contentId,
  contentType,
  title,
  durationSeconds,
  thumbnailUrl,
  isAuthenticated,
  showContinueButton = false,
  planContext,
}: LearningPlanCTAProps) {
  const [plans, setPlans] = useState<LearningPlanResponse[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }
      try {
        const userPlans = await getLearningPlans();
        setPlans(userPlans);
      } catch (err) {
        console.error("Failed to load plans", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPlans();
  }, [isAuthenticated]);

  if (!isAuthenticated) return null; // Don't show CTA if unauthenticated
  if (isLoading && !planContext) return null; // Wait until we know if there is a plan

  const activeDirectPlan = plans.find((p) => p.content_id === contentId && p.status === "active");
  const completedDirectPlan = plans.find((p) => p.content_id === contentId && p.status === "completed");
  const directPlan = activeDirectPlan || completedDirectPlan || planContext?.direct_plan;
  const parentPlaylistPlan = planContext?.parent_playlist_plan;

  // Active plan hierarchy: direct plan if active, otherwise parent playlist plan if active
  const activePlan =
    activeDirectPlan ||
    (planContext?.direct_plan?.status === "active" ? planContext.direct_plan : null) ||
    (parentPlaylistPlan?.status === "active" ? parentPlaylistPlan : null);

  const isParentPlaylistActive =
    !activeDirectPlan &&
    (!planContext?.direct_plan || planContext.direct_plan.status !== "active") &&
    parentPlaylistPlan?.status === "active";

  const hasDuration = durationSeconds && durationSeconds > 0;
  const completedPlan = !activePlan
    ? (completedDirectPlan ||
       (directPlan?.status === "completed" ? directPlan : null) ||
       (parentPlaylistPlan?.status === "completed" ? parentPlaylistPlan : null))
    : null;

  if (activePlan) {
    return (
      <div className="flex flex-col gap-2">
        {isParentPlaylistActive && (
          <div className="text-xs text-[#FF9B51] font-medium flex items-center justify-between bg-[#FF9B51]/10 px-3 py-2 rounded-xl border border-[#FF9B51]/20 mb-1">
            <span className="truncate">Part of playlist plan: <strong>{planContext?.parent_playlist_title || "Course"}</strong></span>
            {planContext?.parent_playlist_id && (
              <Link href={`/learning/playlist/${planContext.parent_playlist_id}`} className="shrink-0 text-xs text-[#EAEFEF] hover:text-[#FF9B51] underline ml-2">
                View
              </Link>
            )}
          </div>
        )}
        <LearningPlanProgress planId={activePlan.id} showContinueButton={showContinueButton} />
      </div>
    );
  }

  if (completedPlan) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-[#25343F]/50 border border-[#FF9B51]/20 rounded-xl items-center text-center">
        <div className="w-10 h-10 rounded-full bg-[#FF9B51]/10 flex items-center justify-center mb-1">
          <Calendar className="w-5 h-5 text-[#FF9B51]" />
        </div>
        <h3 className="text-[#EAEFEF] font-bold">
          {completedPlan.content_type === "playlist" ? "Playlist course completed" : "Learning plan completed"}
        </h3>
        {completedPlan.completed_at && (
          <p className="text-xs text-[#BFC9D1]">
            Completed on {new Date(completedPlan.completed_at).toLocaleDateString()}
          </p>
        )}
        <button
          onClick={() => hasDuration && setIsModalOpen(true)}
          disabled={!hasDuration}
          className="mt-2 w-full py-2.5 px-4 bg-[#FF9B51]/10 border border-[#FF9B51]/40 text-[#FF9B51] hover:bg-[#FF9B51]/20 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Calendar className="w-4 h-4" />
          Start New Plan
        </button>
        {isModalOpen && hasDuration && (
          <LearningPlanCreateModal
            contentId={contentId}
            contentType={contentType}
            title={title}
            durationSeconds={durationSeconds}
            thumbnailUrl={thumbnailUrl}
            onClose={() => setIsModalOpen(false)}
            onSuccess={(plan) => setPlans((prev) => [plan, ...prev])}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => hasDuration && setIsModalOpen(true)}
        disabled={!hasDuration}
        className="w-full py-3 px-4 bg-[#25343F] border border-[#FF9B51]/50 text-[#FF9B51] font-medium rounded-xl hover:bg-[#FF9B51]/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Calendar className="w-5 h-5" />
        Start Learning Plan
      </button>
      {!hasDuration && (
        <p className="text-[11px] text-[#BFC9D1] text-center px-2">
          Duration unavailable. Cannot create a learning plan for this content yet.
        </p>
      )}

      {isModalOpen && hasDuration && (
        <LearningPlanCreateModal
          contentId={contentId}
          contentType={contentType}
          title={title}
          durationSeconds={durationSeconds}
          thumbnailUrl={thumbnailUrl}
          onClose={() => setIsModalOpen(false)}
          onSuccess={(plan) => setPlans((prev) => [plan, ...prev])}
        />
      )}
    </div>
  );
}

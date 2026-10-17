import React from "react";
import { cookies } from "next/headers";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { ContinueLearning } from "@/components/dashboard/ContinueLearning";
import { LearningSummary } from "@/components/dashboard/LearningSummary";
import { InterviewSummary } from "@/components/dashboard/InterviewSummary";
import { ProgressSummary } from "@/components/dashboard/ProgressSummary";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { getLearningWorkspace } from "@/features/learning/services/learningService";
import { getLearningAnalytics } from "@/features/learning/services/learningAnalyticsService";
import { getCurrentUser } from "@/services/auth";
import { LearningWorkspaceResponse, LearningAnalyticsResponse } from "@/features/learning/types";

export const metadata = {
  title: "Dashboard | Placement OS",
  description: "Placement OS unified student dashboard — learning plans, study streaks, and interview preparation.",
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has("access_token");
  const cookieHeader = cookieStore.toString();

  let workspace: LearningWorkspaceResponse | null = null;
  let analytics: LearningAnalyticsResponse | null = null;
  let currentUser: { email?: string } | null = null;
  let workspaceError = false;
  let analyticsError = false;

  if (isAuthenticated) {
    const [wsRes, anRes, userRes] = await Promise.allSettled([
      getLearningWorkspace(cookieHeader),
      getLearningAnalytics(undefined, undefined, cookieHeader),
      getCurrentUser(cookieHeader),
    ]);

    if (wsRes.status === "fulfilled") {
      workspace = wsRes.value;
    } else {
      console.error("Dashboard workspace fetch error:", wsRes.reason);
      workspaceError = true;
    }

    if (anRes.status === "fulfilled") {
      analytics = anRes.value;
    } else {
      console.error("Dashboard analytics fetch error:", anRes.reason);
      analyticsError = true;
    }

    if (userRes.status === "fulfilled") {
      currentUser = userRes.value;
    }
  }

  // Derive effective authenticated status: genuine authentication requires a valid current user session.
  // If the session token is expired or invalidated (backend 401 returning null user), treat gracefully as unauthenticated.
  const hasValidSession = Boolean(currentUser);
  const effectiveIsAuthenticated = hasValidSession;

  if (!hasValidSession && isAuthenticated) {
    // Suppress authenticated error banners on expired credentials
    workspaceError = false;
    analyticsError = false;
    workspace = null;
    analytics = null;
  }

  return (
    <div className="w-full min-h-full bg-bg-app pb-32">
      <div className="mx-auto max-w-layout-max px-layout-px py-8 flex flex-col gap-32">
        {/* Hero Section */}
        <DashboardHero
          isAuthenticated={effectiveIsAuthenticated}
          userEmail={currentUser?.email}
        />

        {/* Primary Action Section */}
        <ContinueLearning
          isAuthenticated={effectiveIsAuthenticated}
          activePlans={workspace?.active_plans}
        />

        {/* Summaries Row */}
        <section aria-labelledby="dashboard-summaries-heading" className="w-full">
          <h2 id="dashboard-summaries-heading" className="sr-only">
            Dashboard Summaries
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-16">
            <LearningSummary
              isAuthenticated={effectiveIsAuthenticated}
              activePlans={workspace?.active_plans}
              error={workspaceError}
            />
            <InterviewSummary />
            <ProgressSummary
              isAuthenticated={effectiveIsAuthenticated}
              streak={workspace?.streak ?? analytics?.streak}
              analyticsSummary={analytics?.summary}
              completedPlansCount={workspace?.completed_plans?.length}
              error={analyticsError && workspaceError}
            />
          </div>
        </section>

        {/* Bottom Section: Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-12 h-full">
            <RecentActivity
              isAuthenticated={effectiveIsAuthenticated}
              recentActivity={analytics?.recent_activity}
              error={analyticsError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

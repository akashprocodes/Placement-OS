import React from "react";
import { Activity, Play, Lock, AlertCircle, ArrowRight, ListVideo } from "lucide-react";
import Link from "next/link";
import { RecentActivityRecord } from "@/features/learning/types";
import { formatDuration } from "@/features/learning/utils/duration";

export interface RecentActivityProps {
  isAuthenticated?: boolean;
  recentActivity?: RecentActivityRecord[];
  error?: boolean;
}

function formatRelativeDate(dateStr: string): string {
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const diffDays = Math.round((todayUTC.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return targetDate.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function RecentActivity({
  isAuthenticated = false,
  recentActivity = [],
  error = false,
}: RecentActivityProps) {
  if (!isAuthenticated) {
    return (
      <section aria-labelledby="recent-activity-heading" className="flex flex-col gap-16 h-full w-full">
        <h2 id="recent-activity-heading" className="text-h4 font-bold text-text-primary">
          Recent Activity
        </h2>
        <div className="flex flex-col items-center justify-center p-32 sm:p-48 text-center border border-border-default border-dashed rounded-2xl bg-bg-surface/30 h-full min-h-[260px]">
          <div className="w-48 h-48 rounded-full bg-bg-muted flex items-center justify-center mb-16">
            <Lock className="w-24 h-24 text-text-muted" />
          </div>
          <h3 className="text-body-large font-semibold text-text-primary mb-8">
            Sign in to view activity
          </h3>
          <p className="text-body-small text-text-muted max-w-sm mb-20">
            Your recent study sessions and completed video milestones will appear here.
          </p>
          <Link
            href="/login?callbackUrl=/"
            className="px-20 py-10 bg-brand-primary hover:bg-brand-hover text-text-inverse text-body-small font-semibold rounded-lg transition-colors inline-block shadow-subtle"
          >
            Sign In
          </Link>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-labelledby="recent-activity-heading" className="flex flex-col gap-16 h-full w-full">
        <h2 id="recent-activity-heading" className="text-h4 font-bold text-text-primary">
          Recent Activity
        </h2>
        <div className="flex flex-col items-center justify-center p-32 sm:p-48 text-center border border-border-default border-dashed rounded-2xl bg-bg-surface/30 h-full min-h-[260px]">
          <div className="w-48 h-48 rounded-full bg-bg-muted flex items-center justify-center mb-16">
            <AlertCircle className="w-24 h-24 text-brand-primary" />
          </div>
          <h3 className="text-body-large font-semibold text-text-primary mb-8">
            Unable to load recent activity
          </h3>
          <p className="text-body-small text-text-muted max-w-sm">
            Could not retrieve recent activity history. Please try refreshing the page.
          </p>
        </div>
      </section>
    );
  }

  if (recentActivity.length === 0) {
    return (
      <section aria-labelledby="recent-activity-heading" className="flex flex-col gap-16 h-full w-full">
        <h2 id="recent-activity-heading" className="text-h4 font-bold text-text-primary">
          Recent Activity
        </h2>
        <div className="flex flex-col items-center justify-center p-32 sm:p-48 text-center border border-border-default border-dashed rounded-2xl bg-bg-surface/30 h-full min-h-[260px]">
          <div className="w-48 h-48 rounded-full bg-bg-muted flex items-center justify-center mb-16">
            <Activity className="w-24 h-24 text-text-muted" />
          </div>
          <h3 className="text-body-large font-semibold text-text-primary mb-8">
            No recent activity
          </h3>
          <p className="text-body-small text-text-muted max-w-sm mb-20">
            Start watching your planned videos to build your learning streak and track daily study time.
          </p>
          <Link
            href="/learning"
            className="px-20 py-10 bg-brand-primary hover:bg-brand-hover text-text-inverse text-body-small font-medium rounded-lg transition-colors inline-block shadow-subtle"
          >
            Browse Learning
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="recent-activity-heading" className="flex flex-col gap-16 h-full w-full">
      <div className="flex justify-between items-center">
        <h2 id="recent-activity-heading" className="text-h4 font-bold text-text-primary">
          Recent Activity
        </h2>
        <Link
          href="/learning/analytics"
          className="text-body-small text-text-secondary hover:text-brand-primary font-medium flex items-center gap-4 transition-colors"
        >
          <span>View Full History</span>
          <ArrowRight className="w-16 h-16" />
        </Link>
      </div>

      <div className="flex flex-col divide-y divide-border-subtle bg-bg-surface border border-border-default rounded-2xl shadow-subtle overflow-hidden">
        {recentActivity.slice(0, 6).map((item, index) => {
          const href =
            item.content_type === "playlist"
              ? `/learning/playlist/${item.content_id}`
              : `/learning/video/${item.content_id}`;

          return (
            <Link
              key={`${item.content_id}-${item.activity_date}-${index}`}
              href={href}
              className="p-16 sm:p-20 flex items-center justify-between gap-16 hover:bg-bg-surface-hover/50 transition-colors group"
            >
              <div className="flex items-center gap-14 min-w-0">
                <div className="w-36 h-36 rounded-lg bg-bg-muted group-hover:bg-brand-primary/10 group-hover:text-brand-primary text-text-muted flex items-center justify-center shrink-0 transition-colors">
                  {item.content_type === "playlist" ? (
                    <ListVideo className="w-16 h-16" />
                  ) : (
                    <Play className="w-16 h-16 fill-current" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-body-small font-medium text-text-primary group-hover:text-brand-primary transition-colors truncate">
                    {item.title || (item.content_type === "playlist" ? "Playlist Course" : "Video Session")}
                  </span>
                  <span className="text-caption text-text-muted flex items-center gap-6">
                    <span className="capitalize">{item.content_type}</span>
                    <span>•</span>
                    <span>{formatRelativeDate(item.activity_date)}</span>
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-body-small font-semibold text-text-primary">
                  {formatDuration(item.watched_seconds)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

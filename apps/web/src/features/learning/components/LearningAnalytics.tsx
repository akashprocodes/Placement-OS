"use client";

import React, { useEffect, useState } from "react";
import { getLearningAnalytics } from "../services/learningAnalyticsService";
import { LearningAnalyticsResponse } from "../types";
import { Loader2, Lock, Clock, CalendarDays, Target, CheckCircle2, TrendingUp, History, Flame } from "lucide-react";
import Link from "next/link";

interface Props {
  isAuthenticated: boolean;
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
  return dateObj.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

export function LearningAnalytics({ isAuthenticated }: Props) {
  const [data, setData] = useState<LearningAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState<string | null>(null);
  const [daysRange, setDaysRange] = useState<number>(30);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - (daysRange - 1));
        
        const startStr = start.toISOString().split("T")[0];
        const endStr = today.toISOString().split("T")[0];
        
        const res = await getLearningAnalytics(startStr, endStr);
        setData(res);
      } catch (_err) {
        if (_err instanceof Error && _err.message === "Unauthorized") {
          setError("Your session has expired. Please sign in again.");
        } else {
          setError("Unable to load learning analytics.");
        }
      } finally {
        setLoading(false);
      }
    }
    
    void loadData();
  }, [isAuthenticated, daysRange]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center p-12 sm:p-24 text-center border border-[#BFC9D1]/10 border-dashed rounded-2xl bg-[#25343F]/30 mt-8 max-w-4xl mx-auto w-full">
        <div className="w-20 h-20 rounded-full bg-[#BFC9D1]/5 flex items-center justify-center mb-8">
          <Lock className="w-10 h-10 text-[#BFC9D1]/50" />
        </div>
        <h3 className="text-lg font-semibold text-[#EAEFEF] mb-3">
          Sign in to view your learning history
        </h3>
        <p className="text-sm text-[#BFC9D1] max-w-sm mb-6">
          Create an account or sign in to track your watch time, completed plans, and daily activity.
        </p>
        <a 
          href="/login?callbackUrl=/learning/analytics"
          className="px-6 py-2.5 bg-[#FF9B51] hover:bg-[#e88a44] text-[#25343F] text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40"
        >
          Sign In
        </a>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-32 min-h-[400px]">
        <Loader2 className="w-12 h-12 text-[#FF9B51] animate-spin mb-4" />
        <p className="text-[#BFC9D1] text-sm">Loading your analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-16 border border-status-error/20 bg-status-error/5 rounded-xl text-center max-w-4xl mx-auto w-full mt-8">
        <p className="text-status-error text-sm">{error || "Failed to load analytics."}</p>
      </div>
    );
  }

  const { summary, daily_history, plan_performance, recent_activity } = data;

  const hasPlans = summary.active_plans_count > 0 || summary.completed_plans_count > 0;
  const hasWatchActivity = summary.total_watched_seconds > 0;

  if (!hasPlans && !hasWatchActivity) {
    return (
      <div className="flex flex-col items-center justify-center p-12 sm:p-24 text-center border border-[#BFC9D1]/10 border-dashed rounded-2xl bg-[#25343F]/30 mt-8 max-w-4xl mx-auto w-full">
        <div className="w-20 h-20 rounded-full bg-[#BFC9D1]/5 flex items-center justify-center mb-8">
          <TrendingUp className="w-10 h-10 text-[#BFC9D1]/50" />
        </div>
        <h3 className="text-lg font-semibold text-[#EAEFEF] mb-3">
          No learning activity yet
        </h3>
        <p className="text-sm text-[#BFC9D1] max-w-sm mb-8">
          Start a learning plan and your study history will appear here.
        </p>
        <Link 
          href="/learning"
          className="px-6 py-2.5 bg-[#FF9B51] hover:bg-[#e88a44] text-[#25343F] text-sm font-semibold rounded-lg transition-colors focus:outline-none"
        >
          Explore Learning
        </Link>
      </div>
    );
  }
  
  if (hasPlans && !hasWatchActivity) {
    return (
      <div className="flex flex-col items-center justify-center p-12 sm:p-24 text-center border border-[#BFC9D1]/10 border-dashed rounded-2xl bg-[#25343F]/30 mt-8 max-w-4xl mx-auto w-full">
        <div className="w-20 h-20 rounded-full bg-[#BFC9D1]/5 flex items-center justify-center mb-8">
          <TrendingUp className="w-10 h-10 text-[#BFC9D1]/50" />
        </div>
        <h3 className="text-lg font-semibold text-[#EAEFEF] mb-3">
          No watch activity yet
        </h3>
        <p className="text-sm text-[#BFC9D1] max-w-sm mb-8">
          You have active learning plans, but no watch time recorded in this date range.
        </p>
        <Link 
          href="/learning"
          className="px-6 py-2.5 bg-[#FF9B51] hover:bg-[#e88a44] text-[#25343F] text-sm font-semibold rounded-lg transition-colors focus:outline-none"
        >
          Continue Learning
        </Link>
      </div>
    );
  }

  // Calculate max for chart
  const maxWatched = Math.max(...daily_history.map(d => d.watched_seconds), 1);

  return (
    <div className="flex flex-col gap-12 w-full max-w-5xl mx-auto">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[#EAEFEF] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#FF9B51]" />
            Learning Analytics
          </h2>
          {data.streak && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#25343F] border border-[#BFC9D1]/15 text-xs text-[#BFC9D1]">
              <Flame className={`w-3.5 h-3.5 ${data.streak.current_streak > 0 ? "text-[#FF9B51]" : "text-[#BFC9D1]/40"}`} />
              <span className="font-semibold text-[#EAEFEF]">{data.streak.current_streak}</span> d streak
            </div>
          )}
        </div>
        
        <div className="flex bg-[#25343F] border border-[#BFC9D1]/20 rounded-lg overflow-hidden">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setDaysRange(days)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                daysRange === days 
                  ? "bg-[#FF9B51]/10 text-[#FF9B51]" 
                  : "text-[#BFC9D1] hover:bg-[#BFC9D1]/5 hover:text-[#EAEFEF]"
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Summary Metrics */}
      {(() => {
        const currentStreak = data.streak?.current_streak ?? summary.current_streak_days ?? 0;
        const longestStreak = data.streak?.longest_streak ?? summary.longest_streak_days ?? 0;

        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[#BFC9D1] text-xs font-medium uppercase tracking-wider">
                <Clock className="w-4 h-4 text-[#FF9B51]" />
                Total Watched <span className="text-[9px] opacity-70 ml-1">(Range)</span>
              </div>
              <div className="text-2xl font-bold text-[#EAEFEF]">
                {formatDuration(summary.total_watched_seconds)}
              </div>
            </div>
            
            <div className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[#BFC9D1] text-xs font-medium uppercase tracking-wider">
                <CalendarDays className="w-4 h-4 text-[#FF9B51]" />
                Active Days <span className="text-[9px] opacity-70 ml-1">(Range)</span>
              </div>
              <div className="text-2xl font-bold text-[#EAEFEF]">
                {summary.total_active_days}
              </div>
            </div>

            <div className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[#BFC9D1] text-xs font-medium uppercase tracking-wider">
                <Flame className="w-4 h-4 text-[#FF9B51]" />
                Study Streak
              </div>
              <div className="text-2xl font-bold text-[#EAEFEF] flex items-baseline gap-1.5">
                <span>{currentStreak}</span>
                <span className="text-xs text-[#BFC9D1] font-normal">{currentStreak === 1 ? "day" : "days"}</span>
              </div>
              <span className="text-[11px] text-[#BFC9D1]">
                Best: <strong className="text-[#EAEFEF] font-medium">{longestStreak}</strong> {longestStreak === 1 ? "day" : "days"}
              </span>
            </div>
            
            <div className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[#BFC9D1] text-xs font-medium uppercase tracking-wider">
                <Target className="w-4 h-4 text-[#FF9B51]" />
                Active Plans
              </div>
              <div className="text-2xl font-bold text-[#EAEFEF]">
                {summary.active_plans_count}
              </div>
            </div>
            
            <div className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl p-5 flex flex-col gap-2 col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-[#BFC9D1] text-xs font-medium uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-[#FF9B51]" />
                Completed Plans
              </div>
              <div className="text-2xl font-bold text-[#EAEFEF]">
                {summary.completed_plans_count}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Daily Activity Chart */}
      <section className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl p-6 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <h3 className="text-base font-semibold text-[#EAEFEF]">Daily Activity ({daysRange} days)</h3>
            <p className="text-[10px] text-[#BFC9D1] italic">Historical catch-up snapshots are not available.</p>
        </div>
        
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#FF9B51] animate-spin" />
          </div>
        ) : (
          <>
            <div className="sr-only">
              <h4>Accessible Daily Activity Data</h4>
              <ul>
                {daily_history.map((day, i) => (
                  <li key={`sr-${i}`}>
                    {formatDate(day.date)}: {formatDuration(day.watched_seconds)} watched.
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-end gap-1 sm:gap-2 h-40 w-full pt-4" aria-hidden="true">
              {daily_history.map((day, i) => {
              const heightPct = Math.max((day.watched_seconds / maxWatched) * 100, 0);
              const isActive = day.watched_seconds > 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#25343F] border border-[#BFC9D1]/20 rounded px-2 py-1 text-[10px] whitespace-nowrap z-10 shadow-lg pointer-events-none text-[#EAEFEF]">
                    {formatDate(day.date)}: {formatDuration(day.watched_seconds)}
                  </div>
                  
                  <div 
                    className={`w-full rounded-t-sm transition-all duration-300 ${isActive ? 'bg-[#FF9B51]' : 'bg-[#BFC9D1]/10 group-hover:bg-[#BFC9D1]/30'}`}
                    style={{ height: `${isActive ? Math.max(heightPct, 5) : 100}%`, minHeight: isActive ? '4px' : '4px', opacity: isActive ? 1 : 0.5 }}
                    aria-label={`${formatDate(day.date)}: ${formatDuration(day.watched_seconds)} watched`}
                    role="img"
                  />
                </div>
              );
            })}</div ></>)}
        <div className="flex justify-between text-[10px] text-[#BFC9D1] uppercase tracking-wider font-medium px-1">
          <span>{formatDate(daily_history[0]?.date || "")}</span>
          <span>{formatDate(daily_history[daily_history.length - 1]?.date || "")}</span>
        </div>
      </section>

      {/* Plan Performance & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Plan Performance */}
        <section className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-[#EAEFEF]">Plan Performance</h3>
          {plan_performance.length === 0 ? (
            <div className="text-sm text-[#BFC9D1] p-8 border border-[#BFC9D1]/10 border-dashed rounded-xl text-center">
              No learning plans created.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {plan_performance.slice(0, 5).map(plan => (
                <div key={plan.plan_id} className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="font-medium text-[#EAEFEF] line-clamp-1">{plan.title}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold whitespace-nowrap ${
                      plan.status === 'completed' ? 'bg-[#FF9B51]/10 text-[#FF9B51]' : 'bg-[#BFC9D1]/10 text-[#BFC9D1]'
                    }`}>
                      {plan.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-end text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-[#BFC9D1] text-[10px] uppercase tracking-wider">Watched</span>
                      <span className="text-[#EAEFEF] font-semibold">{formatDuration(plan.total_watched_seconds)} <span className="text-[#BFC9D1] font-normal text-xs">/ {formatDuration(plan.total_duration_seconds)}</span></span>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                      <span className="text-[#BFC9D1] text-[10px] uppercase tracking-wider">
                        {plan.status === 'completed' ? 'Completed On' : 'Target Date'}
                      </span>
                      <span className="text-[#BFC9D1] text-xs">
                        {plan.status === 'completed' && plan.completed_at 
                          ? formatDate(plan.completed_at.split('T')[0]) 
                          : formatDate(plan.target_completion_date)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-base font-semibold text-[#EAEFEF]">
            <History className="w-5 h-5 text-[#BFC9D1]" />
            Recent Activity
          </div>
          {recent_activity.length === 0 ? (
            <div className="text-sm text-[#BFC9D1] p-8 border border-[#BFC9D1]/10 border-dashed rounded-xl text-center">
              No recent learning activity.
            </div>
          ) : (
            <div className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl overflow-hidden flex flex-col">
              {recent_activity.slice(0, 5).map((act, i) => (
                <div key={i} className={`p-4 flex items-center justify-between gap-4 ${i !== 0 ? 'border-t border-[#BFC9D1]/10' : ''}`}>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-medium text-sm text-[#EAEFEF] truncate">{act.title || "External Content"}</span>
                    <span className="text-[#BFC9D1] text-xs capitalize">{act.content_type} • {formatDate(act.activity_date)}</span>
                  </div>
                  <div className="font-semibold text-sm text-[#FF9B51] whitespace-nowrap">
                    {formatDuration(act.watched_seconds)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

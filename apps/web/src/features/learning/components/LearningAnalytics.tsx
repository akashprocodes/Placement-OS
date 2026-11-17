"use client";

import React, { useEffect, useState } from "react";
import { getLearningAnalytics } from "../services/learningAnalyticsService";
import { LearningAnalyticsResponse } from "../types";
import { Loader2, Lock, Clock, CalendarDays, Target, CheckCircle2, TrendingUp, History, Flame, ArrowRight } from "lucide-react";
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
      <div className="relative overflow-hidden flex flex-col items-center justify-center p-8 sm:p-14 text-center border border-white/[0.08] rounded-2xl bg-gradient-to-b from-white/[0.04] via-white/[0.01] to-transparent backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] mt-4 max-w-2xl mx-auto w-full">
        <div className="relative w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mb-5 shadow-[0_0_20px_rgba(255,155,81,0.2)]">
          <Lock className="w-6 h-6 text-brand-primary" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-text-primary mb-2">
          Sign in to view your learning history
        </h3>
        <p className="text-xs sm:text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
          Create an account or sign in to track your total watch time, completed roadmaps, and daily study activity.
        </p>
        <Link 
          href="/login?callbackUrl=/learning/analytics"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-primary to-[#FF8438] hover:from-[#FF8438] hover:to-brand-primary text-text-inverse text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(255,155,81,0.3)] hover:shadow-[0_0_25px_rgba(255,155,81,0.5)] focus:outline-none focus:ring-2 focus:ring-brand-primary active:scale-95"
        >
          <span>Sign In to Continue</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-24 min-h-[300px]">
        <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
        </div>
        <p className="text-xs text-text-muted">Loading your analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 border border-status-error/20 bg-status-error/5 rounded-2xl text-center max-w-2xl mx-auto w-full mt-4 backdrop-blur-md">
        <p className="text-status-error text-xs sm:text-sm">{error || "Failed to load analytics."}</p>
      </div>
    );
  }

  const { summary, daily_history, plan_performance, recent_activity } = data;

  const hasPlans = summary.active_plans_count > 0 || summary.completed_plans_count > 0;
  const hasWatchActivity = summary.total_watched_seconds > 0;

  if (!hasPlans && !hasWatchActivity) {
    return (
      <div className="flex flex-col items-center justify-center p-10 sm:p-16 text-center border border-white/[0.08] border-dashed rounded-2xl bg-white/[0.01] mt-4 max-w-2xl mx-auto w-full">
        <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mb-4">
          <TrendingUp className="w-6 h-6 text-brand-primary" />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-2">
          No learning activity yet
        </h3>
        <p className="text-xs text-text-secondary max-w-sm mb-6 leading-relaxed">
          Start a learning plan and your study performance, streaks, and watch milestones will appear here.
        </p>
        <Link 
          href="/learning"
          className="px-5 py-2.5 bg-gradient-to-r from-brand-primary to-[#FF8438] hover:from-[#FF8438] hover:to-brand-primary text-text-inverse text-xs font-semibold rounded-xl transition-all shadow-sm focus:outline-none"
        >
          Explore Learning Hub
        </Link>
      </div>
    );
  }
  
  if (hasPlans && !hasWatchActivity) {
    return (
      <div className="flex flex-col items-center justify-center p-10 sm:p-16 text-center border border-white/[0.08] border-dashed rounded-2xl bg-white/[0.01] mt-4 max-w-2xl mx-auto w-full">
        <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mb-4">
          <TrendingUp className="w-6 h-6 text-brand-primary" />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-2">
          No watch activity in this window
        </h3>
        <p className="text-xs text-text-secondary max-w-sm mb-6 leading-relaxed">
          You have active learning plans, but no video sessions logged in this date range.
        </p>
        <Link 
          href="/learning"
          className="px-5 py-2.5 bg-gradient-to-r from-brand-primary to-[#FF8438] hover:from-[#FF8438] hover:to-brand-primary text-text-inverse text-xs font-semibold rounded-xl transition-all shadow-sm focus:outline-none"
        >
          Resume Learning
        </Link>
      </div>
    );
  }

  // Calculate max for chart
  const maxWatched = Math.max(...daily_history.map(d => d.watched_seconds), 1);

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-primary" />
            Learning Analytics
          </h2>
          {data.streak && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-text-secondary">
              <Flame className={`w-3.5 h-3.5 ${data.streak.current_streak > 0 ? "text-brand-primary" : "text-text-muted"}`} />
              <span className="font-semibold text-text-primary">{data.streak.current_streak}</span> d streak
            </div>
          )}
        </div>
        
        <div className="flex bg-white/[0.03] border border-white/[0.08] rounded-xl p-1">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              type="button"
              onClick={() => setDaysRange(days)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                daysRange === days 
                  ? "bg-brand-primary text-text-inverse shadow-sm" 
                  : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04]"
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
            <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col gap-1.5 backdrop-blur-xl">
              <div className="flex items-center gap-1.5 text-text-muted text-[11px] font-semibold uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-brand-primary" />
                Total Watched
              </div>
              <div className="text-xl sm:text-2xl font-bold text-text-primary">
                {formatDuration(summary.total_watched_seconds)}
              </div>
            </div>
            
            <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col gap-1.5 backdrop-blur-xl">
              <div className="flex items-center gap-1.5 text-text-muted text-[11px] font-semibold uppercase tracking-wider">
                <CalendarDays className="w-3.5 h-3.5 text-brand-primary" />
                Active Days
              </div>
              <div className="text-xl sm:text-2xl font-bold text-text-primary">
                {summary.total_active_days}
              </div>
            </div>

            <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col gap-1.5 backdrop-blur-xl">
              <div className="flex items-center gap-1.5 text-text-muted text-[11px] font-semibold uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 text-brand-primary" />
                Study Streak
              </div>
              <div className="text-xl sm:text-2xl font-bold text-text-primary flex items-baseline gap-1">
                <span>{currentStreak}</span>
                <span className="text-xs text-text-muted font-normal">{currentStreak === 1 ? "day" : "days"}</span>
              </div>
              <span className="text-[11px] text-text-muted">
                Best: <strong className="text-text-primary font-medium">{longestStreak}</strong> {longestStreak === 1 ? "day" : "days"}
              </span>
            </div>
            
            <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col gap-1.5 backdrop-blur-xl">
              <div className="flex items-center gap-1.5 text-text-muted text-[11px] font-semibold uppercase tracking-wider">
                <Target className="w-3.5 h-3.5 text-brand-primary" />
                Active Plans
              </div>
              <div className="text-xl sm:text-2xl font-bold text-text-primary">
                {summary.active_plans_count}
              </div>
            </div>
            
            <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col gap-1.5 backdrop-blur-xl col-span-2 md:col-span-1">
              <div className="flex items-center gap-1.5 text-text-muted text-[11px] font-semibold uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary" />
                Completed Plans
              </div>
              <div className="text-xl sm:text-2xl font-bold text-text-primary">
                {summary.completed_plans_count}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Daily Activity Chart */}
      <section className="bg-gradient-to-b from-white/[0.04] via-white/[0.015] to-transparent border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col gap-5 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-text-primary">Daily Watch Activity ({daysRange} days)</h3>
            <p className="text-[11px] text-text-muted italic">Historical daily distribution</p>
        </div>
        
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
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
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0A0D18] border border-white/20 rounded-lg px-2 py-1 text-[10px] whitespace-nowrap z-10 shadow-lg pointer-events-none text-white backdrop-blur-xl">
                      {formatDate(day.date)}: {formatDuration(day.watched_seconds)}
                    </div>
                    
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-300 ${isActive ? 'bg-gradient-to-t from-brand-primary/80 to-brand-primary shadow-[0_0_8px_rgba(255,155,81,0.3)]' : 'bg-white/[0.06] group-hover:bg-white/[0.15]'}`}
                      style={{ height: `${isActive ? Math.max(heightPct, 8) : 6}%`, minHeight: '4px' }}
                      aria-label={`${formatDate(day.date)}: ${formatDuration(day.watched_seconds)} watched`}
                      role="img"
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="flex justify-between text-[11px] text-text-muted uppercase tracking-wider font-semibold px-1 pt-1 border-t border-white/[0.06]">
          <span>{formatDate(daily_history[0]?.date || "")}</span>
          <span>{formatDate(daily_history[daily_history.length - 1]?.date || "")}</span>
        </div>
      </section>

      {/* Plan Performance & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Performance */}
        <section className="flex flex-col gap-3.5">
          <h3 className="text-sm sm:text-base font-bold text-text-primary">Plan Performance</h3>
          {plan_performance.length === 0 ? (
            <div className="text-xs text-text-muted p-8 border border-white/[0.08] border-dashed rounded-2xl text-center bg-white/[0.01]">
              No learning plans created yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {plan_performance.slice(0, 5).map(plan => (
                <div key={plan.plan_id} className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-2.5 backdrop-blur-xl">
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="font-semibold text-text-primary text-xs sm:text-sm line-clamp-1">{plan.title}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold whitespace-nowrap ${
                      plan.status === 'completed' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'bg-white/[0.05] text-text-secondary border border-white/[0.08]'
                    }`}>
                      {plan.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-end text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-text-muted text-[10px] uppercase tracking-wider font-semibold">Watched</span>
                      <span className="text-text-primary font-bold">{formatDuration(plan.total_watched_seconds)} <span className="text-text-muted font-normal text-xs">/ {formatDuration(plan.total_duration_seconds)}</span></span>
                    </div>
                    <div className="flex flex-col gap-0.5 text-right">
                      <span className="text-text-muted text-[10px] uppercase tracking-wider font-semibold">
                        {plan.status === 'completed' ? 'Completed On' : 'Target Date'}
                      </span>
                      <span className="text-text-secondary text-xs">
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
        <section className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-text-primary">
            <History className="w-4 h-4 text-brand-primary" />
            Recent Activity
          </div>
          {recent_activity.length === 0 ? (
            <div className="text-xs text-text-muted p-8 border border-white/[0.08] border-dashed rounded-2xl text-center bg-white/[0.01]">
              No recent learning activity recorded.
            </div>
          ) : (
            <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col backdrop-blur-xl">
              {recent_activity.slice(0, 5).map((act, i) => (
                <div key={i} className={`p-4 flex items-center justify-between gap-4 ${i !== 0 ? 'border-t border-white/[0.06]' : ''}`}>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-semibold text-xs sm:text-sm text-text-primary truncate">{act.title || "External Content"}</span>
                    <span className="text-text-muted text-xs capitalize">{act.content_type} • {formatDate(act.activity_date)}</span>
                  </div>
                  <div className="font-bold text-xs sm:text-sm text-brand-primary whitespace-nowrap">
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

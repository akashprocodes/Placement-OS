import { StudyStreakInfo } from "./workspace";

export interface AnalyticsSummary {
  total_watched_seconds: number;
  total_active_days: number;
  active_plans_count: number;
  completed_plans_count: number;
  current_streak_days?: number;
  longest_streak_days?: number;
}

export interface DailyActivityRecord {
  date: string;
  watched_seconds: number;
}

export interface WeeklyActivityRecord {
  week_start: string;
  watched_seconds: number;
  active_days: number;
}

export interface PlanPerformanceRecord {
  plan_id: string;
  title: string;
  content_id: string;
  content_type: string;
  target_completion_date: string;
  total_duration_seconds: number;
  total_watched_seconds: number;
  status: string;
  completed_at: string | null;
}

export interface RecentActivityRecord {
  activity_date: string;
  content_id: string;
  content_type: string;
  title: string | null;
  watched_seconds: number;
}

export interface LearningAnalyticsResponse {
  summary: AnalyticsSummary;
  daily_history: DailyActivityRecord[];
  weekly_history: WeeklyActivityRecord[];
  plan_performance: PlanPerformanceRecord[];
  recent_activity: RecentActivityRecord[];
  streak?: StudyStreakInfo | null;
}

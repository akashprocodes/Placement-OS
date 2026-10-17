import { LearningPlanResponse, LearningPlanProgress } from "./index";

export interface StudyStreakInfo {
  current_streak: number;
  longest_streak: number;
  today_active: boolean;
}

export interface PlanResumeContext {
  video_id: string;
  video_title?: string | null;
  saved_position_seconds: number;
  duration_seconds?: number | null;
  playlist_id?: string | null;
  has_saved_position: boolean;
}

export interface AdaptivePlanRecommendation {
  schedule_status: "ahead" | "on_track" | "behind" | "completed";
  recommended_daily_target_seconds: number;
  pace_difference_seconds: number;
  remaining_duration_seconds: number;
  remaining_days: number;
  total_completed_seconds: number;
  progress_percent: number;
  is_overdue: boolean;
  is_achievable: boolean;
  explanation: string;
  constraint_note?: string | null;
}

export interface PlanMilestoneInfo {
  completed_milestones: string[];
  next_milestone?: string | null;
  next_milestone_target_percent?: number | null;
  progress_percent: number;
}

export interface LearningMilestone {
  id: string;
  title: string;
  description: string;
  category: "session" | "video" | "plan" | "playlist" | "streak" | string;
  achieved: boolean;
  achieved_at?: string | null;
  target_value?: number | null;
  current_value?: number | null;
}

export interface UserMilestonesSummary {
  achieved_count: number;
  total_count: number;
  milestones: LearningMilestone[];
  next_milestone?: LearningMilestone | null;
}

export interface LearningPlanWithProgress {
  plan: LearningPlanResponse;
  progress: LearningPlanProgress;
  resume?: PlanResumeContext | null;
  adaptive?: AdaptivePlanRecommendation | null;
  milestones?: PlanMilestoneInfo | null;
}

export interface LearningWorkspaceResponse {
  active_plans: LearningPlanWithProgress[];
  completed_plans: LearningPlanResponse[];
  streak?: StudyStreakInfo | null;
  milestones?: UserMilestonesSummary | null;
}

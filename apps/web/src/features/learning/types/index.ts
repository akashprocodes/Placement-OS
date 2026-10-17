import type { AdaptivePlanRecommendation } from "./workspace";

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
  duration?: string | null;
  url: string;
}

export interface YouTubePlaylistItem {
  video_id: string;
  title: string;
  thumbnail_url: string;
  position: number;
  duration_seconds: number | null;
  video_url: string;
  progress_seconds?: number | null;
  progress_percent?: number | null;
  completed?: boolean | null;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  itemCount?: number | null;
  url: string;
  total_duration_seconds?: number;
  duration_available?: boolean;
  synced_at?: string;
  items?: YouTubePlaylistItem[];
  completed_count?: number | null;
  total_count?: number | null;
  next_incomplete_video_id?: string | null;
}

export interface LearningSearchResult {
  query: string;
  videos: YouTubeVideo[];
  playlists: YouTubePlaylist[];
  nextPageToken?: string | null;
}

export interface LearningProgress {
  contentId: string;
  contentType: "video" | "playlist";
  progressSeconds: number;
  durationSeconds?: number | null;
  progressPercent: number;
  completed: boolean;
  lastWatchedAt: string;
}

export interface LearningProgressResponse {
  id: string;
  content_id: string;
  content_type: string;
  progress_seconds: number;
  duration_seconds: number | null;
  progress_percent: number;
  completed: boolean;
  last_watched_at: string;
  created_at: string;
  updated_at: string;
}


export interface LearningPlanCreate {
  content_id: string;
  content_type: "video" | "playlist";
  title: string;
  total_duration_seconds: number;
  target_completion_date: string; // YYYY-MM-DD
}

export interface LearningPlanResponse {
  id: string;
  content_id: string;
  content_type: "video" | "playlist";
  title: string;
  total_duration_seconds: number;
  target_completion_date: string;
  daily_target_seconds: number;
  status: "active" | "completed" | "cancelled";
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LearningPlanProgress {
  plan_id: string;
  target_completion_date: string;
  daily_target_seconds: number;
  completed_seconds_today: number;
  base_target_seconds_today: number;
  previous_debt_seconds: number;
  required_seconds_today: number;
  remaining_seconds_today: number;
  current_debt_seconds: number;
  current_date: string;
  status: "active" | "completed" | "cancelled";
  completed_at?: string;
  adaptive?: AdaptivePlanRecommendation | null;
}

export interface LearningNote {
  id: string;
  user_id: string;
  video_id: string;
  timestamp_seconds: number;
  title: string | null;
  content: string;
  note_type: "note" | "bookmark";
  created_at: string;
  updated_at: string;
}

export interface CreateNotePayload {
  video_id: string;
  timestamp_seconds: number;
  title?: string | null;
  content?: string;
  note_type?: "note" | "bookmark";
}

export interface UpdateNotePayload {
  timestamp_seconds?: number;
  title?: string | null;
  content?: string;
  note_type?: "note" | "bookmark";
}

export interface VideoPlanContextResponse {
  video_id: string;
  active_plan?: LearningPlanResponse | null;
  direct_plan?: LearningPlanResponse | null;
  parent_playlist_plan?: LearningPlanResponse | null;
  parent_playlist_id?: string | null;
  parent_playlist_title?: string | null;
  all_parent_playlist_ids: string[];
}

export * from "./workspace";
export * from "./analytics";

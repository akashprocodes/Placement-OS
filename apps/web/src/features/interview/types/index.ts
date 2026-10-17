export type InterviewType = "resume_based" | "role_based";

export type InterviewStage = "hr" | "technical" | "project_discussion";

export type InterviewStatus = "draft" | "in_progress" | "completed" | "abandoned";

export type ExperienceLevel = "entry" | "mid" | "senior" | "lead";

export type InterviewDifficulty = "easy" | "medium" | "hard";

export interface InterviewSessionCreate {
  interview_type: InterviewType;
  target_role: string;
  experience_level: ExperienceLevel;
  difficulty: InterviewDifficulty;
  selected_stages: InterviewStage[];
  duration_minutes?: number | null;
  resume_id?: string | null;
  title?: string | null;
}

export interface InterviewSessionResponse {
  id: string;
  user_id: string;
  title: string;
  interview_type: InterviewType;
  status: InterviewStatus;
  target_role: string;
  experience_level: ExperienceLevel;
  difficulty: InterviewDifficulty;
  selected_stages: string[];
  duration_minutes?: number | null;
  current_stage?: string | null;
  resume_id?: string | null;
  turn_count: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface InterviewSessionListResponse {
  sessions: InterviewSessionResponse[];
  total: number;
}

export interface ResumeCreateRequest {
  filename: string;
  file_type?: string;
  raw_text?: string;
  content_base64?: string;
}

export interface ResumeResponse {
  id: string;
  user_id: string;
  filename: string;
  file_size_bytes: number;
  file_type: string;
  skills?: string[] | null;
  experience_summary?: string | null;
  created_at: string;
}


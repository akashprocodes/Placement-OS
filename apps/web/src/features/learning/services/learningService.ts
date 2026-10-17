import { LearningSearchResult, YouTubeVideo, YouTubePlaylist, LearningProgressResponse, LearningPlanCreate, LearningPlanResponse } from "../types";
import { getApiBaseUrl } from "@/lib/api";

export async function searchLearningContent(
  query: string,
  pageToken?: string | null
): Promise<LearningSearchResult> {
  if (!query || query.trim().length === 0) {
    return { query: "", videos: [], playlists: [], nextPageToken: null };
  }
  const backendUrl = getApiBaseUrl();
  let url = `${backendUrl}/api/v1/learning/search?q=${encodeURIComponent(query)}`;
  if (pageToken) {
    url += `&pageToken=${encodeURIComponent(pageToken)}`;
  }
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    next: { revalidate: 3600 }
  });
  if (!response.ok) {
    if (response.status === 503) {
      const errBody = await response.json().catch(() => ({}));
      if (typeof errBody?.detail === "string" && errBody.detail.toLowerCase().includes("quota")) {
        throw new Error("YouTube API quota exceeded. Please try again later.");
      }
    }
    throw new Error(`Failed to fetch learning content. Status: ${response.status}`);
  }
  return response.json();
}

export async function getYouTubeVideo(videoId: string): Promise<YouTubeVideo> {
  const backendUrl = getApiBaseUrl();
  const url = `${backendUrl}/api/v1/learning/video/${encodeURIComponent(videoId)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    next: { revalidate: 3600 }
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error("Video not found");
    throw new Error(`Failed to fetch video. Status: ${response.status}`);
  }
  return response.json();
}

export async function getYouTubePlaylist(playlistId: string, cookieHeader?: string): Promise<YouTubePlaylist> {
  const backendUrl = getApiBaseUrl();
  const url = `${backendUrl}/api/v1/learning/playlist/${encodeURIComponent(playlistId)}`;
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
    cache: cookieHeader ? "no-store" : "default",
    ...(!cookieHeader ? { next: { revalidate: 3600 } } : {}),
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error("Playlist not found");
    throw new Error(`Failed to fetch playlist. Status: ${response.status}`);
  }
  return response.json();
}

// ─── Progress API ────────────────────────────────────────────────────────────
// Uses HttpOnly session cookie — credentials: "include" sends it automatically.
// No token parameter — the browser owns the session.

export async function getVideoProgress(
  videoId: string
): Promise<LearningProgressResponse | null> {
  const url = `${getApiBaseUrl()}/api/v1/learning/progress/video/${encodeURIComponent(videoId)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    credentials: "include",
  });
  if (response.status === 401) return null;
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch progress. Status: ${response.status}`);
  return response.json();
}

export async function upsertVideoProgress(
  videoId: string,
  progressSeconds: number,
  durationSeconds: number | null
): Promise<LearningProgressResponse> {
  const url = `${getApiBaseUrl()}/api/v1/learning/progress/video/${encodeURIComponent(videoId)}`;
  const body = {
    content_id: videoId,
    content_type: "video",
    progress_seconds: progressSeconds,
    ...(durationSeconds !== null ? { duration_seconds: durationSeconds } : {}),
  };
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Failed to save progress. Status: ${response.status}`);
  return response.json();
}


// ─── Learning Plans API ──────────────────────────────────────────────────────


export async function createLearningPlan(
  plan: LearningPlanCreate
): Promise<LearningPlanResponse> {
  const url = `${getApiBaseUrl()}/api/v1/learning/plans`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(plan),
  });
  
  if (response.status === 401) {
    throw new Error("You need to be signed in to create a learning plan.");
  }
  if (!response.ok) {
    if (response.status === 422 || response.status === 400) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || "Invalid plan details.");
    }
    throw new Error("Unable to create your learning plan right now. Please try again.");
  }
  return response.json();
}

export async function getLearningWorkspace(cookieHeader?: string): Promise<import("../types").LearningWorkspaceResponse> {
  const url = `${getApiBaseUrl()}/api/v1/learning/workspace`;
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
    cache: cookieHeader ? "no-store" : "default",
  });
  if (response.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) throw new Error("Failed to fetch learning workspace");
  return response.json();
}

export async function getLearningPlans(cookieHeader?: string): Promise<LearningPlanResponse[]> {
  const url = `${getApiBaseUrl()}/api/v1/learning/plans`;
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
    cache: cookieHeader ? "no-store" : "default",
  });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error("Failed to fetch learning plans");
  return response.json();
}

export async function getVideoPlanContext(
  videoId: string,
  playlistId?: string,
  cookieHeader?: string
): Promise<import("../types").VideoPlanContextResponse> {
  let url = `${getApiBaseUrl()}/api/v1/learning/videos/${encodeURIComponent(videoId)}/plan-context`;
  if (playlistId) {
    url += `?playlist_id=${encodeURIComponent(playlistId)}`;
  }
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }
  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
    cache: cookieHeader ? "no-store" : "default",
  });
  if (!response.ok) {
    return {
      video_id: videoId,
      all_parent_playlist_ids: [],
    };
  }
  return response.json();
}


export async function sendLearningSessionHeartbeat(
  sessionId: string,
  contentId: string,
  contentType: "video" | "playlist",
  sequence: number,
  positionSeconds: number,
  playbackRate: number,
  playedContentSeconds: number,
  wallClockSeconds: number,
  status: "active" | "paused" | "ended",
  clientEventAt: string
): Promise<void> {
  const backendUrl = getApiBaseUrl();
  const url = `${backendUrl}/api/v1/learning/sessions/heartbeat`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    credentials: "include", // Inherits httpOnly session cookie
    keepalive: true,
    body: JSON.stringify({
      session_id: sessionId,
      content_id: contentId,
      content_type: contentType,
      sequence: sequence,
      position_seconds: Math.floor(positionSeconds),
      playback_rate: playbackRate,
      played_content_seconds: Math.floor(playedContentSeconds),
      wall_clock_seconds: Math.floor(wallClockSeconds),
      status: status,
      client_event_at: clientEventAt
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send session heartbeat. Status: ${response.status}`);
  }
}

export async function getLearningPlanProgress(planId: string): Promise<import("../types").LearningPlanProgress> {
  const backendUrl = getApiBaseUrl();
  const url = `${backendUrl}/api/v1/learning/plans/${encodeURIComponent(planId)}/progress`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    credentials: "include"
  });
  
  if (!response.ok) {
    if (response.status === 404) throw new Error("Plan not found");
    throw new Error(`Failed to fetch plan progress. Status: ${response.status}`);
  }
  
  return response.json();
}

// ─── Notes & Bookmarks API ──────────────────────────────────────────────────

export async function getVideoNotes(
  videoId: string,
  noteType?: "note" | "bookmark"
): Promise<import("../types").LearningNote[]> {
  const backendUrl = getApiBaseUrl();
  const params = new URLSearchParams();
  if (noteType) params.append("note_type", noteType);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const url = `${backendUrl}/api/v1/learning/videos/${encodeURIComponent(videoId)}/notes${qs}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    credentials: "include",
  });

  if (response.status === 401) return [];
  if (!response.ok) {
    throw new Error(`Failed to fetch notes. Status: ${response.status}`);
  }
  return response.json();
}

export async function createLearningNote(
  payload: import("../types").CreateNotePayload
): Promise<import("../types").LearningNote> {
  const backendUrl = getApiBaseUrl();
  const url = `${backendUrl}/api/v1/learning/notes`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    throw new Error("You must be signed in to create notes.");
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to create note (${response.status})`);
  }
  return response.json();
}

export async function updateLearningNote(
  noteId: string,
  payload: import("../types").UpdateNotePayload
): Promise<import("../types").LearningNote> {
  const backendUrl = getApiBaseUrl();
  const url = `${backendUrl}/api/v1/learning/notes/${encodeURIComponent(noteId)}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    throw new Error("You must be signed in to edit notes.");
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to update note (${response.status})`);
  }
  return response.json();
}

export async function deleteLearningNote(noteId: string): Promise<void> {
  const backendUrl = getApiBaseUrl();
  const url = `${backendUrl}/api/v1/learning/notes/${encodeURIComponent(noteId)}`;

  const response = await fetch(url, {
    method: "DELETE",
    credentials: "include",
  });

  if (response.status === 401) {
    throw new Error("You must be signed in to delete notes.");
  }
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete note (${response.status})`);
  }
}

export async function getPlanAdaptiveRecommendation(
  planId: string
): Promise<import("../types").AdaptivePlanRecommendation> {
  const backendUrl = getApiBaseUrl();
  const url = `${backendUrl}/api/v1/learning/plans/${encodeURIComponent(planId)}/adaptive`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    credentials: "include",
  });

  if (response.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch adaptive plan recommendations (${response.status})`);
  }
  return response.json();
}

export async function getLearningMilestones(): Promise<import("../types").UserMilestonesSummary> {
  const backendUrl = getApiBaseUrl();
  const url = `${backendUrl}/api/v1/learning/milestones`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    credentials: "include",
  });

  if (response.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch learning milestones (${response.status})`);
  }
  return response.json();
}


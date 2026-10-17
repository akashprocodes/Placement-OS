import {
  InterviewSessionCreate,
  InterviewSessionResponse,
  InterviewSessionListResponse,
  ResumeCreateRequest,
  ResumeResponse,
} from "../types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function createInterviewSession(
  payload: InterviewSessionCreate,
  cookieHeader?: string
): Promise<InterviewSessionResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const res = await fetch(`${BACKEND_URL}/api/v1/interviews`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: "Failed to create interview session" }));
    throw new Error(errorBody.detail || `Server error: ${res.status}`);
  }

  return res.json();
}

export async function listInterviewSessions(
  statusFilter?: string,
  cookieHeader?: string
): Promise<InterviewSessionListResponse> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const url = new URL(`${BACKEND_URL}/api/v1/interviews`);
  if (statusFilter) url.searchParams.set("status", statusFilter);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401) return { sessions: [], total: 0 };
    throw new Error(`Failed to list interviews: ${res.status}`);
  }

  return res.json();
}

export async function getInterviewSession(
  sessionId: string,
  cookieHeader?: string
): Promise<InterviewSessionResponse> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const res = await fetch(`${BACKEND_URL}/api/v1/interviews/${sessionId}`, {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error("Interview session not found");
    if (res.status === 403) throw new Error("Not authorized to view this interview");
    throw new Error(`Failed to fetch interview session: ${res.status}`);
  }

  return res.json();
}

export async function abandonInterviewSession(sessionId: string): Promise<InterviewSessionResponse> {
  const res = await fetch(`${BACKEND_URL}/api/v1/interviews/${sessionId}/abandon`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to abandon interview session");
  }

  return res.json();
}

export async function uploadResume(payload: ResumeCreateRequest): Promise<ResumeResponse> {
  const res = await fetch(`${BACKEND_URL}/api/v1/interviews/resumes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: "Failed to upload resume" }));
    throw new Error(errorBody.detail || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function listUserResumes(cookieHeader?: string): Promise<ResumeResponse[]> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const res = await fetch(`${BACKEND_URL}/api/v1/interviews/resumes`, {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`Failed to list resumes: ${res.status}`);
  }

  return res.json();
}


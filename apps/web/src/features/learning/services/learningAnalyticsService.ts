import { LearningAnalyticsResponse } from "../types";
import { getApiBaseUrl } from "@/lib/api";

export async function getLearningAnalytics(
  startDate?: string,
  endDate?: string,
  cookieHeader?: string
): Promise<LearningAnalyticsResponse> {
  let url = `${getApiBaseUrl()}/api/v1/learning/analytics/dashboard`;
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  
  if (params.toString()) {
    url += `?${params.toString()}`;
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
  
  if (response.status === 401) {
    throw new Error("Unauthorized");
  }
  
  if (!response.ok) throw new Error("Failed to fetch learning analytics");
  
  return response.json();
}

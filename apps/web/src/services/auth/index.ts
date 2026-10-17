import { getApiBaseUrl } from "@/lib/api";

export interface CurrentUserResponse {
  id: string;
  email: string;
  created_at: string;
}

export async function getCurrentUser(cookieHeader?: string): Promise<CurrentUserResponse | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }
    const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
      method: "GET",
      headers,
      cache: cookieHeader ? "no-store" : "default",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const AuthService = {
  getCurrentUser,
};

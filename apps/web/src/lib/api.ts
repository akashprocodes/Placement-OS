/**
 * Resolves the API base URL for making backend requests.
 *
 * In the browser (`typeof window !== "undefined"`):
 * - If NEXT_PUBLIC_BACKEND_URL is explicitly set to an absolute URL, that URL is used.
 * - Otherwise defaults to "" (empty string), producing same-origin relative URLs (/api/v1/...)
 *   which are proxied to the backend via Next.js `rewrites()` in `next.config.ts`.
 *   This ensures HttpOnly auth cookies (`access_token`) are forwarded cleanly without
 *   cross-origin/third-party cookie blocking across disjoint cloud domains.
 *
 * On the server (`typeof window === "undefined"` - SSR / Server Components):
 * - Uses `BACKEND_URL` (falling back to `NEXT_PUBLIC_BACKEND_URL` or `http://localhost:8000`),
 *   as Node.js fetch requires an absolute URL.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    // In production browser environments, always enforce same-origin relative URLs ("")
    // to guarantee requests route through Next.js /api/v1 rewrites and forward HttpOnly
    // session cookies, preventing accidental bypass via NEXT_PUBLIC_BACKEND_URL.
    if (process.env.NODE_ENV === "production") {
      return "";
    }
    return process.env.NEXT_PUBLIC_BACKEND_URL || "";
  }
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
}


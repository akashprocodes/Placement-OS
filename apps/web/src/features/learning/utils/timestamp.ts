/**
 * Utilities for formatting and parsing video timestamps.
 */

export function formatTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function parseTimestamp(str: string): number {
  if (!str) return 0;
  const parts = str.trim().split(":").map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p) || p < 0)) return 0;

  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}


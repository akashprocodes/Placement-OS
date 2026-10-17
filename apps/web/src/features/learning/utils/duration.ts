export function parseIsoDuration(duration: string | null | undefined): number {
  if (!duration) return 0;
  // Regex to match ISO 8601 duration format, e.g., PT1H10M30S
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  
  return h * 3600 + m * 60 + s;
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return "0m";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0 && m > 0) {
    return `${h}h ${m}m`;
  } else if (h > 0) {
    return `${h}h`;
  } else if (m > 0) {
    return `${m}m`;
  } else {
    return `${s}s`;
  }
}


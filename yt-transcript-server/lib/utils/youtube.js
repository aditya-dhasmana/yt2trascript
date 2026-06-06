export function extractVideoId(input = "") {
  const value = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] || null;
    }

    if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/").filter(Boolean)[1] || null;
      }

      return url.searchParams.get("v");
    }
  } catch {
    return null;
  }

  return null;
}

export function formatTimestamp(seconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `[${minutes}:${String(remainingSeconds).padStart(2, "0")}]`;
}

export function normalizeDuration(duration = "") {
  if (!duration) return "";

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const parts = hours > 0
    ? [hours, minutes, seconds]
    : [minutes, seconds];

  return parts.map((part, index) => (
    index === 0 ? String(part) : String(part).padStart(2, "0")
  )).join(":");
}

const YOUTUBE_WATCH_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com"]);
const SHORT_HOSTS = new Set(["youtu.be"]);

export function extractVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    if (YOUTUBE_WATCH_HOSTS.has(url.hostname)) {
      if (url.pathname === "/watch") {
        return normalizeVideoId(url.searchParams.get("v"));
      }

      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
        return normalizeVideoId(url.pathname.split("/")[2] ?? null);
      }
    }

    if (SHORT_HOSTS.has(url.hostname)) {
      return normalizeVideoId(url.pathname.split("/")[1] ?? null);
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeVideoId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return /^[a-zA-Z0-9_-]{11}$/.test(trimmed) ? trimmed : null;
}

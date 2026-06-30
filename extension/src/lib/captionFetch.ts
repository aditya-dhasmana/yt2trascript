import type { TranscriptError } from "../types.js";

const MAX_CAPTION_BYTES = 10 * 1024 * 1024;

export function isAllowedCaptionUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();

    return url.protocol === "https:"
      && (hostname === "youtube.com"
        || hostname.endsWith(".youtube.com")
        || hostname.endsWith(".googlevideo.com"));
  } catch {
    return false;
  }
}

export async function fetchCaptionTrack(
  url: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<string> {
  if (!isAllowedCaptionUrl(url)) {
    throw createCaptionFetchError("Caption URL was not a permitted YouTube URL.");
  }

  let response: Response;
  try {
    response = await fetchImplementation(url, {
      credentials: "include",
      redirect: "follow",
    });
  } catch (error) {
    throw createCaptionFetchError(
      error instanceof Error ? error.message : "Caption request failed.",
    );
  }

  if (!response.ok) {
    throw createCaptionFetchError(`YouTube returned HTTP ${response.status} for the caption track.`);
  }

  if (response.url && !isAllowedCaptionUrl(response.url)) {
    throw createCaptionFetchError("Caption request redirected outside permitted YouTube hosts.");
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_CAPTION_BYTES) {
    throw createCaptionFetchError("Caption response was unexpectedly large.");
  }

  const rawText = await response.text();
  if (rawText.length > MAX_CAPTION_BYTES) {
    throw createCaptionFetchError("Caption response was unexpectedly large.");
  }

  return rawText;
}

function createCaptionFetchError(technicalMessage: string): TranscriptError & { technicalMessage: string } {
  return {
    code: "NETWORK_ERROR",
    message: "The extension could not download this caption track from YouTube.",
    technicalMessage,
  };
}

import type { TranscriptResult } from "../types.js";

const CACHE_PREFIX = "transcript:v2:";
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

export async function getCachedTranscript(videoId: string): Promise<TranscriptResult | null> {
  const key = getCacheKey(videoId);
  const response = await chrome.storage.local.get(key);
  const cached = response[key] as TranscriptResult | undefined;

  if (!cached || Date.now() - cached.fetchedAt > MAX_CACHE_AGE_MS) {
    return null;
  }

  return cached;
}

export async function cacheTranscript(result: TranscriptResult): Promise<void> {
  await chrome.storage.local.set({
    [getCacheKey(result.video.videoId)]: result
  });
}

export async function clearCachedTranscript(videoId: string): Promise<void> {
  await chrome.storage.local.remove(getCacheKey(videoId));
}

function getCacheKey(videoId: string): string {
  return `${CACHE_PREFIX}${videoId}`;
}

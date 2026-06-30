import { extractVideoId } from "../lib/extractVideoId.js";
import { extractTranscriptFromPage } from "../lib/transcriptExtractor.js";
import type { ContentMessage, TranscriptError, TranscriptResponse } from "../types.js";

let currentVideoId = extractVideoId(location.href);
let currentUrl = location.href;

chrome.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
  if (message.type !== "GET_TRANSCRIPT") return false;

  void handleTranscriptRequest().then(sendResponse);
  return true;
});

function watchYouTubeNavigation(): void {
  const notifyIfVideoChanged = () => {
    const nextUrl = location.href;
    const nextVideoId = extractVideoId(nextUrl);

    if (nextUrl === currentUrl && nextVideoId === currentVideoId) return;

    currentUrl = nextUrl;
    currentVideoId = nextVideoId;
    void chrome.runtime.sendMessage({
      type: "VIDEO_CHANGED",
      videoId: nextVideoId,
    }).catch(() => {
      // The popup is normally closed during navigation, so no receiver is expected.
    });
  };

  window.addEventListener("yt-navigate-finish", notifyIfVideoChanged);
  window.addEventListener("yt-page-data-updated", notifyIfVideoChanged);
  window.addEventListener("popstate", notifyIfVideoChanged);
  window.addEventListener("hashchange", notifyIfVideoChanged);
  window.setInterval(notifyIfVideoChanged, 1000);
}

async function handleTranscriptRequest(): Promise<TranscriptResponse> {
  const videoId = extractVideoId(location.href);

  if (!videoId) {
    return {
      ok: false,
      error: {
        code: "UNSUPPORTED_PAGE",
        message: "Open a YouTube video page, then try again.",
      },
    };
  }

  try {
    const data = await extractTranscriptFromPage(videoId);
    return { ok: true, data };
  } catch (error) {
    if (isTranscriptError(error)) return { ok: false, error };

    return {
      ok: false,
      error: {
        code: "EXTRACTION_FAILED",
        message: "Transcript extraction failed. Refresh the YouTube page and try again.",
      },
    };
  }
}

function isTranscriptError(error: unknown): error is TranscriptError {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && "message" in error;
}

watchYouTubeNavigation();

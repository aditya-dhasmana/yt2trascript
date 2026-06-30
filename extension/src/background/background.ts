import { fetchCaptionTrack } from "../lib/captionFetch.js";
import { runAiAction } from "../lib/aiClient.js";
import type {
  AiActionMessageResult,
  BackgroundMessage,
  CaptionTrackMessageResult,
  PlayerResponse,
  PlayerResponseMessageResult,
} from "../types.js";

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.set({ installedAt: Date.now() });
});

chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  if (message.type === "READ_PLAYER_RESPONSE") {
    void readPlayerResponse(sender.tab?.id, message.expectedVideoId).then(sendResponse);
    return true;
  }

  if (message.type === "FETCH_CAPTION_TRACK") {
    void handleCaptionFetch(message.url).then(sendResponse);
    return true;
  }

  if (message.type === "RUN_AI_ACTION") {
    void handleAiAction(message).then(sendResponse);
    return true;
  }

  return false;
});

async function readPlayerResponse(
  tabId: number | undefined,
  expectedVideoId: string,
): Promise<PlayerResponseMessageResult> {
  if (!tabId) return { ok: true, playerResponse: null };

  try {
    const [execution] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      args: [expectedVideoId],
      func: (videoId) => {
        type MainWorld = Window & {
          ytInitialPlayerResponse?: PlayerResponse;
        };
        type YouTubePlayer = HTMLElement & {
          getPlayerResponse?: () => PlayerResponse;
        };

        const player = document.getElementById("movie_player") as YouTubePlayer | null;
        const response = (window as MainWorld).ytInitialPlayerResponse
          || player?.getPlayerResponse?.()
          || null;

        if (!response || response.videoDetails?.videoId !== videoId) return null;

        return {
          videoDetails: response.videoDetails,
          captions: response.captions,
          playabilityStatus: response.playabilityStatus,
        };
      },
    });

    return { ok: true, playerResponse: execution?.result || null };
  } catch {
    return { ok: true, playerResponse: null };
  }
}

async function handleCaptionFetch(url: string): Promise<CaptionTrackMessageResult> {
  try {
    const rawText = await fetchCaptionTrack(url);
    return { ok: true, rawText };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "The extension could not download this caption track from YouTube.",
      },
    };
  }
}

async function handleAiAction(
  message: Extract<BackgroundMessage, { type: "RUN_AI_ACTION" }>,
): Promise<AiActionMessageResult> {
  if (!message.videoId || !message.transcript.trim()) {
    return {
      ok: false,
      error: { code: "MISSING_AI_INPUT", message: "A transcript is required for AI actions." },
    };
  }

  const stored = await chrome.storage.local.get("backendUrl");
  const backendUrl = typeof stored.backendUrl === "string" ? stored.backendUrl : undefined;
  return runAiAction(message.action, message.videoId, message.transcript, { backendUrl });
}

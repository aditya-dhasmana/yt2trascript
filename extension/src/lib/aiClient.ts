import type { AiAction, AiActionMessageResult } from "../types.js";

export const DEFAULT_BACKEND_URL = "https://yt2trascript.onrender.com";

export async function runAiAction(
  action: AiAction,
  videoId: string,
  transcript: string,
  options: {
    backendUrl?: string;
    fetchImplementation?: typeof fetch;
  } = {},
): Promise<AiActionMessageResult> {
  const backendUrl = (options.backendUrl || DEFAULT_BACKEND_URL).replace(/\/$/, "");
  const fetchImplementation = options.fetchImplementation || fetch;

  try {
    const response = await fetchImplementation(`${backendUrl}/api/ai/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, transcript }),
    });
    const payload = await response.json() as {
      text?: string;
      code?: string;
      error?: string;
      message?: string;
    };

    if (!response.ok || !payload.text) {
      return {
        ok: false,
        error: {
          code: payload.code || "AI_REQUEST_FAILED",
          message: payload.message || payload.error || "AI helper is unavailable right now.",
        },
      };
    }

    return { ok: true, text: payload.text };
  } catch {
    return {
      ok: false,
      error: {
        code: "BACKEND_OFFLINE",
        message: "AI helper is unavailable right now. Raw transcript is safe and ready.",
      },
    };
  }
}

import { GoogleGenAI } from "@google/genai";
import { cache } from "../cache/memoryCache.js";
import { AppError } from "../utils/errors.js";
import { loadConfig } from "../config/environment.js";

function withAiTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new AppError(
        "AI cleanup and summaries timed out.",
        503,
        "AI_TIMEOUT",
      ));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function createClient(config) {
  if (!config.geminiApiKey) {
    throw new AppError(
      "AI cleanup and summaries are not configured.",
      503,
      "AI_NOT_CONFIGURED",
    );
  }

  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

function normalizeAiError(error) {
  if (error instanceof AppError) return error;

  const technicalMessage = error?.message || "Gemini request failed without an error message.";
  const lowerMessage = technicalMessage.toLowerCase();

  if (lowerMessage.includes("api key not valid")
    || lowerMessage.includes("api_key_invalid")
    || lowerMessage.includes("invalid api key")
    || error?.status === 401
    || error?.status === 403) {
    return new AppError(
      "AI cleanup and summaries are temporarily unavailable.",
      503,
      "AI_AUTH_INVALID",
      {},
      { technicalMessage },
    );
  }

  if (error?.status === 429 || lowerMessage.includes("quota") || lowerMessage.includes("rate limit")) {
    return new AppError(
      "AI cleanup and summaries are temporarily busy. Please try again later.",
      503,
      "AI_RATE_LIMITED",
      {},
      { technicalMessage },
    );
  }

  return new AppError(
    "AI cleanup and summaries are temporarily unavailable.",
    502,
    "AI_PROVIDER_FAILED",
    {},
    { technicalMessage },
  );
}

async function generateText(prompt, options = {}) {
  const config = options.config || loadConfig(options.env);
  const ai = options.client || createClient(config);

  try {
    const response = await withAiTimeout(
      ai.models.generateContent({
        model: config.geminiModel,
        contents: [{ text: prompt }],
      }),
      config.aiTimeoutMs,
    );

    const text = (response.text || "").trim();
    if (!text) {
      throw new AppError(
        "AI cleanup and summaries returned no content.",
        502,
        "AI_EMPTY_RESPONSE",
      );
    }

    return text;
  } catch (error) {
    throw normalizeAiError(error);
  }
}

export async function generateCleanTranscript({ videoId, transcript, ...options }) {
  const cached = cache.getValue(videoId, "cleanTranscript");
  if (cached) return { text: cached, cacheHit: true };

  const text = await generateText(`
Clean this YouTube transcript.

Rules:
- Remove filler words and repeated phrases.
- Improve punctuation and readability.
- Preserve the original meaning.
- Keep useful timestamps if they exist.
- Do not add ideas that are not in the transcript.

Transcript:
${transcript}
`, options);

  cache.set(videoId, "cleanTranscript", text);
  return { text, cacheHit: false };
}

export async function generateSummary({ videoId, transcript, ...options }) {
  const cached = cache.getValue(videoId, "summary");
  if (cached) return { text: cached, cacheHit: true };

  const text = await generateText(`
Summarize this YouTube transcript.

Include:
- Overview
- Key points
- Important concepts
- Actionable takeaways

Keep it clear, useful, and grounded only in the transcript.

Transcript:
${transcript}
`, options);

  cache.set(videoId, "summary", text);
  return { text, cacheHit: false };
}

export async function generateNotes({ videoId, transcript, ...options }) {
  const cached = cache.getValue(videoId, "notes");
  if (cached) return { text: cached, cacheHit: true };

  const text = await generateText(`
Turn this YouTube transcript into structured study notes.

Include:
- Clear section headings
- Important ideas and definitions
- Concise supporting details
- Action items or questions when present

Stay grounded only in the transcript. Do not invent information.

Transcript:
${transcript}
`, options);

  cache.set(videoId, "notes", text);
  return { text, cacheHit: false };
}

export async function generateTranscriptFromVideo({ videoId, videoUrl, config = loadConfig(), client }) {
  const cacheKey = "originalTranscript:gemini-video";
  const cached = cache.getValue(videoId, cacheKey);
  if (cached) return { transcript: cached, cacheHit: true };

  const ai = client || createClient(config);
  let response;

  try {
    response = await ai.models.generateContent({
      model: config.geminiVideoModel,
      generationConfig: {
        temperature: 0,
        media_resolution: "low",
        video_metadata: {
          fps: 0.1,
        },
      },
      contents: [
        {
          fileData: {
            fileUri: videoUrl,
            mimeType: "video/mp4",
          },
        },
        {
          text: `
Extract the spoken transcript from this YouTube video.

Rules:
- Return only the transcript.
- Include [MM:SS] timestamps when possible.
- Preserve the original wording as much as possible.
- Do not summarize.
- Do not add commentary.
`,
        },
      ],
    });
  } catch (error) {
    throw normalizeAiError(error);
  }

  const transcript = {
    text: (response.text || "").trim(),
    segments: [],
    language: "auto",
  };

  if (!transcript.text) {
    throw new AppError(
      "Optional AI transcription returned no content.",
      502,
      "AI_EMPTY_RESPONSE",
    );
  }

  cache.set(videoId, cacheKey, transcript);
  return { transcript, cacheHit: false };
}

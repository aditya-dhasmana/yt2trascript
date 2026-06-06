import { GoogleGenAI } from "@google/genai";
import { cache } from "../cache/memoryCache.js";
import { AppError } from "../utils/errors.js";

function createClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY_1;

  if (!apiKey) {
    throw new AppError("Gemini API key is missing on the backend.", 500, "MISSING_GEMINI_API_KEY");
  }

  return new GoogleGenAI({ apiKey });
}

async function generateText(prompt) {
  const ai = createClient();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: [{ text: prompt }],
  });

  return response.text || "";
}

export async function generateCleanTranscript({ videoId, transcript }) {
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
`);

  cache.set(videoId, "cleanTranscript", text.trim());
  return { text: text.trim(), cacheHit: false };
}

export async function generateSummary({ videoId, transcript }) {
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
`);

  cache.set(videoId, "summary", text.trim());
  return { text: text.trim(), cacheHit: false };
}

export async function generateTranscriptFromVideo({ videoId, videoUrl }) {
  const cacheKey = "originalTranscript:gemini-video";
  const cached = cache.getValue(videoId, cacheKey);
  if (cached) return { transcript: cached, cacheHit: true };

  const ai = createClient();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_VIDEO_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash",
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

  const transcript = {
    text: (response.text || "").trim(),
    segments: [],
    language: "auto",
  };

  if (!transcript.text) {
    throw new Error("Gemini video fallback returned an empty transcript.");
  }

  cache.set(videoId, cacheKey, transcript);
  return { transcript, cacheHit: false };
}

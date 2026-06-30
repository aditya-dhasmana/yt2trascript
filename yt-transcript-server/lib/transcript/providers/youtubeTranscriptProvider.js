import { fetchTranscript } from "youtube-transcript";
import { formatTimestamp } from "../../utils/youtube.js";

export const youtubeTranscriptProvider = {
  name: "youtube-transcript",

  isSupported({ videoId }) {
    return Boolean(videoId);
  },

  async getMetadata() {
    return null;
  },

  async getTranscript({ videoId, lang }) {
    const segments = await fetchTranscript(videoId, lang ? { lang } : undefined);

    if (!segments?.length) {
      throw new Error("Transcript unavailable");
    }

    const transcript = segments
      .map((segment) => `${formatTimestamp(segment.offset / 1000)} ${segment.text}`)
      .join("\n");

    return {
      text: transcript,
      segments: segments.map((segment) => ({
        text: segment.text,
        start: segment.offset / 1000,
        duration: segment.duration / 1000,
      })),
      language: segments[0]?.lang || lang || "auto",
    };
  },

  async healthCheck() {
    return { ok: true };
  },
};

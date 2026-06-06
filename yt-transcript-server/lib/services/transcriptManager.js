import { cache } from "../cache/memoryCache.js";
import { AppError, normalizeProviderError } from "../utils/errors.js";
import { extractVideoId } from "../utils/youtube.js";
import { youtubeMetadataProvider } from "../transcript/providers/youtubeMetadataProvider.js";
import { getTranscriptProviders } from "../transcript/providers/providerRegistry.js";
import { generateTranscriptFromVideo } from "./aiService.js";

export class TranscriptManager {
  constructor({ transcriptProviders = getTranscriptProviders(), metadataProvider = youtubeMetadataProvider } = {}) {
    this.transcriptProviders = transcriptProviders;
    this.metadataProvider = metadataProvider;
  }

  async getVideo({ videoUrl }) {
    const videoId = extractVideoId(videoUrl);

    if (!videoId) {
      throw new AppError("Please enter a valid YouTube URL.", 400, "INVALID_YOUTUBE_URL");
    }

    const cachedMetadata = cache.getValue(videoId, "metadata");
    const metadata = cachedMetadata || await this.fetchAndCacheMetadata(videoId);

    return { videoId, metadata };
  }

  async getTranscript({ videoUrl, lang }) {
    const { videoId, metadata } = await this.getVideo({ videoUrl });
    const cacheKey = `originalTranscript:${lang || "auto"}`;
    const cachedTranscript = cache.getValue(videoId, cacheKey);

    if (cachedTranscript) {
      return {
        videoId,
        metadata,
        transcript: cachedTranscript,
        provider: "cache",
        cacheHit: true,
        providerFailures: [],
      };
    }

    const providerFailures = [];

    for (const provider of this.transcriptProviders) {
      if (!provider.isSupported({ videoId })) continue;

      try {
        const transcript = await provider.getTranscript({ videoId, lang });
        cache.set(videoId, cacheKey, transcript);

        return {
          videoId,
          metadata,
          transcript,
          provider: provider.name,
          cacheHit: false,
          providerFailures,
        };
      } catch (error) {
        providerFailures.push(normalizeProviderError(error, provider.name));
      }
    }

    if (process.env.ENABLE_HEAVY_TRANSCRIPTION === "true") {
      try {
        const result = await generateTranscriptFromVideo({ videoId, videoUrl });
        cache.set(videoId, cacheKey, result.transcript);

        return {
          videoId,
          metadata,
          transcript: result.transcript,
          provider: "gemini-video-fallback",
          cacheHit: result.cacheHit,
          providerFailures,
        };
      } catch (error) {
        providerFailures.push(normalizeProviderError(error, "gemini-video-fallback"));
      }
    } else {
      providerFailures.push({
        provider: "heavy-transcription",
        code: "DISABLED",
        message: "Heavy transcription fallback is disabled. Set ENABLE_HEAVY_TRANSCRIPTION=true to allow Gemini video fallback.",
      });
    }

    throw new AppError(
      "Transcript unavailable. Try another video or upload a transcript file later.",
      404,
      "TRANSCRIPT_UNAVAILABLE",
      { providerFailures },
    );
  }

  async fetchAndCacheMetadata(videoId) {
    try {
      const metadata = await this.metadataProvider.getMetadata({ videoId });
      return cache.set(videoId, "metadata", metadata);
    } catch {
      return cache.set(videoId, "metadata", {
        title: "YouTube video",
        channel: "",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: "",
        tags: [],
        publishedAt: "",
        statistics: {},
        source: "fallback",
      });
    }
  }
}

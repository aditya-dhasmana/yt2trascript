import { cache } from "../cache/memoryCache.js";
import {
  AppError,
  createTranscriptError,
  normalizeProviderError,
  toPublicProviderFailure,
} from "../utils/errors.js";
import { extractVideoId } from "../utils/youtube.js";
import { youtubeMetadataProvider } from "../transcript/providers/youtubeMetadataProvider.js";
import { getTranscriptProviders } from "../transcript/providers/providerRegistry.js";
import { generateTranscriptFromVideo } from "./aiService.js";
import { loadConfig } from "../config/environment.js";

export class TranscriptManager {
  constructor({
    transcriptProviders,
    metadataProvider = youtubeMetadataProvider,
    config = loadConfig(),
    logger = console,
    geminiFallback = generateTranscriptFromVideo,
  } = {}) {
    this.config = config;
    this.transcriptProviders = transcriptProviders || getTranscriptProviders(config);
    this.metadataProvider = metadataProvider;
    this.logger = logger;
    this.geminiFallback = geminiFallback;
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
          providerFailures: providerFailures.map(toPublicProviderFailure),
        };
      } catch (error) {
        const failure = normalizeProviderError(error, provider.name);
        providerFailures.push(failure);
        this.logger.warn?.("TRANSCRIPT PROVIDER FAILURE", {
          videoId,
          provider: failure.provider,
          code: failure.code,
          errorName: failure.errorName,
          technicalMessage: failure.technicalMessage,
        });
      }
    }

    if (this.config.geminiVideoFallbackEnabled && this.config.geminiApiKey) {
      try {
        const result = await this.geminiFallback({
          videoId,
          videoUrl,
          config: this.config,
        });
        cache.set(videoId, cacheKey, result.transcript);

        return {
          videoId,
          metadata,
          transcript: result.transcript,
          provider: "gemini-video-fallback",
          cacheHit: result.cacheHit,
          providerFailures: providerFailures.map(toPublicProviderFailure),
        };
      } catch (error) {
        const failure = normalizeProviderError(error, "gemini-video-fallback");
        providerFailures.push(failure);
        this.logger.warn?.("OPTIONAL GEMINI FALLBACK FAILURE", {
          videoId,
          code: failure.code,
          errorName: failure.errorName,
          technicalMessage: failure.technicalMessage,
        });
      }
    }

    throw createTranscriptError(providerFailures);
  }

  async fetchAndCacheMetadata(videoId) {
    try {
      const metadata = await this.metadataProvider.getMetadata({ videoId });
      return cache.set(videoId, "metadata", metadata);
    } catch (error) {
      this.logger.warn?.("METADATA PROVIDER FAILURE", {
        videoId,
        provider: this.metadataProvider.name || "metadata-provider",
        errorName: error?.name || "Error",
        technicalMessage: error?.message || "Metadata provider failed without an error message.",
      });

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

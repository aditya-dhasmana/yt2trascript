import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { TranscriptManager } from "./lib/services/transcriptManager.js";
import {
  generateCleanTranscript,
  generateNotes,
  generateSummary,
} from "./lib/services/aiService.js";
import { AppError, toPublicAiError } from "./lib/utils/errors.js";
import { getProviderSlots } from "./lib/transcript/providers/providerRegistry.js";
import { loadConfig, validateEnvironment } from "./lib/config/environment.js";

function createCorsOptions(config) {
  return {
    origin(origin, callback) {
      const extensionOriginAllowed = origin?.startsWith("chrome-extension://")
        && (config.extensionOrigins.includes(origin)
          || config.extensionOrigins.includes("chrome-extension://*"));

      if (!origin || config.corsOrigins.includes(origin) || extensionOriginAllowed) {
        callback(null, true);
        return;
      }

      callback(new AppError(
        "This frontend origin is not allowed to call the transcript API.",
        403,
        "CORS_ORIGIN_DENIED",
      ));
    },
  };
}

export function createApp({
  config = loadConfig(),
  logger = console,
  transcriptManager = new TranscriptManager({ config, logger }),
  environmentReport = validateEnvironment(config, { warn() {} }),
} = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  });
  app.use(cors(createCorsOptions(config)));
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      providers: getProviderSlots(),
      configuredProviderPriority: config.transcriptProviderPriority,
      cacheProvider: config.cacheProvider,
      capabilities: {
        ...environmentReport.capabilities,
        transcriptExtraction: transcriptManager.transcriptProviders.length > 0,
      },
      configurationWarnings: environmentReport.warnings.map((warning) => warning.code),
    });
  });

  app.post("/api/metadata", async (req, res, next) => {
    try {
      const { videoUrl } = req.body || {};
      const video = await transcriptManager.getVideo({ videoUrl });
      res.json(video);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/transcript", async (req, res, next) => {
    try {
      const { videoUrl, lang } = req.body || {};
      const result = await transcriptManager.getTranscript({ videoUrl, lang });
      logger.info?.("SERVER_MODE_TRANSCRIPT_REQUEST", {
        source: "server",
        youtubeFetchByBackend: true,
        provider: result.provider,
        videoId: result.videoId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/clean", async (req, res, next) => {
    try {
      const { videoId, transcript } = req.body || {};

      if (!videoId || !transcript) {
        throw new AppError("Video ID and transcript are required.", 400, "MISSING_AI_INPUT");
      }

      const result = await generateCleanTranscript({ videoId, transcript, config });
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/summary", async (req, res, next) => {
    try {
      const { videoId, transcript } = req.body || {};

      if (!videoId || !transcript) {
        throw new AppError("Video ID and transcript are required.", 400, "MISSING_AI_INPUT");
      }

      const result = await generateSummary({ videoId, transcript, config });
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/notes", async (req, res, next) => {
    try {
      const { videoId, transcript } = req.body || {};

      if (!videoId || !transcript) {
        throw new AppError("Video ID and transcript are required.", 400, "MISSING_AI_INPUT");
      }

      const result = await generateNotes({ videoId, transcript, config });
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res) => {
    res.status(404).json({
      error: "API route not found.",
      code: "ROUTE_NOT_FOUND",
      requestId: req.requestId,
    });
  });

  app.use((error, req, res, next) => {
    const statusCode = error.statusCode || 500;
    const code = error.code || "INTERNAL_ERROR";

    logger.error?.("BACKEND ERROR", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode,
      code,
      errorName: error.name,
      message: error.message,
      technicalDetails: error.technicalDetails || {},
    });

    if (req.path.startsWith("/api/ai/")) {
      const publicError = toPublicAiError(error);

      res.status(statusCode).json({
        ok: false,
        ...publicError,
        requestId: req.requestId,
      });
      return;
    }

    res.status(statusCode).json({
      error: error.message || "The server could not complete this request.",
      code,
      details: error.details || {},
      requestId: req.requestId,
    });
  });

  return app;
}

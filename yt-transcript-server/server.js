import "dotenv/config";
import express from "express";
import cors from "cors";
import { TranscriptManager } from "./lib/services/transcriptManager.js";
import { generateCleanTranscript, generateSummary } from "./lib/services/aiService.js";
import { cache } from "./lib/cache/memoryCache.js";
import { AppError } from "./lib/utils/errors.js";
import { getProviderSlots } from "./lib/transcript/providers/providerRegistry.js";

const app = express();
const transcriptManager = new TranscriptManager();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", async (req, res) => {
  res.json({
    ok: true,
    providers: getProviderSlots(),
    heavyTranscriptionEnabled: process.env.ENABLE_HEAVY_TRANSCRIPTION === "true",
    cacheProvider: process.env.CACHE_PROVIDER || "memory",
  });
});

app.post("/metadata", async (req, res, next) => {
  try {
    const { videoUrl } = req.body;
    const video = await transcriptManager.getVideo({ videoUrl });
    res.json(video);
  } catch (error) {
    next(error);
  }
});

app.post("/transcript", async (req, res, next) => {
  try {
    const { videoUrl, lang } = req.body;
    const result = await transcriptManager.getTranscript({ videoUrl, lang });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/ai/clean", async (req, res, next) => {
  try {
    const { videoId, transcript } = req.body;

    if (!videoId || !transcript) {
      throw new AppError("Video ID and transcript are required.", 400, "MISSING_AI_INPUT");
    }

    const result = await generateCleanTranscript({ videoId, transcript });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/ai/summary", async (req, res, next) => {
  try {
    const { videoId, transcript } = req.body;

    if (!videoId || !transcript) {
      throw new AppError("Video ID and transcript are required.", 400, "MISSING_AI_INPUT");
    }

    const result = await generateSummary({ videoId, transcript });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/cache/:videoId", (req, res) => {
  res.json(cache.snapshot(req.params.videoId));
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const code = error.code || "INTERNAL_ERROR";

  console.error("BACKEND ERROR:", {
    code,
    message: error.message,
    details: error.details,
  });

  res.status(statusCode).json({
    error: error.message || "The server could not complete this request.",
    code,
    details: error.details || {},
  });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}. Transcript-first mode enabled.`);
});

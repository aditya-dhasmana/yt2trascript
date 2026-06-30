const LOCAL_FRONTEND_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function parseBoolean(value) {
  return String(value || "").toLowerCase() === "true";
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const geminiApiKey = (env.GEMINI_API_KEY || env.GEMINI_KEY_1 || "").trim();
  const corsOrigins = parseList(env.CORS_ORIGINS);
  const extensionOrigins = parseList(env.EXTENSION_ORIGINS);

  return {
    nodeEnv,
    port: Number(env.PORT) || 10000,
    cacheProvider: env.CACHE_PROVIDER || "memory",
    transcriptProviderPriority: parseList(
      env.TRANSCRIPT_PROVIDER_PRIORITY || "youtube-transcript",
    ),
    youtubeApiKey: (env.YOUTUBE_API_KEY || "").trim(),
    geminiApiKey,
    geminiKeyUsesLegacyName: !env.GEMINI_API_KEY && Boolean(env.GEMINI_KEY_1),
    geminiModel: env.GEMINI_MODEL || "gemini-2.5-flash",
    geminiVideoModel: env.GEMINI_VIDEO_MODEL || env.GEMINI_MODEL || "gemini-2.5-flash",
    aiTimeoutMs: Number(env.AI_TIMEOUT_MS) || 30000,
    geminiVideoFallbackEnabled: parseBoolean(env.ENABLE_GEMINI_TRANSCRIPTION_FALLBACK)
      || parseBoolean(env.ENABLE_HEAVY_TRANSCRIPTION),
    corsOrigins: corsOrigins.length > 0
      ? corsOrigins
      : (nodeEnv === "production" ? [] : LOCAL_FRONTEND_ORIGINS),
    extensionOrigins: extensionOrigins.length > 0
      ? extensionOrigins
      : (nodeEnv === "production" ? [] : ["chrome-extension://*"]),
  };
}

export function validateEnvironment(config, logger = console) {
  const warnings = [];

  if (!config.geminiApiKey) {
    warnings.push({
      code: "AI_NOT_CONFIGURED",
      message: "GEMINI_API_KEY is not configured. Transcript extraction remains available; AI cleanup, summaries, and Gemini video fallback are disabled.",
    });
  }

  if (config.geminiKeyUsesLegacyName) {
    warnings.push({
      code: "LEGACY_GEMINI_KEY_NAME",
      message: "GEMINI_KEY_1 is deprecated. Rename it to GEMINI_API_KEY.",
    });
  }

  if (config.geminiVideoFallbackEnabled && !config.geminiApiKey) {
    warnings.push({
      code: "GEMINI_FALLBACK_DISABLED",
      message: "Gemini video fallback was requested but cannot run without GEMINI_API_KEY.",
    });
  }

  if (config.nodeEnv === "production" && config.corsOrigins.length === 0) {
    warnings.push({
      code: "PRODUCTION_CORS_NOT_CONFIGURED",
      message: "CORS_ORIGINS is empty in production. Browser requests will be rejected until the production frontend origin is configured.",
    });
  }

  if (config.nodeEnv === "production" && config.extensionOrigins.length === 0) {
    warnings.push({
      code: "PRODUCTION_EXTENSION_CORS_NOT_CONFIGURED",
      message: "EXTENSION_ORIGINS is empty in production. Raw extension transcripts still work, but optional AI actions will be rejected until the published extension origin is configured.",
    });
  }

  for (const warning of warnings) {
    logger.warn?.("CONFIG WARNING", warning);
  }

  return {
    warnings,
    capabilities: {
      transcriptExtraction: config.transcriptProviderPriority.length > 0,
      aiConfigured: Boolean(config.geminiApiKey),
      geminiVideoFallbackConfigured: config.geminiVideoFallbackEnabled && Boolean(config.geminiApiKey),
    },
  };
}

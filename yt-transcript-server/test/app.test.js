import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../app.js";
import { TranscriptManager } from "../lib/services/transcriptManager.js";
import { loadConfig, validateEnvironment } from "../lib/config/environment.js";
import { AppError, toPublicAiError } from "../lib/utils/errors.js";

const silentLogger = {
  warn() {},
  error() {},
};

async function withServer(app, callback) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function createTestApp(provider, logger = silentLogger) {
  const config = loadConfig({});
  const transcriptManager = new TranscriptManager({
    transcriptProviders: [provider],
    metadataProvider: {
      async getMetadata() {
        return { title: "Test video", channel: "Test", thumbnail: "", source: "test" };
      },
    },
    config,
    logger,
  });

  return createApp({
    config,
    transcriptManager,
    logger,
    environmentReport: validateEnvironment(config, logger),
  });
}

test("POST /api/transcript rejects an invalid YouTube URL", async () => {
  const app = createTestApp({
    name: "unused-provider",
    isSupported: () => true,
    async getTranscript() {
      throw new Error("This provider should not be reached.");
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: "not-a-youtube-url" }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.code, "INVALID_YOUTUBE_URL");
    assert.ok(body.requestId);
  });
});

test("POST /api/transcript exposes a precise provider failure response", async () => {
  const app = createTestApp({
    name: "blocked-provider",
    isSupported: () => true,
    async getTranscript() {
      const error = new Error("YouTube is receiving too many requests and requires a captcha");
      error.name = "YoutubeTranscriptTooManyRequestError";
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: "https://youtu.be/blocked0001" }),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.code, "TRANSCRIPT_PROVIDER_BLOCKED");
    assert.equal(body.details.providerFailures[0].code, "PROVIDER_BLOCKED");
    assert.equal(body.details.providerFailures[0].retryable, true);
  });
});

test("POST /api/transcript logs Server Mode ownership without transcript text", async () => {
  const infoLogs = [];
  const logger = {
    warn() {},
    error() {},
    info(event, details) {
      infoLogs.push({ event, details });
    },
  };
  const app = createTestApp({
    name: "logging-provider",
    isSupported: () => true,
    async getTranscript() {
      return {
        text: "Sensitive transcript text must not be logged.",
        segments: [{ start: 0, duration: 1, text: "Sensitive transcript text must not be logged." }],
        language: "en",
      };
    },
  }, logger);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: "https://youtu.be/serverlog01" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(infoLogs, [{
      event: "SERVER_MODE_TRANSCRIPT_REQUEST",
      details: {
        source: "server",
        youtubeFetchByBackend: true,
        provider: "logging-provider",
        videoId: "serverlog01",
      },
    }]);
    assert.doesNotMatch(JSON.stringify(infoLogs), /Sensitive transcript/);
  });
});

test("POST /api/ai/notes accepts transcript text without a YouTube request", async () => {
  const app = createTestApp({
    name: "unused-provider",
    isSupported: () => true,
    async getTranscript() {
      throw new Error("The URL transcript provider must not run for transcript-text AI routes.");
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: "notes-test1",
        transcript: "Transcript text supplied directly by the extension.",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.code, "AI_UNDER_DEVELOPMENT");
    assert.equal(body.message, "This AI feature is currently under development.");
    assert.equal(body.retryable, false);
  });
});

test("all technical AI failures map to consistent safe public shapes", () => {
  assert.deepEqual(
    toPublicAiError(new AppError("Gemini key missing", 503, "AI_NOT_CONFIGURED")),
    {
      code: "AI_UNDER_DEVELOPMENT",
      message: "This AI feature is currently under development.",
      retryable: false,
    },
  );

  for (const internalCode of [
    "AI_AUTH_INVALID",
    "AI_RATE_LIMITED",
    "AI_PROVIDER_FAILED",
    "AI_TIMEOUT",
    "AI_EMPTY_RESPONSE",
    "INTERNAL_ERROR",
  ]) {
    const result = toPublicAiError(
      new AppError("Technical provider details that users must not see", 503, internalCode),
    );

    if (internalCode === "AI_AUTH_INVALID") {
      assert.equal(result.code, "AI_UNDER_DEVELOPMENT");
      assert.equal(result.retryable, false);
    } else {
      assert.deepEqual(result, {
        code: "AI_UNAVAILABLE",
        message: "AI feature is temporarily unavailable.",
        retryable: true,
      });
    }
    assert.doesNotMatch(result.message, /Gemini|key|provider details/i);
  }
});

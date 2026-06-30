import test from "node:test";
import assert from "node:assert/strict";
import { TranscriptManager } from "../lib/services/transcriptManager.js";
import { loadConfig } from "../lib/config/environment.js";
import { AppError } from "../lib/utils/errors.js";

const silentLogger = {
  warn() {},
  error() {},
};

function createMetadataProvider() {
  return {
    async getMetadata({ videoId }) {
      return {
        title: `Video ${videoId}`,
        channel: "Test channel",
        thumbnail: "",
        source: "test",
      };
    },
  };
}

test("TranscriptManager returns a normalized transcript from a successful provider", async () => {
  const provider = {
    name: "mock-success",
    isSupported: () => true,
    async getTranscript() {
      return {
        text: "[0:00] A reliable test transcript.",
        segments: [{ text: "A reliable test transcript.", start: 0, duration: 2 }],
        language: "en",
      };
    },
  };
  const manager = new TranscriptManager({
    transcriptProviders: [provider],
    metadataProvider: createMetadataProvider(),
    config: loadConfig({}),
    logger: silentLogger,
  });

  const result = await manager.getTranscript({
    videoUrl: "https://www.youtube.com/watch?v=success0001",
  });

  assert.equal(result.provider, "mock-success");
  assert.equal(result.transcript.language, "en");
  assert.match(result.transcript.text, /reliable test transcript/);
  assert.equal(result.cacheHit, false);
});

test("TranscriptManager distinguishes missing captions from provider outages", async () => {
  const provider = {
    name: "mock-no-captions",
    isSupported: () => true,
    async getTranscript() {
      const error = new Error("Transcript is not available");
      error.name = "YoutubeTranscriptDisabledError";
      throw error;
    },
  };
  const manager = new TranscriptManager({
    transcriptProviders: [provider],
    metadataProvider: createMetadataProvider(),
    config: loadConfig({}),
    logger: silentLogger,
  });

  await assert.rejects(
    manager.getTranscript({ videoUrl: "https://youtu.be/nocaption01" }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "CAPTIONS_UNAVAILABLE");
      assert.equal(error.details.providerFailures[0].code, "CAPTIONS_UNAVAILABLE");
      return true;
    },
  );
});

test("TranscriptManager reports provider blocking as retryable", async () => {
  const provider = {
    name: "mock-blocked",
    isSupported: () => true,
    async getTranscript() {
      const error = new Error("YouTube is receiving too many requests and requires a captcha");
      error.name = "YoutubeTranscriptTooManyRequestError";
      throw error;
    },
  };
  const manager = new TranscriptManager({
    transcriptProviders: [provider],
    metadataProvider: createMetadataProvider(),
    config: loadConfig({}),
    logger: silentLogger,
  });

  await assert.rejects(
    manager.getTranscript({ videoUrl: "https://youtu.be/provider001" }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "TRANSCRIPT_PROVIDER_BLOCKED");
      assert.equal(error.details.providerFailures[0].retryable, true);
      return true;
    },
  );
});

test("an invalid optional Gemini fallback does not replace the core caption error", async () => {
  const provider = {
    name: "mock-no-captions-before-ai",
    isSupported: () => true,
    async getTranscript() {
      const error = new Error("Transcript is not available");
      error.name = "YoutubeTranscriptNotAvailableError";
      throw error;
    },
  };
  const config = loadConfig({
    GEMINI_API_KEY: "invalid-test-key",
    ENABLE_GEMINI_TRANSCRIPTION_FALLBACK: "true",
  });
  const manager = new TranscriptManager({
    transcriptProviders: [provider],
    metadataProvider: createMetadataProvider(),
    config,
    logger: silentLogger,
    async geminiFallback() {
      throw new AppError(
        "AI cleanup and summaries are temporarily unavailable.",
        503,
        "AI_AUTH_INVALID",
      );
    },
  });

  await assert.rejects(
    manager.getTranscript({ videoUrl: "https://youtu.be/aifallback1" }),
    (error) => {
      assert.equal(error.code, "CAPTIONS_UNAVAILABLE");
      assert.deepEqual(
        error.details.providerFailures.map((failure) => failure.code),
        ["CAPTIONS_UNAVAILABLE", "AI_AUTH_INVALID"],
      );
      return true;
    },
  );
});

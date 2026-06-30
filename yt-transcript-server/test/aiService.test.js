import test from "node:test";
import assert from "node:assert/strict";
import { generateSummary } from "../lib/services/aiService.js";
import { loadConfig } from "../lib/config/environment.js";

test("AI summary fails gracefully when GEMINI_API_KEY is missing", async () => {
  await assert.rejects(
    generateSummary({
      videoId: "ai-missing-key",
      transcript: "A transcript used only by the unit test.",
      config: loadConfig({}),
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "AI_NOT_CONFIGURED");
      assert.match(error.message, /not configured/i);
      return true;
    },
  );
});

test("AI summary converts an invalid Gemini key response into a safe error", async () => {
  const invalidKeyClient = {
    models: {
      async generateContent() {
        throw new Error("API key not valid. Please pass a valid API key. API_KEY_INVALID");
      },
    },
  };

  await assert.rejects(
    generateSummary({
      videoId: "ai-invalid-key",
      transcript: "A transcript used only by the unit test.",
      config: loadConfig({ GEMINI_API_KEY: "invalid-test-key" }),
      client: invalidKeyClient,
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "AI_AUTH_INVALID");
      assert.doesNotMatch(error.message, /api key/i);
      return true;
    },
  );
});

test("AI summary times out with a retryable internal AI code", async () => {
  const hangingClient = {
    models: {
      async generateContent() {
        return new Promise(() => {});
      },
    },
  };

  await assert.rejects(
    generateSummary({
      videoId: "ai-timeout-test",
      transcript: "A transcript used only by the timeout unit test.",
      config: { ...loadConfig({ GEMINI_API_KEY: "test-key" }), aiTimeoutMs: 5 },
      client: hangingClient,
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "AI_TIMEOUT");
      return true;
    },
  );
});

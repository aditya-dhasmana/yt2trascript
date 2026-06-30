import test from "node:test";
import assert from "node:assert/strict";
import { runAiAction } from "../src/lib/aiClient.js";

test("extension AI client maps an offline backend to safe copy", async () => {
  const result = await runAiAction("summary", "M7lc1UVf-VE", "Raw transcript", {
    fetchImplementation: async () => {
      throw new Error("ECONNREFUSED with technical details");
    },
  });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "BACKEND_OFFLINE",
      message: "AI helper is unavailable right now. Raw transcript is safe and ready.",
    },
  });
});

test("extension AI client accepts the backend safe error shape", async () => {
  const result = await runAiAction("clean", "M7lc1UVf-VE", "Raw transcript", {
    fetchImplementation: async () => new Response(JSON.stringify({
      ok: false,
      code: "AI_UNDER_DEVELOPMENT",
      message: "This AI feature is currently under development.",
      retryable: false,
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "AI_UNDER_DEVELOPMENT");
    assert.doesNotMatch(result.error.message, /Gemini|API key/i);
  }
});

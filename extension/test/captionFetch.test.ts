import test from "node:test";
import assert from "node:assert/strict";
import { fetchCaptionTrack, isAllowedCaptionUrl } from "../src/lib/captionFetch.js";

test("caption fetch allows YouTube hosts and rejects backend or arbitrary hosts", () => {
  assert.equal(isAllowedCaptionUrl("https://www.youtube.com/api/timedtext?v=abc"), true);
  assert.equal(isAllowedCaptionUrl("https://video.googlevideo.com/api/timedtext?v=abc"), true);
  assert.equal(isAllowedCaptionUrl("https://yt2trascript.onrender.com/api/transcript"), false);
  assert.equal(isAllowedCaptionUrl("https://example.com/captions"), false);
});

test("service-worker caption fetch returns the YouTube response locally", async () => {
  let requestedUrl = "";
  const rawText = await fetchCaptionTrack(
    "https://www.youtube.com/api/timedtext?v=M7lc1UVf-VE",
    async (input) => {
      requestedUrl = String(input);
      return new Response('{"events":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  );

  assert.equal(new URL(requestedUrl).hostname, "www.youtube.com");
  assert.equal(rawText, '{"events":[]}');
});

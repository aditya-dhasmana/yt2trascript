import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTranscriptUrl,
  extractPlayerResponseFromScripts,
  extractTranscriptFromPage,
} from "../src/lib/transcriptExtractor.js";
import type { PlayerResponse } from "../src/types.js";

const playerResponse: PlayerResponse = {
  videoDetails: {
    videoId: "M7lc1UVf-VE",
    title: "YouTube API demo",
    author: "Google for Developers",
  },
  captions: {
    playerCaptionsTracklistRenderer: {
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=M7lc1UVf-VE&lang=en",
          languageCode: "en",
          name: { simpleText: "English" },
        },
      ],
    },
  },
};

test("raw transcript extraction uses only the YouTube caption track path", async () => {
  let captionRequestUrl = "";
  let backendRequests = 0;

  const result = await extractTranscriptFromPage("M7lc1UVf-VE", {
    playerResponse,
    pageUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    now: () => 1234,
    async fetchCaptionTrack(url) {
      captionRequestUrl = url;
      if (url.includes("onrender.com") || url.includes("localhost:10000")) backendRequests += 1;
      return JSON.stringify({
        events: [
          { tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: "Extension-side caption" }] },
        ],
      });
    },
  });

  assert.equal(new URL(captionRequestUrl).hostname, "www.youtube.com");
  assert.equal(new URL(captionRequestUrl).searchParams.get("fmt"), "json3");
  assert.equal(backendRequests, 0);
  assert.equal(result.text, "[00:00] Extension-side caption");
  assert.equal(result.video.channel, "Google for Developers");
  assert.equal(result.segments.length, 1);
});

test("extracts the matching player response from balanced inline JSON", () => {
  const script = `window.test = true; ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};`;
  const result = extractPlayerResponseFromScripts([script], "M7lc1UVf-VE");

  assert.equal(result?.videoDetails?.videoId, "M7lc1UVf-VE");
  assert.equal(result?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length, 1);
});

test("forces json3 format on caption URLs", () => {
  const result = buildTranscriptUrl(
    "https://www.youtube.com/api/timedtext?v=M7lc1UVf-VE&fmt=srv3",
  );
  assert.equal(new URL(result).searchParams.get("fmt"), "json3");
});

import test from "node:test";
import assert from "node:assert/strict";
import { parseTranscript } from "../src/lib/captionParser.js";

test("parses YouTube json3 caption events", () => {
  const segments = parseTranscript(JSON.stringify({
    events: [
      { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: "Hello " }, { utf8: "world" }] },
      { tStartMs: 3500, dDurationMs: 1000, segs: [{ utf8: "Next line" }] },
    ],
  }));

  assert.deepEqual(segments, [
    { start: 1, duration: 2, text: "Hello world" },
    { start: 3.5, duration: 1, text: "Next line" },
  ]);
});

test("parses legacy XML and decodes entities", () => {
  const segments = parseTranscript(
    '<transcript><text start="1.25" dur="2.5">Rock &amp; roll &#39;works&#39;</text></transcript>',
  );

  assert.deepEqual(segments, [
    { start: 1.25, duration: 2.5, text: "Rock & roll 'works'" },
  ]);
});

test("parses srv3 XML timestamps expressed in milliseconds", () => {
  const segments = parseTranscript(
    '<timedtext><body><p t="2500" d="1250"><s>Hello</s><s> there</s></p></body></timedtext>',
  );

  assert.deepEqual(segments, [
    { start: 2.5, duration: 1.25, text: "Hello there" },
  ]);
});

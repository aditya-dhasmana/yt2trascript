import test from "node:test";
import assert from "node:assert/strict";
import { extractVideoId } from "../src/lib/extractVideoId.js";

test("detects watch, shorts, and short YouTube URLs", () => {
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=M7lc1UVf-VE"), "M7lc1UVf-VE");
  assert.equal(extractVideoId("https://www.youtube.com/shorts/M7lc1UVf-VE"), "M7lc1UVf-VE");
  assert.equal(extractVideoId("https://youtu.be/M7lc1UVf-VE"), "M7lc1UVf-VE");
  assert.equal(extractVideoId("https://www.youtube.com/"), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("raw extension modules contain no backend or youtube-transcript dependency", async () => {
  const extensionRoot = path.resolve(import.meta.dirname, "..");
  const packageJson = JSON.parse(
    await readFile(path.join(extensionRoot, "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const rawSource = await Promise.all([
    "src/content/contentScript.ts",
    "src/lib/transcriptExtractor.ts",
    "src/lib/captionFetch.ts",
    "src/lib/captionParser.ts",
  ].map((file) => readFile(path.join(extensionRoot, file), "utf8")));
  const combinedRawSource = rawSource.join("\n");
  const popupHtml = await readFile(path.join(extensionRoot, "src/popup/popup.html"), "utf8");

  assert.equal(packageJson.dependencies?.["youtube-transcript"], undefined);
  assert.equal(packageJson.devDependencies?.["youtube-transcript"], undefined);
  assert.doesNotMatch(combinedRawSource, /onrender\.com|localhost:10000|\/api\/ai\//);
  assert.doesNotMatch(combinedRawSource, /from ["']youtube-transcript["']/);
  assert.match(popupHtml, /Extraction source:<\/strong> Extension Mode/);
  assert.match(popupHtml, /Backend YouTube fetch:<\/strong> No/);
});

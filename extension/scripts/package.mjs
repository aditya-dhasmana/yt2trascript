import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.resolve(extensionRoot, "..", "public", "yt-transcript-extension.zip");

await import("./build.mjs");

await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(outputPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", resolve);
  output.on("error", reject);
  archive.on("warning", reject);
  archive.on("error", reject);
  archive.pipe(output);

  archive.file(path.join(extensionRoot, "manifest.json"), { name: "manifest.json" });
  archive.directory(path.join(extensionRoot, "dist"), "dist");
  archive.file(path.join(extensionRoot, "src", "popup", "popup.html"), {
    name: "src/popup/popup.html",
  });
  archive.file(path.join(extensionRoot, "src", "popup", "popup.css"), {
    name: "src/popup/popup.css",
  });
  void archive.finalize();
});

console.log(`Created ${outputPath}`);

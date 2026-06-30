import { build } from "esbuild";

const shared = {
  bundle: true,
  target: "chrome120",
  sourcemap: false,
  minify: false,
  logLevel: "info",
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ["src/content/contentScript.ts"],
    outfile: "dist/content/contentScript.js",
    format: "iife",
  }),
  build({
    ...shared,
    entryPoints: ["src/popup/popup.ts"],
    outfile: "dist/popup/popup.js",
    format: "iife",
  }),
  build({
    ...shared,
    entryPoints: ["src/background/background.ts"],
    outfile: "dist/background/background.js",
    format: "esm",
  }),
]);

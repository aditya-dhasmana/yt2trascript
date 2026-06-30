export const EXTRACTION_SOURCES = Object.freeze({
  browser: Object.freeze({
    mode: "Browser Mode",
    youtubeFetch: "User browser",
    backendYouTubeFetch: false,
    renderUsage: "No for raw transcript",
    message: "Fetched from YouTube using your browser. Our server did not fetch this transcript.",
  }),
  server: Object.freeze({
    mode: "Server Mode",
    youtubeFetch: "Render backend",
    backendYouTubeFetch: true,
    blockingRisk: "Possible",
    message: "Fetched by server fallback. This may fail if the hosting provider is blocked by YouTube.",
  }),
  extension: Object.freeze({
    mode: "Extension Mode",
    youtubeFetch: "User browser/extension",
    backendYouTubeFetch: false,
    renderUsage: "No for raw transcript",
    message: "Fetched from YouTube using your browser extension. Our server did not fetch this transcript.",
  }),
});

export function getExtractionSource(mode) {
  return EXTRACTION_SOURCES[mode] || null;
}

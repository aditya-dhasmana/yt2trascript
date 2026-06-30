const backendUrl = (process.env.BACKEND_URL || "http://localhost:10000").replace(/\/$/, "");
const videoArgument = process.argv.find((argument) => argument.startsWith("--video="));
const videoUrl = videoArgument?.slice("--video=".length) || process.env.SMOKE_VIDEO_URL;

if (!videoUrl) {
  console.error("Provide a real video with --video=<youtube-url> or SMOKE_VIDEO_URL.");
  process.exit(1);
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const healthResponse = await fetch(`${backendUrl}/api/health`);
const health = await readJson(healthResponse);
if (!healthResponse.ok || !health.ok) {
  console.error("Health check failed.", health);
  process.exit(1);
}
console.log("PASS backend health", health.capabilities);

const invalidResponse = await fetch(`${backendUrl}/api/transcript`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ videoUrl: "not a YouTube URL" }),
});
const invalidResult = await readJson(invalidResponse);
if (invalidResponse.status !== 400 || invalidResult.code !== "INVALID_YOUTUBE_URL") {
  console.error("Invalid URL validation failed.", invalidResult);
  process.exit(1);
}
console.log("PASS invalid URL validation");

const transcriptResponse = await fetch(`${backendUrl}/api/transcript`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ videoUrl }),
});
const transcriptResult = await readJson(transcriptResponse);

if (!transcriptResponse.ok) {
  console.error("LIVE TRANSCRIPT FAILED", {
    status: transcriptResponse.status,
    code: transcriptResult.code,
    error: transcriptResult.error,
    providerFailures: transcriptResult.details?.providerFailures,
    requestId: transcriptResult.requestId,
  });
  process.exit(1);
}

if (!transcriptResult.transcript?.text) {
  console.error("Live transcript response did not contain text.");
  process.exit(1);
}

console.log("PASS live transcript", {
  provider: transcriptResult.provider,
  characters: transcriptResult.transcript.text.length,
  cacheHit: transcriptResult.cacheHit,
});

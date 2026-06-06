import { youtubeTranscriptProvider } from "./youtubeTranscriptProvider.js";

const providerSlots = {
  "youtube-transcript": youtubeTranscriptProvider,
};

export function getTranscriptProviders() {
  const priority = (process.env.TRANSCRIPT_PROVIDER_PRIORITY || "youtube-transcript")
    .split(",")
    .map((provider) => provider.trim())
    .filter(Boolean);

  return priority
    .map((providerName) => providerSlots[providerName])
    .filter(Boolean);
}

export function getProviderSlots() {
  return Object.keys(providerSlots);
}

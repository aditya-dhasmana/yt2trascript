import { youtubeTranscriptProvider } from "./youtubeTranscriptProvider.js";
import { loadConfig } from "../../config/environment.js";

const providerSlots = {
  "youtube-transcript": youtubeTranscriptProvider,
};

export function getTranscriptProviders(config = loadConfig()) {
  const priority = config.transcriptProviderPriority;

  return priority
    .map((providerName) => providerSlots[providerName])
    .filter(Boolean);
}

export function getProviderSlots() {
  return Object.keys(providerSlots);
}

import axios from "axios";
import { normalizeDuration } from "../../utils/youtube.js";

function mapYouTubeApiItem(item) {
  const snippet = item.snippet || {};
  const statistics = item.statistics || {};
  const contentDetails = item.contentDetails || {};

  return {
    title: snippet.title || "Untitled video",
    channel: snippet.channelTitle || "",
    thumbnail: snippet.thumbnails?.maxres?.url
      || snippet.thumbnails?.high?.url
      || snippet.thumbnails?.medium?.url
      || "",
    duration: normalizeDuration(contentDetails.duration),
    tags: snippet.tags || [],
    publishedAt: snippet.publishedAt || "",
    statistics,
    source: "youtube-data-api",
  };
}

async function fetchOEmbedMetadata(videoId) {
  const response = await axios.get("https://www.youtube.com/oembed", {
    params: {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      format: "json",
    },
    timeout: 8000,
  });

  return {
    title: response.data?.title || "Untitled video",
    channel: response.data?.author_name || "",
    thumbnail: response.data?.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: "",
    tags: [],
    publishedAt: "",
    statistics: {},
    source: "youtube-oembed",
  };
}

export const youtubeMetadataProvider = {
  name: "youtube-metadata",

  isSupported({ videoId }) {
    return Boolean(videoId);
  },

  async getMetadata({ videoId }) {
    if (!process.env.YOUTUBE_API_KEY) {
      return fetchOEmbedMetadata(videoId);
    }

    const response = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
      params: {
        part: "snippet,contentDetails,statistics",
        id: videoId,
        key: process.env.YOUTUBE_API_KEY,
      },
      timeout: 8000,
    });

    const item = response.data?.items?.[0];

    if (!item) {
      throw new Error("Video removed, private, or unavailable.");
    }

    return mapYouTubeApiItem(item);
  },

  async getTranscript() {
    throw new Error("YouTube Data API is metadata-only in this app.");
  },

  async healthCheck() {
    return { ok: true, hasApiKey: Boolean(process.env.YOUTUBE_API_KEY) };
  },
};

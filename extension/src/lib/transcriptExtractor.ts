import { parseTranscript } from "./captionParser.js";
import { formatPlainText } from "./transcriptFormatter.js";
import type {
  CaptionTrack,
  CaptionTrackMessageResult,
  PlayerResponse,
  PlayerResponseMessageResult,
  RawCaptionTrack,
  TranscriptError,
  TranscriptResult,
  VideoInfo,
} from "../types.js";

type ExtractorDependencies = {
  playerResponse?: PlayerResponse | null;
  scriptTexts?: string[];
  fetchCaptionTrack?: (url: string) => Promise<string>;
  pageUrl?: string;
  pageTitle?: string;
  pageChannel?: string;
  now?: () => number;
};

export async function extractTranscriptFromPage(
  expectedVideoId: string,
  dependencies: ExtractorDependencies = {},
): Promise<TranscriptResult> {
  const playerResponse = await resolvePlayerResponse(expectedVideoId, dependencies);

  if (!playerResponse) {
    throw createError("NO_PLAYER_DATA", "Could not read YouTube player data for this page.");
  }

  if (playerResponse.videoDetails?.isPrivate
    || playerResponse.playabilityStatus?.status === "LOGIN_REQUIRED") {
    throw createError(
      "PRIVATE_VIDEO",
      "This video is private or requires access that the extension cannot use.",
    );
  }

  const captionTracks = normalizeCaptionTracks(playerResponse);
  if (captionTracks.length === 0) {
    throw createError("NO_TRANSCRIPT", "No transcript or caption track is available for this video.");
  }

  const selectedTrack = selectPreferredTrack(captionTracks);
  const transcriptUrl = buildTranscriptUrl(selectedTrack.baseUrl);
  const captionFetcher = dependencies.fetchCaptionTrack || fetchCaptionTrackFromServiceWorker;
  const rawCaptionPayload = await captionFetcher(transcriptUrl);
  const segments = parseTranscript(rawCaptionPayload);

  if (segments.length === 0) {
    throw createError(
      "CAPTIONS_DISABLED",
      "Caption data was found, but no transcript text could be parsed.",
    );
  }

  return {
    video: buildVideoInfo(playerResponse, expectedVideoId, dependencies),
    segments,
    text: formatPlainText(segments, true),
    track: selectedTrack,
    fetchedAt: (dependencies.now || Date.now)(),
  };
}

async function resolvePlayerResponse(
  expectedVideoId: string,
  dependencies: ExtractorDependencies,
): Promise<PlayerResponse | null> {
  if (Object.prototype.hasOwnProperty.call(dependencies, "playerResponse")) {
    return dependencies.playerResponse ?? null;
  }

  const fromMainWorld = await requestPlayerResponseFromServiceWorker(expectedVideoId);
  if (fromMainWorld?.videoDetails?.videoId === expectedVideoId) return fromMainWorld;

  const scriptTexts = dependencies.scriptTexts
    || Array.from(document.scripts, (script) => script.textContent || "");
  return extractPlayerResponseFromScripts(scriptTexts, expectedVideoId);
}

async function requestPlayerResponseFromServiceWorker(
  expectedVideoId: string,
): Promise<PlayerResponse | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "READ_PLAYER_RESPONSE",
      expectedVideoId,
    }) as PlayerResponseMessageResult;
    return response.ok ? response.playerResponse : null;
  } catch {
    return null;
  }
}

async function fetchCaptionTrackFromServiceWorker(url: string): Promise<string> {
  const response = await chrome.runtime.sendMessage({
    type: "FETCH_CAPTION_TRACK",
    url,
  }) as CaptionTrackMessageResult;

  if (!response.ok) throw response.error;
  return response.rawText;
}

function buildVideoInfo(
  playerResponse: PlayerResponse,
  fallbackVideoId: string,
  dependencies: ExtractorDependencies,
): VideoInfo {
  const documentTitle = typeof document === "undefined"
    ? ""
    : document.title.replace(/\s*-\s*YouTube\s*$/, "").trim();
  const channelFromPage = typeof document === "undefined"
    ? ""
    : document.querySelector<HTMLElement>("ytd-channel-name a, #owner-name a")?.innerText?.trim() || "";

  return {
    videoId: playerResponse.videoDetails?.videoId || fallbackVideoId,
    title: playerResponse.videoDetails?.title || dependencies.pageTitle || documentTitle || "YouTube video",
    channel: playerResponse.videoDetails?.author || dependencies.pageChannel || channelFromPage || "Unknown channel",
    url: dependencies.pageUrl || (typeof location === "undefined" ? "" : location.href),
  };
}

export function extractPlayerResponseFromScripts(
  scriptTexts: string[],
  expectedVideoId: string,
): PlayerResponse | null {
  const candidates: PlayerResponse[] = [];
  const markers = ["ytInitialPlayerResponse =", '"ytInitialPlayerResponse":'];

  for (const scriptText of scriptTexts) {
    for (const marker of markers) {
      let searchFrom = 0;

      while (searchFrom < scriptText.length) {
        const markerIndex = scriptText.indexOf(marker, searchFrom);
        if (markerIndex === -1) break;

        const jsonStart = scriptText.indexOf("{", markerIndex + marker.length);
        if (jsonStart === -1) break;
        const json = extractBalancedJsonObject(scriptText, jsonStart);
        searchFrom = jsonStart + 1;
        if (!json) continue;

        try {
          const candidate = JSON.parse(json) as PlayerResponse;
          if (candidate.videoDetails?.videoId === expectedVideoId) return candidate;
          candidates.push(candidate);
        } catch {
          // YouTube changes inline data frequently; keep searching other script blocks.
        }
      }
    }
  }

  return candidates.find((candidate) => candidate.videoDetails?.videoId === expectedVideoId) || null;
}

function extractBalancedJsonObject(source: string, startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIndex, index + 1);
    }
  }

  return null;
}

export function normalizeCaptionTracks(playerResponse: PlayerResponse): CaptionTrack[] {
  const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  return tracks
    .map((track) => normalizeCaptionTrack(track))
    .filter((track): track is CaptionTrack => track !== null);
}

function normalizeCaptionTrack(track: RawCaptionTrack): CaptionTrack | null {
  if (!track.baseUrl || !track.languageCode) return null;

  return {
    baseUrl: track.baseUrl,
    name: readTrackName(track),
    languageCode: track.languageCode,
    isAutoGenerated: track.kind === "asr",
    ...(track.kind ? { kind: track.kind } : {}),
  };
}

export function selectPreferredTrack(tracks: CaptionTrack[]): CaptionTrack {
  const manualEnglish = tracks.find(
    (track) => track.languageCode.startsWith("en") && !track.isAutoGenerated,
  );
  const anyManual = tracks.find((track) => !track.isAutoGenerated);
  const english = tracks.find((track) => track.languageCode.startsWith("en"));

  return manualEnglish || anyManual || english || tracks[0]!;
}

export function buildTranscriptUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", "json3");
  return url.toString();
}

function readTrackName(track: RawCaptionTrack): string {
  if (track.name?.simpleText) return track.name.simpleText;
  return (track.name?.runs ?? [])
    .map((run) => run.text ?? "")
    .join("")
    .trim() || track.languageCode || "Caption track";
}

function createError(code: TranscriptError["code"], message: string): TranscriptError {
  return { code, message };
}

import { downloadTextFile, safeFilename } from "../lib/downloadManager.js";
import { extractVideoId } from "../lib/extractVideoId.js";
import { cacheTranscript, clearCachedTranscript, getCachedTranscript } from "../lib/storageManager.js";
import { formatPlainText, formatSrt } from "../lib/transcriptFormatter.js";
import type {
  AiAction,
  AiActionMessageResult,
  TranscriptResult,
  TranscriptResponse,
  VideoChangedMessage,
} from "../types.js";

const elements = {
  title: getElement<HTMLParagraphElement>("videoTitle"),
  meta: getElement<HTMLParagraphElement>("videoMeta"),
  status: getElement<HTMLElement>("statusMessage"),
  viewer: getElement<HTMLPreElement>("transcriptViewer"),
  copyButton: getElement<HTMLButtonElement>("copyButton"),
  downloadTxtButton: getElement<HTMLButtonElement>("downloadTxtButton"),
  downloadSrtButton: getElement<HTMLButtonElement>("downloadSrtButton"),
  refreshButton: getElement<HTMLButtonElement>("refreshButton"),
  timestampToggle: getElement<HTMLInputElement>("timestampToggle"),
  rawButton: getElement<HTMLButtonElement>("rawButton"),
  cleanButton: getElement<HTMLButtonElement>("cleanButton"),
  summaryButton: getElement<HTMLButtonElement>("summaryButton"),
  notesButton: getElement<HTMLButtonElement>("notesButton"),
};

let activeTranscript: TranscriptResult | null = null;
let activeTabId: number | null = null;
let activeOutput: { kind: "raw" | AiAction; text: string } = { kind: "raw", text: "" };

void initialize();

elements.timestampToggle.addEventListener("change", showRawTranscript);
elements.copyButton.addEventListener("click", () => void copyTranscript());
elements.downloadTxtButton.addEventListener("click", downloadTxt);
elements.downloadSrtButton.addEventListener("click", downloadSrt);
elements.refreshButton.addEventListener("click", () => void loadTranscript({ forceRefresh: true }));
elements.rawButton.addEventListener("click", showRawTranscript);
elements.cleanButton.addEventListener("click", () => void requestAiAction("clean"));
elements.summaryButton.addEventListener("click", () => void requestAiAction("summary"));
elements.notesButton.addEventListener("click", () => void requestAiAction("notes"));

chrome.runtime.onMessage.addListener((message: VideoChangedMessage) => {
  if (message.type === "VIDEO_CHANGED") void loadTranscript({ forceRefresh: false });
});

async function initialize(): Promise<void> {
  await loadTranscript({ forceRefresh: false });
}

async function loadTranscript(options: { forceRefresh: boolean }): Promise<void> {
  setBusy(true);
  setStatus("Detecting the current YouTube video...");

  const tab = await getActiveTab();
  activeTabId = tab.id ?? null;
  const videoId = tab.url ? extractVideoId(tab.url) : null;

  if (!activeTabId || !videoId) {
    activeTranscript = null;
    activeOutput = { kind: "raw", text: "" };
    renderEmpty("No video detected", "Open a YouTube video page, then click the extension again.");
    setBusy(false);
    return;
  }

  elements.title.textContent = tab.title?.replace(/\s*-\s*YouTube\s*$/, "") || "YouTube video detected";
  elements.meta.textContent = "Video detected • Looking for captions";
  setStatus("Video detected. Reading caption tracks from this YouTube tab...");

  if (options.forceRefresh) {
    await clearCachedTranscript(videoId);
  } else {
    const cached = await getCachedTranscript(videoId);
    if (cached) {
      activeTranscript = cached;
      showRawTranscript();
      renderLoaded(cached, "Captions found • Loaded from local extension cache");
      setBusy(false);
      return;
    }
  }

  const response = await requestTranscript(activeTabId);

  if (!response.ok) {
    activeTranscript = null;
    activeOutput = { kind: "raw", text: "" };
    renderEmpty(errorTitle(response.error.code), response.error.message, true);
    setBusy(false);
    return;
  }

  activeTranscript = response.data;
  showRawTranscript();
  await cacheTranscript(response.data);
  renderLoaded(response.data, "Captions found • Loaded directly from YouTube");
  setBusy(false);
}

async function requestTranscript(tabId: number): Promise<TranscriptResponse> {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "GET_TRANSCRIPT" }) as TranscriptResponse;
  } catch {
    return {
      ok: false,
      error: {
        code: "EXTRACTION_FAILED",
        message: "Could not reach the YouTube page. Refresh the tab and try again.",
      },
    };
  }
}

function renderLoaded(result: TranscriptResult, status: string): void {
  elements.title.textContent = result.video.title;
  elements.meta.textContent = `${result.video.channel} • ${result.segments.length} segments • ${result.track.name}`;
  setStatus(status);
  renderOutput();
}

function showRawTranscript(): void {
  if (!activeTranscript) return;
  activeOutput = {
    kind: "raw",
    text: formatPlainText(activeTranscript.segments, elements.timestampToggle.checked),
  };
  renderOutput();
  setStatus("Showing raw transcript extracted locally from YouTube.");
}

function renderOutput(): void {
  elements.viewer.textContent = activeOutput.text;
}

async function copyTranscript(): Promise<void> {
  if (!activeOutput.text) return;

  await navigator.clipboard.writeText(activeOutput.text);
  setStatus(`${outputLabel()} transcript copied.`);
}

function downloadTxt(): void {
  if (!activeTranscript || !activeOutput.text) return;

  const title = safeFilename(activeTranscript.video.title || activeTranscript.video.videoId);
  const suffix = activeOutput.kind === "raw" ? "transcript" : activeOutput.kind;
  downloadTextFile(`${title}-${suffix}.txt`, activeOutput.text, "text/plain");
  setStatus(`${outputLabel()} TXT download started.`);
}

function downloadSrt(): void {
  if (!activeTranscript) return;

  const title = safeFilename(activeTranscript.video.title || activeTranscript.video.videoId);
  downloadTextFile(`${title}.srt`, formatSrt(activeTranscript.segments), "application/x-subrip");
  setStatus("Raw SRT download started.");
}

async function requestAiAction(action: AiAction): Promise<void> {
  if (!activeTranscript) return;

  setAiBusy(true, action);
  setStatus(`Requesting optional AI ${action}...`);
  const response = await chrome.runtime.sendMessage({
    type: "RUN_AI_ACTION",
    action,
    videoId: activeTranscript.video.videoId,
    transcript: activeTranscript.text,
  }) as AiActionMessageResult;
  setAiBusy(false);

  if (!response.ok) {
    showRawTranscript();
    const label = action === "clean" ? "Clean transcript" : action === "summary" ? "Summary" : "Notes";
    const underDevelopment = response.error.code === "AI_UNDER_DEVELOPMENT";
    setStatus(
      underDevelopment
        ? `${label} is under development right now. Raw transcript is safe and ready.`
        : `${label} is temporarily unavailable. Raw transcript is safe and ready.`,
      true,
    );
    return;
  }

  activeOutput = { kind: action, text: response.text };
  renderOutput();
  setStatus(`Showing AI ${action}. Raw transcript remains stored locally.`);
}

function renderEmpty(title: string, message: string, isError = false): void {
  elements.title.textContent = title;
  elements.meta.textContent = message;
  elements.viewer.textContent = "";
  setStatus(message, isError);
}

function setStatus(message: string, isError = false): void {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function setBusy(isBusy: boolean): void {
  elements.refreshButton.disabled = isBusy;
  elements.copyButton.disabled = isBusy || !activeTranscript;
  elements.downloadTxtButton.disabled = isBusy || !activeTranscript;
  elements.downloadSrtButton.disabled = isBusy || !activeTranscript;
  elements.rawButton.disabled = isBusy || !activeTranscript;
  setAiBusy(isBusy || !activeTranscript);
}

function setAiBusy(isBusy: boolean, action?: AiAction): void {
  elements.cleanButton.disabled = isBusy;
  elements.summaryButton.disabled = isBusy;
  elements.notesButton.disabled = isBusy;
  elements.cleanButton.textContent = isBusy && action === "clean" ? "Cleaning..." : "Clean";
  elements.summaryButton.textContent = isBusy && action === "summary" ? "Summarizing..." : "Summary";
  elements.notesButton.textContent = isBusy && action === "notes" ? "Creating notes..." : "Notes";
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function outputLabel(): string {
  return activeOutput.kind === "raw" ? "Raw" : `AI ${activeOutput.kind}`;
}

function errorTitle(code: string): string {
  const titles: Record<string, string> = {
    UNSUPPORTED_PAGE: "No video detected",
    NO_VIDEO_ID: "No video detected",
    NO_PLAYER_DATA: "Player data unavailable",
    NO_TRANSCRIPT: "No captions found",
    CAPTIONS_DISABLED: "Captions unavailable",
    PRIVATE_VIDEO: "Private video",
    NETWORK_ERROR: "Caption download failed",
    EXTRACTION_FAILED: "Extraction failed",
  };

  return titles[code] || "Transcript unavailable";
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required popup element: ${id}`);
  return element as T;
}

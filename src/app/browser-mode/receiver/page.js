"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ExtractionSourceInfo from "../../components/ExtractionSourceInfo";
import { validateBrowserModePayload, isAllowedYouTubeOrigin } from "../../../browser-mode/receiverPayload";
import {
  createTranscriptFile,
  formatRawTranscript,
} from "../../../browser-mode/transcriptFiles";
import { createAiFailureState } from "../../../lib/aiUi";

const STORAGE_KEY = "yt2t:browser-mode:last-transcript";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:10000";

function downloadFile(file) {
  const blob = new Blob([file.content], { type: `${file.mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function BrowserModeReceiverPage() {
  const [payload, setPayload] = useState(null);
  const [activeOutput, setActiveOutput] = useState({ kind: "raw", text: "" });
  const [status, setStatus] = useState("Waiting for a transcript from your YouTube tab...");
  const [isError, setIsError] = useState(false);
  const [aiStatus, setAiStatus] = useState("idle");

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const validation = validateBrowserModePayload(JSON.parse(stored), "https://www.youtube.com");
        if (validation.ok) {
          setPayload(validation.data);
          setActiveOutput({ kind: "raw", text: formatRawTranscript(validation.data.segments) });
          setStatus("Restored the latest Browser Mode transcript from this tab session.");
        }
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }

    const notifyOpener = () => {
      window.opener?.postMessage({ type: "YT2T_RECEIVER_READY" }, "*");
    };
    const readyTimer = window.setInterval(notifyOpener, 500);
    notifyOpener();

    const handleMessage = (event) => {
      if (event.source !== window.opener || !isAllowedYouTubeOrigin(event.origin)) return;

      if (event.data?.type === "YT2T_IMPORT_ERROR") {
        setStatus(event.data.error || "YouTube transcript extraction failed.");
        setIsError(true);
        event.source?.postMessage({ type: "YT2T_IMPORT_ACK" }, event.origin);
        return;
      }

      if (event.data?.type !== "YT2T_TRANSCRIPT_IMPORT") return;
      const validation = validateBrowserModePayload(event.data.payload, event.origin);
      if (!validation.ok) {
        setStatus(validation.error);
        setIsError(true);
        return;
      }

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(validation.data));
      setPayload(validation.data);
      setActiveOutput({ kind: "raw", text: formatRawTranscript(validation.data.segments) });
      setStatus("Transcript imported directly from your YouTube tab. No server extraction was used.");
      setIsError(false);
      if (process.env.NODE_ENV !== "production") {
        console.info("BROWSER_MODE_TRANSCRIPT_RECEIVED", {
          source: "browser",
          youtubeFetchByBackend: false,
          textLength: formatRawTranscript(validation.data.segments).length,
          segments: validation.data.segments.length,
        });
      }
      event.source?.postMessage({ type: "YT2T_IMPORT_ACK" }, event.origin);
      window.clearInterval(readyTimer);
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.clearInterval(readyTimer);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const rawText = useMemo(
    () => payload ? formatRawTranscript(payload.segments) : "",
    [payload],
  );

  async function copyTranscript() {
    if (!activeOutput.text) return;
    await navigator.clipboard.writeText(activeOutput.text);
    setStatus(`${activeOutput.kind === "raw" ? "Raw" : "AI"} transcript copied.`);
    setIsError(false);
  }

  async function runAiAction(action) {
    if (!payload || !rawText) return;
    setAiStatus(action);
    setStatus(`Requesting optional AI ${action}...`);
    setIsError(false);

    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          videoId: payload.video.videoId,
          transcript: rawText,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.text) {
        const failure = new Error("AI helper unavailable");
        failure.code = result.code || "AI_UNAVAILABLE";
        throw failure;
      }

      setActiveOutput({ kind: action, text: result.text });
      setStatus(`Showing AI ${action}. Your raw transcript remains stored in this browser session.`);
    } catch (error) {
      const failureState = createAiFailureState({
        action,
        code: error.code || "AI_UNAVAILABLE",
        rawText,
      });
      setActiveOutput(failureState.activeOutput);
      setStatus(failureState.message);
      setIsError(true);
      if (process.env.NODE_ENV !== "production") {
        console.warn("BROWSER_MODE_AI_UNAVAILABLE", {
          action,
          code: error.code || error.name || "AI_UNAVAILABLE",
        });
      }
    } finally {
      setAiStatus("idle");
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-zinc-950 md:px-8">
      <article className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Browser Mode</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">Your browser transcript</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Raw transcripts arrive directly from your YouTube tab. Render is used only if you request an AI action.
            </p>
          </div>
          <Link href="/" className="text-sm font-bold text-emerald-800">Back to setup</Link>
        </header>

        <p className={`mt-5 rounded-md border px-4 py-3 text-sm font-medium ${
          isError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-900"
        }`} role="status">
          {status}
        </p>

        <div className="mt-4">
          <ExtractionSourceInfo mode="browser" />
        </div>

        {!payload ? (
          <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">Waiting for YouTube</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Return to the YouTube video and click the “Get Transcript” bookmark again. Keep this receiver tab open.
            </p>
          </section>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
            <aside className="h-fit rounded-lg border border-zinc-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Imported video</p>
              <h2 className="mt-2 text-xl font-black leading-snug">{payload.video.title}</h2>
              <p className="mt-2 text-sm text-zinc-600">{payload.video.channel}</p>
              <p className="mt-4 text-xs text-zinc-500">
                {payload.segments.length} segments · {payload.track.name} · {payload.track.languageCode}
              </p>
              <a
                href={payload.video.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex text-sm font-bold text-blue-700"
              >
                Open YouTube video
              </a>
            </aside>

            <section className="rounded-lg border border-zinc-200 bg-white">
              <div className="flex flex-wrap gap-2 border-b border-zinc-200 p-4">
                <button type="button" className="rounded-md border px-3 py-2 text-sm font-semibold" onClick={() => {
                  setActiveOutput({ kind: "raw", text: rawText });
                  setStatus("Showing raw Browser Mode transcript.");
                  setIsError(false);
                }}>Raw</button>
                <button type="button" className="rounded-md border px-3 py-2 text-sm font-semibold" onClick={copyTranscript}>Copy</button>
                <button type="button" className="rounded-md border px-3 py-2 text-sm font-semibold" onClick={() => downloadFile(createTranscriptFile(payload, "txt"))}>TXT</button>
                <button type="button" className="rounded-md border px-3 py-2 text-sm font-semibold" onClick={() => downloadFile(createTranscriptFile(payload, "srt"))}>SRT</button>
                <button type="button" className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-zinc-400" disabled={aiStatus !== "idle"} onClick={() => runAiAction("clean")}>{aiStatus === "clean" ? "Cleaning..." : "Clean"}</button>
                <button type="button" className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-zinc-400" disabled={aiStatus !== "idle"} onClick={() => runAiAction("summary")}>{aiStatus === "summary" ? "Summarizing..." : "Summary"}</button>
                <button type="button" className="rounded-md bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-zinc-400" disabled={aiStatus !== "idle"} onClick={() => runAiAction("notes")}>{aiStatus === "notes" ? "Creating notes..." : "Notes"}</button>
              </div>
              <pre className="max-h-[65vh] min-h-[520px] overflow-auto whitespace-pre-wrap p-5 text-sm leading-7 text-zinc-700">
                {activeOutput.text}
              </pre>
            </section>
          </div>
        )}
      </article>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import jsPDF from "jspdf";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:10000";

const tabs = [
  { id: "original", label: "Original Transcript" },
  { id: "clean", label: "Clean Transcript" },
  { id: "summary", label: "Summary" },
];

const processingMessages = {
  metadata: "Fetching video details...",
  transcript: "Looking for available captions...",
  fallback: "Captions are slow or unavailable. Trying fallback transcription...",
};

function downloadText(fileName, text) {
  const element = document.createElement("a");
  const file = new Blob([text], { type: "text/plain" });
  element.href = URL.createObjectURL(file);
  element.download = `${fileName}.txt`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function downloadPdf(fileName, title, text) {
  const doc = new jsPDF();
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  const lines = doc.splitTextToSize(text, pageWidth);
  let cursorY = 32;

  doc.setFontSize(16);
  doc.text(title, margin, 18);
  doc.setFontSize(10);

  lines.forEach((line) => {
    if (cursorY > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }

    doc.text(line, margin, cursorY);
    cursorY += 5;
  });

  doc.save(`${fileName}.pdf`);
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "transcript";
}

function LoadingBar() {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
      <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-emerald-600" />
    </div>
  );
}

function VideoSkeleton() {
  return (
    <aside className="h-fit rounded-lg border border-zinc-200 bg-white p-4">
      <div className="aspect-video w-full animate-pulse rounded-md bg-zinc-200" />
      <div className="mt-4 h-5 w-5/6 animate-pulse rounded bg-zinc-200" />
      <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-zinc-100" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="h-16 animate-pulse rounded-md bg-zinc-100" />
        <div className="h-16 animate-pulse rounded-md bg-zinc-100" />
      </div>
    </aside>
  );
}

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [video, setVideo] = useState(null);
  const [originalTranscript, setOriginalTranscript] = useState("");
  const [cleanTranscript, setCleanTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [activeTab, setActiveTab] = useState("original");
  const [status, setStatus] = useState("idle");
  const [processingStep, setProcessingStep] = useState("");
  const [aiStatus, setAiStatus] = useState("idle");
  const [error, setError] = useState("");

  const activeText = useMemo(() => {
    if (activeTab === "clean") return cleanTranscript;
    if (activeTab === "summary") return summary;
    return originalTranscript;
  }, [activeTab, cleanTranscript, originalTranscript, summary]);

  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label || "Transcript";
  const fileBaseName = slugify(`${activeLabel} ${video?.metadata?.title || "youtube-video"}`);
  const isProcessing = status === "loading";

  async function request(path, body) {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Request failed.");
    }

    return result;
  }

  async function handleProcess() {
    setStatus("loading");
    setProcessingStep("metadata");
    setAiStatus("idle");
    setError("");
    setVideo(null);
    setOriginalTranscript("");
    setCleanTranscript("");
    setSummary("");
    setActiveTab("original");
    let fallbackHintTimer;

    try {
      const metadataResult = await request("/metadata", { videoUrl });
      setVideo({
        videoId: metadataResult.videoId,
        metadata: metadataResult.metadata,
        provider: "Processing",
        cacheHit: false,
      });

      setProcessingStep("transcript");
      fallbackHintTimer = window.setTimeout(() => {
        setProcessingStep("fallback");
      }, 8000);

      const result = await request("/transcript", { videoUrl });

      setVideo({ videoId: result.videoId, metadata: result.metadata, provider: result.provider, cacheHit: result.cacheHit });
      setOriginalTranscript(result.transcript.text);
      setProcessingStep("");
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setProcessingStep("");
      setStatus("error");
    } finally {
      window.clearTimeout(fallbackHintTimer);
    }
  }

  async function handleGenerateClean() {
    if (!video || !originalTranscript) return;
    setAiStatus("cleaning");
    setError("");

    try {
      const result = await request("/ai/clean", {
        videoId: video.videoId,
        transcript: originalTranscript,
      });
      setCleanTranscript(result.text);
      setActiveTab("clean");
      setAiStatus("idle");
    } catch (err) {
      setError(err.message);
      setAiStatus("idle");
    }
  }

  async function handleGenerateSummary() {
    if (!video || !originalTranscript) return;
    setAiStatus("summarizing");
    setError("");

    try {
      const result = await request("/ai/summary", {
        videoId: video.videoId,
        transcript: originalTranscript,
      });
      setSummary(result.text);
      setActiveTab("summary");
      setAiStatus("idle");
    } catch (err) {
      setError(err.message);
      setAiStatus("idle");
    }
  }

  function handleCopy() {
    if (!activeText) return;
    navigator.clipboard.writeText(activeText);
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "YouTube Transcript Platform",
    applicationCategory: "UtilityApplication",
    operatingSystem: "Web",
    description: "Extract YouTube transcripts, clean captions, and generate AI summaries on demand.",
  };

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex min-h-[42vh] w-full max-w-6xl flex-col justify-center px-4 py-12 md:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
            YouTube Transcript Platform
          </p>
          <h1 className="max-w-4xl text-4xl font-black leading-tight md:text-6xl">
            Get YouTube Transcripts, Clean Transcripts and AI Summaries Instantly
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 md:text-lg">
            Extract transcripts, clean captions and generate summaries from YouTube videos.
          </p>

          <div className="mt-8 flex w-full max-w-3xl flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-2 md:flex-row">
            <input
              className="min-h-12 flex-1 rounded-md border border-transparent bg-white px-4 text-sm outline-none focus:border-emerald-500"
              placeholder="Paste a YouTube URL"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-12 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
                onClick={async () => {
                  const text = await navigator.clipboard.readText();
                  setVideoUrl(text);
                }}
              >
                Paste
              </button>
              <button
                type="button"
                className="min-h-12 rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                onClick={handleProcess}
                disabled={!videoUrl || isProcessing}
              >
                {isProcessing ? "Processing..." : "Process"}
              </button>
            </div>
          </div>

          {isProcessing && (
            <div className="mt-5 max-w-3xl rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-emerald-950">
                    {processingMessages[processingStep] || "Processing video..."}
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">
                    Metadata appears first. Transcript extraction may take longer when fallback transcription is needed.
                  </p>
                </div>
                <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />
              </div>
              <div className="mt-4">
                <LoadingBar />
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </div>
      </section>

      {(video || isProcessing) && (
        <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-[320px_1fr] md:px-8">
          {video ? (
            <aside className="h-fit rounded-lg border border-zinc-200 bg-white p-4">
              <img
                src={video.metadata.thumbnail}
                alt={video.metadata.title}
                className="aspect-video w-full rounded-md bg-zinc-100 object-cover"
              />
              <h2 className="mt-4 text-lg font-bold leading-snug">{video.metadata.title}</h2>
              <p className="mt-2 text-sm text-zinc-600">{video.metadata.channel}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-600">
                <div className="rounded-md bg-zinc-50 p-3">
                  <p className="font-semibold text-zinc-950">Provider</p>
                  <p>{video.provider}</p>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <p className="font-semibold text-zinc-950">Cache</p>
                  <p>{video.cacheHit ? "Hit" : "Fresh"}</p>
                </div>
              </div>
            </aside>
          ) : (
            <VideoSkeleton />
          )}

          <section className="min-h-[620px] rounded-lg border border-zinc-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${
                      activeTab === tab.id
                        ? "bg-zinc-950 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                    disabled={isProcessing && !activeText}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" onClick={handleCopy} disabled={!activeText}>
                  Copy
                </button>
                <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" onClick={() => downloadText(fileBaseName, activeText)} disabled={!activeText}>
                  TXT
                </button>
                <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" onClick={() => downloadPdf(fileBaseName, activeLabel, activeText)} disabled={!activeText}>
                  PDF
                </button>
                <button
                  className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
                  onClick={handleGenerateClean}
                  disabled={aiStatus !== "idle" || !originalTranscript}
                >
                  {aiStatus === "cleaning" ? "Cleaning..." : "Generate Clean Transcript"}
                </button>
                <button
                  className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
                  onClick={handleGenerateSummary}
                  disabled={aiStatus !== "idle" || !originalTranscript}
                >
                  {aiStatus === "summarizing" ? "Summarizing..." : "Generate Summary"}
                </button>
              </div>
            </div>

            <div className="max-h-[560px] overflow-y-auto whitespace-pre-wrap p-5 text-sm leading-7 text-zinc-700">
              {isProcessing && !activeText ? (
                <div className="space-y-5">
                  <div>
                    <p className="font-bold text-zinc-950">
                      {processingMessages[processingStep] || "Processing video..."}
                    </p>
                    <p className="mt-2 text-zinc-500">
                      Keep this page open. The transcript will appear here automatically when it is ready.
                    </p>
                  </div>
                  <LoadingBar />
                  <div className="space-y-3">
                    <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
                    <div className="h-4 w-11/12 animate-pulse rounded bg-zinc-100" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-100" />
                    <div className="h-4 w-10/12 animate-pulse rounded bg-zinc-100" />
                  </div>
                </div>
              ) : activeText || (
                <p className="text-zinc-500">
                  This output has not been generated yet.
                </p>
              )}
            </div>
          </section>
        </section>
      )}
    </main>
  );
}

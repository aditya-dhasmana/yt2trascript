"use client";

import { useState, useRef, useEffect } from "react";
import jsPDF from "jspdf";

export default function Home() {
  // ================== STATE ==================
  const [videoUrl, setVideoUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [videoMeta, setVideoMeta] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | no-transcript | error
  const [error, setError] = useState("");

  // ================== INPUT REF FOR AUTO FOCUS ==================
  const inputRef = useRef(null);

  // Auto focus when status becomes idle
  useEffect(() => {
    if (status === "idle" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [status]);

  // ================== RESET EVERYTHING ==================
  function resetAll() {
    setVideoUrl("");
    setTranscript("");
    setVideoMeta(null);
    setError("");
    setStatus("idle");
  }

  // ================== FETCH TRANSCRIPT ==================
  async function handleGetTranscript() {
    setStatus("loading");
    setError("");
    setTranscript("");
    setVideoMeta(null);

    try {
      // Fetch video meta (title + thumbnail)
      const oEmbedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          videoUrl
        )}&format=json`
      );

      if (!oEmbedRes.ok) throw new Error("Invalid YouTube URL");

      const meta = await oEmbedRes.json();

      setVideoMeta({
        title: meta.title,
        thumbnail: meta.thumbnail_url,
      });

      // Fetch transcript from backend
      const res = await fetch("http://localhost:4000/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });

      const data = await res.json();

      if (res.status === 404) {
        setStatus("no-transcript");
        return;
      }

      if (!res.ok) throw new Error(data.error || "Failed to fetch transcript");

      // Clean transcript text
      const text = data.transcript.map((t) => t.text.trim()).join(" ");
      setTranscript(text);
      setStatus("success");
    } catch (err) {
      setError(err.message || "Something went wrong");
      setStatus("error");
    }
  }

  // ================== DOWNLOAD TXT ==================
  function downloadTxt() {
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ================== DOWNLOAD PDF ==================
  function downloadPdf() {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const margin = 10;
    const maxWidth = 190;

    const lines = doc.splitTextToSize(transcript, maxWidth);
    let y = margin;

    lines.forEach((line) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 8;
    });

    doc.save("transcript.pdf");
  }

  // ================== UI ==================
  return (
    <main className="min-h-screen bg-zinc-50 flex justify-center">
      <div
        className={`w-full max-w-3xl px-4 sm:px-6 ${
          status === "idle"
            ? "flex flex-col justify-center min-h-screen"
            : "py-16"
        }`}
      >
        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900">
            Free YouTube Transcript Downloader
          </h1>
          <p className="text-zinc-600 mt-2 text-sm sm:text-base">
            No login. No ads. Paste a YouTube link and download transcript as TXT
            or PDF.
          </p>
        </div>

        {/* INPUT + BUTTON */}
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                placeholder="Paste YouTube video link..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full h-14 px-4 pr-10 border-2 border-zinc-300 rounded-xl
                           text-zinc-900 placeholder-zinc-400
                           focus:outline-none focus:ring-2 focus:ring-black bg-white"
              />

              {videoUrl && (
                <button
                  onClick={() => setVideoUrl("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => {
                if (
                  status === "success" ||
                  status === "no-transcript" ||
                  status === "error"
                ) {
                  resetAll();
                } else {
                  handleGetTranscript();
                }
              }}
              disabled={status === "loading"}
              className="h-14 px-8 rounded-xl bg-zinc-900 text-white font-medium
                         hover:bg-zinc-800 transition-all disabled:opacity-50"
            >
              {status === "loading"
                ? "Fetching..."
                : status === "success" ||
                  status === "no-transcript" ||
                  status === "error"
                ? "Next Transcript"
                : "Get Transcript"}
            </button>
          </div>
        </div>

        {/* ERROR */}
        {status === "error" && (
          <div className="bg-red-100 text-red-700 p-6 rounded-xl text-center mb-8">
            <p className="font-semibold text-xl mb-2">
              Transcript could not be fetched
            </p>
            <p>{error}</p>
          </div>
        )}

        {/* NO TRANSCRIPT */}
        {status === "no-transcript" && (
          <div className="bg-yellow-100 text-yellow-900 p-6 rounded-xl text-center mb-8 text-lg font-medium">
            This video does not have captions available.
          </div>
        )}

        {/* VIDEO META */}
        {videoMeta && (
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-8">
            <img
              src={videoMeta.thumbnail}
              alt="Video thumbnail"
              className="rounded-lg mb-4 w-full"
            />
            <h2 className="font-semibold text-lg text-zinc-900">
              {videoMeta.title}
            </h2>
          </div>
        )}

        {/* TRANSCRIPT */}
        {status === "success" && (
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <button
                onClick={downloadTxt}
                className="w-full border rounded-lg py-3 hover:bg-zinc-100"
              >
                Download TXT
              </button>

              <button
                onClick={downloadPdf}
                className="w-full border rounded-lg py-3 hover:bg-zinc-100"
              >
                Download PDF
              </button>
            </div>

            <div className="bg-zinc-100 rounded-lg p-4 h-64 overflow-y-auto text-sm leading-6 text-zinc-900">
              <p className="whitespace-pre-wrap">{transcript}</p>
            </div>
          </div>
        )}

    {/* ================== SEO CONTENT FOR GOOGLE ================== */}
    <section className="mt-20 text-zinc-700 text-sm leading-7">
      <h2 className="text-xl font-semibold mb-4">
        Free YouTube Transcript Downloader (No Login, No Ads)
      </h2>

      <p className="mb-4">
        This free YouTube transcript downloader allows you to extract captions and
        subtitles from any YouTube video instantly. No sign-in, no ads, and no
        restrictions. Just paste the video link and download the transcript as
        clean text or PDF.
      </p>

      <p className="mb-4">
        You can convert YouTube captions into readable notes for study, research,
        content creation, or reference. The tool works with videos that have
        captions enabled and provides a fast way to turn spoken content into text.
      </p>

      <h3 className="text-lg font-semibold mt-6 mb-2">
        Why use this YouTube Transcript Tool?
      </h3>

      <ul className="list-disc ml-6 space-y-2">
        <li>Download YouTube captions as text</li>
        <li>Convert YouTube transcript to PDF</li>
        <li>No login required</li>
        <li>No ads or distractions</li>
        <li>Completely free to use</li>
        <li>Clean and readable transcript format</li>
      </ul>
    </section>


      </div>
    </main>
  );
}

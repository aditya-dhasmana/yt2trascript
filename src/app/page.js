"use client";

import { useState, useMemo, useRef } from "react";
import jsPDF from "jspdf";

// --- SEO METADATA (For Next.js App Router, move this to layout.js if needed) ---
// Note: In 'use client' files, metadata is handled via the <head> or layout.
// This is what Google crawls.

export default function Home() {
  // ================== STATE ==================
  const [videoUrl, setVideoUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [videoMeta, setVideoMeta] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, loading, success, no-transcript, error
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState("");

  const inputRef = useRef(null);

  // ================== VALIDATION LOGIC ==================
  const isValidYouTubeUrl = (url) => {
    const pattern = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?].*)?$/;
    return pattern.test(url);
  };

  const isUrlValid = useMemo(() => {
    if (!videoUrl) return true;
    return isValidYouTubeUrl(videoUrl);
  }, [videoUrl]);

  // ================== CORE LOGIC ==================
  async function handleGetTranscript() {
    if (!isValidYouTubeUrl(videoUrl)) return;

    setStatus("loading");
    setLoadingStep("Identifying video...");
    setError("");
    setTranscript("");

    try {
      const videoId = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
      
      // Step 1: Fetch Meta (SEO/UI)
      const oEmbedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
      );
      if (oEmbedRes.ok) {
        const meta = await oEmbedRes.json();
        setVideoMeta({ title: meta.title, thumbnail: meta.thumbnail_url });
      }

      // Step 2: Try Client-Side Bypass (Fast & Free)
      setLoadingStep("Scanning for captions...");
      let transcriptXML = null;
      try {
        const embedRes = await fetch(`https://www.youtube.com/embed/${videoId}`);
        const html = await embedRes.text();
        const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
        
        if (match) {
          const playerResponse = JSON.parse(match[1]);
          const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (tracks && tracks.length > 0) {
            const track = tracks.find(t => t.languageCode === "en") || tracks[0];
            const captionRes = await fetch(track.baseUrl);
            transcriptXML = await captionRes.text();
          }
        }
      } catch (e) {
        console.log("Client-side block, falling back to Server AI...");
      }

      // Step 3: Call Master Backend (Queue + Gemini AI)
      setLoadingStep(transcriptXML ? "Finalizing text..." : "Using AI to extract transcript...");
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:10000";

      const res = await fetch(`${BACKEND_URL}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, transcriptXML }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");

      // Format & Set Result
      const text = data.transcript.map(t => t.text?.trim() || "").join(" ");
      if (!text) throw new Error("No transcript content found");

      setTranscript(text);
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  // ================== EXPORTS ==================
  function downloadTxt() {
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.txt";
    a.click();
  }

  // ================== UI COMPONENTS ==================
  return (
    <main className="min-h-screen bg-white text-zinc-900 selection:bg-zinc-200">
      
      {/* 1. HERO SECTION (CENTERED) */}
      <section className={`flex flex-col items-center justify-center px-6 transition-all duration-700 ${status === 'idle' ? 'min-h-screen' : 'pt-20 pb-10'}`}>
        <div className="w-full max-w-2xl">
          
          <header className="text-center mb-10">
            <h1 className="text-5xl font-bold tracking-tighter sm:text-6xl mb-4">Transcript.</h1>
            <p className="text-zinc-500 font-light text-lg">Convert any YouTube video to clean text instantly.</p>
          </header>

          {/* INPUT AREA */}
          <div className="relative group">
            <div className={`flex flex-col sm:flex-row items-center gap-2 p-2 border rounded-3xl transition-all duration-300 ${!isUrlValid && videoUrl ? 'border-red-400 bg-red-50/30' : 'border-zinc-200 bg-white shadow-2xl shadow-zinc-200/30 focus-within:border-zinc-400'}`}>
              <div className="relative flex-1 w-full">
                <input
                  ref={inputRef}
                  className="w-full bg-transparent px-5 py-4 outline-none text-lg"
                  placeholder="Paste YouTube or Shorts link..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                {videoUrl && (
                  <button 
                    onClick={() => { setVideoUrl(""); setStatus("idle"); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-900 p-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <button
                onClick={handleGetTranscript}
                disabled={!videoUrl || !isUrlValid || status === "loading"}
                className="w-full sm:w-auto bg-zinc-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-black transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed"
              >
                {status === "loading" ? "Processing..." : "Get Text"}
              </button>
            </div>
            {!isUrlValid && videoUrl && (
              <p className="absolute -bottom-7 left-6 text-red-500 text-xs font-medium animate-in slide-in-from-top-1">Invalid YouTube URL</p>
            )}
          </div>

          {/* LOADING STATE */}
          {status === "loading" && (
            <div className="mt-16 text-center animate-in fade-in">
              <div className="inline-block w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mb-4"></div>
              <p className="text-zinc-400 text-sm tracking-widest uppercase font-medium">{loadingStep}</p>
            </div>
          )}
        </div>
      </section>

      {/* 2. RESULTS SECTION */}
      {status === "success" && (
        <section className="max-w-5xl mx-auto px-6 pb-24 animate-in slide-in-from-bottom-10 duration-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Meta Sidebar */}
            <div className="md:col-span-1">
              <div className="bg-white border border-zinc-100 p-4 rounded-3xl shadow-sm sticky top-10">
                <img src={videoMeta?.thumbnail} className="rounded-2xl mb-4 w-full aspect-video object-cover" alt="Thumbnail" />
                <h3 className="font-bold text-zinc-900 leading-tight mb-6">{videoMeta?.title}</h3>
                <div className="space-y-3">
                  <button onClick={downloadTxt} className="w-full bg-zinc-900 text-white py-3 rounded-xl font-semibold text-sm hover:shadow-lg transition">Download .TXT</button>
                  <button onClick={() => window.print()} className="w-full bg-zinc-100 text-zinc-600 py-3 rounded-xl font-semibold text-sm hover:bg-zinc-200 transition">Print PDF</button>
                </div>
              </div>
            </div>
            {/* Transcript Area */}
            <div className="md:col-span-2">
              <div className="bg-zinc-50 rounded-3xl p-8 sm:p-12 border border-zinc-100 shadow-inner">
                <p className="text-zinc-800 leading-relaxed text-lg whitespace-pre-wrap selection:bg-yellow-200">
                  {transcript}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. SEO CONTENT SECTION */}
      <article className="max-w-4xl mx-auto px-6 py-24 border-t border-zinc-100 mt-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 text-zinc-600">
          <div>
            <h2 className="text-zinc-900 font-bold text-2xl mb-4">The Smartest Way to Subtitle.</h2>
            <p className="leading-relaxed">
              Our 2026 AI engine bypasses standard extraction limits by using a <strong>dual-layered fallback system</strong>. If the video has captions, we fetch them; if not, Gemini AI "listens" to the video to generate them for you.
            </p>
          </div>
          <div className="space-y-6">
            <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Capabilities</h2>
            <ul className="space-y-4 text-sm font-medium">
              <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 bg-zinc-900 rounded-full" /> YouTube Shorts Support</li>
              <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 bg-zinc-900 rounded-full" /> No Login Required</li>
              <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 bg-zinc-900 rounded-full" /> High-Accuracy AI (Gemini 1.5)</li>
            </ul>
          </div>
        </div>
      </article>

      <footer className="py-10 text-center text-zinc-300 text-[10px] uppercase tracking-tighter">
        &copy; 2026 Transcript Pro • Advanced Data Extraction
      </footer>
    </main>
  );
}
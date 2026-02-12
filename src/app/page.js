"use client";
import { useState, useRef } from "react";
import jsPDF from "jspdf";

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [videoMeta, setVideoMeta] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [loadingStep, setLoadingStep] = useState("");

  const handleGetTranscript = async () => {
    setStatus("loading");
    setLoadingStep("Fetching video details...");
    
    try {
      const videoId = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
      if (!videoId) throw new Error("Invalid YouTube Link");

      // Step 1: Meta
      const oEmbedRes = await fetch(`https://www.youtube.com/oembed?url=${videoUrl}&format=json`);
      const meta = await oEmbedRes.json();
      setVideoMeta({ title: meta.title, thumbnail: meta.thumbnail_url });

      // Step 2: Attempt Frontend Extraction (Fastest)
      setLoadingStep("Checking for captions...");
      let transcriptXML = null;
      try {
        const embedRes = await fetch(`https://www.youtube.com/embed/${videoId}`);
        const html = await embedRes.text();
        const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
        if (match) {
          const playerResponse = JSON.parse(match[1]);
          const track = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.[0];
          if (track) {
            const capRes = await fetch(track.baseUrl);
            transcriptXML = await capRes.text();
          }
        }
      } catch (e) { console.log("Frontend fetch blocked by CORS, switching to Server AI..."); }

      // Step 3: Server Call (AI Fallback)
      setLoadingStep(transcriptXML ? "Finalizing text..." : "AI is generating transcript...");
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, transcriptXML }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const text = data.transcript.map(t => t.text).join(" ");
      setTranscript(text);
      setStatus("success");
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-zinc-200 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Glass Header */}
        <div className="text-center py-12 animate-in fade-in slide-in-from-top-4 duration-1000">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 to-zinc-500 mb-4">
            Transcript Pro
          </h1>
          <p className="text-zinc-500 text-lg">AI-Powered YouTube Extraction • Free Forever</p>
        </div>

        {/* Input Section */}
        <div className="bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-white flex flex-col sm:flex-row gap-2 mb-8">
          <input
            className="flex-1 bg-transparent px-6 py-4 outline-none text-lg text-zinc-800"
            placeholder="Paste YouTube Link (Watch, Shorts, or Live)..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
          <button
            onClick={handleGetTranscript}
            disabled={status === "loading"}
            className="bg-zinc-900 text-white px-8 py-4 rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {status === "loading" ? "Processing..." : "Extract Now"}
          </button>
        </div>

        {/* Loading State */}
        {status === "loading" && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-zinc-900 mb-4"></div>
            <p className="text-zinc-600 font-medium animate-pulse">{loadingStep}</p>
          </div>
        )}

        {/* Results Card */}
        {status === "success" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in zoom-in-95 duration-500">
            <div className="md:col-span-1">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 sticky top-8">
                <img src={videoMeta?.thumbnail} className="rounded-xl mb-4 w-full aspect-video object-cover" />
                <h2 className="font-bold text-zinc-800 leading-tight mb-4">{videoMeta?.title}</h2>
                <div className="space-y-2">
                  <button onClick={() => window.print()} className="w-full py-2 bg-zinc-100 rounded-lg text-sm font-bold hover:bg-zinc-200 transition">Print Page</button>
                  <button onClick={() => setStatus("idle")} className="w-full py-2 text-zinc-400 text-sm hover:text-zinc-900 transition">Clear</button>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg border border-zinc-100 overflow-hidden">
                <div className="p-4 bg-zinc-50 border-b flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Transcript Text</span>
                  <div className="flex gap-2">
                    <button onClick={() => navigator.clipboard.writeText(transcript)} className="text-xs px-3 py-1 bg-white border rounded-md hover:shadow-sm">Copy</button>
                  </div>
                </div>
                <div className="p-8 max-h-[600px] overflow-y-auto leading-relaxed text-zinc-700 whitespace-pre-wrap">
                  {transcript}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
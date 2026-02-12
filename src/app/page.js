"use client";
import { useState } from "react";

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle, loading, success
  const [transcript, setTranscript] = useState("");

  return (
    // This outer div handles the perfect centering
    <main className="min-h-screen w-full bg-white flex items-center justify-center p-6 sm:p-12">
      
      {/* Container: Max width keeps it from stretching too far on desktop */}
      <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-700">
        
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            Transcript.
          </h1>
          <p className="mt-4 text-lg text-zinc-500 font-light">
            Convert any YouTube video to text instantly.
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-3 shadow-2xl shadow-zinc-200/50 flex flex-col sm:flex-row items-center gap-2 transition-all focus-within:border-zinc-400">
          <input
            className="w-full bg-transparent px-5 py-3 outline-none text-zinc-800 placeholder-zinc-400 text-lg"
            placeholder="Paste YouTube link here..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
          <button
            onClick={() => setStatus("loading")}
            disabled={!videoUrl || status === "loading"}
            className="w-full sm:w-auto bg-zinc-900 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-black transition-all active:scale-95 disabled:opacity-20"
          >
            {status === "loading" ? "Processing..." : "Extract"}
          </button>
        </div>

        {/* Status / Loading State */}
        {status === "loading" && (
          <div className="mt-12 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin"></div>
            <p className="mt-4 text-zinc-400 text-sm tracking-widest uppercase">System Working...</p>
          </div>
        )}

        {/* Success View */}
        {status === "success" && (
          <div className="mt-12 space-y-6 animate-in slide-in-from-bottom-8 duration-500">
             <div className="bg-zinc-50 rounded-3xl p-8 border border-zinc-100 shadow-inner">
                <p className="text-zinc-700 leading-relaxed whitespace-pre-wrap">
                  {transcript || "Your transcript will appear here..."}
                </p>
             </div>
             <div className="flex justify-center gap-4">
               <button className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition">Download TXT</button>
               <button onClick={() => setStatus("idle")} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition">Start Over</button>
             </div>
          </div>
        )}

      </div>
    </main>
  );
}
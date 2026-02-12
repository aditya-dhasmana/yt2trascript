"use client";
import { useState, useMemo } from "react";

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("idle");
  const [targetLang, setTargetLang] = useState("English");
  const [loadingStep, setLoadingStep] = useState("");

  const langs = ["English", "Spanish", "French", "Hindi", "German", "Japanese"];

  const isValid = useMemo(() => {
    if (!videoUrl) return true;
    return /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/.test(videoUrl);
  }, [videoUrl]);

  const handleExtract = async () => {
    setStatus("loading");
    setLoadingStep("Connecting to AI...");
    
    try {
      const videoId = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
      let transcriptXML = null;

      // Fast-path: Check for native captions first
      try {
        const embedRes = await fetch(`https://www.youtube.com/embed/${videoId}`);
        const html = await embedRes.text();
        const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
        if (match) {
          const tracks = JSON.parse(match[1])?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (tracks) {
            const capRes = await fetch(tracks[0].baseUrl);
            transcriptXML = await capRes.text();
          }
        }
      } catch (e) { console.log("CORS bypass active"); }

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, transcriptXML, targetLang }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error();

      setTranscript(data.transcript.map(t => t.text).join(" "));
      setStatus("success");
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen bg-white text-zinc-900 flex flex-col items-center justify-center p-6 selection:bg-zinc-200">
      <div className="w-full max-w-2xl animate-in fade-in duration-700">
        
        <div className="text-center mb-10">
          <h1 className="text-6xl font-bold tracking-tighter mb-4">Transcript.</h1>
          <div className="flex justify-center gap-2 mb-8">
            {langs.map(l => (
              <button key={l} onClick={() => setTargetLang(l)} className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${targetLang === l ? 'bg-zinc-900 text-white border-zinc-900' : 'text-zinc-400 border-zinc-100'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className={`flex flex-col sm:flex-row gap-2 p-2 border rounded-3xl transition-all ${!isValid && videoUrl ? 'border-red-400' : 'border-zinc-200 shadow-2xl shadow-zinc-100'}`}>
          <div className="relative flex-1">
            <input className="w-full p-4 outline-none text-lg" placeholder="Paste link..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
            {videoUrl && <button onClick={() => {setVideoUrl(""); setStatus("idle");}} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300">✕</button>}
          </div>
          <button onClick={handleExtract} disabled={!isValid || !videoUrl || status === "loading"} className="bg-zinc-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-black transition-all disabled:opacity-20">
            {status === "loading" ? "Thinking..." : "Extract"}
          </button>
        </div>

        {status === "loading" && <p className="text-center mt-8 text-zinc-400 text-xs tracking-[0.2em] animate-pulse">{loadingStep}</p>}

        {status === "success" && (
          <div className="mt-12 animate-in slide-in-from-bottom-5 duration-500">
            <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-8 shadow-inner overflow-y-auto max-h-96">
              <p className="text-lg leading-relaxed text-zinc-700 whitespace-pre-wrap">{transcript}</p>
            </div>
            <div className="flex justify-center gap-6 mt-8">
              <button onClick={() => window.print()} className="text-xs font-bold uppercase text-zinc-400 hover:text-zinc-900">Print PDF</button>
              <button onClick={() => setStatus("idle")} className="text-xs font-bold uppercase text-zinc-400 hover:text-zinc-900">New Video</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
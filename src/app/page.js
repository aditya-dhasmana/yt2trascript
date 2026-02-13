/**
 * FRONTEND: Next.js + Tailwind
 * LOCATION: app/page.js
 */
"use client";
import { useState } from "react";
import jsPDF from "jspdf"; // npm install jspdf

export default function Home() {
  // --- STATE ---
  const [videoUrl, setVideoUrl] = useState("");
  const [data, setData] = useState(null); // Stores {title, summary, transcript, videoId}
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [targetLang, setTargetLang] = useState("English");
  const [startTime, setStartTime] = useState(0); // For jumping video to specific seconds
  const [searchTerm, setSearchTerm] = useState("");

  // --- LOGIC: FETCH TRANSCRIPT ---
  const handleGetTranscript = async () => {
    if (!videoUrl) return;
    setStatus("loading");
    setData(null); // Reset UI

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, targetLang }),
      });
      
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error || "Server error");
      
      setData(result);
      setStatus("success");
    } catch (err) {
      console.error("Frontend Fetch Error:", err);
      setStatus("error");
    }
  };

  // --- LOGIC: TIMESTAMP JUMPING ---
  const seekTo = (ts) => {
    // Converts [01:30] into 90 seconds
    const match = ts.match(/\[(\d+):(\d+)\]/);
    if (match) {
      const sec = parseInt(match[1]) * 60 + parseInt(match[2]);
      setStartTime(sec);
    }
  };

  // --- LOGIC: PDF EXPORT ---
  const downloadPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const safeName = data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.setFontSize(14);
    doc.text(data.title, 10, 20);
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(data.transcript, 180);
    doc.text(splitText, 10, 30);
    doc.save(`${safeName}.pdf`);
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 p-6 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        
        {/* HEADER SECTION */}
        <header className="text-center mb-10 pt-10">
          <h1 className="text-6xl font-black tracking-tighter mb-4">Transcript.</h1>
          <p className="text-zinc-500 mb-8">Professional AI Video-to-Text Conversion</p>
          
          {/* SEARCH & INPUT BAR */}
          <div className="max-w-2xl mx-auto flex flex-col md:flex-row gap-2 bg-white p-2 rounded-3xl shadow-2xl border border-zinc-100">
            <input 
              className="flex-1 p-4 outline-none text-lg bg-transparent"
              placeholder="Paste YouTube Link Here..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <button 
              onClick={handleGetTranscript}
              disabled={status === "loading"}
              className="bg-black text-white px-10 py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-30"
            >
              {status === "loading" ? "Thinking..." : "Generate"}
            </button>
          </div>
        </header>

        {/* LOADING & ERROR STATES */}
        {status === "loading" && <div className="text-center font-bold text-zinc-400 animate-pulse tracking-widest uppercase text-xs">AI is reading the video...</div>}
        {status === "error" && <div className="text-center text-red-500 bg-red-50 p-4 rounded-xl border border-red-100 max-w-md mx-auto">The server had an issue. Please try a different video or check your API key.</div>}

        {/* MAIN RESULTS DASHBOARD */}
        {status === "success" && data && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
            
            {/* LEFT: VIDEO & SUMMARY */}
            <div className="lg:col-span-5 space-y-6">
              <div className="aspect-video rounded-3xl overflow-hidden shadow-2xl bg-black border border-white">
                <iframe 
                  key={startTime} // Using key=startTime forces a refresh so the video jumps to the new time
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${data.videoId}?start=${startTime}&autoplay=1`}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
              <div className="bg-zinc-900 text-white p-8 rounded-3xl">
                <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mb-4">Executive Summary</h3>
                <p className="text-lg leading-relaxed italic">"{data.summary}"</p>
              </div>
            </div>

            {/* RIGHT: SEARCHABLE TRANSCRIPT */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden h-[650px] flex flex-col">
              <div className="p-6 border-b flex items-center justify-between gap-4 bg-zinc-50/50">
                <input 
                  className="flex-1 bg-white border px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 ring-zinc-100"
                  placeholder="Filter transcript..."
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button onClick={downloadPDF} className="bg-white border text-[10px] font-bold px-4 py-2 rounded-xl hover:bg-zinc-50 uppercase">.PDF</button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                <h2 className="text-2xl font-bold tracking-tight mb-6">{data.title}</h2>
                
                {/* SAFETY LOGIC: Check if transcript exists before calling .split */}
                {data?.transcript?.split('\n').map((line, i) => {
                  const ts = line.match(/\[\d+:\d+\]/);
                  const isVisible = !searchTerm || line.toLowerCase().includes(searchTerm.toLowerCase());

                  if (!isVisible) return null;

                  return (
                    <div key={i} className="flex gap-4 group">
                      {ts && (
                        <button 
                          onClick={() => seekTo(ts[0])}
                          className="text-blue-500 font-mono text-xs font-bold hover:underline shrink-0 pt-1"
                        >
                          {ts[0]}
                        </button>
                      )}
                      <p className="text-zinc-600 text-sm leading-relaxed">
                        {line.replace(ts?.[0] || "", "")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
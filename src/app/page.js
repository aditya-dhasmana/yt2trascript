/**
 * FRONTEND: Next.js + Tailwind CSS
 * FEATURES: Search, Timestamps, Video Player, PDF/TXT Export
 */
"use client";
import { useState, useMemo } from "react";
import jsPDF from "jspdf";

export default function Home() {
  // --- STATE MANAGEMENT ---
  const [videoUrl, setVideoUrl] = useState("");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("idle");
  const [targetLang, setTargetLang] = useState("English");
  const [searchTerm, setSearchTerm] = useState(""); // For the internal transcript search
  const [startTime, setStartTime] = useState(0); // Controls the video jump

  // --- LOGIC: TIMESTAMP JUMPING ---
  const seekTo = (ts) => {
    const match = ts.match(/\[(\d+):(\d+)\]/);
    if (match) {
      const seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
      setStartTime(seconds);
      // We don't need a separate API for the player; 
      // changing the 'key' or 'src' of the iframe triggers a jump.
    }
  };

  // --- LOGIC: FETCHING DATA ---
  const handleProcess = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, targetLang }),
      });
      const result = await res.json();
      setData(result);
      setStatus("success");
    } catch (e) { setStatus("error"); }
  };

  // --- LOGIC: DYNAMIC FILE EXPORT ---
  const exportFile = (format) => {
    const fileName = data.title.replace(/\s+/g, '_').toLowerCase();
    if (format === 'txt') {
      const blob = new Blob([data.transcript], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.txt`;
      a.click();
    } else {
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(data.title, 10, 20);
      doc.setFontSize(10);
      const wrappedText = doc.splitTextToSize(data.transcript, 180);
      doc.text(wrappedText, 10, 30);
      doc.save(`${fileName}.pdf`);
    }
  };

  return (
    <main className="min-h-screen bg-white text-zinc-900 p-4 md:p-12 selection:bg-yellow-100">
      <div className="max-w-6xl mx-auto">
        
        {/* SECTION 1: HEADER & INPUT */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-black tracking-tighter mb-4">Transcript.</h1>
          <div className="max-w-2xl mx-auto flex flex-col md:flex-row gap-2 bg-zinc-50 p-2 rounded-3xl border border-zinc-100 shadow-xl">
            <input 
              className="flex-1 bg-transparent p-4 outline-none text-lg"
              placeholder="Paste YouTube Link..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <select 
              className="bg-white px-4 py-2 rounded-2xl text-xs font-bold uppercase border border-zinc-200"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
            >
              {["English", "Spanish", "French", "Hindi", "German"].map(l => <option key={l}>{l}</option>)}
            </select>
            <button onClick={handleProcess} className="bg-black text-white px-8 py-4 rounded-2xl font-bold hover:bg-zinc-800 transition">Get</button>
          </div>
        </header>

        {/* SECTION 2: THE DASHBOARD (Only shows on success) */}
        {status === "success" && data && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-1000">
            
            {/* LEFT COLUMN: PLAYER & SUMMARY (5/12 width) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="aspect-video rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 bg-black">
                <iframe 
                  key={startTime} // Changing key forces iframe to reload at new 'start' time
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${data.videoId}?start=${startTime}&autoplay=1`}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
              <div className="bg-zinc-900 text-white p-8 rounded-3xl shadow-xl">
                <h3 className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-4">AI Insight</h3>
                <p className="text-lg font-medium leading-relaxed italic">"{data.summary}"</p>
              </div>
            </div>

            {/* RIGHT COLUMN: SEARCHABLE TRANSCRIPT (7/12 width) */}
            <div className="lg:col-span-7 flex flex-col bg-white border border-zinc-100 rounded-3xl shadow-2xl overflow-hidden h-[650px]">
              
              {/* Transcript Toolbar */}
              <div className="p-6 border-b border-zinc-50 flex justify-between items-center gap-4 bg-zinc-50/50">
                <input 
                  className="flex-1 bg-white border border-zinc-200 px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 ring-zinc-100"
                  placeholder="Search words in transcript..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => exportFile('txt')} className="p-2 text-[10px] font-bold uppercase border rounded-lg bg-white">.TXT</button>
                  <button onClick={() => exportFile('pdf')} className="p-2 text-[10px] font-bold uppercase border rounded-lg bg-white">.PDF</button>
                </div>
              </div>

              {/* Scrollable Transcript List */}
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                <h2 className="text-2xl font-bold mb-6 tracking-tight">{data.title}</h2>
                {data.transcript.split('\n').filter(line => line.trim() !== "").map((line, i) => {
                  const tsMatch = line.match(/\[\d+:\d+\]/);
                  const isMatch = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());

                  return (
                    <div key={i} className={`group flex gap-4 p-2 rounded-xl transition-colors ${isMatch ? 'bg-yellow-50 ring-1 ring-yellow-200' : 'hover:bg-zinc-50'}`}>
                      {tsMatch && (
                        <button 
                          onClick={() => seekTo(tsMatch[0])}
                          className="font-mono text-xs font-bold text-blue-500 hover:text-blue-700 shrink-0 mt-1"
                        >
                          {tsMatch[0]}
                        </button>
                      )}
                      <p className="text-sm leading-relaxed text-zinc-600">
                        {line.replace(tsMatch?.[0] || "", "")}
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
// page.js
"use client";
import { useState } from "react";
import jsPDF from "jspdf"; // npm install jspdf

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [data, setData] = useState(null); // Stores Title, Summary, Transcript
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [targetLang, setTargetLang] = useState("English");

  const languages = ["English", "Spanish", "French", "Hindi", "German", "Japanese"];

  const handleGetTranscript = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, targetLang }),
      });
      
      if (!res.ok) throw new Error("Failed to fetch");
      const result = await res.json();
      setData(result);
      setStatus("success");
    } catch (err) {
      setStatus("error");
    }
  };

  // FRONTEND FILE GENERATION (Privacy-safe and Fast)
  const handleDownload = (type) => {
    // Dynamic naming: sanitized title + _transcript
    const fileName = data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + "_transcript";

    if (type === 'txt') {
      const element = document.createElement("a");
      const file = new Blob([data.transcript], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `${fileName}.txt`;
      document.body.appendChild(element);
      element.click();
    } else if (type === 'pdf') {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(data.title, 10, 20); // Add Title to PDF
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(data.transcript, 180); // Wrap text to fit page
      doc.text(splitText, 10, 40);
      doc.save(`${fileName}.pdf`);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 p-6 md:p-12 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        
        {/* HERO SECTION */}
        <div className="text-center mb-10">
          <h1 className="text-6xl font-black tracking-tighter mb-4">Transcript.</h1>
          <p className="text-zinc-500 font-medium">AI-powered extraction, translation, and summaries.</p>
        </div>

        {/* INPUT & LANGUAGE SECTION */}
        <div className="bg-white p-4 rounded-3xl shadow-xl border border-zinc-100 mb-8">
          <div className="flex flex-col md:flex-row gap-3">
            <input 
              className="flex-1 p-4 bg-zinc-100 rounded-2xl outline-none focus:ring-2 ring-zinc-200 transition-all"
              placeholder="Paste YouTube Link (e.g., https://youtube.com/watch?v=...)"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <select 
              className="p-4 bg-zinc-100 rounded-2xl font-bold text-xs uppercase cursor-pointer"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
            >
              {languages.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <button 
              onClick={handleGetTranscript}
              disabled={status === "loading" || !videoUrl}
              className="bg-black text-white px-8 py-4 rounded-2xl font-bold hover:scale-105 transition-all disabled:opacity-30"
            >
              {status === "loading" ? "Processing..." : "Generate"}
            </button>
          </div>
        </div>

        {/* RESULTS GRID */}
        {status === "success" && data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
            
            {/* LEFT: VIDEO PLAYER & SUMMARY */}
            <div className="space-y-6">
              <div className="aspect-video rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                <iframe 
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${data.videoId}`}
                  allowFullScreen
                />
              </div>
              <div className="bg-zinc-900 text-white p-8 rounded-3xl shadow-lg">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">AI Summary</h3>
                <p className="text-lg leading-relaxed font-medium italic opacity-90">"{data.summary}"</p>
              </div>
            </div>

            {/* RIGHT: TRANSCRIPT & DOWNLOADS */}
            <div className="flex flex-col">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-zinc-100 flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                   <h2 className="text-2xl font-bold tracking-tight">{data.title}</h2>
                   <div className="flex gap-2">
                     <button onClick={() => handleDownload('txt')} className="p-2 hover:bg-zinc-100 rounded-lg text-xs font-bold">.TXT</button>
                     <button onClick={() => handleDownload('pdf')} className="p-2 hover:bg-zinc-100 rounded-lg text-xs font-bold">.PDF</button>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[400px] pr-4 text-zinc-600 leading-relaxed whitespace-pre-wrap text-sm">
                  {data.transcript}
                </div>
              </div>
            </div>

          </div>
        )}

        {status === "error" && (
          <p className="text-center text-red-500 font-bold mt-4 italic">Something went wrong. Please check your link or try again later.</p>
        )}
      </div>
    </main>
  );
}
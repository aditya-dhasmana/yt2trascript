/**
 * FRONTEND: Next.js + Tailwind
 * PURPOSE: Dashboard with Video, Search, and Timestamps
 */
"use client";
import { useState } from "react";
import jsPDF from "jspdf";

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("idle");
  const [targetLang, setTargetLang] = useState("English");
  const [startTime, setStartTime] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const handleGet = async () => {
    setStatus("loading");
    setData(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, targetLang }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setData(result);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const seekTo = (ts) => {
    const match = ts.match(/\[(\d+):(\d+)\]/);
    if (match) setStartTime(parseInt(match[1]) * 60 + parseInt(match[2]));
  };

  return (
    <main className="min-h-screen bg-zinc-50 p-4 md:p-10 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <header className="text-center mb-10">
          <h1 className="text-5xl font-black mb-4 tracking-tighter">Transcript.</h1>
          <div className="max-w-xl mx-auto flex flex-col md:flex-row gap-2 bg-white p-2 rounded-2xl shadow-lg border">
            <input className="flex-1 p-3 outline-none" placeholder="YouTube Link..." value={videoUrl} onChange={(e)=>setVideoUrl(e.target.value)} />
            <button onClick={handleGet} className="bg-black text-white px-6 py-3 rounded-xl font-bold">Generate</button>
          </div>
        </header>

        {status === "loading" && <p className="text-center animate-pulse font-bold text-zinc-400">PROCESSING VIDEO...</p>}
        {status === "error" && <p className="text-center text-red-500 font-bold">Error: Check your API Key or Video URL.</p>}

        {status === "success" && data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="aspect-video rounded-2xl overflow-hidden shadow-xl bg-black">
                <iframe key={startTime} className="w-full h-full" src={`https://www.youtube.com/embed/${data.videoId}?start=${startTime}&autoplay=1`} allowFullScreen />
              </div>
              <div className="bg-zinc-900 text-white p-6 rounded-2xl">
                <h4 className="text-[10px] uppercase text-zinc-500 font-bold mb-2">Summary</h4>
                <p className="text-sm italic opacity-90">{data.summary}</p>
              </div>
            </div>

            <div className="bg-white border rounded-2xl flex flex-col h-[600px] overflow-hidden shadow-sm">
              <div className="p-4 border-b bg-zinc-50 flex justify-between">
                <input className="bg-white border px-3 py-1 rounded-lg text-xs outline-none" placeholder="Search..." onChange={(e)=>setSearchTerm(e.target.value)} />
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <h2 className="font-bold text-xl">{data.title}</h2>
                {data?.transcript?.split('\n').map((line, i) => {
                  const ts = line.match(/\[\d+:\d+\]/);
                  if (searchTerm && !line.toLowerCase().includes(searchTerm.toLowerCase())) return null;
                  return (
                    <div key={i} className="flex gap-4 text-sm">
                      {ts && <button onClick={()=>seekTo(ts[0])} className="text-blue-500 font-bold shrink-0">{ts[0]}</button>}
                      <span className="text-zinc-600">{line.replace(ts?.[0] || "", "")}</span>
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
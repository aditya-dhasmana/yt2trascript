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
  const [downloadFormat, setDownloadFormat] = useState("txt"); // Default format

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

  const downloadTranscript = () => {
    if (!data) return;
    const fileName = `transcript_${data.title.replace(/\s+/g, '_').toLowerCase()}`;

    if (downloadFormat === "txt") {
      // Logic for .txt download
      const element = document.createElement("a");
      const file = new Blob([data.transcript], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `${fileName}.txt`;
      document.body.appendChild(element);
      element.click();
    } else {
      // Logic for .pdf download using jsPDF
      const doc = new jsPDF();
      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth() - (margin * 2);
      
      doc.setFontSize(16);
      doc.text(data.title, margin, 20);
      doc.setFontSize(10);
      
      // splitTextToSize handles long lines so they don't bleed off the page
      const splitText = doc.splitTextToSize(data.transcript, pageWidth);
      doc.text(splitText, margin, 35);
      doc.save(`${fileName}.pdf`);
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
          <h1 className="text-5xl font-black mb-4 tracking-tighter italic">Transcript.</h1>
          <div className="max-w-xl mx-auto flex flex-col md:flex-row gap-2 bg-white p-2 rounded-2xl shadow-lg border">
            <input className="flex-1 p-3 outline-none" placeholder="YouTube Link..." value={videoUrl} onChange={(e)=>setVideoUrl(e.target.value)} />
            <button onClick={handleGet} className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-zinc-800 transition">Generate</button>
          </div>
        </header>

        {status === "loading" && <p className="text-center animate-pulse font-bold text-zinc-400">WATCHING VIDEO & TRANSCRIBING...</p>}
        {status === "error" && <p className="text-center text-red-500 font-bold">Error: Check your API Key or Video URL.</p>}

        {status === "success" && data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="aspect-video rounded-2xl overflow-hidden shadow-xl bg-black">
                <iframe key={startTime} className="w-full h-full" src={`https://www.youtube.com/embed/${data.videoId}?start=${startTime}&autoplay=1`} allowFullScreen />
              </div>
              <div className="bg-zinc-900 text-white p-6 rounded-2xl">
                <h4 className="text-[10px] uppercase text-zinc-500 font-bold mb-2 tracking-widest">Summary</h4>
                <p className="text-sm italic opacity-90 leading-relaxed">{data.summary}</p>
              </div>
            </div>

            <div className="bg-white border rounded-2xl flex flex-col h-[600px] overflow-hidden shadow-sm">
              <div className="p-4 border-b bg-zinc-50 flex justify-between items-center">
                <input className="bg-white border px-3 py-1 rounded-lg text-xs outline-none focus:ring-1 focus:ring-black" placeholder="Search transcript..." onChange={(e)=>setSearchTerm(e.target.value)} />
                
                {/* Format Selector and Download Button */}
                <div className="flex gap-2">
                  <select 
                    className="text-xs border rounded-lg px-2 bg-white outline-none cursor-pointer"
                    value={downloadFormat}
                    onChange={(e) => setDownloadFormat(e.target.value)}
                  >
                    <option value="txt">.TXT</option>
                    <option value="pdf">.PDF</option>
                  </select>
                  <button 
                    onClick={downloadTranscript}
                    className="bg-black text-white text-[10px] px-3 py-1.5 rounded-lg font-bold hover:bg-zinc-700 uppercase"
                  >
                    Download
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <h2 className="font-bold text-xl leading-tight">{data.title}</h2>
                {data?.transcript?.split('\n').map((line, i) => {
                  const ts = line.match(/\[\d+:\d+\]/);
                  if (searchTerm && !line.toLowerCase().includes(searchTerm.toLowerCase())) return null;
                  return (
                    <div key={i} className="flex gap-4 text-sm group">
                      {ts && <button onClick={()=>seekTo(ts[0])} className="text-blue-500 font-bold shrink-0 hover:underline">{ts[0]}</button>}
                      <span className="text-zinc-600 group-hover:text-black transition-colors">{line.replace(ts?.[0] || "", "")}</span>
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
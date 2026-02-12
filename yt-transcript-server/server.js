import express from "express";
import cors from "cors";
import Bottleneck from "bottleneck";
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. CONFIG & KEY POOL ---
const API_KEYS = [
  process.env.GEMINI_KEY_1,
  process.env.GEMINI_KEY_2,
  process.env.GEMINI_KEY_3
].filter(Boolean);

let keyIndex = 0;

// --- 2. THE QUEUE (Bottleneck) ---
const limiter = new Bottleneck({
  minTime: 2000, // 1 request every 2 seconds (safe for 15-30 RPM)
  maxConcurrent: 1
});

// --- 3. HELPER FUNCTIONS ---
function extractVideoId(url) {
  const reg = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&]+)/;
  const match = url.match(reg);
  return match ? match[1] : null;
}

function parseXMLCaptions(xml) {
  if (!xml) return [];
  const matches = [...xml.matchAll(/<text[^>]*>(.*?)<\/text>/g)];
  return matches.map((m) => ({
    text: m[1]
      .replace(/&amp;/g, "&").replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"').replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  }));
}

// --- 4. THE AI FALLBACK ENGINE ---
async function fetchFromGemini(videoId, modelName) {
  const currentKey = API_KEYS[keyIndex % API_KEYS.length];
  keyIndex++;

  const genAI = new GoogleGenerativeAI(currentKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const prompt = `Provide the transcript for this YouTube video: https://www.youtube.com/watch?v=${videoId}. Return ONLY the text.`;
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// --- 5. THE MASTER ROUTE ---
app.post("/transcript", async (req, res) => {
  const { videoUrl, transcriptXML } = req.body;
  const videoId = extractVideoId(videoUrl);

  if (!videoId) return res.status(400).json({ error: "Invalid URL" });

  try {
    // LAYER 1: Use XML if provided by frontend
    if (transcriptXML && transcriptXML.length > 50) {
      const transcript = parseXMLCaptions(transcriptXML);
      return res.json({ transcript, source: "frontend-xml" });
    }

    // LAYER 2: Fallback to Gemini via Queue
    const aiResult = await limiter.schedule(async () => {
      try {
        return await fetchFromGemini(videoId, "gemini-1.5-flash");
      } catch (e) {
        // LAYER 3: Fallback to Flash-Lite if Flash fails
        console.log("Flash failed, trying Lite...");
        return await fetchFromGemini(videoId, "gemini-1.5-flash-lite");
      }
    });

    // Format AI string into your existing array structure
    const formattedTranscript = [{ text: aiResult }];
    res.json({ transcript: formattedTranscript, source: "gemini-ai" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "All extraction methods failed." });
  }
});

app.listen(10000, () => console.log("System Online"));
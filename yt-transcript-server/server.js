import express from "express";
import cors from "cors";
import Bottleneck from "bottleneck";
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// 1. Setup API Key Pool
const API_KEYS = [
  process.env.GEMINI_KEY_1,
  process.env.GEMINI_KEY_2,
  process.env.GEMINI_KEY_3
].filter(Boolean);

let keyIndex = 0;

// 2. Rate Limiter (15-30 RPM safe zone)
const limiter = new Bottleneck({
  minTime: 2500, 
  maxConcurrent: 1
});

// 3. AI Extraction + Translation Logic
async function fetchFromGemini(videoId, modelName, targetLang = "English") {
  const currentKey = API_KEYS[keyIndex % API_KEYS.length];
  keyIndex++;

  const genAI = new GoogleGenerativeAI(currentKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const prompt = `
    1. Extract the full transcript for this video: https://www.youtube.com/watch?v=${videoId}.
    2. Translate the entire transcript into ${targetLang}.
    3. Return ONLY the final text in ${targetLang}. No intros, no outros.
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// 4. Main Route
app.post("/transcript", async (req, res) => {
  const { videoUrl, transcriptXML, targetLang } = req.body;
  const videoId = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];

  if (!videoId) return res.status(400).json({ error: "Invalid ID" });

  try {
    // LAYER 1: Immediate XML Parsing (If frontend found it and no translation needed)
    if (transcriptXML && (!targetLang || targetLang === "English")) {
      const matches = [...transcriptXML.matchAll(/<text[^>]*>(.*?)<\/text>/g)];
      const transcript = matches.map(m => ({ text: m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'") }));
      return res.json({ transcript, source: "xml" });
    }

    // LAYER 2: AI Fallback/Translation via Queue
    const aiResult = await limiter.schedule(async () => {
      try {
        return await fetchFromGemini(videoId, "gemini-1.5-flash", targetLang);
      } catch (e) {
        console.log("Switching to Flash-Lite...");
        return await fetchFromGemini(videoId, "gemini-1.5-flash-lite", targetLang);
      }
    });

    res.json({ transcript: [{ text: aiResult }], source: "gemini" });

  } catch (err) {
    res.status(500).json({ error: "System busy. Please try again in a moment." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Backend Active on Port ${PORT}`));
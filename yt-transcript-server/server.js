/**
 * BACKEND: Node.js + Express
 * SDK: @google/genai (2026 Modern)
 */
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize with your key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY_1 });

app.post("/transcript", async (req, res) => {
  const { videoUrl, targetLang } = req.body;
  const videoId = videoUrl?.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];

  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    /**
     * FIX: Use 'gemini-flash-latest' or 'gemini-3-flash-preview'.
     * 'gemini-3-flash' (without -preview) is not a valid API ID yet.
     */
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest", 
      contents: [{
        role: "user",
        parts: [{
          text: `
            Analyze this YouTube video: https://www.youtube.com/watch?v=${videoId}
            
            1. Extract a full timestamped transcript [MM:SS].
            2. Provide a Title and a 3-sentence Summary.
            3. Translate everything into ${targetLang || 'English'}.
            
            FORMAT:
            TITLE: [Title]
            SUMMARY: [Summary]
            TRANSCRIPT: [Text]
          `
        }]
      }]
    });

    // The new @google/genai SDK returns text as a property
    const text = response.text || "";

    const title = text.match(/TITLE:(.*?)(?=SUMMARY:)/s)?.[1]?.trim() || "Video Analysis";
    const summary = text.match(/SUMMARY:(.*?)(?=TRANSCRIPT:)/s)?.[1]?.trim() || "Summary not available.";
    const transcript = text.match(/TRANSCRIPT:(.*)/s)?.[1]?.trim() || text;

    res.json({ title, summary, transcript, videoId });

  } catch (err) {
    console.error("BACKEND ERROR:", err);
    // Return a clean error to the frontend
    res.status(500).json({ 
      error: `Gemini API Error: ${err.message}. If 404 persists, try changing the model to 'gemini-2.5-flash'.` 
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`-----------------------------------------------`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Using gemini-flash-latest alias`);
  console.log(`-----------------------------------------------`);
});
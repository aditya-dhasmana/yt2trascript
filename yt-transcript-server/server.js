/**
 * BACKEND: Node.js + Express
 * SDK: @google/genai (2026 Standard)
 */
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai"; // The new SDK
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize the new client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY_1 });

app.post("/transcript", async (req, res) => {
  const { videoUrl, targetLang } = req.body;
  const videoId = videoUrl?.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];

  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    /**
     * FIX: Use 'gemini-3-flash'. 
     * The new SDK handles the 'models/' prefix and versioning automatically.
     */
    const response = await ai.models.generateContent({
      model: "gemini-3-flash",
      contents: `
        Analyze this video: https://www.youtube.com/watch?v=${videoId}
        
        REQUIRED OUTPUT:
        1. Full transcript with [MM:SS] timestamps.
        2. A creative TITLE.
        3. A 3-sentence SUMMARY.
        4. All content must be in ${targetLang || 'English'}.
        
        FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
        TITLE: [Title]
        SUMMARY: [Summary]
        TRANSCRIPT: [Transcript with timestamps]
      `
    });

    // In the new SDK, response.text is a property, not a function
    const text = response.text;

    const title = text.match(/TITLE:(.*?)(?=SUMMARY:)/s)?.[1]?.trim() || "Transcript";
    const summary = text.match(/SUMMARY:(.*?)(?=TRANSCRIPT:)/s)?.[1]?.trim() || "No summary available.";
    const transcript = text.match(/TRANSCRIPT:(.*)/s)?.[1]?.trim() || text;

    res.json({ title, summary, transcript, videoId });

  } catch (err) {
    console.error("BACKEND ERROR:", err);
    res.status(500).json({ 
      error: `Gemini 3 Error: ${err.message}. Please verify your API Key in Google AI Studio.` 
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Gemini 3 Flash Server running on port ${PORT}`);
});
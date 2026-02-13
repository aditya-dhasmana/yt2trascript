/**
 * BACKEND: Node.js + Express
 * SDK: @google/genai (2026 Standard)
 */
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize the 2026 client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY_1 });

app.post("/transcript", async (req, res) => {
  const { videoUrl, targetLang } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: "No URL provided." });
  }

  try {
    /**
     * FIX 1: Use 'gemini-2.5-flash' or 'gemini-3-flash-preview'.
     * 'gemini-3-flash' (plain) often throws 404 if not using the preview ID.
     */
const response = await ai.models.generateContent({
  model: "gemini-3-flash-preview", 
  generationConfig: {
    temperature: 0.0,            // Zero randomness = Faster choice
    media_resolution: "low",      // 70 tokens per frame vs 258
    // CUSTOM 2026 SPEED HACK: Use video metadata to focus on audio
    video_metadata: {
      fps: 0.1                   // Only process 1 frame every 10s
    }
  },
  contents: [
    {
      fileData: {
        fileUri: videoUrl,
        mimeType: "video/mp4"
      }
    },
    { text:  ` Analyze this specific video. 
            1. Extract the full transcript with [MM:SS] timestamps.
            2. Create a Title and a 3-sentence Summary.
            3. Translate everything into ${targetLang || 'English'}.
            
            IMPORTANT: Do not summarize Llama 3.1 or AI news unless it is actually in this video.
            
            FORMAT:
            TITLE: [Title]
            SUMMARY: [Summary]
            TRANSCRIPT: [Text]
          
          "CRITICAL: Just output the transcript. No preamble. No analysis."` }
  ]
});
          

    const text = response.text || "";

    // Parsing the structured response
    const title = text.match(/TITLE:(.*?)(?=SUMMARY:)/s)?.[1]?.trim() || "Video Analysis";
    const summary = text.match(/SUMMARY:(.*?)(?=TRANSCRIPT:)/s)?.[1]?.trim() || "No summary available.";
    const transcript = text.match(/TRANSCRIPT:(.*)/s)?.[1]?.trim() || text;

    res.json({ title, summary, transcript });

  } catch (err) {
    console.error("BACKEND ERROR:", err);
    res.status(500).json({ 
      error: `Gemini API Error: ${err.message}. Check your API quota in Google AI Studio.` 
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} with YouTube Multimodal support.`);
});
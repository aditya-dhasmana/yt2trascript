/**
 * BACKEND: REAL transcript + Gemini formatting
 */

import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { YoutubeTranscript } from "youtube-transcript";
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_KEY_1
});

app.post("/transcript", async (req, res) => {

  const { videoUrl, targetLang } = req.body;

  const videoId = videoUrl?.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];

  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {

    // ✅ STEP 1 — FETCH REAL YOUTUBE TRANSCRIPT
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);

    const rawTranscript = transcriptData
      .map(item => {
        const minutes = Math.floor(item.offset / 60);
        const seconds = Math.floor(item.offset % 60);
        const timestamp =
          `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;

        return `[${timestamp}] ${item.text}`;
      })
      .join("\n");

    // ✅ STEP 2 — SEND REAL TEXT TO GEMINI
    const response = await ai.models.generateContent({

      model: "gemini-2.0-flash",

      contents: [{
        role: "user",
        parts: [{
          text: `
Here is a REAL YouTube transcript:

${rawTranscript}

TASK:

1. Create a short TITLE
2. Write a 3 sentence SUMMARY
3. Translate everything into ${targetLang || 'English'}

FORMAT:

TITLE:
SUMMARY:
TRANSCRIPT:
`
        }]
      }]
    });

    // safer text extraction
    const text =
      response?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "")
        .join("") || "";

    const title =
      text.match(/TITLE:(.*?)(?=SUMMARY:)/s)?.[1]?.trim()
      || "Video Analysis";

    const summary =
      text.match(/SUMMARY:(.*?)(?=TRANSCRIPT:)/s)?.[1]?.trim()
      || "Summary not available.";

    const transcript =
      text.match(/TRANSCRIPT:(.*)/s)?.[1]?.trim()
      || rawTranscript;

    res.json({ title, summary, transcript, videoId });

  } catch (err) {

    console.error("BACKEND ERROR:", err);

    res.status(500).json({
      error: "Failed to fetch transcript or Gemini formatting failed"
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

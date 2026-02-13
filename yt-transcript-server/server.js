/**
 * BACKEND: Node.js + Express
 * PURPOSE: Securely talks to Gemini 1.5 Flash
 */
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY_1);

app.post("/transcript", async (req, res) => {
  const { videoUrl, targetLang } = req.body;
  const videoId = videoUrl?.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];

  if (!videoId) return res.status(400).json({ error: "Invalid YouTube URL" });

  try {
    // 404 FIX: Using the direct model string for the production API
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
      Instructions for: https://www.youtube.com/watch?v=${videoId}
      1. Provide the full transcript with [MM:SS] timestamps at the start of paragraphs.
      2. Provide a 3-sentence summary and a title.
      3. Translate everything into ${targetLang || 'English'}.
      
      Format your response exactly like this:
      TITLE: [Title]
      SUMMARY: [Summary]
      TRANSCRIPT: [Transcript]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse the AI output
    const title = text.match(/TITLE:(.*?)(?=SUMMARY:)/s)?.[1]?.trim() || "Transcript";
    const summary = text.match(/SUMMARY:(.*?)(?=TRANSCRIPT:)/s)?.[1]?.trim() || "No summary available.";
    const transcript = text.match(/TRANSCRIPT:(.*)/s)?.[1]?.trim() || text;

    res.json({ title, summary, transcript, videoId });
  } catch (err) {
    console.error("BACKEND ERROR:", err.message);
    res.status(500).json({ error: `API Error: ${err.message}` });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
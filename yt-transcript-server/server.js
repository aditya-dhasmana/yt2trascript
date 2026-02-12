/**
 * BACKEND: Node.js + Express
 * PURPOSE: Handles AI logic and Key Rotation
 */
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// Load Gemini API Key from your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY_1);

app.post("/transcript", async (req, res) => {
  const { videoUrl, targetLang } = req.body;
  const videoId = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];

  if (!videoId) return res.status(400).json({ error: "Invalid YouTube URL" });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Updated Prompt to enforce [MM:SS] structure for the search/jump logic
    const prompt = `
      Instructions for https://www.youtube.com/watch?v=${videoId}:
      1. Extract the transcript with timestamps at the start of every new thought or paragraph.
      2. Use the exact format [MM:SS] for timestamps.
      3. Create a professional title and a 3-sentence summary.
      4. Translate everything into ${targetLang}.
      
      Output format:
      TITLE: [insert title]
      SUMMARY: [insert summary]
      TRANSCRIPT:
      [00:00] Initial introduction...
      [01:15] Key point about the topic...
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Parsing the structured AI response
    const title = text.match(/TITLE:(.*?)(?=SUMMARY:)/s)?.[1]?.trim() || "Video Transcript";
    const summary = text.match(/SUMMARY:(.*?)(?=TRANSCRIPT:)/s)?.[1]?.trim() || "";
    const transcript = text.match(/TRANSCRIPT:(.*)/s)?.[1]?.trim() || text;

    res.json({ title, summary, transcript, videoId });
  } catch (err) {
    res.status(500).json({ error: "AI Processing Error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Backend live on ${PORT}`));
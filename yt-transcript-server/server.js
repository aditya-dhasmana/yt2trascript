// server.js
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config'; // Loads your GEMINI_KEY_1 from .env

const app = express();
app.use(cors()); // Allows frontend to talk to this server
app.use(express.json());

// Initialize Gemini with your key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY_1);

app.post("/transcript", async (req, res) => {
  const { videoUrl, targetLang } = req.body;
  
  // Extract the 11-character Video ID using Regex
  const videoId = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
  if (!videoId) return res.status(400).json({ error: "Invalid YouTube URL" });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // The "Instruction" we send to the AI
    const prompt = `
      Extract the transcript for the video at this URL: https://www.youtube.com/watch?v=${videoId}.
      1. Create a short, catchy title for the content.
      2. Provide a 3-sentence summary of the main points.
      3. Translate the title, summary, and full transcript into ${targetLang}.
      
      Return the result EXACTLY in this format:
      TITLE: [insert title]
      SUMMARY: [insert summary]
      TRANSCRIPT: [insert full text]
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Split the AI response into usable pieces
    const title = text.match(/TITLE:(.*?)(?=SUMMARY:)/s)?.[1]?.trim() || "Transcript";
    const summary = text.match(/SUMMARY:(.*?)(?=TRANSCRIPT:)/s)?.[1]?.trim() || "";
    const transcript = text.match(/TRANSCRIPT:(.*)/s)?.[1]?.trim() || text;

    res.json({ title, summary, transcript, videoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI processing failed. Check your API key or video link." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
/**
 * BACKEND: Node.js + Express
 * LOCATION: Your server folder
 */
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config'; // Requires npm install dotenv

const app = express();

// Middleware
app.use(cors()); // Allows your Vercel frontend to access this API
app.use(express.json()); // Allows the server to read JSON bodies

// Initialize Gemini with the key from your Render Environment Variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY_1);

app.post("/transcript", async (req, res) => {
  const { videoUrl, targetLang } = req.body;

  // 1. Extract Video ID: Ensuring we have a valid 11-character YouTube ID
  const videoId = videoUrl?.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];

  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL provided." });
  }

  try {
    // 2. Select the Model: Flash 1.5 is the fastest and has a high free-tier quota
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // 3. The Instruction: We ask for a specific structure so we can parse it later
    const prompt = `
      Instructions for video: https://www.youtube.com/watch?v=${videoId}
      1. Extract the full transcript with [MM:SS] timestamps at the start of paragraphs.
      2. Create a professional title and a 3-sentence summary.
      3. Translate EVERYTHING (title, summary, transcript) into ${targetLang || 'English'}.
      
      Output format EXACTLY:
      TITLE: [title here]
      SUMMARY: [summary here]
      TRANSCRIPT: [text here]
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // 4. Parsing Logic: Extracting data between the markers we set in the prompt
    const title = text.match(/TITLE:(.*?)(?=SUMMARY:)/s)?.[1]?.trim() || "Video Transcript";
    const summary = text.match(/SUMMARY:(.*?)(?=TRANSCRIPT:)/s)?.[1]?.trim() || "No summary available.";
    const transcript = text.match(/TRANSCRIPT:(.*)/s)?.[1]?.trim() || text;

    // 5. Success Response
    res.json({ title, summary, transcript, videoId });

  } catch (err) {
    // 6. Error Handling: This shows up in your Render "Logs" tab
    console.error("CRITICAL BACKEND ERROR:", err.message);
    res.status(500).json({ 
      error: "Gemini failed to process this video. It might be too long, private, or restricted." 
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Backend is active on port ${PORT}`));
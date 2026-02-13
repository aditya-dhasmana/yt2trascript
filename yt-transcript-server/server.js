/**
 * BACKEND: Node.js + Express
 * MODEL: Gemini 3 Flash (Latest 2026 Stable)
 */
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const app = express();

// Middleware configuration
app.use(cors()); // Allows Vercel frontend to talk to this Render backend
app.use(express.json());

// Initialize the Google Generative AI with your key
// Ensure process.env.GEMINI_KEY_1 is set in your Render dashboard
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY_1);

app.post("/transcript", async (req, res) => {
  const { videoUrl, targetLang } = req.body;

  // Extract the 11-character YouTube ID
  const videoId = videoUrl?.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];

  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL provided." });
  }

  try {
    /**
     * FIX: We are using 'gemini-3-flash'. 
     * Older 'gemini-1.5-flash' now returns a 404 because it has been retired.
     */
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });

    // Refined prompt for Gemini 3's advanced multimodal reasoning
    const prompt = `
      Act as a professional transcriber. I am providing a YouTube link: https://www.youtube.com/watch?v=${videoId}
      
      Task:
      1. Extract the full transcript with [MM:SS] timestamps at the start of every new paragraph or speaker change.
      2. Create a compelling, click-worthy title.
      3. Write a high-level 3-sentence summary of the main takeaways.
      4. Translate the Title, Summary, and Transcript into ${targetLang || 'English'}.

      Output Format (STRICT):
      TITLE: [The Title]
      SUMMARY: [The Summary]
      TRANSCRIPT: [The full timestamped text]
    `;

    console.log(`Processing video: ${videoId} using Gemini 3 Flash...`);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Advanced Parsing: Using Regex to split the AI's response into our data structure
    const title = text.match(/TITLE:(.*?)(?=SUMMARY:)/s)?.[1]?.trim() || "Video Analysis";
    const summary = text.match(/SUMMARY:(.*?)(?=TRANSCRIPT:)/s)?.[1]?.trim() || "No summary generated.";
    const transcript = text.match(/TRANSCRIPT:(.*)/s)?.[1]?.trim() || text;

    // Send the data back to your Next.js frontend
    res.json({
      title,
      summary,
      transcript,
      videoId
    });

  } catch (err) {
    // This will print the specific reason for failure in your Render logs
    console.error("CRITICAL BACKEND ERROR:", err.message);
    
    res.status(500).json({ 
      error: `Gemini API Error: ${err.message}. Ensure you are using a modern model name like gemini-3-flash.` 
    });
  }
});

// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`-----------------------------------------------`);
  console.log(`🚀 Server active on port ${PORT}`);
  console.log(`🚀 Using Gemini 3 Flash logic`);
  console.log(`-----------------------------------------------`);
});
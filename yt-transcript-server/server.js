// ===============================
// IMPORTS
// ===============================

import express from "express";
import cors from "cors";
import axios from "axios";
import PQueue from "p-queue";

// ===============================
// APP INIT
// ===============================

const app = express();

app.use(cors());
app.use(express.json());

// ===============================
// GOD MODE REQUEST QUEUE
// Prevent YouTube rate limiting
// ===============================

const requestQueue = new PQueue({
  concurrency: 1,   // only 1 YouTube request at a time
  interval: 5000,   // wait 5 sec between requests
  intervalCap: 1
});

// ===============================
// RANDOM HEADERS (ANTI BOT)
// ===============================

function randomHeaders() {
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Mozilla/5.0 (X11; Linux x86_64)"
  ];

  return {
    "User-Agent": agents[Math.floor(Math.random() * agents.length)],
    "Accept-Language": "en-US,en;q=0.9"
  };
}

// ===============================
// EXTRACT VIDEO ID
// ===============================

function extractVideoId(url) {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/i
  );
  return match ? match[1] : null;
}

// ===============================
// PARSE XML CAPTIONS
// ===============================

function parseCaptions(xml) {
  const matches = [...xml.matchAll(/<text[^>]*>(.*?)<\/text>/g)];

  return matches.map(m => ({
    text: decodeURIComponent(
      m[1]
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#10;/g, " ")
    )
  }));
}

// ===============================
// API ROUTE
// ===============================

app.post("/transcript", async (req, res) => {

  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: "Video URL required" });
  }

  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {

    const result = await requestQueue.add(async () => {

      // direct caption endpoint
      const apiUrl =
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`;

      const response = await axios.get(apiUrl, {
        headers: randomHeaders(),
        timeout: 10000
      });

      if (!response.data) {
        return null;
      }

      return parseCaptions(response.data);
    });

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "No captions available" });
    }

    res.json({ transcript: result });

  } catch (err) {

    console.log("ERROR:", err.message);

    if (err.response?.status === 429) {
      return res.status(429).json({
        error: "Rate limited by YouTube. Try again shortly."
      });
    }

    res.status(500).json({ error: "Transcript fetch failed" });
  }
});

// ===============================
// HEALTH CHECK ROUTE
// ===============================

app.get("/", (req, res) => {
  res.send("ULTRA TRANSCRIPT API RUNNING");
});

// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`SERVER RUNNING ON ${PORT}`);
});

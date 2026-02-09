const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

function extractVideoId(url) {
  const reg =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&]+)/;
  const match = url.match(reg);
  return match ? match[1] : null;
}

app.post("/transcript", async (req, res) => {
  try {
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ error: "Missing videoUrl" });
    }

    const videoId = extractVideoId(videoUrl);

    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    // STEP 1: Get player response (NO scraping HTML)
    const player = await axios.post(
      "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      {
        videoId,
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20210721.00.00",
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
        },
      }
    );

    const tracks =
      player.data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!tracks || tracks.length === 0) {
      return res.status(404).json({ transcript: [] });
    }

    // STEP 2: choose English or first track
    const track =
      tracks.find((t) => t.languageCode === "en") || tracks[0];

    // STEP 3: fetch captions XML
    const captionRes = await axios.get(track.baseUrl);

    const xml = captionRes.data;

    // STEP 4: parse captions
    const matches = [...xml.matchAll(/<text[^>]*>(.*?)<\/text>/g)];

    const transcript = matches.map((m) => ({
      text: decodeURIComponent(
        m[1]
          .replace(/&amp;/g, "&")
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
      ),
    }));

    res.json({ transcript });
  } catch (err) {
    console.error(err.message);

    if (err.response?.status === 429) {
      return res
        .status(429)
        .json({ error: "YouTube temporary rate limit. Try again." });
    }

    res.status(500).json({ error: "Server error fetching transcript" });
  }
});

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON", PORT);
});

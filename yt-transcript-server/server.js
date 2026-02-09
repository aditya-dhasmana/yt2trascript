const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

function extractVideoId(url) {
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

app.post("/transcript", async (req, res) => {
  try {
    const { videoUrl } = req.body;

    const videoId = extractVideoId(videoUrl);

    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    // STEP 1 — get captions list
    const infoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const videoPage = await axios.get(infoUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    const captionsRegex =
      /"captionTracks":(\[.*?\])/;

    const match = videoPage.data.match(captionsRegex);

    if (!match) {
      return res.json({ transcript: [] });
    }

    const captionTracks = JSON.parse(match[1]);

    const captionUrl = captionTracks[0].baseUrl;

    // STEP 2 — fetch actual captions XML
    const captions = await axios.get(captionUrl);

    const xml = captions.data;

    // STEP 3 — parse XML manually (simple)
    const transcript = [...xml.matchAll(/<text.*?>(.*?)<\/text>/g)]
      .map((m) =>
        m[1]
          .replace(/&amp;/g, "&")
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
      );

    res.json({ transcript });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch transcript" });
  }
});

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON", PORT);
});

import express from "express";
import cors from "cors";


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

function parseXMLCaptions(xml) {
  if (!xml) return [];

  const matches = [...xml.matchAll(/<text[^>]*>(.*?)<\/text>/g)];

  return matches.map((m) => ({
    text: decodeURIComponent(
      m[1]
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
    ),
  }));
}

app.post("/transcript", async (req, res) => {
  try {
    const { videoUrl, transcriptXML } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ error: "Missing videoUrl" });
    }

    if (!transcriptXML) {
      return res
        .status(400)
        .json({ error: "Missing transcriptXML from frontend" });
    }

    const videoId = extractVideoId(videoUrl);

    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    // ⭐ parse transcript sent from frontend
    const transcript = parseXMLCaptions(transcriptXML);

    res.json({ transcript });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error processing transcript" });
  }
});

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON", PORT);
});

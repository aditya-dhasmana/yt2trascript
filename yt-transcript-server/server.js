// ===============================
// IMPORTS
// ===============================

import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();

app.use(cors());
app.use(express.json());

// ===============================
// HELPER FUNCTIONS
// ===============================

function extractVideoId(url) {

  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/watch\?v=)([^&]+)/);

  return match ? match[1] : null;
}

function decodeHtml(html) {

  const match = html.match(
    /ytInitialPlayerResponse\s*=\s*(\{.+?\});/);

  if (!match) return null;

  return JSON.parse(match[1]);
}

function parseXMLCaptions(xml) {

  const regex = /<text[^>]*>(.*?)<\/text>/g;

  const result = [];

  let match;

  while ((match = regex.exec(xml)) !== null) {

    const text = match[1]
      .replace(/&amp;/g,"&")
      .replace(/&lt;/g,"<")
      .replace(/&gt;/g,">")
      .replace(/&#39;/g,"'")
      .replace(/&quot;/g,'"');

    result.push({ text });
  }

  return result;
}

// ===============================
// API ROUTE
// ===============================

app.post("/transcript", async (req,res) => {

  try {

    const { videoUrl } = req.body;

    if(!videoUrl)
      return res.status(400).json({ error:"Video URL required" });

    console.log("Fetching transcript:", videoUrl);

    const videoId = extractVideoId(videoUrl);

    if(!videoId)
      return res.status(400).json({ error:"Invalid YouTube URL" });

    // fetch youtube page
    const htmlRes = await axios.get(
      `https://www.youtube.com/watch?v=${videoId}`);

    const playerResponse = decodeHtml(htmlRes.data);

    if(!playerResponse?.captions)
      return res.status(404).json({
        error:"No captions available"
      });

    const tracks =
      playerResponse.captions
      .playerCaptionsTracklistRenderer
      .captionTracks;

    const captionUrl = tracks[0].baseUrl;

    // fetch caption xml
    const xmlRes = await axios.get(captionUrl);

    const transcript = parseXMLCaptions(xmlRes.data);

    res.json({ transcript });

  } catch(err) {

    console.log(err);

    res.status(500).json({
      error:"Processing failed"
    });
  }

});

// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`ULTRA SERVER RUNNING ON ${PORT}`);
});

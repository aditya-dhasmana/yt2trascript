// ===============================
// IMPORTS
// ===============================

// Express = backend server framework
import express from "express";

// CORS = allows frontend (different domain like Vercel) to call this backend
import cors from "cors";

// spawn = used to run external programs (here: python + yt-dlp)
import { spawn } from "child_process";


// ===============================
// APP INITIALIZATION
// ===============================

const app = express();

// Enable CORS so frontend can access API
app.use(cors());

// Allow JSON request bodies
// (frontend sends { videoUrl: "..." })
app.use(express.json());


// ===============================
// CAPTION PARSER FUNCTION
// ===============================

/*
This function cleans subtitle text.

yt-dlp outputs subtitles in WEBVTT format like:

WEBVTT
00:00:00.000 --> 00:00:01.000
Hello world

We REMOVE:
- WEBVTT header
- timestamps
- empty lines
- numbering

And keep only actual spoken text.
*/

function parseCaptions(content) {

  // Split file into lines
  const lines = content.split("\n");

  const result = [];

  const PORT = process.env.PORT || 4000;

  for (let line of lines) {

    // Remove extra spaces
    line = line.trim();

    // Skip unwanted lines:
    if (
      !line ||                      // empty lines
      line.startsWith("WEBVTT") || // header
      line.includes("-->") ||      // timestamp lines
      /^\d+$/.test(line)           // subtitle numbering
    ) {
      continue;
    }

    // Save cleaned text
    result.push({ text: line });
  }

  return result;
}


// ===============================
// API ROUTE
// ===============================

/*
Frontend sends POST request:

POST /transcript
Body:
{
  videoUrl: "https://youtube.com/..."
}
*/

app.post("/transcript", (req, res) => {

  // Extract video URL from request
  const { videoUrl } = req.body;

  // Validate input
  if (!videoUrl) {
    return res.status(400).json({ error: "Video URL required" });
  }

  console.log("Fetching transcript:", videoUrl);


  // ===============================
  // yt-dlp COMMAND SETUP
  // ===============================

  /*
  We run:

  python -m yt_dlp [options]

  Options explained:

  -m yt_dlp
      run yt-dlp module

  --skip-download
      don't download video, only metadata/subtitles

  --write-auto-sub
      allow auto-generated captions

  --write-sub
      allow manual captions

  --sub-lang en.*
      match English subtitles

  --convert-subs vtt
      convert subtitles to WEBVTT format

  --print requested_subtitles
      print subtitle content to stdout instead of saving files
      (THIS is why we don't need filesystem anymore)
  */

  const args = [
    "-m",
    "yt_dlp",
    "--skip-download",
    "--write-auto-sub",
    "--write-sub",
    "--sub-lang",
    "en.*",
    "--convert-subs",
    "vtt",
    "--print",
    "requested_subtitles"
  ];

  // Spawn python process
  const py = spawn("python", [...args, videoUrl]);

  // Store output from yt-dlp
  let output = "";


  // ===============================
  // READ yt-dlp OUTPUT (stdout)
  // ===============================

  // Capture subtitle content printed by yt-dlp
  py.stdout.on("data", (data) => {
    output += data.toString();
  });


  // Log errors from yt-dlp
  py.stderr.on("data", (data) => {
    console.log("ERR:", data.toString());
  });


  // If python fails to start
  py.on("error", () => {
    return res.status(500).json({ error: "Python spawn failed" });
  });


  // ===============================
  // PROCESS AFTER yt-dlp FINISHES
  // ===============================

  py.on("close", () => {

    try {

      // If no subtitle output found
      if (!output) {
        return res.status(404).json({
          error: "No captions available"
        });
      }

      // Clean and parse captions
      const transcript = parseCaptions(output);

      // Send transcript back to frontend
      res.json({ transcript });

    } catch (e) {

      console.log("Parse error:", e);

      res.status(500).json({
        error: "Processing failed"
      });

    }

  });

});


// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(`ULTRA SERVER RUNNING ON ${PORT}`);
});

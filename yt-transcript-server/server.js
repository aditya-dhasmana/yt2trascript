// ===============================
// IMPORTS
// ===============================

// Express = backend server framework
import express from "express";

import path from "path";

// CORS = allows frontend (different domain like Vercel) to call this backend
import cors from "cors";

// spawn = used to run external programs (here: python + yt-dlp)
import { spawn } from "child_process";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// APP INITIALIZATION
// ===============================

const app = express();

// Enable CORS so frontend can access API
app.use(cors());

// Allow JSON request bodies
app.use(express.json());

// ===============================
// CAPTION PARSER FUNCTION
// ===============================

function parseCaptions(content) {
  const lines = content.split("\n");
  const result = [];

  for (let line of lines) {
    line = line.trim();
    if (
      !line ||
      line.startsWith("WEBVTT") ||
      line.includes("-->") ||
      /^\d+$/.test(line)
    ) continue;

    result.push({ text: line });
  }

  return result;
}

// ===============================
// API ROUTE
// ===============================

app.post("/transcript", (req, res) => {

  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: "Video URL required" });
  }

  console.log("Fetching transcript:", videoUrl);

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

  // ===============================
  // PYTHON PATH (FIXED FOR RENDER)
  // ===============================

  const pythonPath = process.env.RENDER
    ? "python3" // Render (Linux)
    : path.join(__dirname, ".venv", "Scripts", "python.exe"); // Local Windows

  const py = spawn(pythonPath, [...args, videoUrl]);

  let output = "";
  let responseSent = false;

  py.stdout.on("data", (data) => {
    output += data.toString();
  });

  py.stderr.on("data", (data) => {
    console.log("ERR:", data.toString());
  });

  py.on("error", (err) => {
    if (!responseSent) {
      responseSent = true;
      console.log("Python spawn failed:", err);
      return res.status(500).json({ error: "Python spawn failed" });
    }
  });

  py.on("close", () => {

    if (responseSent) return;

    try {

      if (!output) {
        responseSent = true;
        return res.status(404).json({ error: "No captions available" });
      }

      const transcript = parseCaptions(output);

      responseSent = true;
      res.json({ transcript });

    } catch (e) {

      if (!responseSent) {
        responseSent = true;
        console.log("Parse error:", e);
        res.status(500).json({ error: "Processing failed" });
      }

    }

  });

});

// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`ULTRA SERVER RUNNING ON ${PORT}`);
});

# YouTube Transcript Platform

A transcript-first YouTube tool with optional AI cleanup and summaries.

## Official architecture

There is one backend entry point: `yt-transcript-server/server.js`.

- Browser Mode is the primary V1 journey: a bookmarklet runs on the YouTube page and transfers transcript data directly to the website receiver with `postMessage`.
- The Next.js frontend owns the Browser Mode setup/receiver, transcript display, copy, and downloads.
- The Express backend owns validation, metadata, transcript providers, caching, and optional Gemini actions.
- Server Mode is a labeled fallback where Render contacts YouTube and may be blocked.
- The Chrome extension is optional and retains its independent raw transcript path.
- `TranscriptManager` owns provider order, fallback decisions, caching, and normalized errors.
- Transcript providers own communication with one transcript source.
- Gemini is optional. Missing Gemini configuration does not disable normal transcript extraction.

Browser Mode never calls `/api/transcript`; Render receives transcript text only when the user explicitly requests Clean, Summary, or Notes. The website form keeps `youtubeTranscriptProvider` as a server-side fallback. The optional extension does not import or bundle the `youtube-transcript` package.

```text
Browser Mode: YouTube page → bookmarklet → postMessage → website receiver
Server fallback: Website → Render → YouTube
Optional extension: YouTube page → extension service worker → YouTube captions
```

## Visible source ownership

Every transcript surface identifies who contacted YouTube:

- Browser Mode: user browser; backend YouTube fetch is **No**; Render is not used for raw transcript.
- Server Mode: Render backend; backend YouTube fetch is **Yes**; blocking risk is possible.
- Extension Mode: user browser/extension; backend YouTube fetch is **No**.

Development logs record only source metadata, video ID, provider, text length, and segment count. Full transcript text is never logged.

## Optional AI safety

Clean, Summary, and Notes are optional helpers. Missing/invalid configuration returns `AI_UNDER_DEVELOPMENT`; temporary provider, timeout, rate-limit, offline, and unknown failures return `AI_UNAVAILABLE`. The UI shows product-safe copy, restores the raw transcript, and leaves Copy/TXT/SRT available.

AI is not part of the core V1 success condition. A usable raw transcript is the core result.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Clean local setup

Frontend:

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Backend, in a second terminal:

```powershell
Set-Location yt-transcript-server
Copy-Item .env.example .env
npm ci
npm start
```

Open `http://localhost:3000`. The frontend uses `http://localhost:10000` from `.env.local`.

Browser Mode raw import, copy, TXT, and SRT work while the backend is stopped. The backend is needed only for AI actions and Server Mode fallback.

`YOUTUBE_API_KEY` is optional and improves metadata. `GEMINI_API_KEY` is optional and enables AI cleanup, summaries, and the explicitly enabled Gemini video fallback.

## API routes

- `GET /api/health`
- `POST /api/metadata`
- `POST /api/transcript`
- `POST /api/ai/clean`
- `POST /api/ai/summary`
- `POST /api/ai/notes`

## Verification commands

Frontend:

```powershell
npm run check
npm audit
```

Backend:

```powershell
Set-Location yt-transcript-server
npm run check
npm audit
```

Optional live YouTube smoke test, with the backend already running:

```powershell
npm run test:smoke -- --video=https://www.youtube.com/watch?v=M7lc1UVf-VE
```

Normal tests use mocks and do not call YouTube or Gemini.

Extension:

```powershell
Set-Location extension
npm ci
npm run check
npm audit
npm run package:zip
```

## Production configuration

Frontend environment:

```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend.example.com
NEXT_PUBLIC_SITE_URL=https://www.yt2trascript.in
```

Backend environment:

```env
NODE_ENV=production
CORS_ORIGINS=https://yt2trascript.in,https://www.yt2trascript.in
EXTENSION_ORIGINS=chrome-extension://YOUR_PUBLISHED_EXTENSION_ID
TRANSCRIPT_PROVIDER_PRIORITY=youtube-transcript
ENABLE_GEMINI_TRANSCRIPTION_FALLBACK=false
```

Deploy the backend before the frontend because the frontend calls the canonical `/api/*` routes. Follow `RELEASE_CHECKLIST.md` before declaring a release.

Works on videos with available captions. Some restricted, private, region-locked, live, or captionless videos may not work.

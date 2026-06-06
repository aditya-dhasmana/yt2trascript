# YouTube Transcript Platform

A transcript-first YouTube tool focused on fast transcript extraction, optional AI generation, and low API usage.

## Architecture

The app is split into two responsibilities:

- Frontend: URL input, transcript display, tabs, copy, TXT/PDF download, and explicit AI action buttons.
- Backend: metadata lookup, transcript provider routing, caching, and Gemini-powered clean transcript or summary generation.

## Local Setup

Create the frontend env file:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:10000
```

Create the backend env file in `yt-transcript-server`:

```env
PORT=10000
YOUTUBE_API_KEY=
GEMINI_API_KEY=
ENABLE_HEAVY_TRANSCRIPTION=false
CACHE_PROVIDER=memory
TRANSCRIPT_PROVIDER_PRIORITY=youtube-transcript
GEMINI_MODEL=gemini-2.5-flash
```

## Run Locally

Start the backend:

```bash
cd yt-transcript-server
npm start
```

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Backend Routes

- `POST /metadata`: fetch video metadata.
- `POST /transcript`: fetch the original transcript through the provider pipeline.
- `POST /ai/clean`: generate a clean transcript only after the user asks.
- `POST /ai/summary`: generate a summary only after the user asks.
- `GET /health`: inspect provider and cache configuration.

## Engineering Rhythm

The main pattern is provider routing.

Providers own how one source works. The manager owns order, cache lookup, fallback, and normalized errors. This keeps business logic stable when new providers like Supadata, Apify, Whisper, or uploads are added later.

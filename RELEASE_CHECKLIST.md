# Release checklist

## Clean installation

- [ ] From the repository root, run `npm ci` (it replaces `node_modules` from the lockfile).
- [ ] From `yt-transcript-server`, run `npm ci` (it replaces `node_modules` from the backend lockfile).
- [ ] Confirm `npm ls youtube-transcript` inside `yt-transcript-server` resolves locally with no unmet dependency.

## Automated checks

- [ ] Frontend: `npm run check`
- [ ] Backend: `npm run check`
- [ ] Frontend: `npm audit`
- [ ] Backend: `npm audit`
- [ ] Extension: `npm audit`

## Local smoke test

- [ ] Start the backend with `npm start` inside `yt-transcript-server`.
- [ ] Confirm `http://localhost:10000/api/health` returns `ok: true`.
- [ ] Start the frontend with `npm run dev` from the repository root.
- [ ] Confirm `http://localhost:3000` loads.
- [ ] Confirm an invalid URL returns `INVALID_YOUTUBE_URL`.
- [ ] Run `npm run test:smoke -- --video=<caption-rich-youtube-url>` inside `yt-transcript-server`.
- [ ] Confirm a valid URL either returns transcript text or a precise error such as `CAPTIONS_UNAVAILABLE`, `TRANSCRIPT_PROVIDER_BLOCKED`, or `TRANSCRIPT_PROVIDER_NETWORK_ERROR`.

## Website-first Browser Mode

- [ ] Start the website with `npm run dev`.
- [ ] Open `http://localhost:3000` and find **Recommended · No-extension Browser Mode**.
- [ ] Drag **Get Transcript** to the browser bookmarks bar.
- [ ] Open a YouTube video with available captions.
- [ ] Click the saved bookmark and confirm `/browser-mode/receiver` opens.
- [ ] Confirm the receiver shows the video title, URL, caption track, and transcript preview.
- [ ] Confirm the receiver says **Fetched from YouTube using your browser**.
- [ ] Confirm the receiver says **Backend YouTube fetch: No** and **Render used: No for raw transcript**.
- [ ] Confirm Copy places the raw transcript on the clipboard.
- [ ] Confirm TXT and SRT download locally.
- [ ] Stop `yt-transcript-server` while keeping Next.js running.
- [ ] Repeat Browser Mode and confirm raw import, preview, copy, TXT, and SRT still work.
- [ ] Confirm Clean, Summary, and Notes fail gracefully without removing the raw transcript.
- [ ] Confirm each failed AI action shows unavailable/under-development copy without Gemini/API-key details.
- [ ] Confirm Summary, Clean, and Notes can each be attempted after another AI action fails.
- [ ] Confirm the browser Network panel contains no `/api/transcript` request during Browser Mode.
- [ ] Restart the backend and confirm Server Mode still works as the labeled fallback.
- [ ] Confirm Server Mode says **Fetched by server fallback** and **Backend YouTube fetch: Yes**.

## Production parity

- [ ] Deploy `yt-transcript-server/server.js` as the only backend.
- [ ] Set backend `NODE_ENV=production`.
- [ ] Set backend `CORS_ORIGINS` to both production frontend origins.
- [ ] Set frontend `NEXT_PUBLIC_BACKEND_URL` to the deployed backend origin, without `/api` at the end.
- [ ] Set frontend `NEXT_PUBLIC_SITE_URL=https://www.yt2trascript.in`.
- [ ] Confirm production `GET <backend>/api/health` reports transcript extraction enabled.
- [ ] Confirm the deployed frontend presents Browser Mode first, Server Mode as fallback, and Extension Mode as optional.
- [ ] Run the transcript user journey on production and record the response `requestId` if it fails.
- [ ] Confirm missing or invalid Gemini configuration affects only AI actions, not original transcript extraction.

## Optional Extension Mode

- [ ] Run `npm ci && npm run check` inside `extension`.
- [ ] Stop the local backend and block the production backend URL in browser developer tools.
- [ ] Load the unpacked `extension` directory in Chrome.
- [ ] Open a YouTube video with captions and confirm the popup detects the video.
- [ ] Confirm captions are found and raw transcript text appears with both backends unavailable.
- [ ] Confirm Copy places the transcript on the clipboard.
- [ ] Confirm TXT downloads a local transcript file.
- [ ] Navigate between two YouTube videos without a full reload and repeat extraction.
- [ ] Confirm an optional AI action fails gracefully without removing the raw transcript.

## AI failure safety

- [ ] Stop the backend.
- [ ] Click Summary and confirm friendly unavailable copy.
- [ ] Confirm the raw transcript remains visible and Copy/TXT/SRT still work.
- [ ] Repeat separately for Clean and Notes.
- [ ] Restart the backend with no Gemini key and confirm the UI says the AI feature is under development.
- [ ] Confirm user-facing responses never mention Gemini API keys, stack traces, or provider internals.

Do not mark the release ready unless a real caption-rich YouTube video returns transcript text through the production frontend.

Works on videos with available captions. Some restricted, private, region-locked, live, or captionless videos may not work.

# YouTube Raw Transcript Extension

The extension has an extension-first raw transcript path:

```text
YouTube tab → content script → extension service worker → YouTube caption URL
```

The website backend is not involved in video detection, caption discovery, caption download, parsing, preview, copy, TXT download, SRT download, or local caching.

The backend is contacted only when the user explicitly clicks Clean, Summary, or Notes:

```text
Extension service worker → POST transcript text → optional backend AI endpoint
```

## Build and test

```powershell
Set-Location extension
npm ci
npm run check
npm run package:zip
```

The packaged extension is written to `public/yt-transcript-extension.zip`.

## Load unpacked

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose this `extension` directory.
5. Open a YouTube video that has captions.
6. Open the extension popup.

## Required offline smoke test

1. Stop `yt-transcript-server` and confirm port 10000 is closed.
2. In browser developer tools, optionally block `https://yt2trascript.onrender.com/*` to prove the deployed backend is unreachable too.
3. Open `https://www.youtube.com/watch?v=M7lc1UVf-VE` or another caption-rich video.
4. Navigate to a second caption-rich video without reloading the YouTube tab to exercise SPA detection.
5. Open the extension popup.
6. Confirm the popup reports **Video detected** and then **Captions found**.
7. Confirm raw transcript text appears in the preview.
8. Click **Copy** and paste into a local text editor.
9. Click **TXT** and confirm the downloaded file contains the raw transcript.
10. Click **Summary** while the backend is blocked and confirm the popup reports that optional AI is offline while the raw transcript remains visible.

## Optional AI backend

The default backend is `https://yt2trascript.onrender.com`. For local AI endpoint testing, set this from the extension service-worker console:

```js
chrome.storage.local.set({ backendUrl: "http://localhost:10000" })
```

Reset to production with:

```js
chrome.storage.local.remove("backendUrl")
```

Production must configure `EXTENSION_ORIGINS=chrome-extension://<published-extension-id>` on the backend.

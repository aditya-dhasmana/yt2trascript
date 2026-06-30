"use client";

import { useEffect, useRef } from "react";
import { createBrowserModeBookmarklet } from "../../browser-mode/bookmarklet";

export default function BrowserModeSetup() {
  const bookmarkletRef = useRef(null);

  useEffect(() => {
    const receiverUrl = `${window.location.origin}/browser-mode/receiver`;
    bookmarkletRef.current?.setAttribute(
      "href",
      createBrowserModeBookmarklet(receiverUrl),
    );
  }, []);

  return (
    <section className="mt-8 max-w-4xl rounded-lg border-2 border-emerald-600 bg-emerald-50 p-5">
      <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
        Recommended · No-extension Browser Mode
      </p>
      <h2 className="mt-2 text-2xl font-black text-emerald-950">
        Get the transcript through your own YouTube tab
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-900">
        This uses your browser on the YouTube page, so the transcript request does not come from our server.
        It works on videos with available captions.
      </p>

      <p className="mt-4 inline-flex rounded-full bg-emerald-800 px-3 py-1 text-xs font-bold text-white">
        Browser Mode = User browser fetches YouTube
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
        <a
          ref={bookmarkletRef}
          href="#browser-mode-steps"
          className="inline-flex min-h-14 cursor-grab items-center justify-center rounded-md bg-emerald-800 px-6 text-base font-black text-white shadow-sm active:cursor-grabbing"
          title="Drag this button to your bookmarks bar"
        >
          Get Transcript
        </a>

        <ol id="browser-mode-steps" className="grid gap-2 text-sm text-emerald-950 sm:grid-cols-2">
          <li><span className="font-bold">1.</span> Drag “Get Transcript” to your bookmarks bar.</li>
          <li><span className="font-bold">2.</span> Open YouTube video.</li>
          <li><span className="font-bold">3.</span> Click the bookmarklet.</li>
          <li><span className="font-bold">4.</span> Transcript opens here.</li>
        </ol>
      </div>

      <p className="mt-4 text-xs leading-5 text-emerald-800">
        Some restricted, private, region-locked, live, or captionless videos may not work.
      </p>
    </section>
  );
}

import "./globals.css";

export const metadata = {
  title: "YouTube Transcript Platform - Original Transcripts, Clean Captions and AI Summaries",
  description:
    "Extract YouTube transcripts, clean captions, and generate AI summaries only when you need them.",
  icons: [
    { url: "/favicon.ico" },
  ],
  keywords: [
    "youtube transcript downloader",
    "download youtube transcript",
    "youtube captions to text",
    "youtube transcript to pdf",
    "clean youtube transcript",
    "youtube summary generator",
    "get transcript from youtube video",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

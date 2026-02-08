import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "YouTube Transcript Downloader – Download YouTube Captions as TXT or PDF",
  description:
    "Free tool to download YouTube video transcripts and captions. Convert YouTube subtitles to clean text or PDF instantly.",

    icons: [
    { url: "/favicon-16x16.png", sizes: "16x16" },
    { url: "/favicon-32x32.png", sizes: "32x32" },
    { url: "/favicon-180x180.png", sizes: "180x180" },
    { url: "/favicon-512x512.png", sizes: "512x512" },
  ],
  keywords: [
    "youtube transcript downloader",
    "download youtube transcript",
    "youtube captions to text",
    "youtube transcript to pdf",
    
    "get transcript from youtube video"
  ],
};


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

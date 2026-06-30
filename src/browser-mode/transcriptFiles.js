export function formatTimestamp(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`
    : `${pad(minutes)}:${pad(remainingSeconds)}`;
}

export function formatRawTranscript(segments, includeTimestamps = true) {
  return segments.map((segment) => (
    includeTimestamps ? `[${formatTimestamp(segment.start)}] ${segment.text}` : segment.text
  )).join("\n");
}

function formatSrtTimestamp(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.floor((safeSeconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

export function formatSrt(segments) {
  return segments.map((segment, index) => {
    const fallbackDuration = Math.max(segment.text.length / 14, 1.5);
    const end = segment.start + (segment.duration ?? fallbackDuration);
    return `${index + 1}\n${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(end)}\n${segment.text}`;
  }).join("\n\n");
}

export function safeFilename(value) {
  return value.replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120)
    || "youtube-transcript";
}

export function createTranscriptFile(payload, format = "txt") {
  const baseName = safeFilename(payload.video.title || payload.video.videoId);
  if (format === "srt") {
    return {
      filename: `${baseName}.srt`,
      content: formatSrt(payload.segments),
      mimeType: "application/x-subrip",
    };
  }

  return {
    filename: `${baseName}.txt`,
    content: formatRawTranscript(payload.segments, true),
    mimeType: "text/plain",
  };
}

import type { TranscriptSegment } from "../types.js";

export function formatPlainText(segments: TranscriptSegment[], includeTimestamps: boolean): string {
  return segments
    .map((segment) => {
      if (!includeTimestamps) {
        return segment.text;
      }

      return `[${formatTimestamp(segment.start)}] ${segment.text}`;
    })
    .join("\n");
}

export function formatSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((segment, index) => {
      const start = formatSrtTimestamp(segment.start);
      const fallbackDuration = Math.max(segment.text.length / 14, 1.5);
      const end = formatSrtTimestamp(segment.start + (segment.duration ?? fallbackDuration));

      return `${index + 1}\n${start} --> ${end}\n${segment.text}`;
    })
    .join("\n\n");
}

export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
  }

  return `${pad(minutes)}:${pad(remainingSeconds)}`;
}

function formatSrtTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.floor((safeSeconds % 1) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${String(milliseconds).padStart(3, "0")}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

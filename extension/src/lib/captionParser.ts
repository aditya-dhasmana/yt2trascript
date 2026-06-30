import type { TranscriptSegment } from "../types.js";

type TimedTextEvent = {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string }>;
};

type TimedTextJson = {
  events?: TimedTextEvent[];
};

export function parseTranscript(rawText: string): TranscriptSegment[] {
  const trimmed = rawText.trim();

  if (!trimmed) return [];
  if (trimmed.startsWith("{")) return parseJsonTranscript(trimmed);
  return parseXmlTranscript(trimmed);
}

function parseJsonTranscript(rawJson: string): TranscriptSegment[] {
  const payload = JSON.parse(rawJson) as TimedTextJson;

  return (payload.events ?? [])
    .map((event) => {
      const text = normalizeText(
        (event.segs ?? []).map((segment) => segment.utf8 ?? "").join(""),
      );

      if (!text || typeof event.tStartMs !== "number") return null;

      const segment: TranscriptSegment = {
        start: event.tStartMs / 1000,
        text,
      };

      if (typeof event.dDurationMs === "number") {
        segment.duration = event.dDurationMs / 1000;
      }

      return segment;
    })
    .filter((segment): segment is TranscriptSegment => segment !== null);
}

function parseXmlTranscript(rawXml: string): TranscriptSegment[] {
  const legacySegments = parseXmlNodes(rawXml, "text", "start", "dur", 1);
  if (legacySegments.length > 0) return legacySegments;

  return parseXmlNodes(rawXml, "p", "t", "d", 1000);
}

function parseXmlNodes(
  rawXml: string,
  tagName: "text" | "p",
  startAttribute: string,
  durationAttribute: string,
  divisor: number,
): TranscriptSegment[] {
  const nodePattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const segments: TranscriptSegment[] = [];

  for (const match of rawXml.matchAll(nodePattern)) {
    const attributes = match[1] ?? "";
    const startValue = readAttribute(attributes, startAttribute);
    const start = startValue === null ? Number.NaN : Number(startValue) / divisor;
    const durationValue = readAttribute(attributes, durationAttribute);
    const text = normalizeText(decodeHtmlEntities(stripXmlTags(match[2] ?? "")));

    if (!Number.isFinite(start) || !text) continue;

    const segment: TranscriptSegment = { start, text };
    if (durationValue !== null) {
      const duration = Number(durationValue) / divisor;
      if (Number.isFinite(duration)) segment.duration = duration;
    }
    segments.push(segment);
  }

  return segments;
}

function readAttribute(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function stripXmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

export function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, token: string) => {
    if (token.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(token.slice(2), 16));
    }
    if (token.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(token.slice(1), 10));
    }
    return namedEntities[token.toLowerCase()] ?? entity;
  });
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

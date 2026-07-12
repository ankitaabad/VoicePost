import type { TtsMetadata } from "@app/shared";
import { computeLayout, DEFAULT_OVERLAY_Y } from "@app/shared";
import type { ThumbnailBrightness } from "./thumbnailAnalysis";

export type CaptionSegment = {
  text: string;
  start: number;
  end: number;
};

// Safety margin (seconds) subtracted from each segment's end so a
// caption never visibly outlasts the word it represents.
const SEGMENT_END_MARGIN = 0.05;

const MAX_CHARS = 45;

export function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "\u2019")
    .replace(/:/g, "\\:")
    .replace(/%/g, "%%");
}

/**
 * Group Kokoro's real per-token timings into caption segments of at
 * most `MAX_CHARS` characters. Tokens are merged with the whitespace
 * that follows them to reproduce natural display text. Each segment's
 * `start` and `end` come straight from the source tokens.
 */
export function groupTokensIntoSegments(
  metadata: TtsMetadata,
  startOffset: number,
  endOffset: number,
  audioDuration: number,
): CaptionSegment[] {
  const { tokens } = metadata;
  if (tokens.length === 0) return [];

  const segments: CaptionSegment[] = [];
  let currentTokens: typeof tokens = [];
  let currentText = "";

  const flush = () => {
    if (currentTokens.length === 0) return;
    const start = startOffset + currentTokens[0].start;
    const end = Math.max(
      start,
      startOffset +
        currentTokens[currentTokens.length - 1].end -
        SEGMENT_END_MARGIN,
    );
    segments.push({ text: currentText.trim(), start, end });
    currentTokens = [];
    currentText = "";
  };

  for (const tok of tokens) {
    const candidate =
      currentText.length > 0 ? `${currentText} ${tok.text}` : tok.text;

    if (currentText.length > 0 && candidate.length > MAX_CHARS) {
      flush();
      currentTokens = [tok];
      currentText = tok.text;
    } else {
      currentTokens.push(tok);
      currentText = candidate;
    }
  }
  flush();

  // Clamp to audio duration and prevent negative ranges
  const cap = audioDuration - endOffset;
  for (const seg of segments) {
    seg.start = Math.max(startOffset, Math.min(seg.start, cap));
    seg.end = Math.max(seg.start, Math.min(seg.end, cap));
  }

  return segments;
}

export function buildCaptionFilters(
  segments: CaptionSegment[],
  outputHeight: number,
  outputWidth: number,
  brightness: ThumbnailBrightness = "dark",
  overlayY: number = DEFAULT_OVERLAY_Y,
): string[] {
  if (segments.length === 0) return [];

  const layout = computeLayout(outputWidth, outputHeight, overlayY);
  const { fontSize, margin, barPadX, barW, textY } = layout;
  const isLight = brightness === "light";
  const borderW = isLight
    ? Math.max(1, Math.round(fontSize * 0.1))
    : Math.max(1, Math.round(fontSize * 0.05));
  const borderColor = isLight ? "black@1.0" : "black@0.8";

  return segments.map((seg) => {
    const escaped = escapeDrawText(seg.text);
    return [
      `drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=white:borderw=${borderW}:bordercolor=${borderColor}:x='if(gt(text_w\\,${outputWidth - margin * 2})\\,(w-text_w)/2\\,if(gt(text_w\\,${barW - barPadX * 2 - borderW * 2})\\,${margin + barPadX}\\,(w-text_w)/2))':y=${textY}:enable='between(t\\,${seg.start.toFixed(2)}\\,${seg.end.toFixed(2)})'`,
    ].join(",");
  });
}

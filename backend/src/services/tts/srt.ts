import type { TtsMetadata } from "@app/shared";
import { groupTokensIntoSegments } from "@src/services/video/captions";

function formatSrtTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function generateSRT(
  metadata: TtsMetadata,
  audioDuration: number,
): string {
  const segments = groupTokensIntoSegments(metadata, 0, 0, audioDuration);
  if (segments.length === 0) return "";

  return `${segments
    .map(
      (seg, i) =>
        `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text}`,
    )
    .join("\n\n")}\n`;
}

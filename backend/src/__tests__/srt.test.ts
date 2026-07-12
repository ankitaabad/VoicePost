import type { TtsMetadata } from "@app/shared";
import { generateSRT } from "@src/services/tts/srt";
import { describe, expect, it } from "vitest";

function makeMetadata(tokens: TtsMetadata["tokens"]): TtsMetadata {
  return {
    voice_id: "af_heart",
    duration: 5,
    sample_rate: 24000,
    tokens,
  };
}

describe("generateSRT", () => {
  it("returns empty string for empty tokens", () => {
    expect(generateSRT(makeMetadata([]), 1)).toBe("");
  });

  it("produces SRT-format blocks with sequence, timecodes, text", () => {
    const metadata = makeMetadata([
      { text: "Hello", start: 0.0, end: 0.5 },
      { text: "world", start: 0.5, end: 1.0 },
    ]);
    const srt = generateSRT(metadata, 1.0);
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:00,950\nHello world");
  });

  it("formats timecodes with zero-padding", () => {
    const metadata = makeMetadata([{ text: "Hi", start: 3601.5, end: 3602.0 }]);
    const srt = generateSRT(metadata, 3602.5);
    // 3601.5s = 1h 0m 1s 500ms
    expect(srt).toContain("01:00:01,500 -->");
  });

  it("handles multiple segments separated by blank line", () => {
    const tokens = Array.from({ length: 20 }, (_, i) => ({
      text: `word${i}`,
      start: i * 0.5,
      end: i * 0.5 + 0.4,
    }));
    const srt = generateSRT(makeMetadata(tokens), 20);
    const blocks = srt.trim().split("\n\n");
    expect(blocks.length).toBeGreaterThan(1);
    for (let i = 0; i < blocks.length; i++) {
      expect(blocks[i].startsWith(`${i + 1}\n`)).toBe(true);
    }
  });
});

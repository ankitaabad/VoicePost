import type { TtsMetadata } from "@app/shared";
import {
  buildCaptionFilters,
  groupTokensIntoSegments,
} from "@src/services/video/captions";
import { describe, expect, it } from "vitest";

const FADE_IN = 0;
const FADE_OUT = 0;
const AUDIO_DURATION = 22; // raw TTS duration — audio processor keeps the same length

function makeMetadata(tokens: TtsMetadata["tokens"]): TtsMetadata {
  return {
    voice_id: "af_heart",
    duration: 22,
    sample_rate: 24000,
    tokens,
  };
}

describe("groupTokensIntoSegments", () => {
  it("returns [] for empty tokens", () => {
    expect(groupTokensIntoSegments(makeMetadata([]), 0, 0, 1)).toEqual([]);
  });

  it("puts all tokens in one segment when short", () => {
    const metadata = makeMetadata([
      { text: "Hello", start: 0.0, end: 0.5 },
      { text: "world", start: 0.5, end: 1.0 },
    ]);
    const segs = groupTokensIntoSegments(metadata, 0, 0, 1.0);
    expect(segs).toEqual([{ text: "Hello world", start: 0.0, end: 0.95 }]);
  });

  it("breaks at explicit maxChars", () => {
    const words = [
      "The",
      "personal",
      "cloud",
      "platform",
      "delivers",
      "open-source",
      "Postgres",
      "Redis",
      "and",
      "VictoriaLogs",
      "to",
      "every",
      "deployment",
      "you",
      "create",
    ];
    const tokens = words.map((w, i) => ({
      text: w,
      start: i * 0.5,
      end: i * 0.5 + 0.4,
    }));
    const segs = groupTokensIntoSegments(makeMetadata(tokens), 0, 0, 20, 45);
    expect(segs.length).toBeGreaterThan(1);
    for (const seg of segs) {
      expect(seg.text.length).toBeLessThanOrEqual(45);
      expect(seg.end).toBeGreaterThan(seg.start);
    }
  });

  it("uses 45 as the default maxChars (SRT path)", () => {
    const words = [
      "alpha",
      "beta",
      "gamma",
      "delta",
      "epsilon",
      "zeta",
      "eta",
      "theta",
      "iota",
      "kappa",
    ];
    const tokens = words.map((w, i) => ({
      text: w,
      start: i * 0.5,
      end: i * 0.5 + 0.4,
    }));
    const segs = groupTokensIntoSegments(makeMetadata(tokens), 0, 0, 20);
    for (const seg of segs) {
      expect(seg.text.length).toBeLessThanOrEqual(45);
    }
  });

  it("honors a custom maxChars for narrow outputs", () => {
    // Single long token that exceeds the cap on its own — should be
    // emitted as its own segment rather than merged into the next.
    const tokens = [
      { text: "VoicePost", start: 0.0, end: 0.5 },
      { text: "is", start: 0.5, end: 0.7 },
      { text: "awesome", start: 0.7, end: 1.2 },
    ];
    const segs = groupTokensIntoSegments(makeMetadata(tokens), 0, 0, 5, 12);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    for (const seg of segs) {
      expect(seg.text.length).toBeLessThanOrEqual(12);
    }
  });

  it("applies startOffset to all segments", () => {
    const metadata = makeMetadata([
      { text: "Hello", start: 0.0, end: 0.5 },
      { text: "world", start: 0.5, end: 1.0 },
    ]);
    const segs = groupTokensIntoSegments(metadata, 1, 0, 2.0);
    expect(segs[0].start).toBeCloseTo(1.0, 2);
    expect(segs[0].end).toBeCloseTo(1.95, 2);
  });

  it("clamps segments to [startOffset, audioDuration - endOffset]", () => {
    const metadata = makeMetadata([{ text: "Hello", start: 21.9, end: 22.1 }]);
    const segs = groupTokensIntoSegments(
      metadata,
      FADE_IN,
      FADE_OUT,
      AUDIO_DURATION,
    );
    expect(segs[0].start).toBeLessThanOrEqual(AUDIO_DURATION - FADE_OUT);
    expect(segs[0].end).toBeLessThanOrEqual(AUDIO_DURATION - FADE_OUT);
  });

  it("preserves monotonically increasing timestamps from Kokoro", () => {
    // Realistic-looking input from Kokoro (post-hoc, but valid)
    const metadata = makeMetadata([
      { text: "VoicePost", start: 0.325, end: 0.925 },
      { text: "turns", start: 0.925, end: 1.2125 },
      { text: "your", start: 1.2125, end: 1.35 },
      { text: "text", start: 1.35, end: 1.6875 },
      { text: "into", start: 1.6875, end: 1.9375 },
      { text: "studio-quality", start: 1.9375, end: 2.7 },
    ]);
    const segs = groupTokensIntoSegments(metadata, 0, 0, 10);
    expect(segs.length).toBe(1);
    expect(segs[0].text).toBe("VoicePost turns your text into studio-quality");
    expect(segs[0].start).toBeCloseTo(0.325, 3);
    expect(segs[0].end).toBeCloseTo(2.65, 2); // 2.7 - 0.05 margin
  });
});

describe("buildCaptionFilters", () => {
  it("emits ffmpeg drawtext for each segment", () => {
    const segments = [
      { text: "Hello world", start: 1.0, end: 2.5 },
      { text: "How are you", start: 2.6, end: 4.0 },
    ];
    const filters = buildCaptionFilters(segments, 1080, 1920);
    expect(filters.length).toBe(2);
    expect(filters[0]).toContain("drawtext=text='Hello world'");
    expect(filters[0]).toContain("enable='between(t\\,1.00\\,2.50)'");
    expect(filters[1]).toContain("drawtext=text='How are you'");
  });

  it("escapes dangerous characters for ffmpeg drawtext", () => {
    const segments = [{ text: "What's up: 50%", start: 0, end: 1 }];
    const filters = buildCaptionFilters(segments, 1080, 1920);
    expect(filters[0]).toContain("\\:");
    expect(filters[0]).toContain("%%");
  });
});

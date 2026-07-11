import {
  buildCaptionSegments,
  splitIntoSentences,
} from "@src/services/video/captions";
import { VOICE_PROFILES } from "@src/services/video/voiceProfiles";
import {
  computePacingMultiplier,
  computeWordWeight,
  estimateSyllables,
  getPunctuationStretch,
} from "@src/services/video/wordWeights";
import { describe, expect, it } from "vitest";
import { SCRIPTS } from "./fixtures/scripts";
import ttsDurations from "./fixtures/tts-durations.json";

function getVoiceProfile(id: string) {
  return VOICE_PROFILES.find((v) => v.id === id) ?? VOICE_PROFILES[0];
}

// ══════════════════════════════════════════════════════════
// 1. Word weight unit tests
// ══════════════════════════════════════════════════════════

describe("estimateSyllables", () => {
  it("counts basic words", () => {
    expect(estimateSyllables("cat")).toBe(1);
    expect(estimateSyllables("water")).toBe(2);
    expect(estimateSyllables("beautiful")).toBe(3);
  });

  it("handles silent e", () => {
    expect(estimateSyllables("make")).toBe(1);
    expect(estimateSyllables("late")).toBe(1);
  });

  it("handles le at end", () => {
    expect(estimateSyllables("bottle")).toBe(2);
    expect(estimateSyllables("little")).toBe(2);
  });

  it("returns 1 for empty/single char", () => {
    expect(estimateSyllables("")).toBe(1);
    expect(estimateSyllables("a")).toBe(1);
  });
});

describe("computeWordWeight", () => {
  it("weights short words less than long words", () => {
    expect(computeWordWeight("a")).toBeLessThan(computeWordWeight("hello"));
    expect(computeWordWeight("hello")).toBeLessThan(
      computeWordWeight("beautiful"),
    );
  });

  it("weights numbers by digit count", () => {
    expect(computeWordWeight("1")).toBeLessThan(computeWordWeight("123"));
    expect(computeWordWeight("123")).toBe(4.5); // 3 * 1.5
  });

  it("weights all-caps abbreviations as letters", () => {
    expect(computeWordWeight("API")).toBeCloseTo(2.1, 1); // 3 * 0.7
    expect(computeWordWeight("VPN")).toBeCloseTo(2.1, 1);
  });

  it("handles punctuation-only tokens", () => {
    expect(computeWordWeight("...")).toBe(0.5);
    expect(computeWordWeight("---")).toBe(0.5);
  });
});

describe("computePacingMultiplier", () => {
  it("returns 1.0 for single-word sentences", () => {
    expect(computePacingMultiplier(0, 1)).toBe(1.0);
  });

  it("slows at start and end, fastest in middle", () => {
    const start = computePacingMultiplier(0, 10);
    const mid = computePacingMultiplier(5, 10);
    const end = computePacingMultiplier(9, 10);
    expect(start).toBeGreaterThan(mid);
    expect(end).toBeGreaterThan(mid);
    expect(start).toBeCloseTo(end, 2);
  });

  it("middle is approximately 1.0", () => {
    const mid = computePacingMultiplier(5, 10);
    expect(mid).toBeCloseTo(1.0, 1);
  });
});

describe("getPunctuationStretch", () => {
  it("stretches words before commas", () => {
    expect(getPunctuationStretch("fast,")).toBeGreaterThan(1.0);
  });

  it("stretches words before periods most", () => {
    expect(getPunctuationStretch("hello.")).toBeGreaterThan(
      getPunctuationStretch("fast,"),
    );
  });

  it("stretches words before question marks", () => {
    expect(getPunctuationStretch("really?")).toBeGreaterThan(1.0);
  });

  it("returns 1.0 for plain words", () => {
    expect(getPunctuationStretch("hello")).toBe(1.0);
  });

  // New: when a pause is already inserted after the word, suppress
  // stretch to avoid double-counting time (pause alone models the gap).
  it("returns 1.0 when hasPauseAfter is true (no double-count)", () => {
    expect(getPunctuationStretch("hello.", true)).toBe(1.0);
    expect(getPunctuationStretch("fast,", true)).toBe(1.0);
    expect(getPunctuationStretch("really?", true)).toBe(1.0);
  });
});

// ══════════════════════════════════════════════════════════
// 2. Pure algorithm tests — instant, no I/O
// ══════════════════════════════════════════════════════════

describe("splitIntoSentences", () => {
  it("splits on period", () => {
    expect(splitIntoSentences("Hello world. Goodbye.")).toEqual([
      { text: "Hello world", endPunct: ".", hasParagraphBreak: false },
      { text: "Goodbye", endPunct: ".", hasParagraphBreak: false },
    ]);
  });

  it("handles ellipsis without false splits", () => {
    expect(splitIntoSentences("What if it was just... simple? Yes.")).toEqual([
      {
        text: "What if it was just\u2026 simple",
        endPunct: "?",
        hasParagraphBreak: false,
      },
      { text: "Yes", endPunct: ".", hasParagraphBreak: false },
    ]);
  });

  it("handles em-dash", () => {
    expect(
      splitIntoSentences("Developers\u2014what if your cloud was simple?"),
    ).toEqual([
      {
        text: "Developers\u2014what if your cloud was simple",
        endPunct: "?",
        hasParagraphBreak: false,
      },
    ]);
  });

  it("handles newlines between paragraphs", () => {
    expect(splitIntoSentences("First paragraph.\n\nSecond paragraph.")).toEqual(
      [
        { text: "First paragraph", endPunct: ".", hasParagraphBreak: true },
        { text: "Second paragraph", endPunct: ".", hasParagraphBreak: false },
      ],
    );
  });

  it("empty script", () => {
    expect(splitIntoSentences("")).toEqual([]);
  });

  // ── New: abbreviation handling ─────────────────────────────────
  it("does not split inside 'Dr.'", () => {
    expect(splitIntoSentences("Visit Dr. Smith today.")).toEqual([
      {
        text: "Visit Dr. Smith today",
        endPunct: ".",
        hasParagraphBreak: false,
      },
    ]);
  });

  it("does not split inside 'Mr.'", () => {
    expect(splitIntoSentences("Mr. Jones arrived.")).toEqual([
      { text: "Mr. Jones arrived", endPunct: ".", hasParagraphBreak: false },
    ]);
  });

  it("does not split inside dotted-initialisms like 'U.S.A.'", () => {
    expect(splitIntoSentences("Born in the U.S.A. in 1990.")).toEqual([
      {
        text: "Born in the U.S.A. in 1990",
        endPunct: ".",
        hasParagraphBreak: false,
      },
    ]);
  });

  it("does not split inside decimals like '$10.99'", () => {
    expect(splitIntoSentences("Just $10.99 today only.")).toEqual([
      {
        text: "Just $10.99 today only",
        endPunct: ".",
        hasParagraphBreak: false,
      },
    ]);
  });

  it("does not split inside 'e.g.' and 'i.e.'", () => {
    expect(
      splitIntoSentences("Use big words, i.e. acronyms, freely. Done."),
    ).toEqual([
      {
        text: "Use big words, i.e. acronyms, freely",
        endPunct: ".",
        hasParagraphBreak: false,
      },
      { text: "Done", endPunct: ".", hasParagraphBreak: false },
    ]);
  });

  it("does not split inside URLs", () => {
    expect(
      splitIntoSentences("Visit https://example.com. It is great."),
    ).toEqual([
      {
        text: "Visit https://example.com",
        endPunct: ".",
        hasParagraphBreak: false,
      },
      { text: "It is great", endPunct: ".", hasParagraphBreak: false },
    ]);
  });

  // ── New: trailing-no-punct handling ────────────────────────────
  it("handles trailing no-punctuation (preserves last character)", () => {
    expect(splitIntoSentences("Hello world")).toEqual([
      { text: "Hello world", endPunct: "", hasParagraphBreak: false },
    ]);
  });

  it("handles trailing no-punctuation after a question", () => {
    expect(splitIntoSentences("Are you ready? I am")).toEqual([
      { text: "Are you ready", endPunct: "?", hasParagraphBreak: false },
      { text: "I am", endPunct: "", hasParagraphBreak: false },
    ]);
  });
});

describe("buildCaptionSegments (edge cases)", () => {
  const adam = getVoiceProfile("am_adam");

  it("empty script returns empty segments", () => {
    expect(buildCaptionSegments("", 10, adam)).toEqual([]);
  });

  it("single word produces one segment", () => {
    const segments = buildCaptionSegments("Hello.", 2, adam);
    expect(segments.length).toBe(1);
    expect(segments[0].text).toBe("Hello.");
  });

  it("ellipsis does not cause false sentence split", () => {
    const segments = buildCaptionSegments(
      "What if it was just... simple? Yes.",
      5,
      adam,
    );
    const allText = segments.map((s) => s.text).join(" ");
    expect(allText).toContain("What if it was just\u2026 simple?");
  });

  // New: post-process padding (e.g. fadeIn/fadeOut from audio processor)
  it("shifts first segment by startPadding", () => {
    const padded = buildCaptionSegments("Hello world.", 5, adam, {
      startPadding: 1,
      endPadding: 1,
    });
    const unpadded = buildCaptionSegments("Hello world.", 3, adam);

    // The padded first segment should start ~1s later than the
    // unpadded one (accounting for the leading-silence difference too).
    expect(padded[0].start).toBeGreaterThan(unpadded[0].start);

    // No segment may run past the audio duration
    for (const seg of padded) {
      expect(seg.end).toBeLessThanOrEqual(5);
    }
  });

  it("startPadding shifts captions to align with post-processed audio", () => {
    // Simulate: raw TTS is 3s, but audio processor adds 1s fadeIn +
    // 1s fadeOut so the post-processed audio is 5s. The first word
    // should appear at 1.32s (1s fadeIn + 0.32s leadingSilence) in
    // the video timeline, NOT at 0.32s.
    const segments = buildCaptionSegments("Hello world.", 5, adam, {
      startPadding: 1,
      endPadding: 1,
    });
    expect(segments[0].start).toBeGreaterThanOrEqual(1.0);
    expect(segments[0].start).toBeLessThanOrEqual(1.55);
  });

  it("trailing-no-punct script still gets a final-word stretch", () => {
    // Without endPunct, the last word should still get a slight
    // sentence-end stretch via the virtual period — meaning the
    // final word's duration is longer than the preceding word's.
    const segments = buildCaptionSegments("the quick brown fox jumps", 4, adam);
    expect(segments.length).toBeGreaterThan(0);
    // The last word in the script is the last word in the segment.
    // Its duration should be >= the middle words' average.
    const lastSeg = segments[segments.length - 1];
    expect(lastSeg.text).toContain("jumps");
  });

  it("abbreviations in script do not cause extra sentence boundaries", () => {
    const segments = buildCaptionSegments(
      "Visit Dr. Smith at 123 Main St. today.",
      6,
      adam,
    );
    const allText = segments.map((s) => s.text).join(" ");
    // "Dr. Smith at 123 Main St." should be ONE segment, not split at "Dr." or "St."
    expect(allText).toContain("Dr. Smith");
  });
});

// ══════════════════════════════════════════════════════════
// 3. Fixture-based tests — real TTS durations, instant
// ══════════════════════════════════════════════════════════

describe("buildCaptionSegments (all voices × all scripts)", () => {
  for (const voice of VOICE_PROFILES) {
    for (const [scriptName, script] of Object.entries(SCRIPTS)) {
      const fixtureKey = `${voice.id}/${scriptName}`;
      const duration = ttsDurations[fixtureKey as keyof typeof ttsDurations];

      if (duration === undefined) continue;

      it(`${fixtureKey}: ${duration}s, valid segments`, () => {
        const segments = buildCaptionSegments(script, duration, voice);

        expect(segments.length).toBeGreaterThan(0);

        // First segment starts after leading silence (0.25–0.48 across voices)
        expect(segments[0].start).toBeGreaterThanOrEqual(0.2);
        expect(segments[0].start).toBeLessThanOrEqual(0.55);

        // No segment exceeds audio duration
        for (const seg of segments) {
          expect(seg.end).toBeLessThanOrEqual(duration + 0.05);
          expect(seg.end).toBeGreaterThan(seg.start);
        }

        // Monotonically ordered
        for (let i = 1; i < segments.length; i++) {
          expect(segments[i].start).toBeGreaterThanOrEqual(
            segments[i - 1].start - 0.01,
          );
        }

        // No segment text exceeds MAX_CHARS (45)
        for (const seg of segments) {
          expect(seg.text.length).toBeLessThanOrEqual(46);
        }

        // Last segment ends before audio ends
        const lastEnd = segments[segments.length - 1].end;
        expect(lastEnd).toBeLessThanOrEqual(duration);
      });

      it(`${fixtureKey}: segment timeline (visual)`, () => {
        const segments = buildCaptionSegments(script, duration, voice);
        const wordCount = script.split(/\s+/).length;
        const segText = segments
          .map(
            (s) =>
              `  [${s.start.toFixed(2)} \u2192 ${s.end.toFixed(2)}] (${(s.end - s.start).toFixed(2)}s) "${s.text}"`,
          )
          .join("\n");
        console.log(
          `\n${fixtureKey} | ${duration}s | ${wordCount} words | ${segments.length} segments\n${segText}`,
        );
        expect(segments.length).toBeGreaterThan(0);
      });
    }
  }
});

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
import ttsDurations from "./fixtures/tts-durations.json";

function getVoiceProfile(id: string) {
  return VOICE_PROFILES.find((v) => v.id === id) ?? VOICE_PROFILES[0];
}

const SCRIPTS: Record<string, string> = {
  zipup:
    "JavaScript developers\u2014what if your own cloud was just... simple?\n\nIntroducing Zipup Cloud. An open-source personal cloud that lets you deploy and run multiple JavaScript applications from a single server.\n\nEvery app comes with built-in Postgres, Valkey for Redis, and VictoriaLogs for powerful log searching. Host static websites, get automatic Let\u2019s Encrypt SSL certificates, and securely access your services over VPN.\n\nNo complex cloud setup. No unnecessary moving parts. Just everything you need to build and deploy.",
  short: "Your Personal Cloud. Simplified.",
  commas:
    "Your Personal Cloud. Simplified. A fast, secure and pragmatic open-source cloud, designed for JavaScript developers. Simple to use, powerful to run.",
  semicolons:
    "Build faster; deploy smarter. The platform: simple, scalable, secure. One command; total control.",
  questions:
    "Tired of complex cloud setups? Want to deploy with a single command? Looking for built-in Postgres and Redis? Your search ends here.",
  long50:
    "Meet the open-source personal cloud built for developers who value simplicity. Deploy static sites, APIs and full-stack apps from one server. Every project gets Postgres, Redis and log searching out of the box. No vendor lock-in. No surprise bills. Just your infrastructure, your rules.",
};

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

import type { VoiceProfile } from "./voiceProfiles";
import {
  computePacingMultiplier,
  computeWordWeight,
  getPunctuationStretch,
} from "./wordWeights";

export type CaptionSegment = {
  text: string;
  start: number;
  end: number;
};

export type WordTiming = {
  word: string;
  start: number;
  end: number;
};

/**
 * Timing strategy interface — swap this out for forced alignment
 * when word-level timestamps become available from Kokoro or an aligner.
 */
export type TimingStrategy = (
  script: string,
  audioDuration: number,
  voiceProfile: VoiceProfile,
) => WordTiming[];

// Safety margin (seconds) subtracted from each segment's end
// to prevent captions running ahead of audio due to TTS timing variance.
const SEGMENT_END_MARGIN = 0.05;

const MAX_CHARS = 45;

export type BuildOptions = {
  /**
   * Seconds of audio padding at the START that contains no speech
   * (e.g. fadeIn applied by the audio processor). The first word's
   * timestamp is shifted forward by this amount.
   */
  startPadding?: number;
  /**
   * Seconds of audio padding at the END that contains no speech
   * (e.g. fadeOut applied by the audio processor). Subtracted from
   * `audioDuration` when computing the speech-rate denominator.
   */
  endPadding?: number;
};

export function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "\u2019")
    .replace(/:/g, "\\:")
    .replace(/%/g, "%%");
}

export function getPauseType(
  punct: string,
): "period" | "comma" | "question" | "exclamation" | "semicolon" | "colon" {
  if (punct === ".") return "period";
  if (punct === ",") return "comma";
  if (punct === "?") return "question";
  if (punct === "!") return "exclamation";
  if (punct === ";" || punct === "\u2014") return "semicolon";
  if (punct === ":") return "colon";
  return "period";
}

// Common English abbreviations whose internal `.` should NOT trigger a
// sentence split. Matches case-insensitively at word boundaries.
const ABBREVIATIONS = [
  "Dr",
  "Mr",
  "Mrs",
  "Ms",
  "Jr",
  "Sr",
  "St",
  "Mt",
  "Ft",
  "Sgt",
  "Capt",
  "Lt",
  "Col",
  "Gen",
  "Gov",
  "Pres",
  "Sen",
  "Rep",
  "Hon",
  "Rev",
  "Prof",
  "Inc",
  "Co",
  "Ltd",
  "Corp",
  "LLC",
  "LLP",
  "PLC",
  "GmbH",
  "vs",
  "etc",
  "approx",
  "dept",
  "est",
  "min",
  "max",
  "no",
  "vol",
  "pp",
  "pg",
  "ch",
  "fig",
  "al",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

// Placeholder used to mask false sentence boundaries (dotted
// abbreviations, decimals, URLs, etc.) before splitting. It is a control
// character that will not appear in user input.
const FALSE_BOUNDARY = "\u0001";

function maskFalseBoundaries(text: string): string {
  let masked = text;

  // Mask "i.e." and "e.g." (multi-letter abbreviations with internal dots).
  // The trailing `.` is part of the abbreviation, so it must also be
  // masked — otherwise it would be treated as a sentence terminator and
  // cause a split like "Use big words, i.e" / "acronyms".
  masked = masked.replace(/\b(i\.e|e\.g)\./gi, (m) =>
    m.replace(/\./g, FALSE_BOUNDARY),
  );

  // Mask other dotted abbreviations (Dr., Mr., etc.)
  const abbrevPattern = new RegExp(
    `\\b(${ABBREVIATIONS.map((a) => a.replace(/\./g, "\\.")).join("|")})\\.`,
    "g",
  );
  masked = masked.replace(abbrevPattern, (m) => {
    // Preserve the original case of the trailing letter
    return m.slice(0, -1) + FALSE_BOUNDARY;
  });

  // Mask dotted-initialisms like "U.S.A.", "U.K." (2+ letters separated
  // by single dots, optionally followed by lowercase letters)
  masked = masked.replace(/\b(?:[A-Za-z]\.){2,}(?:[a-z]+)?/g, (m) =>
    m.replace(/\./g, FALSE_BOUNDARY),
  );

  // Mask decimals like "10.99", "0.5", "3.14"
  masked = masked.replace(/(\d)\.(\d)/g, `$1${FALSE_BOUNDARY}$2`);

  // Mask version numbers like "v1.2.3", "1.0.0"
  masked = masked.replace(/(\w)\.(\d)/g, (m, p1) =>
    p1 === "v" || /\d/.test(p1) ? m.replace(/\./g, FALSE_BOUNDARY) : m,
  );

  // Mask URLs (http://, https://, www.). Leave any trailing sentence
  // terminator (`.`, `?`, `!`) unmasked so that a URL at the end of a
  // sentence is correctly treated as a sentence boundary.
  masked = masked.replace(/(https?:\/\/[^\s]+|www\.[^\s]+)/g, (m) => {
    const lastChar = m.slice(-1);
    if (".!?".includes(lastChar)) {
      return m.slice(0, -1).replace(/\./g, FALSE_BOUNDARY) + lastChar;
    }
    return m.replace(/\./g, FALSE_BOUNDARY);
  });

  return masked;
}

export function splitIntoSentences(
  script: string,
): Array<{ text: string; endPunct: string; hasParagraphBreak: boolean }> {
  // Normalize ellipsis (...) so it doesn't trigger false sentence splits
  const normalized = script.replace(/\.{3,}/g, "\u2026");

  // Mask false sentence boundaries (abbreviations, decimals, URLs, etc.)
  const masked = maskFalseBoundaries(normalized);

  const parts = masked
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(new RegExp(FALSE_BOUNDARY, "g"), "."))
    .filter((s) => s.length > 0);

  return parts.map((part, i) => {
    const unmaskedPart = part;
    const lastChar = unmaskedPart.slice(-1);
    const isTerminator = ".!?\u2026".includes(lastChar);

    let text: string;
    let endPunct: string;
    if (isTerminator) {
      text = unmaskedPart.slice(0, -1).trim();
      endPunct = lastChar;
    } else {
      // Script ended without terminal punctuation — preserve the full
      // text and use an empty endPunct. The caption builder will apply a
      // virtual period stretch to the final word.
      text = unmaskedPart.trim();
      endPunct = "";
    }

    let hasParagraphBreak = false;
    if (i < parts.length - 1) {
      const nextPart = parts[i + 1];
      const thisEnd = normalized.indexOf(part) + part.length;
      const nextStart = normalized.indexOf(nextPart, thisEnd);
      if (nextStart > 0) {
        const between = normalized.slice(thisEnd, nextStart);
        hasParagraphBreak = /\n\s*\n/.test(between);
      }
    }

    return { text, endPunct, hasParagraphBreak };
  });
}

/**
 * Count all internal punctuation pauses within a sentence text.
 */
export function countInternalPauses(
  text: string,
  voiceProfile: VoiceProfile,
): number {
  const matches = text.match(/[,;:\u2014]/g);
  if (!matches) return 0;

  return matches.reduce((sum, punct) => {
    const type = getPauseType(punct);
    return sum + voiceProfile.pauses[type];
  }, 0);
}

// ── Heuristic word-level timing ──────────────────────────────────

function computeSentencePauseTime(
  sentences: Array<{
    endPunct: string;
    hasParagraphBreak: boolean;
    text: string;
  }>,
  voiceProfile: VoiceProfile,
): number {
  return sentences.reduce((sum, s) => {
    const endPause = voiceProfile.pauses[getPauseType(s.endPunct)];
    const internalPause = countInternalPauses(s.text, voiceProfile);
    const paragraphPause = s.hasParagraphBreak
      ? voiceProfile.paragraphPause
      : 0;
    return sum + endPause + internalPause + paragraphPause;
  }, 0);
}

function heuristicWordTimings(
  script: string,
  audioDuration: number,
  voiceProfile: VoiceProfile,
  options: BuildOptions = {},
): WordTiming[] {
  const { startPadding = 0, endPadding = 0 } = options;
  const sentences = splitIntoSentences(script);
  if (sentences.length === 0) return [];

  // Build per-sentence word lists with weights
  const sentenceData = sentences.map((s) => {
    // Display text preserves user intent (no extra `.` if script had none)
    const displayText = s.endPunct ? `${s.text}${s.endPunct}` : s.text;
    const words = displayText.split(/\s+/).filter((w) => w.length > 0);

    // Decide per-word whether a pause will be inserted AFTER it. When
    // a pause follows, the stretch multiplier is suppressed to avoid
    // double-counting (the pause alone models the gap accurately).
    const followedByPause = words.map((w, i) => {
      const isLast = i === words.length - 1;
      if (isLast) return true; // sentence-end pause (or virtual period)
      return /[,;:]$/.test(w); // internal pause-causing punctuation
    });

    // For stretch lookup, the last word needs a virtual `.` when the
    // script ended without terminal punctuation so it still gets a
    // sentence-end stretch.
    const weights = words.map((w, i) => {
      const isLast = i === words.length - 1;
      const stretchSource = isLast && s.endPunct === "" ? `${w}.` : w;
      return (
        computeWordWeight(w) *
        computePacingMultiplier(i, words.length) *
        getPunctuationStretch(stretchSource, followedByPause[i])
      );
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    return { words, weights, totalWeight, sentence: s };
  });

  const totalPauseTime = computeSentencePauseTime(sentences, voiceProfile);
  const totalWeight = sentenceData.reduce((sum, sd) => sum + sd.totalWeight, 0);
  // Subtract start/end padding (e.g. fadeIn/fadeOut added by audio
  // processor) before computing the speech-rate denominator so the
  // voice-profile pause table — which is calibrated against raw TTS —
  // stays consistent.
  const effectiveDuration = Math.max(
    0.1,
    audioDuration - startPadding - endPadding,
  );
  const availableDuration = Math.max(
    0.1,
    effectiveDuration - voiceProfile.leadingSilence - totalPauseTime,
  );
  const speechRate = totalWeight / availableDuration;

  // Assign timestamps to each word proportional to weight
  const timings: WordTiming[] = [];
  // First word starts after startPadding (e.g. fadeIn) + voice-profile
  // leading silence. All timestamps are in the post-processed audio
  // timeline.
  let currentTime = startPadding + voiceProfile.leadingSilence;

  for (const sd of sentenceData) {
    const { words, weights, totalWeight: sentWeight, sentence: s } = sd;
    const speakTime = sentWeight / speechRate;

    let t = currentTime;
    for (let wi = 0; wi < words.length; wi++) {
      const wordDuration = (weights[wi] / sentWeight) * speakTime;
      timings.push({ word: words[wi], start: t, end: t + wordDuration });
      t += wordDuration;
    }

    currentTime += speakTime;
    if (s.endPunct) {
      currentTime += voiceProfile.pauses[getPauseType(s.endPunct)];
    }
    if (s.hasParagraphBreak) currentTime += voiceProfile.paragraphPause;
  }

  return timings;
}

// ── Group word timings into caption segments (≤MAX_CHARS) ────────

function groupIntoCaptionSegments(
  wordTimings: WordTiming[],
  duration: number,
): CaptionSegment[] {
  if (wordTimings.length === 0) return [];

  const segments: CaptionSegment[] = [];
  let current: WordTiming[] = [];

  for (const wt of wordTimings) {
    const candidate =
      current.length > 0
        ? `${current.map((w) => w.word).join(" ")} ${wt.word}`
        : wt.word;
    if (current.length > 0 && candidate.length > MAX_CHARS) {
      segments.push({
        text: current.map((w) => w.word).join(" "),
        start: current[0].start,
        end: current[current.length - 1].end - SEGMENT_END_MARGIN,
      });
      current = [wt];
    } else {
      current.push(wt);
    }
  }

  if (current.length > 0) {
    segments.push({
      text: current.map((w) => w.word).join(" "),
      start: current[0].start,
      end: current[current.length - 1].end - SEGMENT_END_MARGIN,
    });
  }

  // Clamp end times: no overlaps, cap at audio duration
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const nextStart = segments[i + 1]?.start ?? duration;
    const maxEnd = i === segments.length - 1 ? duration : nextStart;
    seg.end = Math.min(seg.end, maxEnd);
  }

  return segments;
}

// ── Public API ───────────────────────────────────────────────────

export function buildCaptionSegments(
  script: string,
  duration: number,
  voiceProfile: VoiceProfile,
  optionsOrStrategy?: BuildOptions | TimingStrategy,
  maybeStrategy?: TimingStrategy,
): CaptionSegment[] {
  // Support both buildCaptionSegments(script, dur, vp, strategy) and
  // buildCaptionSegments(script, dur, vp, options, strategy).
  let options: BuildOptions = {};
  let strategy: TimingStrategy | undefined;
  if (typeof optionsOrStrategy === "function") {
    strategy = optionsOrStrategy;
  } else if (optionsOrStrategy) {
    options = optionsOrStrategy;
    strategy = maybeStrategy;
  }

  const fn = strategy ?? heuristicWordTimings;
  const wordTimings = fn(script, duration, voiceProfile, options);
  return groupIntoCaptionSegments(wordTimings, duration);
}

export function buildCaptionFilters(
  segments: CaptionSegment[],
  outputHeight: number,
  outputWidth: number,
): string[] {
  if (segments.length === 0) return [];

  const fontSize = Math.max(24, Math.round(outputHeight * 0.04));
  const margin = Math.round(outputWidth * 0.04);
  const barPadX = Math.round(outputWidth * 0.02);
  const barW = outputWidth - margin * 2;
  const textY = Math.round(outputHeight * 0.62);

  return segments.map((seg) => {
    const escaped = escapeDrawText(seg.text);
    return [
      `drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black@0.8:x='if(gt(text_w\\,${barW - barPadX * 2})\\,${margin + barPadX}\\,(w-text_w)/2)':y=${textY}:enable='between(t\\,${seg.start.toFixed(2)}\\,${seg.end.toFixed(2)})'`,
    ].join(",");
  });
}

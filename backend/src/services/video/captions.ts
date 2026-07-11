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

export function splitIntoSentences(
  script: string,
): Array<{ text: string; endPunct: string; hasParagraphBreak: boolean }> {
  // Normalize ellipsis (...) so it doesn't trigger false sentence splits
  const normalized = script.replace(/\.{3,}/g, "\u2026");
  const parts = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return parts.map((part, i) => {
    const lastChar = part.slice(-1);
    const text = part.slice(0, -1).trim();

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

    return { text, endPunct: lastChar, hasParagraphBreak };
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
): WordTiming[] {
  const sentences = splitIntoSentences(script);
  if (sentences.length === 0) return [];

  // Build per-sentence word lists with weights
  const sentenceData = sentences.map((s) => {
    const captionText = `${s.text}${s.endPunct}`;
    const words = captionText.split(/\s+/);
    const weights = words.map(
      (w, i) =>
        computeWordWeight(w) *
        computePacingMultiplier(i, words.length) *
        getPunctuationStretch(w),
    );
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    return { words, weights, totalWeight, sentence: s };
  });

  const totalPauseTime = computeSentencePauseTime(sentences, voiceProfile);
  const totalWeight = sentenceData.reduce((sum, sd) => sum + sd.totalWeight, 0);
  const availableDuration = Math.max(
    0.1,
    audioDuration - voiceProfile.leadingSilence - totalPauseTime,
  );
  const speechRate = totalWeight / availableDuration;

  // Assign timestamps to each word proportional to weight
  const timings: WordTiming[] = [];
  let currentTime = voiceProfile.leadingSilence;

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
    currentTime += voiceProfile.pauses[getPauseType(s.endPunct)];
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
  timingStrategy?: TimingStrategy,
): CaptionSegment[] {
  const strategy = timingStrategy ?? heuristicWordTimings;
  const wordTimings = strategy(script, duration, voiceProfile);
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

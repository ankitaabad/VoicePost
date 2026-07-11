/**
 * Weighted speech model for caption timing.
 *
 * Instead of treating every word as equal duration, we estimate relative
 * speaking duration per word using syllable count, character patterns,
 * and punctuation context. Combined with a sentence-level pacing curve,
 * this produces more accurate word-level timestamps than constant WPS.
 */

// ── Syllable estimation (English heuristic) ──────────────────────

export function estimateSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 1;

  let count = 0;
  let prevVowel = false;
  for (const ch of w) {
    const isVowel = "aeiouy".includes(ch);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  // Silent e at end (e.g. "make" → 1 syllable, not 2)
  if (w.endsWith("e") && count > 1) count--;

  // "le" at end after consonant adds a syllable (e.g. "bottle" → 2)
  if (
    w.endsWith("le") &&
    w.length > 2 &&
    !"aeiouy".includes(w.charAt(w.length - 3))
  ) {
    count++;
  }

  return Math.max(1, count);
}

// ── Word weight (relative speaking duration) ─────────────────────

export function computeWordWeight(word: string): number {
  const cleaned = word.replace(/[^a-zA-Z0-9]/g, "");
  if (cleaned.length === 0) return 0.5; // punctuation-only token

  // Numbers: each digit takes roughly equal spoken time
  if (/^\d+$/.test(cleaned)) {
    return cleaned.length * 1.5;
  }

  // All-caps abbreviations (API, VPN, SSL) — spoken as individual letters
  if (
    cleaned === cleaned.toUpperCase() &&
    cleaned.length >= 2 &&
    cleaned.length <= 6
  ) {
    return cleaned.length * 0.7;
  }

  // Regular words: syllable-based with consonant cluster adjustment
  const syllables = estimateSyllables(cleaned);
  const consonantRatio =
    cleaned.replace(/[aeiouy]/gi, "").length / cleaned.length;
  return syllables * (1 + consonantRatio * 0.2);
}

// ── Sentence-level pacing curve ──────────────────────────────────
// Speakers naturally slow at sentence boundaries and speed up in the
// middle. Modelled as a U-shaped curve on word position within sentence.

export function computePacingMultiplier(
  wordIndex: number,
  wordsInSentence: number,
): number {
  if (wordsInSentence <= 1) return 1.0;
  const t = wordIndex / (wordsInSentence - 1); // [0, 1]
  const midBoost = 4 * t * (1 - t); // 0 at ends, 1 at middle
  return 1.0 + 0.08 * (1 - midBoost); // 1.08 at ends, 1.0 at middle
}

// ── Punctuation stretch ──────────────────────────────────────────
// Words immediately before punctuation are articulated more
// deliberately (stretched), independent of the silence that follows.

export function getPunctuationStretch(word: string): number {
  const lastChar = word.slice(-1);
  if (lastChar === ",") return 1.05;
  if (lastChar === ".") return 1.1;
  if (lastChar === "?") return 1.08;
  if (lastChar === "!") return 1.06;
  if (lastChar === ";" || lastChar === ":") return 1.03;
  if (lastChar === "\u2026") return 1.08; // ellipsis
  return 1.0;
}

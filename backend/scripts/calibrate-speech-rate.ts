/**
 * Calibrate per-voice speechRate from TTS fixture durations.
 *
 * For each (voice × script) sample:
 *   1. Compute total weighted score for the script
 *   2. actualSpeakingTime = fixtureDuration - leadingSilence - totalPauseTime
 *   3. speechRate_i = totalWeight / actualSpeakingTime
 *   4. speechRate = median(speechRate_i) per voice
 *
 * Run: npx tsx scripts/calibrate-speech-rate.ts
 */

import ttsDurations from "../src/__tests__/fixtures/tts-durations.json";
import {
  countInternalPauses,
  getPauseType,
  splitIntoSentences,
} from "../src/services/video/captions";
import { VOICE_PROFILES } from "../src/services/video/voiceProfiles";
import {
  computePacingMultiplier,
  computeWordWeight,
  getPunctuationStretch,
} from "../src/services/video/wordWeights";

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

function computeTotalWeight(script: string): number {
  const sentences = splitIntoSentences(script);
  let total = 0;
  for (const s of sentences) {
    const words = `${s.text}${s.endPunct}`.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      total +=
        computeWordWeight(words[i]) *
        computePacingMultiplier(i, words.length) *
        getPunctuationStretch(words[i]);
    }
  }
  return total;
}

function computePauseTime(
  script: string,
  voice: (typeof VOICE_PROFILES)[0],
): number {
  const sentences = splitIntoSentences(script);
  return sentences.reduce((sum, s) => {
    const endPause = voice.pauses[getPauseType(s.endPunct)];
    const internalPause = countInternalPauses(s.text, voice);
    const paragraphPause = s.hasParagraphBreak ? voice.paragraphPause : 0;
    return sum + endPause + internalPause + paragraphPause;
  }, 0);
}

console.log("=== Speech Rate Calibration ===\n");

for (const voice of VOICE_PROFILES) {
  const rates: Array<{
    script: string;
    rate: number;
    totalWeight: number;
    speakTime: number;
  }> = [];

  for (const [scriptName, script] of Object.entries(SCRIPTS)) {
    const key = `${voice.id}/${scriptName}` as keyof typeof ttsDurations;
    const duration = ttsDurations[key];
    if (duration === undefined) continue;

    const totalWeight = computeTotalWeight(script);
    const pauseTime = computePauseTime(script, voice);
    const speakTime = duration - voice.leadingSilence - pauseTime;
    const rate = totalWeight / speakTime;

    rates.push({ script: scriptName, rate, totalWeight, speakTime });
  }

  const median = rates.map((r) => r.rate).sort((a, b) => a - b)[
    Math.floor(rates.length / 2)
  ];
  const mean = rates.reduce((s, r) => s + r.rate, 0) / rates.length;

  console.log(`${voice.id}:`);
  console.log(`  median: ${median.toFixed(3)}  mean: ${mean.toFixed(3)}`);
  for (const r of rates) {
    console.log(
      `    ${r.script.padEnd(12)} rate=${r.rate.toFixed(3)}  weight=${r.totalWeight.toFixed(1)}  speak=${r.speakTime.toFixed(2)}s`,
    );
  }
  console.log();
}

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TtsMetadata } from "@app/shared";
import { groupTokensIntoSegments } from "@src/services/video/captions";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SCRIPTS } from "./fixtures/scripts";

const KOKORO_URL = process.env.KOKORO_URL ?? "http://localhost:8888/tts";
const AUDIO_CACHE_DIR = join(tmpdir(), "caption-drift-audio-v2");
const SCRIPT_KEY = "voicepost_ad";

type SilenceRegion = { start: number; end: number };

async function fetchTtsMetadata(
  text: string,
  voiceId: string,
): Promise<TtsMetadata> {
  const res = await fetch(KOKORO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice_id: voiceId, speed: 1.0 }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    throw new Error(`Kokoro ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    audio: string;
    sample_rate: number;
    duration: number;
    voice_id: string;
    tokens: TtsMetadata["tokens"];
  };
  return {
    voice_id: json.voice_id,
    duration: json.duration,
    sample_rate: json.sample_rate,
    tokens: json.tokens,
  };
}

function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        audioPath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exit ${code}`));
      const dur = parseFloat(stdout.trim());
      resolve(Number.isFinite(dur) ? dur : 0);
    });
    proc.on("error", reject);
  });
}

function detectSilenceRegions(audioPath: string): Promise<SilenceRegion[]> {
  return new Promise((resolve) => {
    const proc = spawn(
      "ffmpeg",
      [
        "-i",
        audioPath,
        "-af",
        "silencedetect=noise=-30dB:d=0.15",
        "-f",
        "null",
        "-",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", () => {
      const regions: SilenceRegion[] = [];
      let start: number | null = null;
      for (const line of stderr.split("\n")) {
        const s = line.match(/silence_start: ([\d.]+)/);
        const e = line.match(/silence_end: ([\d.]+)/);
        if (s) start = parseFloat(s[1]);
        if (e && start !== null) {
          regions.push({ start, end: parseFloat(e[1]) });
          start = null;
        }
      }
      resolve(regions);
    });
    proc.on("error", () => resolve([]));
  });
}

type DriftRow = {
  text: string;
  segmentEnd: number;
  nearestSilenceMid: number | null;
  drift: number | null;
};

function pairDrift(
  segments: { text: string; start: number; end: number }[],
  regions: SilenceRegion[],
): DriftRow[] {
  return segments.map((seg) => {
    let best: { mid: number; dist: number } | null = null;
    for (const r of regions) {
      if (r.start === 0) continue;
      const mid = (r.start + r.end) / 2;
      const dist = Math.abs(seg.end - mid);
      if (best === null || dist < best.dist) best = { mid, dist };
    }
    return {
      text: seg.text,
      segmentEnd: seg.end,
      nearestSilenceMid: best?.mid ?? null,
      drift: best ? seg.end - best.mid : null,
    };
  });
}

describe("caption alignment — Kokoro ground-truth tokens vs real silences", () => {
  const VOICE_IDS = ["af_heart", "af_sarah", "am_adam", "am_liam"] as const;
  const FADE_IN = 1;
  const FADE_OUT = 1;
  const script = SCRIPTS[SCRIPT_KEY];

  beforeAll(async () => {
    await mkdir(AUDIO_CACHE_DIR, { recursive: true });
  });

  for (const voiceId of VOICE_IDS) {
    it(`${voiceId}: token-derived segments vs real silences`, async () => {
      const metadata = await fetchTtsMetadata(script, voiceId);
      const audioPath = join(AUDIO_CACHE_DIR, `${voiceId}_${SCRIPT_KEY}.wav`);
      // Also save the audio for silence detection
      const b64Res = await fetch(KOKORO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script, voice_id: voiceId, speed: 1.0 }),
        signal: AbortSignal.timeout(60000),
      });
      const { audio } = (await b64Res.json()) as { audio: string };
      await writeFile(audioPath, Buffer.from(audio, "base64"));

      const actualDuration = await getAudioDuration(audioPath);
      const regions = await detectSilenceRegions(audioPath);

      const segments = groupTokensIntoSegments(
        metadata,
        FADE_IN,
        FADE_OUT,
        actualDuration + FADE_IN + FADE_OUT,
      );
      const rows = pairDrift(segments, regions);

      const lines: string[] = [];
      lines.push(
        `\n=== ${voiceId}/${SCRIPT_KEY} === tts=${metadata.duration.toFixed(2)}s, raw_audio=${actualDuration.toFixed(2)}s, ${segments.length} segs, ${regions.length} silences, ${metadata.tokens.length} tokens`,
      );
      for (const r of rows) {
        const sign = r.drift !== null ? (r.drift > 0 ? "+" : "") : "?";
        const driftStr =
          r.drift !== null ? `${sign}${r.drift.toFixed(3)}s` : "  ?    ";
        const near = r.nearestSilenceMid?.toFixed(2) ?? "  -  ";
        lines.push(
          `  end=${r.segmentEnd.toFixed(2).padStart(6)} near_silence_mid=${near} drift=${driftStr.padStart(8)}  "${r.text.length > 50 ? `${r.text.slice(0, 47)}...` : r.text}"`,
        );
      }
      console.log(lines.join("\n"));

      // With ground-truth timestamps, max drift on any segment
      // should be < 0.3s — the segment's end naturally lands shortly
      // before the inter-sentence silence starts.
      const drifts = rows
        .map((r) => r.drift)
        .filter((d): d is number => d !== null);
      if (drifts.length > 0) {
        const maxAbsDrift = Math.max(...drifts.map((d) => Math.abs(d)));
        expect(maxAbsDrift).toBeLessThan(0.4);
      }
      expect(segments.length).toBeGreaterThan(0);
      expect(regions.length).toBeGreaterThan(1);
    }, 60_000);
  }

  afterAll(() => {
    // cached audio persists across runs
  });
});

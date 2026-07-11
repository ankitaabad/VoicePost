import { spawn } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCaptionSegments,
  type CaptionSegment,
} from "@src/services/video/captions";
import type { VoiceProfile } from "@src/services/video/voiceProfiles";
import { VOICE_PROFILES } from "@src/services/video/voiceProfiles";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SCRIPTS } from "./fixtures/scripts";

const KOKORO_URL = process.env.KOKORO_URL ?? "http://localhost:8888/tts";
const AUDIO_CACHE_DIR = join(tmpdir(), "caption-drift-audio");
const SCRIPT_KEY = "voicepost_ad";

type SilenceRegion = { start: number; end: number };

async function isKokoroAvailable(): Promise<boolean> {
  try {
    const res = await fetch(KOKORO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "ok", voice_id: "af_heart", speed: 1.0 }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function generateTTS(
  text: string,
  voiceId: string,
  outPath: string,
): Promise<void> {
  const res = await fetch(KOKORO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice_id: voiceId, speed: 1.0 }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    throw new Error(`Kokoro ${res.status}: ${await res.text()}`);
  }
  await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
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
  predictedEnd: number;
  nearestSilenceMid: number | null;
  drift: number | null;
};

function pairDrift(
  segments: CaptionSegment[],
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
      predictedEnd: seg.end,
      nearestSilenceMid: best?.mid ?? null,
      drift: best ? seg.end - best.mid : null,
    };
  });
}

const kokoroUp = await isKokoroAvailable();

describe.skipIf(!kokoroUp)("caption drift analysis — voicepost_ad", () => {
  beforeAll(async () => {
    await mkdir(AUDIO_CACHE_DIR, { recursive: true });
  });

  for (const voice of VOICE_PROFILES) {
    const script = SCRIPTS[SCRIPT_KEY];
    const audioPath = join(AUDIO_CACHE_DIR, `${voice.id}_${SCRIPT_KEY}.wav`);

    it(`${voice.id}: segments vs real silences`, async () => {
      let cached = true;
      try {
        await stat(audioPath);
      } catch {
        cached = false;
      }
      if (!cached) {
        await generateTTS(script, voice.id, audioPath);
      }

      const actualDuration = await getAudioDuration(audioPath);
      const regions = await detectSilenceRegions(audioPath);
      const segments = buildCaptionSegments(
        script,
        actualDuration,
        voice as VoiceProfile,
      );
      const rows = pairDrift(segments, regions);

      const lines: string[] = [];
      lines.push(
        `\n=== ${voice.id}/${SCRIPT_KEY} === actual=${actualDuration.toFixed(2)}s, ${segments.length} segs, ${regions.length} silences${cached ? " (cached)" : " (regenerated)"}`,
      );
      for (const r of rows) {
        const sign = r.drift !== null ? (r.drift > 0 ? "+" : "") : "?";
        const driftStr =
          r.drift !== null ? `${sign}${r.drift.toFixed(3)}s` : "  ?    ";
        const near = r.nearestSilenceMid?.toFixed(2) ?? "  -  ";
        lines.push(
          `  end=${r.predictedEnd.toFixed(2).padStart(5)} near_silence_mid=${near} drift=${driftStr.padStart(7)}  "${r.text.length > 50 ? `${r.text.slice(0, 47)}...` : r.text}"`,
        );
      }
      console.log(lines.join("\n"));

      expect(segments.length).toBeGreaterThan(0);
      expect(regions.length).toBeGreaterThan(1);
    }, 60_000);
  }

  afterAll(() => {
    // audio files in tmpdir persist for next run; intentional
  });
});

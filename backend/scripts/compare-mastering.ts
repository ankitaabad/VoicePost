import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getLogger } from "@src/lib/core/logger";
import { masterAudio } from "@src/services/audio/mastering";
import { generateSpeech } from "@src/services/tts/kokoro";
import ffmpeg from "fluent-ffmpeg";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";
const COMPARE_DIR = join(STORAGE_PATH, "compare");

const SAMPLE_SCRIPT =
  "Tired of reading the same flat scripts? VoicePost turns your ideas into broadcast-ready audio in seconds. Pick a voice, add cinematic background music, and let our AI do the heavy lifting. Ready to sound like a studio? Hit generate.";

const VOICES = ["af_heart", "af_sarah", "am_adam", "am_liam"] as const;

type Metrics = {
  integrated_lufs: number | null;
  true_peak_dbtp: number | null;
  loudness_range_lu: number | null;
  duration_sec: number | null;
};

function getDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data.format.duration ?? 0);
    });
  });
}

async function measure(filePath: string): Promise<Metrics> {
  const lines: string[] = [];
  const nullOut = join(tmpdir(), `ebur128-${randomUUID()}.null`);
  await new Promise<void>((resolve, reject) => {
    ffmpeg(filePath)
      .audioFilters("ebur128=peak=true")
      .outputOptions(["-f", "null"])
      .on("stderr", (line) => lines.push(line))
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(nullOut);
  });
  await import("node:fs/promises").then((m) =>
    m.unlink(nullOut).catch(() => {}),
  );

  const text = lines.join("\n");
  const summary = text.split("Summary:").pop() ?? text;

  const iMatch = summary.match(/I:\s*([-\d.]+)\s*LUFS/);
  const lraMatch = summary.match(/LRA:\s*([-\d.]+)\s*LU/);
  const peakMatch = summary.match(/Peak:\s*([-\d.]+)\s*dBFS/);

  const duration = await getDuration(filePath).catch(() => 0);

  return {
    integrated_lufs: iMatch ? Number(iMatch[1]) : null,
    true_peak_dbtp: peakMatch ? Number(peakMatch[1]) : null,
    loudness_range_lu: lraMatch ? Number(lraMatch[1]) : null,
    duration_sec: Number(duration.toFixed(2)),
  };
}

type Variant = "raw" | "mastered" | "bypass";

function formatMetric(value: number | null, suffix = ""): string {
  if (value === null) return "n/a";
  return `${value.toFixed(2)}${suffix}`;
}

async function run() {
  const logger = getLogger();
  await mkdir(COMPARE_DIR, { recursive: true });

  const results: Array<{
    voice: string;
    files: Record<Variant, { path: string; metrics: Metrics }>;
  }> = [];

  for (const voiceId of VOICES) {
    const voiceDir = join(COMPARE_DIR, voiceId);
    await mkdir(voiceDir, { recursive: true });

    const rawPath = join(voiceDir, "raw.wav");
    const masteredPath = join(voiceDir, "mastered.mp3");
    const bypassPath = join(voiceDir, "bypass.mp3");

    const rawExists = await stat(rawPath)
      .then(() => true)
      .catch(() => false);
    if (!rawExists) {
      logger.info(`[compare] ${voiceId}: generating raw...`);
      const t0 = Date.now();
      const { audioPath } = await generateSpeech(
        SAMPLE_SCRIPT,
        voiceId,
        rawPath,
      );
      logger.info(
        `[compare] ${voiceId}: raw ${audioPath} (${Date.now() - t0}ms)`,
      );
    } else {
      logger.info(`[compare] ${voiceId}: raw.wav exists, reusing`);
    }

    logger.info(`[compare] ${voiceId}: mastering with defaults...`);
    await masterAudio(rawPath, masteredPath);

    logger.info(
      `[compare] ${voiceId}: mastering with all shaping disabled (bypass)...`,
    );
    await masterAudio(rawPath, bypassPath, {
      skipShaping: true,
      targetLufs: -16,
      truePeakDb: -1.5,
      loudnessRange: 11,
    });

    logger.info(`[compare] ${voiceId}: measuring...`);
    const [rawM, masteredM, bypassM] = await Promise.all([
      measure(rawPath),
      measure(masteredPath),
      measure(bypassPath),
    ]);

    await writeFile(
      join(voiceDir, "metrics.json"),
      JSON.stringify(
        { raw: rawM, mastered: masteredM, bypass: bypassM },
        null,
        2,
      ),
    );

    results.push({
      voice: voiceId,
      files: {
        raw: { path: rawPath, metrics: rawM },
        mastered: { path: masteredPath, metrics: masteredM },
        bypass: { path: bypassPath, metrics: bypassM },
      },
    });
  }

  console.log("\n=== Audio Mastering Comparison ===\n");
  console.log(
    "voice     variant     LUFS     TP(dBTP)  LRA(LU)  dur(s)   path",
  );
  console.log("-".repeat(90));
  for (const r of results) {
    for (const v of ["raw", "mastered", "bypass"] as const) {
      const f = r.files[v];
      console.log(
        `${r.voice.padEnd(9)} ${v.padEnd(11)} ${formatMetric(f.metrics.integrated_lufs, " LUFS").padEnd(8)} ${formatMetric(f.metrics.true_peak_dbtp).padEnd(9)} ${formatMetric(f.metrics.loudness_range_lu).padEnd(9)} ${formatMetric(f.metrics.duration_sec).padEnd(8)} ${f.path}`,
      );
    }
    console.log("-".repeat(90));
  }
  console.log(
    `\nAll outputs written to ${COMPARE_DIR}/<voice>/{raw.wav,mastered.mp3,bypass.mp3,metrics.json}`,
  );
  console.log(
    "Listen to raw.wav vs mastered.mp3 vs bypass.mp3 in each voice directory.\n",
  );
}

run().catch((err) => {
  console.error("compare-mastering failed:", err);
  process.exit(1);
});

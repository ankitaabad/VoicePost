import { execSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { processAudio } from "@src/services/audio/processor";
import { generateSpeech } from "@src/services/tts/kokoro";
import ffmpeg from "fluent-ffmpeg";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";
const TEST_DIR = join(STORAGE_PATH, "compare", "bgm-final");

function measureLUFS(file: string, start?: number, end?: number): number {
  let cmd = `ffmpeg -hide_banner -i "${file}"`;
  if (start !== undefined) cmd += ` -ss ${start}`;
  if (end !== undefined) cmd += ` -t ${end - (start ?? 0)}`;
  cmd += ` -af ebur128 -f null - 2>&1`;
  const out = execSync(cmd, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const summary = out.split("Summary:").pop() ?? out;
  const m = summary.match(/I:\s*([-\d.]+)\s*LUFS/);
  return m ? Number(m[1]) : NaN;
}

async function getDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data.format.duration ?? 0);
    });
  });
}

async function run() {
  await mkdir(TEST_DIR, { recursive: true });

  const script =
    "Tired of reading the same flat scripts? VoicePost turns your ideas into broadcast-ready audio in seconds. Pick a voice, add cinematic background music, and let our AI do the heavy lifting. Ready to sound like a studio? Hit generate.";
  const ttsPath = join(TEST_DIR, "narration.wav");
  const { audioPath: ttsOut } = await generateSpeech(
    script,
    "af_heart",
    ttsPath,
  );

  const withBgmDir = join(TEST_DIR, "with-bgm");
  await mkdir(withBgmDir, { recursive: true });
  const outputPath = join(withBgmDir, "audio.mp3");
  await processAudio(ttsOut, outputPath, withBgmDir, "ambient-inspiring.mp3");
  const dur = await getDuration(outputPath);
  console.log(`Final output: ${outputPath} (${dur.toFixed(1)}s)`);
  console.log(`Full integrated: ${measureLUFS(outputPath).toFixed(1)} LUFS\n`);

  // Measure segments: beginning (BGM fade-in), mid-narration, end (BGM fade-out)
  const segs: Array<[string, number, number]> = [
    ["0-0.5s (BGM fade-in)", 0, 0.5],
    ["0.5-1.0s (BGM only, pre-narr)", 0.5, 1.0],
    ["1.0-1.5s (BGM only, pre-narr)", 1.0, 1.5],
    ["1.5-2.0s (start of narr)", 1.5, 2.0],
    ["3.0-4.0s (mid-narr)", 3.0, 4.0],
    [
      `${(dur - 1.5).toFixed(1)}-${dur.toFixed(1)}s (BGM fade-out)`,
      dur - 1.5,
      dur,
    ],
  ];
  console.log(`${"  segment".padEnd(40)}LUFS`);
  console.log(`  ${"-".repeat(50)}`);
  for (const [label, s, e] of segs) {
    const lufs = measureLUFS(outputPath, s, e);
    console.log(`  ${label.padEnd(40)}${lufs.toFixed(1)}`);
  }

  // Also build a narration-only reference (no BGM) for comparison
  const noBgmDir = join(TEST_DIR, "no-bgm");
  await mkdir(noBgmDir, { recursive: true });
  const outputPath2 = join(noBgmDir, "audio.mp3");
  await processAudio(ttsOut, outputPath2, noBgmDir);
  console.log(`\nNarration-only reference: ${outputPath2}`);
  console.log(`Full integrated: ${measureLUFS(outputPath2).toFixed(1)} LUFS`);
  for (const [label, s, e] of segs) {
    const lufs = measureLUFS(
      outputPath2,
      Math.min(s, dur - 0.1),
      Math.min(e, dur - 0.01),
    );
    console.log(`  ${label.padEnd(40)}${lufs.toFixed(1)}`);
  }

  await rm(withBgmDir, { recursive: true, force: true });
  await rm(noBgmDir, { recursive: true, force: true });
  await rm(TEST_DIR, { recursive: true, force: true });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

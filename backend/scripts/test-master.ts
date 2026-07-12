import { execSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { masterAudio } from "@src/services/audio/mastering";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";
const TEST_DIR = join(STORAGE_PATH, "compare", "master-test");

function measureLUFS(f: string, s?: number, e?: number): number {
  let cmd = `ffmpeg -hide_banner -i "${f}"`;
  if (s !== undefined) cmd += ` -ss ${s}`;
  if (e !== undefined) cmd += ` -t ${e - (s ?? 0)}`;
  cmd += ` -af ebur128 -f null - 2>&1`;
  const result = execSync(cmd, { encoding: "utf8" });
  const summary = result.split("Summary:").pop() ?? result;
  const m = summary.match(/I:\s*([-\d.]+)\s*LUFS/);
  return m ? Number(m[1]) : NaN;
}

async function run() {
  await mkdir(TEST_DIR, { recursive: true });

  // Generate a 10s test file using execSync (lavfi not available in fluent-ffmpeg)
  const testInput = join(TEST_DIR, "input.wav");
  execSync(
    `ffmpeg -y -f lavfi -i "anoisesrc=color=white:duration=10:amplitude=0.1" -ar 48000 -c:a pcm_s16le "${testInput}" 2>/dev/null`,
  );

  const inputLUFS = measureLUFS(testInput);
  console.log(`Input: ${inputLUFS.toFixed(1)} LUFS`);

  const outputPath = join(TEST_DIR, "output.mp3");
  await masterAudio(testInput, outputPath);

  const outputLUFS = measureLUFS(outputPath);
  console.log(`Output: ${outputLUFS.toFixed(1)} LUFS (target: -16)`);
  console.log(`Gain applied: ${(outputLUFS - inputLUFS).toFixed(1)} dB`);

  await rm(TEST_DIR, { recursive: true, force: true });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { processAudio } from "@src/services/audio/processor";
import { generateSpeech } from "@src/services/tts/kokoro";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";
const TEST_DIR = join(STORAGE_PATH, "compare", "bgm-isolated");

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
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
    { encoding: "utf8" },
  );
  return parseFloat(out.trim());
}

async function run() {
  await mkdir(TEST_DIR, { recursive: true });

  // Short narration with natural pauses (Kokoro adds silence between sentences)
  const ttsPath = join(TEST_DIR, "narr.wav");
  const { audioPath: ttsOut } = await generateSpeech("Hi. ... ... ... ... ... ... Bye.", "af_heart", ttsPath);
  const narrDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${ttsOut}"`, { encoding: "utf8" }));
  console.log(`narration: ${narrDur.toFixed(2)}s`);

  // Copy narration BEFORE first processAudio call (which deletes the file)
  const ttsCopy = join(TEST_DIR, "narr-copy.wav");
  execSync(`cp "${ttsOut}" "${ttsCopy}"`);

  // Generate WITH BGM
  const outId = randomUUID();
  const outName = await processAudio(ttsOut, outId, "ambient-inspiring.mp3");
  const outPath = join(STORAGE_PATH, "audio", outName);
  const outDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outPath}"`, { encoding: "utf8" }));
  console.log(`output: ${outPath} (${outDur.toFixed(2)}s)`);
  console.log(`full integrated (with BGM): ${measureLUFS(outPath).toFixed(1)} LUFS`);

  // Generate WITHOUT BGM (narration-only reference)
  const refId = randomUUID();
  const refName = await processAudio(ttsCopy, refId);
  const refPath = join(STORAGE_PATH, "audio", refName);
  const refDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${refPath}"`, { encoding: "utf8" }));
  console.log(`narration-only ref: ${refPath} (${refDur.toFixed(2)}s)`);
  console.log(`full integrated (no BGM): ${measureLUFS(refPath).toFixed(1)} LUFS\n`);

  console.log("  segment".padEnd(45) + "with BGM".padEnd(12) + "no BGM");
  console.log("  " + "-".repeat(70));
  for (const [label, s, e] of [
    ["0-0.5s (BGM fade-in)", 0, 0.5],
    ["0.5-1.0s (Hi.)", 0.5, 1.0],
    ["1.0-2.0s (silence gap, BGM only)", 1.0, Math.min(2.0, outDur - 0.01)],
    ["2.0-3.0s (silence gap, BGM only)", 2.0, Math.min(3.0, outDur - 0.01)],
    [`${(outDur - 1).toFixed(1)}-${outDur.toFixed(1)}s (BGM fade-out)`, outDur - 1, outDur - 0.01],
  ] as const) {
    const withBGM = measureLUFS(outPath, s, e);
    const noBGM = measureLUFS(refPath, s, Math.min(e, refDur - 0.01));
    const delta = withBGM - noBGM;
    console.log(`  ${label.padEnd(45)}${withBGM.toFixed(1).padEnd(12)}${noBGM.toFixed(1)}  (delta ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} dB)`);
  }

  // Cleanup
  await rm(join(STORAGE_PATH, "audio", outName), { force: true });
  await rm(join(STORAGE_PATH, "audio", refName), { force: true });
  await rm(TEST_DIR, { recursive: true, force: true });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

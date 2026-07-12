import { execSync } from "node:child_process";
import { join } from "node:path";
import { generateSpeech } from "@src/services/tts/kokoro";
import ffmpeg from "fluent-ffmpeg";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";
const out = "/tmp/premaster-check.wav";
const ttsPath = "/tmp/check-narr.wav";
const ttsCopy = "/tmp/check-narr-copy.wav";

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
  await generateSpeech("Hello. World.", "af_heart", ttsPath);
  execSync(`cp ${ttsPath} ${ttsCopy}`);

  const bgmPath = join(STORAGE_PATH, "bgm", "ambient-inspiring.mp3");
  const narrationDuration = parseFloat(
    execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${ttsCopy}`, { encoding: "utf8" }),
  );
  console.log("narr duration:", narrationDuration);

  await new Promise<void>((res, rej) => {
    ffmpeg()
      .input(bgmPath)
      .inputOptions(["-stream_loop", "-1"])
      .input(ttsCopy)
      .complexFilter([
        `[0:a]atrim=duration=${narrationDuration}[bgm_trimmed]`,
        `[bgm_trimmed]volume=0.04[bgm_reduced]`,
        `[bgm_reduced]afade=t=in:d=1,afade=t=out:st=${Math.max(0, narrationDuration - 1)}:d=1[bgm_faded]`,
        `[1:a]asplit[narration_sidechain][narration_mix]`,
        `[bgm_faded][narration_sidechain]sidechaincompress=threshold=0.1:ratio=4:attack=10:release=200:mix=1[ducked]`,
        `[narration_mix][ducked]amix=inputs=2:duration=first:weights=1 1:normalize=0[mixed]`,
      ])
      .outputOptions(["-map", "[mixed]", "-c:a", "pcm_s16le", "-ar", "48000"])
      .on("end", () => res())
      .on("error", (e) => rej(e))
      .save(out);
  });

  console.log("\n=== PRE-MASTER (before mastering) ===");
  console.log("full:", measureLUFS(out).toFixed(1), "LUFS");
  console.log(`0-${Math.min(1, narrationDuration).toFixed(1)}s (fade-in):`, measureLUFS(out, 0, Math.min(1, narrationDuration)).toFixed(1));
  console.log("mid:", measureLUFS(out, 0.5, Math.min(1.5, narrationDuration)).toFixed(1));
  console.log(`end (fade-out):`, measureLUFS(out, Math.max(0, narrationDuration - 1), narrationDuration).toFixed(1));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

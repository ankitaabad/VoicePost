import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { getLogger } from "@src/lib/core/logger";
import {
  DEFAULT_MASTERING_OPTIONS,
  type MasteringOptions,
  masterAudio,
} from "@src/services/audio/mastering";
import ffmpeg from "fluent-ffmpeg";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";

function getDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data.format.duration ?? 0);
    });
  });
}

async function buildPreMasterWav(
  narrationPath: string,
  preMasterPath: string,
  bgmPath: string | undefined,
  fadeInSec: number,
  fadeOutSec: number,
): Promise<void> {
  const narrationDuration = await getDuration(narrationPath);
  const fadeOutStart = Math.max(0, narrationDuration - fadeOutSec);

  if (bgmPath) {
    const bgmFull = join(STORAGE_PATH, "bgm", bgmPath);
    const bgmDuration = await getDuration(bgmFull);
    const shouldLoop = bgmDuration < narrationDuration;

    const command = ffmpeg();
    if (shouldLoop) {
      command.input(bgmFull).inputOptions(["-stream_loop", "-1"]);
    } else {
      command.input(bgmFull);
    }

    await new Promise<void>((resolve, reject) => {
      command
        .input(narrationPath)
        .complexFilter([
          `[0:a]atrim=duration=${narrationDuration}[bgm_trimmed]`,
          `[bgm_trimmed]volume=0.04[bgm_reduced]`,
          `[bgm_reduced]afade=t=in:d=${fadeInSec},afade=t=out:st=${fadeOutStart}:d=${fadeOutSec}[bgm_faded]`,
          `[1:a]asplit[narration_sidechain][narration_mix]`,
          `[bgm_faded][narration_sidechain]sidechaincompress=threshold=0.1:ratio=4:attack=10:release=200:mix=1[ducked]`,
          `[narration_mix][ducked]amix=inputs=2:duration=first:weights=1 1:normalize=0[mixed]`,
        ])
        .outputOptions(["-map", "[mixed]", "-c:a", "pcm_s16le", "-ar", "48000"])
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .save(preMasterPath);
    });
  } else {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(narrationPath)
        .audioCodec("pcm_s16le")
        .audioFrequency(48000)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .save(preMasterPath);
    });
  }
}

export async function processAudio(
  narrationPath: string,
  outputPath: string,
  tempDir: string,
  bgmPath?: string,
  options: MasteringOptions = {},
): Promise<string> {
  const logger = getLogger();
  const opts = { ...DEFAULT_MASTERING_OPTIONS, ...options };

  const preMasterPath = join(tempDir, "premaster.wav");

  logger.info(
    `[ffmpeg] Starting: ${narrationPath} → ${outputPath}, bgm=${bgmPath ?? "none"}`,
  );

  const t0 = Date.now();

  await buildPreMasterWav(
    narrationPath,
    preMasterPath,
    bgmPath,
    opts.fadeInSec,
    opts.fadeOutSec,
  );

  await masterAudio(preMasterPath, outputPath, opts);

  await unlink(narrationPath).catch(() => {});
  await unlink(preMasterPath).catch(() => {});

  logger.info(`[ffmpeg] total: ${Date.now() - t0}ms → ${outputPath}`);
  return outputPath;
}

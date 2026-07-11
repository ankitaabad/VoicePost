import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { getLogger } from "@src/lib/core/logger";
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

export async function processAudio(
  narrationPath: string,
  outputId: string,
  bgmPath?: string,
): Promise<string> {
  const logger = getLogger();
  const outputFilename = `${outputId}.mp3`;
  const outputPath = join(STORAGE_PATH, "audio", outputFilename);

  logger.info(
    `[ffmpeg] Starting: ${narrationPath} → ${outputPath}, bgm=${bgmPath ?? "none"}`,
  );

  const t0 = Date.now();

  const narrationDuration = await getDuration(narrationPath);
  const fadeInDuration = 1;
  const fadeOutDuration = 1;
  const fadeOutStart = Math.max(0, narrationDuration - fadeOutDuration);

  await new Promise<void>((resolve, reject) => {
    (async () => {
      const command = ffmpeg();

      if (bgmPath) {
        const bgmFull = join(STORAGE_PATH, "bgm", bgmPath);

        const bgmDuration = await getDuration(bgmFull);

        const shouldLoop = bgmDuration < narrationDuration;
        logger.info(
          `[ffmpeg] BGM: ${bgmPath} (${bgmDuration.toFixed(1)}s), narration: ${narrationDuration.toFixed(1)}s, looping: ${shouldLoop}`,
        );

        if (shouldLoop) {
          command.input(bgmFull).inputOptions(["-stream_loop", "-1"]);
        } else {
          command.input(bgmFull);
        }

        command
          .input(narrationPath)
          .complexFilter([
            `[0:a]atrim=duration=${narrationDuration}[bgm_trimmed]`,
            `[bgm_trimmed]volume=0.5[bgm_reduced]`,
            `[bgm_reduced]afade=t=in:d=${fadeInDuration},afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}[bgm_faded]`,
            `[1:a]highpass=f=80[narration_hp]`,
            `[narration_hp]equalizer=f=250:t=q:w=1:g=-2[narration_low]`,
            `[narration_low]equalizer=f=4000:t=q:w=1:g=2[narration_eq]`,
            `[narration_eq]loudnorm=I=-16:TP=-1.5:LRA=11[narration]`,
            `[narration]asplit[narration_sidechain][narration_mix]`,
            `[bgm_faded][narration_sidechain]sidechaincompress=threshold=-20dB:ratio=4:attack=10:release=200:mix=1[ducked]`,
            `[narration_mix][ducked]amix=inputs=2:duration=first:weights=1 0.5[mixed]`,
            `[mixed]alimiter=limit=-1dB[limited]`,
            `[limited]loudnorm=I=-16:LRA=7:TP=-1[mastered]`,
            `[mastered]atrim=duration=${narrationDuration}[output]`,
          ])
          .outputOptions(["-map", "[output]", "-b:a", "192k"])
          .save(outputPath)
          .on("end", () => {
            logger.info(
              `[ffmpeg] Done with BGM: ${Date.now() - t0}ms → ${outputPath}`,
            );
            resolve();
          })
          .on("error", (err) => {
            logger.error(`[ffmpeg] BGM processing failed: ${err}`);
            reject(err);
          });
      } else {
        command
          .input(narrationPath)
          .audioFilters([
            "highpass=f=80",
            "equalizer=f=250:t=q:w=1:g=-2",
            "equalizer=f=4000:t=q:w=1:g=2",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            `afade=t=in:d=${fadeInDuration}`,
            `afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}`,
            "alimiter=limit=-1dB",
            "loudnorm=I=-16:LRA=7:TP=-1",
          ])
          .audioBitrate("192k")
          .save(outputPath)
          .on("end", () => {
            logger.info(
              `[ffmpeg] Done without BGM: ${Date.now() - t0}ms → ${outputPath}`,
            );
            resolve();
          })
          .on("error", (err) => {
            logger.error(`[ffmpeg] No-BGM processing failed: ${err}`);
            reject(err);
          });
      }
    })();
  });

  await unlink(narrationPath).catch(() => {});

  return outputFilename;
}

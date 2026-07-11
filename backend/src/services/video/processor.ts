import { join } from "node:path";
import { getLogger } from "@src/lib/core/logger";
import ffmpeg from "fluent-ffmpeg";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";
const MAX_WIDTH = 1920;

function getDimensions(
  filePath: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const video = data.streams.find((s) => s.width && s.height);
      if (!video?.width || !video.height) {
        return reject(new Error("Could not detect image dimensions"));
      }
      resolve({ width: video.width, height: video.height });
    });
  });
}

export async function generateVideo(
  audioPath: string,
  thumbnailPath: string,
  outputId: string,
  overlayY = 0.8,
): Promise<string> {
  const logger = getLogger();
  const outputPath = join(STORAGE_PATH, "video", `${outputId}.mp4`);

  const dims = await getDimensions(thumbnailPath);
  let outputWidth = dims.width;
  let outputHeight = dims.height;

  if (outputWidth > MAX_WIDTH) {
    const scale = MAX_WIDTH / outputWidth;
    outputWidth = MAX_WIDTH;
    outputHeight = Math.round(outputHeight * scale);
  }

  if (outputWidth % 2 !== 0) outputWidth += 1;
  if (outputHeight % 2 !== 0) outputHeight += 1;

  const barsHeight = Math.round(outputHeight / 5);

  logger.info(
    `[video] Thumbnail: ${dims.width}x${dims.height} → Output: ${outputWidth}x${outputHeight}, bars: ${barsHeight}px`,
  );

  const t0 = Date.now();

  return new Promise<string>((resolve, reject) => {
    ffmpeg()
      .input(thumbnailPath)
      .inputOptions(["-loop", "1", "-framerate", "30"])
      .input(audioPath)
      .complexFilter([
        `[1:a]aformat=channel_layouts=mono,showfreqs=s=${outputWidth}x${barsHeight}:mode=bar:fscale=lin:ascale=sqrt:win_size=256:w=25:r=15:colors=white@0.8,format=yuva420p,colorkey=0x000000:0.01:0.1[viz]`,
        `[0:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2:black,colorchannelmixer=rr=0.5:gg=0.5:bb=0.5[bg]`,
        `[bg][viz]overlay=0:(H-h)*${overlayY}:format=auto[out]`,
      ])
      .outputOptions([
        "-map",
        "[out]",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "copy",
        "-shortest",
        "-movflags",
        "+faststart",
      ])
      .save(outputPath)
      .on("end", () => {
        logger.info(
          `[video] Done: ${outputId}, ${Date.now() - t0}ms → ${outputPath}`,
        );
        resolve(outputPath);
      })
      .on("error", (err) => {
        logger.error(`[video] Failed: ${err}`);
        reject(err);
      });
  });
}

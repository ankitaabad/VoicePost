import { join } from "node:path";
import { getLogger } from "@src/lib/core/logger";
import ffmpeg from "fluent-ffmpeg";
import { buildCaptionFilters, buildCaptionSegments } from "./captions";
import { getVoiceProfile } from "./voiceProfiles";

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

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration ?? 0);
    });
  });
}

export async function generateVideo(
  audioPath: string,
  thumbnailPath: string,
  outputId: string,
  _overlayY = 0.8,
  script?: string,
  voiceId?: string,
): Promise<string> {
  const logger = getLogger();
  const outputPath = join(STORAGE_PATH, "video", `${outputId}.mp4`);

  const dims = await getDimensions(thumbnailPath);
  const duration = await getAudioDuration(audioPath);
  let outputWidth = dims.width;
  let outputHeight = dims.height;

  if (outputWidth > MAX_WIDTH) {
    const scale = MAX_WIDTH / outputWidth;
    outputWidth = MAX_WIDTH;
    outputHeight = Math.round(outputHeight * scale);
  }

  if (outputWidth % 2 !== 0) outputWidth += 1;
  if (outputHeight % 2 !== 0) outputHeight += 1;

  const voiceProfile = getVoiceProfile(voiceId ?? "af_heart");

  logger.info(
    `[video] Thumbnail: ${dims.width}x${dims.height} → Output: ${outputWidth}x${outputHeight}, duration: ${duration.toFixed(1)}s, voice: ${voiceProfile.id}, captions: ${script ? "yes" : "no"}`,
  );

  let captionChain = "";
  if (script) {
    const segments = buildCaptionSegments(script, duration, voiceProfile);
    const filters = buildCaptionFilters(segments, outputHeight, outputWidth);
    if (filters.length > 0) {
      captionChain = `,${filters.join(",")}`;
    }
  }

  const fps = 30;

  const t0 = Date.now();

  const mainChain = `[0:v]fps=${fps},drawbox=x=0:y=0:w=iw:h=ih:color=black@0.2:t=fill${captionChain}[main]`;
  const waveformChain = [
    `[1:a]showwaves=s=700x140:mode=cline:colors=white@0.5:rate=${fps}[wave]`,
    `[wave]gblur=sigma=2,format=rgba,colorkey=0x000000:0.01:0.3[glow]`,
  ].join(",");
  const overlayChain = `[main][glow]overlay=(W-w)/2:(H-h)/2:format=auto[out]`;

  return new Promise<string>((resolve, reject) => {
    ffmpeg()
      .input(thumbnailPath)
      .inputOptions(["-loop 1"])
      .input(audioPath)
      .complexFilter([`${mainChain};${waveformChain};${overlayChain}`])
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
        "-pix_fmt",
        "yuv420p",
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

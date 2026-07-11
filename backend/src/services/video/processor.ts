import { join } from "node:path";
import { getLogger } from "@src/lib/core/logger";
import { loadTtsMetadata } from "@src/services/tts/metadata";
import ffmpeg from "fluent-ffmpeg";
import { buildCaptionFilters, groupTokensIntoSegments } from "./captions";
import { analyzeThumbnail } from "./thumbnailAnalysis";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";
const MAX_WIDTH = 1920;
const WAVEFORM_W = 900;
const WAVEFORM_H = 200;
const WAVEFORM_SIZE = `${WAVEFORM_W}x${WAVEFORM_H}`;

// Audio processor (`backend/src/services/audio/processor.ts`) applies
// 1s fade-in and 1s fade-out as VOLUME RAMPS — `atrim=duration=...`
// keeps the output length equal to the raw TTS duration, so Kokoro's
// token timestamps already align with the post-processed audio.
const AUDIO_PADDING_SECONDS = 0;

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
  audioId?: string,
): Promise<string> {
  const logger = getLogger();
  const outputPath = join(STORAGE_PATH, "video", `${outputId}.mp4`);

  const dims = await getDimensions(thumbnailPath);
  const duration = await getAudioDuration(audioPath);
  const { yavg, brightness } = await analyzeThumbnail(thumbnailPath);
  let outputWidth = dims.width;
  let outputHeight = dims.height;

  if (outputWidth > MAX_WIDTH) {
    const scale = MAX_WIDTH / outputWidth;
    outputWidth = MAX_WIDTH;
    outputHeight = Math.round(outputHeight * scale);
  }

  if (outputWidth % 2 !== 0) outputWidth += 1;
  if (outputHeight % 2 !== 0) outputHeight += 1;

  logger.info(
    `[video] Thumbnail: ${dims.width}x${dims.height} → Output: ${outputWidth}x${outputHeight}, duration: ${duration.toFixed(1)}s`,
  );

  let captionChain = "";
  if (audioId) {
    const metadata = await loadTtsMetadata(audioId);
    if (metadata) {
      const segments = groupTokensIntoSegments(
        metadata,
        AUDIO_PADDING_SECONDS,
        AUDIO_PADDING_SECONDS,
        duration,
      );
      const filters = buildCaptionFilters(
        segments,
        outputHeight,
        outputWidth,
        brightness,
      );
      if (filters.length > 0) {
        captionChain = `,${filters.join(",")}`;
      }
      logger.info(
        `[video] Captions: ${segments.length} segments from ${metadata.tokens.length} Kokoro tokens`,
      );
    } else {
      logger.warn(
        `[video] No TTS metadata sidecar for audio_id=${audioId}; skipping captions`,
      );
    }
  }

  const fps = 30;

  const t0 = Date.now();

  const overlayAlpha = (0.05 + 0.15 * (yavg / 255)).toFixed(2);
  const dimChain = `drawbox=x=0:y=0:w=iw:h=ih:color=black@${overlayAlpha}:t=fill`;
  const mainChain = `[0:v]fps=${fps},${dimChain}${captionChain}[main]`;
  const waveformChain = `[1:a]showwaves=s=${WAVEFORM_SIZE}:mode=cline:colors=white@1.0:rate=20:draw=full,gblur=sigma=1,format=rgba,colorkey=0x000000:0.01:0.3[glow]`;
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

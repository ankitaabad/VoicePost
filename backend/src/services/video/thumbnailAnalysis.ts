import { getLogger } from "@src/lib/core/logger";
import ffmpeg from "fluent-ffmpeg";

export type ThumbnailBrightness = "light" | "dark";

export type ThumbnailAnalysis = {
  brightness: ThumbnailBrightness;
  yavg: number;
};

const BRIGHTNESS_THRESHOLD = 128;

export function analyzeThumbnail(
  thumbnailPath: string,
): Promise<ThumbnailAnalysis> {
  const logger = getLogger();
  return new Promise((resolve) => {
    let lastYavg = 0;
    ffmpeg(thumbnailPath)
      .videoFilters([
        "signalstats",
        "metadata=print:key=lavfi.signalstats.YAVG",
      ])
      .output("-")
      .outputOptions(["-f null"])
      .on("stderr", (line) => {
        const match = line.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
        if (match) lastYavg = parseFloat(match[1]);
      })
      .on("end", () => {
        const brightness: ThumbnailBrightness =
          lastYavg > BRIGHTNESS_THRESHOLD ? "light" : "dark";
        logger.info(
          `[video] Thumbnail brightness: ${lastYavg.toFixed(1)} → ${brightness}`,
        );
        resolve({ brightness, yavg: lastYavg });
      })
      .on("error", (err) => {
        logger.warn(
          `[video] Brightness analysis failed: ${err.message}, defaulting to dark`,
        );
        resolve({ brightness: "dark", yavg: 0 });
      })
      .run();
  });
}

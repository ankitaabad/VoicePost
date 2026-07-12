import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getLogger } from "@src/lib/core/logger";
import ffmpeg from "fluent-ffmpeg";

export type MasteringOptions = {
  highpassHz?: number;
  lowMidHz?: number;
  lowMidCutDb?: number;
  lowMidQ?: number;
  presenceHz?: number;
  presenceBoostDb?: number;
  presenceQ?: number;
  airShelfHz?: number;
  airShelfDb?: number;
  enableCompressor?: boolean;
  skipShaping?: boolean;
  targetLufs?: number;
  truePeakDb?: number;
  loudnessRange?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  outputBitrate?: string;
};

export const DEFAULT_MASTERING_OPTIONS: Required<MasteringOptions> = {
  highpassHz: 80,
  lowMidHz: 220,
  lowMidCutDb: -1.5,
  lowMidQ: 1.4,
  presenceHz: 3500,
  presenceBoostDb: 1.5,
  presenceQ: 1.2,
  airShelfHz: 9000,
  airShelfDb: 1.2,
  enableCompressor: false,
  skipShaping: false,
  targetLufs: -16,
  truePeakDb: -1.5,
  loudnessRange: 11,
  fadeInSec: 1,
  fadeOutSec: 1,
  outputBitrate: "192k",
};

function getDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data.format.duration ?? 0);
    });
  });
}

type LoudnormMeasurement = {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
};

async function measureLoudness(
  inputPath: string,
  targetLufs: number,
  truePeakDb: number,
  loudnessRange: number,
): Promise<LoudnormMeasurement> {
  const logger = getLogger();
  const filter = `loudnorm=I=${targetLufs}:TP=${truePeakDb}:LRA=${loudnessRange}:print_format=json`;

  const stderr = await new Promise<string>((resolve, reject) => {
    const lines: string[] = [];
    const nullOut = join(tmpdir(), `loudnorm-measure-${randomUUID()}.null`);
    ffmpeg(inputPath)
      .audioFilters(filter)
      .outputOptions(["-f", "null"])
      .on("stderr", (line) => {
        lines.push(line);
      })
      .on("end", () => resolve(lines.join("\n")))
      .on("error", (err) => reject(err))
      .save(nullOut);
  }).catch((err) => {
    logger.error(`[loudnorm:measure] failed: ${err}`);
    throw err;
  });

  const match = stderr.match(
    /\{[\s\S]*?"input_i"[\s\S]*?"target_offset"[\s\S]*?\}/,
  );
  if (!match) {
    throw new Error("loudnorm measurement pass did not return JSON");
  }
  return JSON.parse(match[0]) as LoudnormMeasurement;
}

function buildFilterChain(
  opts: Required<MasteringOptions>,
  duration: number,
  measured: LoudnormMeasurement,
): string[] {
  const fadeOutStart = Math.max(0, duration - opts.fadeOutSec);
  const chains: string[] = [];

  if (!opts.skipShaping) {
    chains.push(`highpass=f=${opts.highpassHz}`);
    chains.push(
      `equalizer=f=${opts.lowMidHz}:t=q:w=${opts.lowMidQ}:g=${opts.lowMidCutDb}`,
    );
    chains.push(
      `equalizer=f=${opts.presenceHz}:t=q:w=${opts.presenceQ}:g=${opts.presenceBoostDb}`,
    );
    chains.push(`highshelf=f=${opts.airShelfHz}:g=${opts.airShelfDb}`);

    if (opts.enableCompressor) {
      chains.push("acompressor=threshold=0.125:ratio=3:attack=20:release=200");
    }
  }

  chains.push(
    `loudnorm=I=${opts.targetLufs}:TP=${opts.truePeakDb}:LRA=${opts.loudnessRange}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=summary`,
  );
  chains.push(`afade=t=in:d=${opts.fadeInSec}`);
  chains.push(`afade=t=out:st=${fadeOutStart}:d=${opts.fadeOutSec}`);
  chains.push("alimiter=limit=0.891");

  return chains;
}

export async function masterAudio(
  inputPath: string,
  outputPath: string,
  options: MasteringOptions = {},
): Promise<void> {
  const logger = getLogger();
  const opts: Required<MasteringOptions> = {
    ...DEFAULT_MASTERING_OPTIONS,
    ...options,
  };

  logger.info(
    `[masterAudio] start: ${inputPath} → ${outputPath} (opts=${JSON.stringify(opts)})`,
  );

  const t0 = Date.now();
  const duration = await getDuration(inputPath);

  const measured = await measureLoudness(
    inputPath,
    opts.targetLufs,
    opts.truePeakDb,
    opts.loudnessRange,
  );
  logger.info(
    `[masterAudio] measured: I=${measured.input_i} LUFS, TP=${measured.input_tp} dBTP, LRA=${measured.input_lra} LU, offset=${measured.target_offset} LU`,
  );

  const filters = buildFilterChain(opts, duration, measured);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(filters)
      .audioBitrate(opts.outputBitrate)
      .on("stderr", (line) => {
        if (line.includes("Output")) {
          process.stderr.write(`[masterAudio] ${line}`);
        }
      })
      .on("end", () => {
        logger.info(`[masterAudio] done: ${Date.now() - t0}ms → ${outputPath}`);
        resolve();
      })
      .on("error", (err) => {
        logger.error(`[masterAudio] failed: ${err}`);
        reject(err);
      })
      .save(outputPath);
  });
}

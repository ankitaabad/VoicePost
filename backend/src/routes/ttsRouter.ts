import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  GenerateRequest,
  type GenerateResponse,
  RewriteScriptRequest,
  type VideoResponse,
} from "@app/shared";
import { getLogger } from "@src/lib/core/logger";
import {
  BadRequest,
  InternalServerError,
  NotFound,
} from "@src/lib/http/errorHandler";
import { okResponse } from "@src/lib/http/response";
import { processAudio } from "@src/services/audio/processor";
import { rewriteScript } from "@src/services/script/rewriter";
import { fetchVoices, generateSpeech } from "@src/services/tts/kokoro";
import { generateVideo } from "@src/services/video/processor";
import ffmpeg from "fluent-ffmpeg";
import { Hono } from "hono";
import { v4 as uuid } from "uuid";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";

const FALLBACK_VOICES = [
  {
    id: "af_heart",
    name: "American Female (Heart)",
    gender: "female",
    language: "en",
  },
  {
    id: "af_sarah",
    name: "American Female (Sarah)",
    gender: "female",
    language: "en",
  },
  {
    id: "am_adam",
    name: "American Male (Adam)",
    gender: "male",
    language: "en",
  },
  {
    id: "am_liam",
    name: "American Male (Liam)",
    gender: "male",
    language: "en",
  },
];

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) resolve(0);
      else resolve(data.format.duration ?? 0);
    });
  });
}

const router = new Hono();

router.get("/voices", async (c) => {
  const logger = getLogger();
  const ALLOWED_IDS = new Set(FALLBACK_VOICES.map((v) => v.id));

  try {
    const allVoices = await fetchVoices();
    const voices = allVoices.filter((v) => ALLOWED_IDS.has(v.id));
    logger.info(
      `[voices] Live Kokoro: ${voices.length}/${allVoices.length} voices (filtered)`,
    );
    return okResponse(c, voices);
  } catch (err) {
    logger.warn(
      `[voices] Kokoro unreachable, using fallback (${FALLBACK_VOICES.length} voices): ${err}`,
    );
    return okResponse(c, FALLBACK_VOICES);
  }
});

const SAMPLE_VOICE_IDS = new Set(FALLBACK_VOICES.map((v) => v.id));

router.get("/sample/:voiceId", async (c) => {
  const voiceId = c.req.param("voiceId");
  if (!SAMPLE_VOICE_IDS.has(voiceId)) {
    throw new NotFound("Voice sample not found");
  }

  const filePath = join(STORAGE_PATH, "samples", `${voiceId}.wav`);

  try {
    await stat(filePath);
  } catch {
    throw new NotFound("Voice sample not found");
  }

  const file = await import("node:fs/promises").then((m) =>
    m.readFile(filePath),
  );
  return c.newResponse(file, 200, {
    "Content-Type": "audio/wav",
    "Content-Disposition": `inline; filename="${voiceId}.wav"`,
  });
});

router.get("/bgm", async (c) => {
  const _logger = getLogger();
  const bgmDir = join(STORAGE_PATH, "bgm");

  let files: string[];
  try {
    files = await readdir(bgmDir);
  } catch {
    return okResponse(c, []);
  }

  const tracks: Array<{
    id: string;
    name: string;
    duration: number;
    file: string;
  }> = [];

  for (const file of files) {
    if (!file.match(/\.(mp3|wav|ogg|flac)$/i)) continue;
    const fullPath = join(bgmDir, file);
    const duration = await getAudioDuration(fullPath);
    const name = file.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    tracks.push({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      duration: Math.round(duration),
      file,
    });
  }

  return okResponse(c, tracks);
});

router.get("/bgm/:file", async (c) => {
  const file = c.req.param("file");
  const filePath = join(STORAGE_PATH, "bgm", file);

  try {
    await stat(filePath);
  } catch {
    throw new NotFound("BGM track not found");
  }

  const fileBuffer = await import("node:fs/promises").then((m) =>
    m.readFile(filePath),
  );

  const ext = file.split(".").pop()?.toLowerCase() ?? "mpeg";
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
  };

  return c.newResponse(fileBuffer, 200, {
    "Content-Type": mimeMap[ext] ?? "audio/mpeg",
    "Content-Disposition": `inline; filename="${file}"`,
  });
});

router.post("/rewrite-script", async (c) => {
  const logger = getLogger();
  const body = await c.req.json();
  const input = RewriteScriptRequest.assert(body);

  try {
    const polished = await rewriteScript(input.script);
    return okResponse(c, { script: polished });
  } catch (err) {
    logger.error(`[rewrite-script] Failed: ${err}`);
    throw new InternalServerError("Failed to rewrite script");
  }
});

router.post("/generate", async (c) => {
  const logger = getLogger();
  const body = await c.req.json();
  const input = GenerateRequest.assert(body);

  const narrationWav = `${uuid()}.wav`;
  const narrationPath = join(STORAGE_PATH, "audio", narrationWav);
  const outputId = uuid();

  try {
    const t0 = Date.now();

    logger.info(
      `[generate] Starting: voice=${input.voice_id}, bgm=${input.bgm_track ?? "none"}, script.length=${input.script.length}`,
    );

    const t1 = Date.now();
    await generateSpeech(input.script, input.voice_id, narrationPath);
    logger.info(`[generate] TTS done: ${Date.now() - t1}ms`);

    const t2 = Date.now();
    await processAudio(narrationPath, outputId, input.bgm_track);
    logger.info(`[generate] Audio processing done: ${Date.now() - t2}ms`);

    const response: GenerateResponse = {
      id: outputId,
      status: "completed",
      audio_url: `/api/v1/tts/audio/${outputId}`,
    };

    logger.info(
      `[generate] Completed: ${outputId}, total=${Date.now() - t0}ms`,
    );
    return okResponse(c, response);
  } catch (err) {
    logger.error(`[generate] Failed at ${Date.now()}ms: ${err}`);

    try {
      await import("node:fs/promises").then((m) => m.unlink(narrationPath));
    } catch {}

    const response: GenerateResponse = {
      id: outputId,
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    };

    throw new InternalServerError(response.error);
  }
});

router.get("/audio/:id", async (c) => {
  const id = c.req.param("id");
  const filePath = join(STORAGE_PATH, "audio", `${id}.mp3`);

  try {
    await stat(filePath);
  } catch {
    throw new NotFound("Audio not found");
  }

  const file = await import("node:fs/promises").then((m) =>
    m.readFile(filePath),
  );
  return c.newResponse(file, 200, {
    "Content-Type": "audio/mpeg",
    "Content-Disposition": `inline; filename="${id}.mp3"`,
  });
});

router.post("/generate-video", async (c) => {
  const logger = getLogger();
  const body = await c.req.parseBody();

  const audioId = typeof body.audio_id === "string" ? body.audio_id : "";
  const thumbnailFile = body.thumbnail;
  const overlayYRaw =
    typeof body.overlay_y === "string" ? body.overlay_y : "0.8";
  const overlayY = Math.min(1, Math.max(0, Number(overlayYRaw) || 0.8));
  const script =
    typeof body.script === "string" && body.script.length > 0
      ? body.script
      : undefined;
  const voiceId =
    typeof body.voice_id === "string" && body.voice_id.length > 0
      ? body.voice_id
      : undefined;

  if (!audioId) {
    throw new BadRequest("audio_id is required");
  }
  if (
    !(thumbnailFile instanceof File) ||
    !["image/jpeg", "image/png"].includes(thumbnailFile.type)
  ) {
    throw new BadRequest("Thumbnail must be a JPEG or PNG image");
  }
  if (thumbnailFile.size > 1 * 1024 * 1024) {
    throw new BadRequest("Thumbnail must be under 1MB");
  }

  const ext = thumbnailFile.type === "image/png" ? "png" : "jpg";
  const thumbId = uuid();
  const thumbPath = join(STORAGE_PATH, "thumbnails", `${thumbId}.${ext}`);
  const audioPath = join(STORAGE_PATH, "audio", `${audioId}.mp3`);
  const outputId = uuid();

  try {
    await stat(audioPath);
  } catch {
    throw new NotFound("Audio not found");
  }

  try {
    const thumbBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
    await import("node:fs/promises").then((m) =>
      m.writeFile(thumbPath, thumbBuffer),
    );

    const t0 = Date.now();
    logger.info(
      `[generate-video] Starting: audio=${audioId}, thumbnail=${thumbnailFile.name}`,
    );

    await generateVideo(
      audioPath,
      thumbPath,
      outputId,
      overlayY,
      script,
      voiceId,
    );
    logger.info(`[generate-video] Done: ${outputId}, ${Date.now() - t0}ms`);

    const response: VideoResponse = {
      id: outputId,
      status: "completed",
      video_url: `/api/v1/tts/video/${outputId}`,
    };
    return okResponse(c, response);
  } catch (err) {
    logger.error(`[generate-video] Failed: ${err}`);
    throw new InternalServerError(
      err instanceof Error ? err.message : "Video generation failed",
    );
  } finally {
    await import("node:fs/promises").then((m) =>
      m.unlink(thumbPath).catch(() => {}),
    );
  }
});

router.get("/video/:id", async (c) => {
  const id = c.req.param("id");
  const filePath = join(STORAGE_PATH, "video", `${id}.mp4`);

  try {
    await stat(filePath);
  } catch {
    throw new NotFound("Video not found");
  }

  const file = await import("node:fs/promises").then((m) =>
    m.readFile(filePath),
  );
  return c.newResponse(file, 200, {
    "Content-Type": "video/mp4",
    "Content-Disposition": `inline; filename="${id}.mp4"`,
  });
});

export default router;

import { readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CreateProjectRequest,
  type CreateProjectResponse,
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
import { saveTtsMetadata } from "@src/services/tts/metadata";
import { generateSRT } from "@src/services/tts/srt";
import { generateVideo } from "@src/services/video/processor";
import ffmpeg from "fluent-ffmpeg";
import { Hono } from "hono";
import { v4 as uuid } from "uuid";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";
const PROJECTS_DIR = join(STORAGE_PATH, "projects");

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

// ────────────────────────────────────────────────────────────────────
// Project-based endpoints
// ────────────────────────────────────────────────────────────────────

/**
 * Create an empty project directory. Returns a stable project ID that
 * the frontend will use for all subsequent operations. Generation is
 * a separate step so the project ID survives audio regenerations.
 * Requires a unique project name in the request body.
 */
router.post("/projects", async (c) => {
  const logger = getLogger();
  const body = await c.req.json();
  const input = CreateProjectRequest.assert(body);
  const name = input.name.trim();

  // Check name uniqueness across existing projects
  try {
    const existingDirs = await readdir(PROJECTS_DIR);
    for (const dir of existingDirs) {
      const metaPath = join(PROJECTS_DIR, dir, "project.json");
      try {
        const raw = await import("node:fs/promises").then((m) =>
          m.readFile(metaPath, "utf8"),
        );
        const meta = JSON.parse(raw) as { name?: string };
        if (meta.name && meta.name.toLowerCase() === name.toLowerCase()) {
          throw new BadRequest("A project with this name already exists");
        }
      } catch (err) {
        if (err instanceof BadRequest) throw err;
        // No project.json or unreadable — skip
      }
    }
  } catch (err) {
    if (err instanceof BadRequest) throw err;
    // Dir may not exist yet — that's fine
  }

  const projectId = uuid();
  const projectDir = join(PROJECTS_DIR, projectId);

  try {
    await import("node:fs/promises").then((m) =>
      m.mkdir(projectDir, { recursive: true }),
    );
    await writeFile(
      join(projectDir, "project.json"),
      JSON.stringify({ name, createdAt: new Date().toISOString() }, null, 2),
    );
  } catch (err) {
    logger.error(`[projects] Failed to create dir ${projectDir}: ${err}`);
    throw new InternalServerError("Failed to create project");
  }

  logger.info(`[projects] Created: ${projectId} ("${name}")`);
  const response: CreateProjectResponse = { id: projectId, name };
  return c.json(response, 201);
});

/**
 * Run the full TTS + audio processing + SRT pipeline for an existing
 * project. Writes `narration.wav`, `audio.mp3`, `subtitles.srt`, and
 * `metadata.json` into the project directory. Re-running replaces all
 * of these (the project ID stays stable).
 */
router.post("/projects/:id/generate", async (c) => {
  const logger = getLogger();
  const projectId = c.req.param("id");
  const projectDir = join(PROJECTS_DIR, projectId);

  logger.info(`[generate] Request received: project=${projectId}`);

  try {
    await stat(projectDir);
  } catch (err) {
    logger.error(`[generate] Project dir not found: ${projectDir}, err=${err}`);
    throw new NotFound("Project not found");
  }

  logger.info(`[generate] Project dir exists, parsing body`);

  let input;
  try {
    const body = await c.req.json();
    logger.info(
      `[generate] Body parsed: script.length=${(body?.script as string)?.length}, voice_id=${body?.voice_id}, speed=${body?.speed}, bgm_track=${body?.bgm_track}`,
    );
    input = GenerateRequest.assert(body);
    logger.info(`[generate] Validation passed`);
  } catch (err) {
    logger.error(`[generate] Body parse/validation failed: ${err}`);
    throw err;
  }

  const narrationPath = join(projectDir, "narration.wav");
  const audioPath = join(projectDir, "audio.mp3");
  const srtPath = join(projectDir, "subtitles.srt");

  try {
    const t0 = Date.now();

    logger.info(
      `[generate] Starting: project=${projectId}, voice=${input.voice_id}, speed=${input.speed}, bgm=${input.bgm_track ?? "none"}, script.length=${input.script.length}`,
    );

    const t1 = Date.now();
    logger.info(`[generate] Calling generateSpeech...`);
    const { metadata } = await generateSpeech(
      input.script,
      input.voice_id,
      narrationPath,
      input.speed,
    );
    await saveTtsMetadata(projectId, metadata);
    logger.info(
      `[generate] TTS done: ${Date.now() - t1}ms, ${metadata.tokens.length} tokens`,
    );

    const t2 = Date.now();
    logger.info(`[generate] Calling processAudio...`);
    await processAudio(narrationPath, audioPath, projectDir, input.bgm_track);
    logger.info(`[generate] Audio processing done: ${Date.now() - t2}ms`);

    const t3 = Date.now();
    const audioDuration = await getAudioDuration(audioPath);
    const srt = generateSRT(metadata, audioDuration);
    await import("node:fs/promises").then((m) => m.writeFile(srtPath, srt));
    logger.info(
      `[generate] SRT generated: ${Date.now() - t3}ms, ${srt.length} bytes`,
    );

    const response: GenerateResponse = {
      id: projectId,
      status: "completed",
      audio_url: `/api/v1/tts/projects/${projectId}/audio`,
      srt_url: `/api/v1/tts/projects/${projectId}/srt`,
    };

    logger.info(
      `[generate] Completed: ${projectId}, total=${Date.now() - t0}ms`,
    );
    return okResponse(c, response);
  } catch (err) {
    logger.error(`[generate] Failed at ${Date.now()}ms: ${err}`);
    logger.error(
      `[generate] Error details: name=${(err as Error)?.name}, message=${(err as Error)?.message}, stack=${(err as Error)?.stack?.slice(0, 500)}`,
    );

    try {
      await import("node:fs/promises").then((m) => m.unlink(narrationPath));
    } catch {}

    const response: GenerateResponse = {
      id: projectId,
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    };

    throw new InternalServerError(response.error);
  }
});

router.get("/projects/:id/audio", async (c) => {
  const projectId = c.req.param("id");
  const filePath = join(PROJECTS_DIR, projectId, "audio.mp3");

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
    "Content-Disposition": `inline; filename="${projectId}.mp3"`,
    "Cache-Control": "no-cache",
  });
});

router.get("/projects/:id/srt", async (c) => {
  const projectId = c.req.param("id");
  const filePath = join(PROJECTS_DIR, projectId, "subtitles.srt");

  try {
    await stat(filePath);
  } catch {
    throw new NotFound("Subtitles not found");
  }

  const file = await import("node:fs/promises").then((m) =>
    m.readFile(filePath),
  );
  return c.newResponse(file, 200, {
    "Content-Type": "application/x-subrip",
    "Content-Disposition": `inline; filename="${projectId}.srt"`,
    "Cache-Control": "no-cache",
  });
});

router.get("/projects/:id/thumbnail", async (c) => {
  const projectId = c.req.param("id");
  const projectDir = join(PROJECTS_DIR, projectId);

  try {
    await stat(projectDir);
  } catch {
    throw new NotFound("Project not found");
  }

  // Try jpg first, then png
  const fs = await import("node:fs/promises");
  for (const ext of ["jpg", "png"] as const) {
    const filePath = join(projectDir, `thumbnail.${ext}`);
    try {
      await stat(filePath);
      const file = await fs.readFile(filePath);
      return c.newResponse(file, 200, {
        "Content-Type": ext === "jpg" ? "image/jpeg" : "image/png",
        "Content-Disposition": `inline; filename="${projectId}.${ext}"`,
        "Cache-Control": "no-cache",
      });
    } catch {
      // Try next extension
    }
  }

  throw new NotFound("Thumbnail not found");
});

router.post("/projects/:id/thumbnail", async (c) => {
  const logger = getLogger();
  const projectId = c.req.param("id");
  const projectDir = join(PROJECTS_DIR, projectId);

  try {
    await stat(projectDir);
  } catch {
    throw new NotFound("Project not found");
  }

  const body = await c.req.parseBody();
  const thumbnailFile = body.thumbnail;

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
  const thumbPath = join(projectDir, `thumbnail.${ext}`);

  // Remove any existing thumbnail (different extension) before writing
  const fs = await import("node:fs/promises");
  for (const oldExt of ["jpg", "png"] as const) {
    if (oldExt === ext) continue;
    const oldPath = join(projectDir, `thumbnail.${oldExt}`);
    try {
      await fs.unlink(oldPath);
    } catch {
      // File didn't exist — fine
    }
  }

  const thumbBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
  await fs.writeFile(thumbPath, thumbBuffer);

  logger.info(
    `[thumbnail] Saved: project=${projectId}, size=${thumbBuffer.length}`,
  );

  return okResponse(c, {
    thumbnail_url: `/api/v1/tts/projects/${projectId}/thumbnail`,
  });
});

router.delete("/projects/:id/thumbnail", async (c) => {
  const projectId = c.req.param("id");
  const projectDir = join(PROJECTS_DIR, projectId);

  try {
    await stat(projectDir);
  } catch {
    throw new NotFound("Project not found");
  }

  const fs = await import("node:fs/promises");
  let deleted = false;
  for (const ext of ["jpg", "png"] as const) {
    const filePath = join(projectDir, `thumbnail.${ext}`);
    try {
      await fs.unlink(filePath);
      deleted = true;
    } catch {
      // File didn't exist — fine
    }
  }

  if (!deleted) {
    throw new NotFound("Thumbnail not found");
  }

  return okResponse(c, { deleted: true });
});

router.post("/projects/:id/video", async (c) => {
  const logger = getLogger();
  const projectId = c.req.param("id");
  const projectDir = join(PROJECTS_DIR, projectId);

  try {
    await stat(projectDir);
  } catch {
    throw new NotFound("Project not found");
  }

  const body = await c.req.parseBody();

  const thumbnailFile = body.thumbnail;
  const overlayYRaw =
    typeof body.overlay_y === "string" ? body.overlay_y : "0.8";
  const overlayY = Math.min(1, Math.max(0, Number(overlayYRaw) || 0.8));

  const audioPath = join(projectDir, "audio.mp3");

  try {
    await stat(audioPath);
  } catch {
    throw new NotFound("Audio not found — generate audio first");
  }

  // Determine thumbnail path: use uploaded file if provided, otherwise
  // look for an existing thumbnail on the server (uploaded via the
  // separate POST /projects/:id/thumbnail endpoint).
  let thumbPath: string;
  if (thumbnailFile instanceof File) {
    if (!["image/jpeg", "image/png"].includes(thumbnailFile.type)) {
      throw new BadRequest("Thumbnail must be a JPEG or PNG image");
    }
    if (thumbnailFile.size > 1 * 1024 * 1024) {
      throw new BadRequest("Thumbnail must be under 1MB");
    }
    const ext = thumbnailFile.type === "image/png" ? "png" : "jpg";
    thumbPath = join(projectDir, `thumbnail.${ext}`);
    const fs = await import("node:fs/promises");
    const thumbBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
    await fs.writeFile(thumbPath, thumbBuffer);
  } else {
    // Look for existing thumbnail
    const exts = ["jpg", "png"] as const;
    const found = exts.find((e) => {
      try {
        // sync stat via require — this is a one-time lookup
        return require("node:fs").existsSync(
          join(projectDir, `thumbnail.${e}`),
        );
      } catch {
        return false;
      }
    });
    if (!found) {
      throw new BadRequest("Thumbnail not found — upload one first");
    }
    thumbPath = join(projectDir, `thumbnail.${found}`);
  }

  try {
    const t0 = Date.now();
    logger.info(
      `[generate-video] Starting: project=${projectId}, thumbnail=${thumbPath}`,
    );

    await generateVideo(audioPath, thumbPath, projectId, overlayY);
    logger.info(`[generate-video] Done: ${projectId}, ${Date.now() - t0}ms`);

    const response: VideoResponse = {
      id: projectId,
      status: "completed",
      video_url: `/api/v1/tts/projects/${projectId}/video`,
    };
    return okResponse(c, response);
  } catch (err) {
    logger.error(`[generate-video] Failed: ${err}`);
    throw new InternalServerError(
      err instanceof Error ? err.message : "Video generation failed",
    );
  } finally {
    // Thumbnail is persisted in project dir; no cleanup needed
  }
});

router.get("/projects/:id/video", async (c) => {
  const projectId = c.req.param("id");
  const filePath = join(PROJECTS_DIR, projectId, "video.mp4");

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
    "Content-Disposition": `inline; filename="${projectId}.mp4"`,
    "Cache-Control": "no-cache",
  });
});

router.delete("/projects/:id", async (c) => {
  const logger = getLogger();
  const projectId = c.req.param("id");
  const projectDir = join(PROJECTS_DIR, projectId);

  try {
    await stat(projectDir);
  } catch {
    throw new NotFound("Project not found");
  }

  try {
    await import("node:fs/promises").then((m) =>
      m.rm(projectDir, { recursive: true, force: true }),
    );
  } catch (err) {
    logger.error(`[projects] Failed to delete ${projectId}: ${err}`);
    throw new InternalServerError("Failed to delete project");
  }

  logger.info(`[projects] Deleted: ${projectId}`);
  return okResponse(c, { id: projectId, deleted: true });
});

export default router;

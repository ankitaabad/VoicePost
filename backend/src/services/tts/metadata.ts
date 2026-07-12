import { join } from "node:path";
import type { TtsMetadata } from "@app/shared";

const PROJECTS_DIR = join(process.env.STORAGE_PATH ?? "storage", "projects");

/**
 * Save Kokoro's per-token metadata into a project's directory. Stored
 * as `metadata.json` alongside the project's audio and video files so
 * downstream consumers (SRT, video captions) can recover word-level
 * timings without re-running TTS.
 */
export async function saveTtsMetadata(
  projectId: string,
  metadata: TtsMetadata,
): Promise<string> {
  const path = join(PROJECTS_DIR, projectId, "metadata.json");
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(join(PROJECTS_DIR, projectId), { recursive: true });
  await writeFile(path, JSON.stringify(metadata));
  return path;
}

/**
 * Load Kokoro's per-token metadata for a project. Returns `null` if
 * the sidecar does not exist.
 */
export async function loadTtsMetadata(
  projectId: string,
): Promise<TtsMetadata | null> {
  const path = join(PROJECTS_DIR, projectId, "metadata.json");
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as TtsMetadata;
  } catch {
    return null;
  }
}

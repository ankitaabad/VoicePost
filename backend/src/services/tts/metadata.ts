import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TtsMetadata } from "@app/shared";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";
const TOKENS_DIR = join(STORAGE_PATH, "tts-tokens");

/**
 * Save Kokoro's per-token metadata for a generated audio file. The
 * metadata is stored in a sidecar JSON file keyed by audio id so the
 * video pipeline can recover real word-level timestamps later without
 * re-running TTS.
 */
export async function saveTtsMetadata(
  audioId: string,
  metadata: TtsMetadata,
): Promise<string> {
  await mkdir(TOKENS_DIR, { recursive: true });
  const path = join(TOKENS_DIR, `${audioId}.json`);
  await writeFile(path, JSON.stringify(metadata));
  return path;
}

/**
 * Load Kokoro's per-token metadata for a previously generated audio
 * file. Returns `null` if the sidecar does not exist (e.g. audio was
 * generated before this feature shipped).
 */
export async function loadTtsMetadata(
  audioId: string,
): Promise<TtsMetadata | null> {
  const path = join(TOKENS_DIR, `${audioId}.json`);
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as TtsMetadata;
  } catch {
    return null;
  }
}

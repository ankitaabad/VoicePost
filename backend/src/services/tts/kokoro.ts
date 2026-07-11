import { writeFile } from "node:fs/promises";
import { getLogger } from "@src/lib/core/logger";
import axios from "axios";

const KOKORO_URL = process.env.KOKORO_URL ?? "http://localhost:8888";

export type VoiceInfo = {
  id: string;
  name: string;
  gender: string;
  language: string;
};

export async function fetchVoices(): Promise<VoiceInfo[]> {
  const { data } = await axios.get<{ voices: VoiceInfo[] }>(
    `${KOKORO_URL}/voices`,
    { timeout: 5_000 },
  );
  return data.voices;
}

export async function generateSpeech(
  text: string,
  voiceId: string,
  outputPath: string,
): Promise<void> {
  const logger = getLogger();

  logger.info(
    `[kokoro] Requesting: voice=${voiceId}, text.length=${text.length}`,
  );

  const t0 = Date.now();
  const response = await axios.post<ArrayBuffer>(
    `${KOKORO_URL}/tts`,
    { text, voice_id: voiceId, speed: 1.0 },
    {
      responseType: "arraybuffer",
      timeout: 120_000,
      headers: { "Content-Type": "application/json" },
    },
  );

  const buffer = Buffer.from(response.data);
  await writeFile(outputPath, buffer);

  logger.info(
    `[kokoro] Done: ${Date.now() - t0}ms, ${buffer.length} bytes → ${outputPath}`,
  );
}

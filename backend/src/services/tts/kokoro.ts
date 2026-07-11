import { writeFile } from "node:fs/promises";
import type { TtsMetadata } from "@app/shared";
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

export type SynthesizeResult = {
  /** Absolute path to the saved WAV file. */
  audioPath: string;
  /** Sidecar metadata to persist alongside the audio file. */
  metadata: TtsMetadata;
};

export async function generateSpeech(
  text: string,
  voiceId: string,
  outputPath: string,
): Promise<SynthesizeResult> {
  const logger = getLogger();

  logger.info(
    `[kokoro] Requesting: voice=${voiceId}, text.length=${text.length}`,
  );

  const t0 = Date.now();
  const response = await axios.post<{
    audio: string;
    sample_rate: number;
    duration: number;
    voice_id: string;
    tokens: TtsMetadata["tokens"];
  }>(
    `${KOKORO_URL}/tts`,
    { text, voice_id: voiceId, speed: 1.0 },
    {
      timeout: 120_000,
      headers: { "Content-Type": "application/json" },
    },
  );

  const audioBytes = Buffer.from(response.data.audio, "base64");
  await writeFile(outputPath, audioBytes);

  const metadata: TtsMetadata = {
    voice_id: response.data.voice_id,
    duration: response.data.duration,
    sample_rate: response.data.sample_rate,
    tokens: response.data.tokens,
  };

  logger.info(
    `[kokoro] Done: ${Date.now() - t0}ms, ${audioBytes.length} bytes, ${metadata.tokens.length} tokens → ${outputPath}`,
  );

  return { audioPath: outputPath, metadata };
}

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import axios from "axios";

const KOKORO_URL = process.env.KOKORO_URL ?? "http://localhost:8888";
const SAMPLES_DIR = join(import.meta.dirname, "..", "storage", "samples");

const SAMPLE_SCRIPT =
  "VoicePost is a media generation platform that transforms text into professional audio and video content. Write or AI-generate a script, pick a voice and background music, and produce broadcast-ready audio. Then turn it into a captioned video with a custom thumbnail.";

const VOICES = ["af_heart", "af_sarah", "am_adam", "am_liam"] as const;

async function generate() {
  await mkdir(SAMPLES_DIR, { recursive: true });

  for (const voiceId of VOICES) {
    const outputPath = join(SAMPLES_DIR, `${voiceId}.wav`);
    console.log(`Generating sample for ${voiceId}...`);

    const t0 = Date.now();
    const response = await axios.post<ArrayBuffer>(
      `${KOKORO_URL}/tts`,
      { text: SAMPLE_SCRIPT, voice_id: voiceId, speed: 1.0 },
      {
        responseType: "arraybuffer",
        timeout: 120_000,
        headers: { "Content-Type": "application/json" },
      },
    );

    const buffer = Buffer.from(response.data);
    await writeFile(outputPath, buffer);
    console.log(`  Done: ${buffer.length} bytes in ${Date.now() - t0}ms`);
  }

  console.log(`\nAll samples generated in ${SAMPLES_DIR}`);
}

generate().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});

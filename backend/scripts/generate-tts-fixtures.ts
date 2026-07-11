import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { VOICE_PROFILES } from "../src/services/video/voiceProfiles";

const KOKORO_URL = "http://localhost:8888/tts";

const SCRIPTS: Record<string, string> = {
  zipup:
    "JavaScript developers\u2014what if your own cloud was just... simple?\n\nIntroducing Zipup Cloud. An open-source personal cloud that lets you deploy and run multiple JavaScript applications from a single server.\n\nEvery app comes with built-in Postgres, Valkey for Redis, and VictoriaLogs for powerful log searching. Host static websites, get automatic Let\u2019s Encrypt SSL certificates, and securely access your services over VPN.\n\nNo complex cloud setup. No unnecessary moving parts. Just everything you need to build and deploy.",
  short: "Your Personal Cloud. Simplified.",
  commas:
    "Your Personal Cloud. Simplified. A fast, secure and pragmatic open-source cloud, designed for JavaScript developers. Simple to use, powerful to run.",
  semicolons:
    "Build faster; deploy smarter. The platform: simple, scalable, secure. One command; total control.",
  questions:
    "Tired of complex cloud setups? Want to deploy with a single command? Looking for built-in Postgres and Redis? Your search ends here.",
  long50:
    "Meet the open-source personal cloud built for developers who value simplicity. Deploy static sites, APIs and full-stack apps from one server. Every project gets Postgres, Redis and log searching out of the box. No vendor lock-in. No surprise bills. Just your infrastructure, your rules.",
};

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration ?? 0);
    });
  });
}

async function generateTTS(
  script: string,
  voiceId: string,
  outputPath: string,
): Promise<void> {
  const response = await fetch(KOKORO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: script, voice_id: voiceId, speed: 1.0 }),
  });
  if (!response.ok) {
    throw new Error(`TTS failed for ${voiceId}: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const { writeFile: fsWriteFile } = await import("node:fs/promises");
  await fsWriteFile(outputPath, buffer);
}

async function main() {
  const durations: Record<string, number> = {};
  const tmpDir = join(import.meta.dirname ?? ".", "tmp-tts");

  // Ensure tmp dir exists
  const { mkdir } = await import("node:fs/promises");
  await mkdir(tmpDir, { recursive: true });

  for (const voice of VOICE_PROFILES) {
    for (const [scriptName, script] of Object.entries(SCRIPTS)) {
      const key = `${voice.id}/${scriptName}`;
      const audioPath = join(tmpDir, `${key.replace("/", "-")}.wav`);

      process.stdout.write(`Generating ${key}...`);
      await generateTTS(script, voice.id, audioPath);
      const duration = await getAudioDuration(audioPath);
      durations[key] = Math.round(duration * 1000) / 1000;
      console.log(` ${duration.toFixed(3)}s`);
    }
  }

  const fixturePath = join(
    import.meta.dirname ?? ".",
    "../src/__tests__/fixtures/tts-durations.json",
  );
  await writeFile(fixturePath, `${JSON.stringify(durations, null, 2)}\n`);
  console.log(
    `\nWrote ${Object.keys(durations).length} durations to ${fixturePath}`,
  );

  // Cleanup tmp files
  const { rm } = await import("node:fs/promises");
  await rm(tmpDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

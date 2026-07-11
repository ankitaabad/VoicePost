import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import app from "./app";
import { validateEnv } from "./env";

validateEnv();

const STORAGE_PATH = process.env.STORAGE_PATH ?? "storage";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const KOKORO_URL = process.env.KOKORO_URL ?? "http://localhost:8888";

await mkdir(join(STORAGE_PATH, "audio"), { recursive: true });

console.log(
  `Config: Ollama=${OLLAMA_URL}, Kokoro=${KOKORO_URL}, Storage=${STORAGE_PATH}`,
);

const PORT = 8080;

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});

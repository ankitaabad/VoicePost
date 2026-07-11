import { getLogger } from "@src/lib/core/logger";
import axios from "axios";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";

type OllamaResponse = {
  response: string;
};

function buildPrompt(raw: string): string {
  return [
    "Turn this into a radio ad script. Hook, then benefits, then call to action.",
    "Conversational tone, like a friendly expert. Short punchy sentences.",
    "Do not repeat yourself. Do not add filler. Say what needs to be said and stop.",
    "No labels, no markdown. Only the script.",
    "",
    "Input:",
    raw,
  ].join("\n");
}

export async function rewriteScript(raw: string): Promise<string> {
  const logger = getLogger();
  const t0 = Date.now();

  logger.info(`[ollama] Sending to qwen3:1.7b: prompt.length=${raw.length}`);

  const { data } = await axios.post<OllamaResponse>(
    `${OLLAMA_URL}/api/generate`,
    {
      model: "qwen3:1.7b",
      prompt: buildPrompt(raw),
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
      },
    },
    { timeout: 180_000 },
  );

  const polished = data.response.trim();
  logger.info(
    `[ollama] Done: ${Date.now() - t0}ms, ${raw.length} → ${polished.length} chars`,
  );
  return polished;
}

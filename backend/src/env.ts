import { type } from "arktype";
import { getLogger } from "./lib/core/logger";

const EnvSchema = type({
  DATABASE_URL: "string",
  PASETO_PRIVATE_KEY: "string",
  PASETO_PUBLIC_KEY: "string",
});

export function validateEnv() {
  const logger = getLogger();
  const result = EnvSchema(process.env);

  if (result instanceof type.errors) {
    for (const err of result) {
      logger.error(`Missing or invalid env var: ${err.message}`);
    }
    process.exit(1);
  }
}

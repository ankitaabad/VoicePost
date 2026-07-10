import { serve } from "@hono/node-server";
import app from "./app";
import { validateEnv } from "./env";

validateEnv();

const PORT = 8080;

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});

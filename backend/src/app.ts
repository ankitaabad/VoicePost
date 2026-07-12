import { loggerMiddleware } from "@src/lib/core/logger";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";

import { errorHandler } from "./lib/http/errorHandler";
import ttsRouter from "./routes/ttsRouter";

const app = new Hono();
app.onError((err, c) => errorHandler(c, err));
app.use(secureHeaders());
app.use("/api/*", loggerMiddleware());

app.route("/api/v1/tts", ttsRouter);

export default app;

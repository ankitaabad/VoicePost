import { loggerMiddleware } from "@src/lib/core/logger";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";

import { errorHandler, Unauthorized } from "./lib/http/errorHandler";
import { authMiddleware, csrfMiddleware } from "./lib/http/middleware";
import profileRouter from "./routes/profileRouter";
import protectedAuthRouter from "./routes/protectedAuthRouter";
import publicAuthRouter from "./routes/publicAuthRouter";

const app = new Hono();
app.onError((err, c) => errorHandler(c, err));
app.use(secureHeaders());
app.use("/api/*", loggerMiddleware());
app.use("*", async (c, next) => {
  const secFetchSite = c.req.header("sec-fetch-site");
  if (secFetchSite && secFetchSite === "cross-site") {
    throw new Unauthorized();
  }
  await next();
});

const publicApi = new Hono();
publicApi.route("/auth", publicAuthRouter);

const protectedApi = new Hono();
protectedApi.use("*", authMiddleware);
protectedApi.use("*", csrfMiddleware);
protectedApi.route("/auth", protectedAuthRouter);
protectedApi.route("/profile", profileRouter);

app.route("/api/v1", publicApi);
app.route("/api/v1", protectedApi);

export default app;

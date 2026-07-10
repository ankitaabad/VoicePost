import { APP_NAME } from "@src/lib/core/constants";
import { asyncLocalStorage } from "@src/lib/core/context";
import { generateId } from "@src/lib/core/id";
import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import SenseLogs from "senselogs";

export const appLogger = new SenseLogs(
  { timestamp: true },
  { service: `${APP_NAME}_service` },
);
appLogger.addFilter(["debug", "info", "warn", "error", "fatal"]);

export const loggerMiddleware = (): MiddlewareHandler => {
  return createMiddleware(async (c, next) => {
    const requestId = c.req.header("Request-ID") || generateId();
    const logger = appLogger.child({
      requestId,
    });
    c.header("Request-ID", requestId);
    return asyncLocalStorage.run({ logger }, async () => {
      await next();
    });
  });
};

export const getLogger = () => {
  const store = asyncLocalStorage.getStore();
  if (!store) {
    return appLogger.child({
      requestId: "system",
      phase: "startup",
    });
  }
  return store.logger;
};

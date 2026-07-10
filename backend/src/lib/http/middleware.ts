import type { UserResponse } from "@app/shared";
import type { AccessTokenPayload } from "@src/lib/auth/token";
import { verifyAccessToken, verifyCSRFToken } from "@src/lib/auth/token";
import { Forbidden, Unauthorized } from "@src/lib/http/errorHandler";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

export type AuthVariables = {
  user: UserResponse;
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const token = getCookie(c, "ACCESS_TOKEN");

    if (!token) {
      throw new Unauthorized("Missing access token");
    }

    let payload: AccessTokenPayload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      throw new Unauthorized("Invalid or expired access token");
    }

    c.set("user", {
      id: payload.sub,
      email: payload.email,
      avatar_url: payload.avatar_url,
      status: payload.status,
    });
    await next();
  },
);

export const csrfMiddleware = createMiddleware(async (c, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    return next();
  }

  const csrfCookie = getCookie(c, "CSRF_TOKEN");
  const csrfHeader = c.req.header("X-CSRF-Token");

  if (!csrfCookie || !csrfHeader) {
    throw new Forbidden("Missing CSRF token");
  }

  const user = c.get("user");
  const userId = user?.id || c.req.header("X-User-Id");

  if (!userId) {
    throw new Forbidden("Missing user context for CSRF validation");
  }

  const valid = await verifyCSRFToken(csrfHeader, userId);
  if (!valid) {
    throw new Forbidden("Invalid CSRF token");
  }

  await next();
});

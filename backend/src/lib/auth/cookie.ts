import type { UserResponse } from "@app/shared";
import {
  generateAccessToken,
  generateCSRFToken,
  generateRefreshToken,
} from "@src/lib/auth/token";
import { CookieType } from "@src/lib/core/constants";
import { getLogger } from "@src/lib/core/logger";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";

export const addAllTokensToCookie = async (
  c: Context,
  reset: boolean = false,
  user?: UserResponse,
) => {
  const logger = getLogger();

  const scheme = c.get("scheme");
  const secure = scheme !== "http";

  const cookieConfigs = {
    [CookieType.ACCESS_TOKEN]: {
      httpOnly: true,
      sameSite: "Lax" as const,
      path: "/",
    },
    [CookieType.REFRESH_TOKEN]: {
      httpOnly: true,
      path: "/api/v1/auth/refresh",
    },
    [CookieType.CSRF_TOKEN]: {
      httpOnly: false,
      sameSite: "strict" as const,
      path: "/",
    },
  };

  const applyCookie = (name: keyof typeof cookieConfigs, value: string) => {
    const config = cookieConfigs[name];

    setCookie(c, name, value, {
      secure,
      ...config,
      ...(reset && {
        maxAge: 0,
        expires: new Date(0),
      }),
    });
  };

  if (reset) {
    logger.info("Clearing cookies");

    (Object.keys(cookieConfigs) as (keyof typeof cookieConfigs)[]).forEach(
      (key) => {
        applyCookie(key, "");
      },
    );

    return;
  }

  if (!user) {
    throw new Error("User data required to generate tokens");
  }

  const [access_token, refresh_token, csrf_token] = await Promise.all([
    generateAccessToken(user),
    generateRefreshToken(user.id),
    generateCSRFToken(user.id),
  ]);

  logger.info("Setting cookies");

  applyCookie(CookieType.ACCESS_TOKEN, access_token);
  applyCookie(CookieType.REFRESH_TOKEN, refresh_token.token);
  applyCookie(CookieType.CSRF_TOKEN, csrf_token);
};

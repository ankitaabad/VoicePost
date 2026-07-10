import type { UserResponse, UserStatus } from "@app/shared";
import { db } from "@src/db/client";
import { V4 } from "paseto";
import { AUD, ISSUER, TokenPurpose } from "../core/constants";
import { generateId } from "../core/id";
import { getLogger } from "../core/logger";
import { getPasetoKeys } from "./tokenKeys";

const ACCESS_TTL = 60 * 60 * 1000;
const REFRESH_TTL = 24 * 60 * 60 * 1000;

export const APP_AUD = "app_access";
export const REFRESH_AUD = "token_refresh";

export type TokenPayload = {
  sub: string;
  aud: AUD;
  iss: typeof ISSUER;
  purpose: TokenPurpose;
  iat: string;
  exp: string;
};

export type AccessTokenPayload = {
  sub: string;
  aud: typeof AUD.APP_API;
  iss: string;
  purpose: typeof TokenPurpose.ACCESS;
  email: string;
  avatar_url: string | null;
  status: UserStatus;
  iat: string;
  exp: string;
};

export type RefreshTokenPayload = {
  sub: string;
  aud: typeof AUD.APP_API;
  iss: string;
  purpose: typeof TokenPurpose.REFRESH;
  jti: string;
  iat: string;
  exp: string;
};

export const generateAccessToken = async (user: UserResponse) => {
  const iat = new Date().toISOString();
  const exp = new Date(Date.now() + ACCESS_TTL).toISOString();
  const payload = {
    sub: user.id,
    email: user.email,
    avatar_url: user.avatar_url,
    status: user.status,
    aud: AUD.APP_API,
    iss: ISSUER,
    purpose: TokenPurpose.ACCESS,
    iat,
    exp,
  };
  const pasetoKeys = await getPasetoKeys();
  return await V4.sign(payload, pasetoKeys.secretKey);
};

export const generateRefreshToken = async (userId: string) => {
  const iat = new Date().toISOString();
  const exp = new Date(Date.now() + REFRESH_TTL).toISOString();
  const jti = generateId();
  const payload = {
    sub: userId,
    aud: AUD.APP_API,
    iss: ISSUER,
    purpose: TokenPurpose.REFRESH,
    jti,
    iat,
    exp,
  };

  await storeRefreshJti(jti, userId, exp);

  const pasetoKeys = await getPasetoKeys();

  return {
    jti,
    token: await V4.sign(payload, pasetoKeys.secretKey),
  };
};

export const generateCSRFToken = async (userId: string) => {
  const iat = new Date().toISOString();
  const exp = new Date(Date.now() + ACCESS_TTL + 5000).toISOString();
  const payload = {
    sub: userId,
    aud: AUD.APP_API,
    iss: ISSUER,
    purpose: TokenPurpose.CSRF,
    iat,
    exp,
  };
  const pasetoKeys = await getPasetoKeys();

  return await V4.sign(payload, pasetoKeys.secretKey);
};

export const verifyAccessToken = async (
  token: string,
): Promise<AccessTokenPayload> => {
  const pasetoKeys = await getPasetoKeys();
  const payload = (await V4.verify(token, pasetoKeys.publicKey, {
    issuer: ISSUER,
  })) as AccessTokenPayload;

  if (payload.aud !== AUD.APP_API) {
    throw new Error("Invalid audience");
  }
  if (payload.purpose !== TokenPurpose.ACCESS) {
    throw new Error("Invalid token purpose");
  }

  const now = Date.now();
  if (new Date(payload.iat).getTime() > now + 30_000) {
    throw new Error("Invalid issued-at (iat)");
  }
  if (new Date(payload.exp).getTime() <= now) {
    throw new Error("Access token expired");
  }
  if (!payload.sub) {
    throw new Error("Missing subject (sub)");
  }

  return payload;
};

export const verifyRefreshToken = async (
  token: string,
): Promise<RefreshTokenPayload> => {
  const pasetoKeys = await getPasetoKeys();
  const payload = (await V4.verify(token, pasetoKeys.publicKey, {
    issuer: ISSUER,
  })) as RefreshTokenPayload;
  if (payload.aud !== AUD.APP_API) {
    throw new Error("Invalid audience");
  }
  if (payload.purpose !== TokenPurpose.REFRESH) {
    throw new Error("Invalid token purpose");
  }
  if (!payload.jti) {
    throw new Error("Missing jti");
  }

  const consumed = await consumeRefreshJti(payload.jti);
  if (!consumed) {
    throw new Error("Refresh token already used or invalid");
  }

  const now = Date.now();
  if (new Date(payload.exp).getTime() <= now) {
    throw new Error("Refresh token expired");
  }

  return payload;
};

export const verifyCSRFToken = async (
  token: string,
  userId: string,
): Promise<boolean> => {
  try {
    const pasetoKeys = await getPasetoKeys();
    const payload = (await V4.verify(token, pasetoKeys.publicKey, {
      issuer: ISSUER,
    })) as {
      sub: string;
      aud: string;
      purpose: string;
      iat: string;
      exp: string;
    };

    if (payload.aud !== AUD.APP_API) return false;
    if (payload.purpose !== TokenPurpose.CSRF) return false;
    if (payload.sub !== userId) return false;

    const now = Date.now();
    if (new Date(payload.exp).getTime() <= now) return false;

    return true;
  } catch {
    return false;
  }
};

async function storeRefreshJti(jti: string, userId: string, exp: string) {
  const logger = getLogger();
  try {
    await db
      .insertInto("refresh_tokens")
      .values({
        id: generateId(),
        user_id: userId,
        jti,
        expires_at: new Date(exp),
      })
      .execute();
  } catch (error) {
    logger.error(`Failed to store refresh token JTI: ${error}`);
    throw new Error("Failed to store refresh token");
  }
}

async function consumeRefreshJti(jti: string): Promise<boolean> {
  try {
    const token = await db
      .selectFrom("refresh_tokens")
      .where("jti", "=", jti)
      .where("used_at", "is", null)
      .where("expires_at", ">", new Date())
      .selectAll()
      .executeTakeFirst();

    if (!token) return false;

    await db
      .updateTable("refresh_tokens")
      .set({ used_at: new Date() })
      .where("id", "=", token.id)
      .execute();

    return true;
  } catch (error) {
    const logger = getLogger();
    logger.error(`Failed to consume refresh token JTI: ${error}`);
    return false;
  }
}

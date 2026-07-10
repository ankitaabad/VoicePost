import { createHash, randomBytes } from "node:crypto";
import {
  ForgotPassword,
  LoginUser,
  RegisterUser,
  ResetPassword,
  type UserResponse,
  VerifyEmail,
} from "@app/shared";
import { db } from "@src/db/client";
import { addAllTokensToCookie } from "@src/lib/auth/cookie";
import {
  hashPassword,
  verifyPasswordHash,
  verifyPasswordStrength,
} from "@src/lib/auth/password";
import { verifyRefreshToken } from "@src/lib/auth/token";
import { generateId } from "@src/lib/core/id";
import { getLogger } from "@src/lib/core/logger";
import { BadRequest, Conflict, Unauthorized } from "@src/lib/http/errorHandler";
import { createResponse, okResponse } from "@src/lib/http/response";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";

const RESET_TOKEN_TTL = 60 * 60 * 1000;

const router = new Hono();

router.post("/register", async (c) => {
  const logger = getLogger();
  const body = await c.req.json();
  const input = RegisterUser.assert(body);

  const strong = await verifyPasswordStrength(input.password);
  if (!strong) {
    throw new BadRequest(
      "Password has been compromised in a data breach. Please choose a different password.",
    );
  }

  const existing = await db
    .selectFrom("users")
    .where("email", "=", input.email)
    .select("id")
    .executeTakeFirst();

  if (existing) {
    logger.warn(`Registration failed: email already registered ${input.email}`);
    throw new Conflict("Email already registered");
  }

  const userId = generateId();
  const authProviderId = generateId();
  const passwordHash = await hashPassword(input.password);

  const user = await db.transaction().execute(async (trx) => {
    const createdUser = await trx
      .insertInto("users")
      .values({
        id: userId,
        email: input.email,
        status: "ACTIVE",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx
      .insertInto("user_auth_providers")
      .values({
        id: authProviderId,
        user_id: userId,
        provider: "EMAIL",
        password_hash: passwordHash,
        status: "VERIFIED",
      })
      .execute();

    return createdUser;
  });

  logger.info(`User registered: ${user.id}`);
  return createResponse(c, user, "User registered successfully");
});

router.post("/login", async (c) => {
  const logger = getLogger();
  const body = await c.req.json();
  const input = LoginUser.assert(body);

  const result = await db
    .selectFrom("users")
    .innerJoin("user_auth_providers", "user_auth_providers.user_id", "users.id")
    .where("users.email", "=", input.email)
    .where("user_auth_providers.provider", "=", "EMAIL")
    .select([
      "users.id",
      "users.email",
      "users.avatar_url",
      "users.status",
      "user_auth_providers.password_hash",
    ])
    .executeTakeFirst();

  if (!result?.password_hash) {
    throw new Unauthorized("Invalid email or password");
  }

  const valid = await verifyPasswordHash(result.password_hash, input.password);
  if (!valid) {
    throw new Unauthorized("Invalid email or password");
  }

  const response: UserResponse = {
    id: result.id,
    email: result.email,
    avatar_url: result.avatar_url,
    status: result.status,
  };

  await addAllTokensToCookie(c, false, response);

  logger.info(`User logged in: ${result.id}`);
  return okResponse(c, response);
});

router.post("/logout", async (c) => {
  const logger = getLogger();
  await addAllTokensToCookie(c, true);
  logger.info("User logged out");
  return okResponse(c, null, "Logged out successfully");
});

router.post("/refresh", async (c) => {
  const logger = getLogger();
  const refreshToken = getCookie(c, "REFRESH_TOKEN");

  if (!refreshToken) {
    throw new Unauthorized("Missing refresh token");
  }

  let payload: { sub: string };
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    throw new Unauthorized("Invalid or expired refresh token");
  }

  const user = await db
    .selectFrom("users")
    .where("id", "=", payload.sub)
    .select(["id", "email", "avatar_url", "status"])
    .executeTakeFirst();

  if (!user) {
    throw new Unauthorized("User not found");
  }

  await addAllTokensToCookie(c, false, user);

  logger.info(`Tokens refreshed for user: ${payload.sub}`);
  return okResponse(c, null, "Tokens refreshed successfully");
});

router.post("/forgot-password", async (c) => {
  const logger = getLogger();
  const body = await c.req.json();
  const input = ForgotPassword.assert(body);

  const user = await db
    .selectFrom("users")
    .where("email", "=", input.email)
    .select("id")
    .executeTakeFirst();

  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    await db
      .insertInto("verification_tokens")
      .values({
        id: generateId(),
        user_id: user.id,
        purpose: "PASSWORD_RESET",
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + RESET_TOKEN_TTL),
      })
      .execute();

    logger.info(`Password reset token generated for user: ${user.id}`);
    return okResponse(c, null, "Password reset link sent", { token: rawToken });
  }

  return okResponse(
    c,
    null,
    "If an account with that email exists, a password reset link has been sent",
  );
});

router.post("/reset-password", async (c) => {
  const logger = getLogger();
  const body = await c.req.json();
  const input = ResetPassword.assert(body);

  const tokenHash = createHash("sha256").update(input.token).digest("hex");

  const resetToken = await db
    .selectFrom("verification_tokens")
    .where("token_hash", "=", tokenHash)
    .where("purpose", "=", "PASSWORD_RESET")
    .where("used_at", "is", null)
    .selectAll()
    .executeTakeFirst();

  if (!resetToken || resetToken.expires_at < new Date()) {
    throw new BadRequest("Invalid or expired reset token");
  }

  const passwordHash = await hashPassword(input.password);

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("user_auth_providers")
      .set({ password_hash: passwordHash })
      .where("user_id", "=", resetToken.user_id)
      .where("provider", "=", "EMAIL")
      .execute();

    await trx
      .updateTable("verification_tokens")
      .set({ used_at: new Date() })
      .where("id", "=", resetToken.id)
      .execute();
  });

  logger.info(`Password reset completed for user: ${resetToken.user_id}`);
  return okResponse(c, null, "Password reset successfully");
});

router.post("/verify-email", async (c) => {
  const logger = getLogger();
  const body = await c.req.json();
  const input = VerifyEmail.assert(body);

  const tokenHash = createHash("sha256").update(input.token).digest("hex");

  const verification = await db
    .selectFrom("verification_tokens")
    .where("token_hash", "=", tokenHash)
    .where("purpose", "=", "EMAIL_VERIFICATION")
    .where("used_at", "is", null)
    .selectAll()
    .executeTakeFirst();

  if (!verification || verification.expires_at < new Date()) {
    throw new BadRequest("Invalid or expired verification token");
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("user_auth_providers")
      .set({ status: "VERIFIED" })
      .where("user_id", "=", verification.user_id)
      .where("provider", "=", "EMAIL")
      .execute();

    await trx
      .updateTable("verification_tokens")
      .set({ used_at: new Date() })
      .where("id", "=", verification.id)
      .execute();
  });

  logger.info(`Email verified for user: ${verification.user_id}`);
  return okResponse(c, null, "Email verified successfully");
});

export default router;

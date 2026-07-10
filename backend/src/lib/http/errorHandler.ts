import { Environment } from "@src/lib/core/constants";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getLogger } from "../core/logger";

class HttpError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
export class BadRequest extends HttpError {
  constructor(message = "Bad request") {
    super(400, "BAD_REQUEST", message);
  }
}
export class MissingRequiredParams extends HttpError {
  constructor(message = "Missing Required Params") {
    super(400, "MISSING_REQUIRED_PARAMS", message);
  }
}

export class Unauthorized extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class BadSignature extends HttpError {
  constructor(message = "Failed to verify signature.") {
    super(401, "BAD_SIGNATURE", message);
  }
}

export class Forbidden extends HttpError {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
  }
}
export class NotFound extends HttpError {
  constructor(message = "Not Found") {
    super(404, "NOT_FOUND", message);
  }
}
export class Conflict extends HttpError {
  constructor(message = "Conflict") {
    super(409, "CONFLICT", message);
  }
}
export class UnprocessableEntity extends HttpError {
  constructor(message = "Unprocessable Entity") {
    super(422, "UNPROCESSABLE_ENTITY", message);
  }
}
export class TooManyRequests extends HttpError {
  constructor(message = "Too Many Requests") {
    super(429, "TOO_MANY_REQUESTS", message);
  }
}
export class InternalServerError extends HttpError {
  constructor(message = "Internal Server Error") {
    super(500, "INTERNAL_SERVER_ERROR", message);
  }
}

export function errorHandler(c: Context, error: unknown) {
  const logger = getLogger();
  logger.debug(`error stack ${(error as Error)?.stack}`);
  logger.error(`error occurred ${(error as Error)?.message}`);

  if (error instanceof HttpError) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.status,
    );
  }

  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          process.env.NODE_ENV === Environment.PRODUCTION
            ? "Something went wrong"
            : error instanceof Error
              ? error.message
              : "Unknown error",
      },
    },
    500,
  );
}

import type { Context } from "hono";

export function okResponse<T>(
  c: Context,
  data: T,
  message?: string,
  meta?: Record<string, unknown>,
) {
  const body: Record<string, unknown> = { data };
  if (message) body.message = message;
  if (meta) body.meta = meta;
  return c.json(body, 200);
}

export function createResponse<T>(
  c: Context,
  data: T,
  message?: string,
  meta?: Record<string, unknown>,
) {
  const body: Record<string, unknown> = { data };
  if (message) body.message = message;
  if (meta) body.meta = meta;
  return c.json(body, 201);
}

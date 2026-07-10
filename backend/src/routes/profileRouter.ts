import { UpdateProfile, type UserResponse } from "@app/shared";
import { db } from "@src/db/client";
import { addAllTokensToCookie } from "@src/lib/auth/cookie";
import { okResponse } from "@src/lib/http/response";
import { Hono } from "hono";
import type { AuthVariables } from "../lib/http/middleware";

const router = new Hono<{ Variables: AuthVariables }>();

router.put("", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const input = UpdateProfile.assert(body);

  const updated = await db
    .updateTable("users")
    .set({
      avatar_url: input.avatar_url,
      updated_at: new Date(),
    })
    .where("id", "=", user.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  const response: UserResponse = {
    id: updated.id,
    email: updated.email,
    avatar_url: updated.avatar_url,
    status: updated.status,
  };

  await addAllTokensToCookie(c, false, response);

  return okResponse(c, response);
});

export default router;

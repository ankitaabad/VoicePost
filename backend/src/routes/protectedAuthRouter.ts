import type { UserResponse } from "@app/shared";
import { okResponse } from "@src/lib/http/response";
import { Hono } from "hono";
import type { AuthVariables } from "../lib/http/middleware";

const router = new Hono<{ Variables: AuthVariables }>();

router.get("/me", async (c) => {
  const user: UserResponse = c.get("user");
  return okResponse(c, user);
});

export default router;

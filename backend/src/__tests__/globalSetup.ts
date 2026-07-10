import "dotenv/config";
import type { CustomDB } from "@src/db/schema.override";
import { hashPassword } from "@src/lib/auth/password";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

export const SEED_EMAIL = "seeded@test.com";
export const SEED_PASSWORD = "SeedP@ss1";

const db = new Kysely<CustomDB>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
  }),
});

export async function setup() {
  await db.deleteFrom("verification_tokens").execute();
  await db.deleteFrom("refresh_tokens").execute();
  await db.deleteFrom("user_auth_providers").execute();
  await db.deleteFrom("users").execute();

  await db
    .insertInto("users")
    .values({
      id: "00000000-0000-0000-0000-000000000001",
      email: SEED_EMAIL,
      status: "ACTIVE",
    })
    .execute();

  const passwordHash = await hashPassword(SEED_PASSWORD);

  await db
    .insertInto("user_auth_providers")
    .values({
      id: "00000000-0000-0000-0000-000000000002",
      user_id: "00000000-0000-0000-0000-000000000001",
      provider: "EMAIL",
      password_hash: passwordHash,
      status: "VERIFIED",
    })
    .execute();

  await db.destroy();
}

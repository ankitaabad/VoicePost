import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { CustomDB } from "./schema.override";

export const db = new Kysely<CustomDB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});

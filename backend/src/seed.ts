import { db } from "@src/db/client";

async function seed() {
  await db.deleteFrom("verification_tokens").execute();
  await db.deleteFrom("user_auth_providers").execute();
  await db.deleteFrom("users").execute();

  console.log("Database cleaned");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });

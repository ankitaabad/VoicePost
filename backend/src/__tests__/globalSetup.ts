import "dotenv/config";

export async function setup() {
  try {
    const { db } = await import("@src/db/client");

    await db.destroy();
  } catch {
    console.warn("[globalSetup] Skipping setup — Postgres not reachable");
  }
}

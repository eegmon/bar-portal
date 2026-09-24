import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:bar_portal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function migrateDiscordSync() {
  try {
    await db.execute("ALTER TABLE users ADD COLUMN discord_synced_at TEXT");
    console.log("✓ Added discord_synced_at column to users table");
  } catch {
    console.log(
      "ℹ discord_synced_at column already present in users table (OK)",
    );
  }
}

migrateDiscordSync().catch((error) => {
  console.error("Discord sync migration failed:", error);
  process.exitCode = 1;
});

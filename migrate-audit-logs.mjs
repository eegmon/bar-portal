import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:bar_portal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function migrateAuditLogs() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log("✓ audit_logs table is ready");
}

migrateAuditLogs().catch((error) => {
  console.error("Audit log migration failed:", error);
  process.exitCode = 1;
});
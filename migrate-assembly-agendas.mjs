import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:bar_portal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function addColumn(table, definition) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  } catch (error) {
    if (!String(error).toLowerCase().includes("duplicate column")) throw error;
  }
}

try {
  await addColumn("agendas", "agenda_order INTEGER NOT NULL DEFAULT 0");
  await addColumn("agendas", "choice_config TEXT NOT NULL DEFAULT '[]'");
  await addColumn("agendas", "voting_deadline TEXT DEFAULT ''");
  await addColumn("agendas", "voting_started_at TEXT DEFAULT ''");
  await addColumn("agendas", "voting_closed_at TEXT DEFAULT ''");
  await addColumn("agendas", "result_confirmed_at TEXT DEFAULT ''");
  await addColumn("agendas", "result_confirmed_by TEXT DEFAULT ''");
  await addColumn("agendas", "voting_method TEXT NOT NULL DEFAULT 'MAJORITY'");
  await addColumn(
    "assembly_attendances",
    "approval_status TEXT NOT NULL DEFAULT 'APPROVED'",
  );
  await addColumn("assembly_attendances", "attended_at TEXT DEFAULT ''");
  await addColumn("assembly_attendances", "evidence_url TEXT DEFAULT ''");
  await addColumn("assembly_attendances", "rejection_reason TEXT DEFAULT ''");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS assembly_voting_rights (
      assembly_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      voting_power INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (assembly_id, user_id)
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS assembly_audit_logs (
      id TEXT PRIMARY KEY,
      assembly_id TEXT,
      agenda_id TEXT,
      actor_id TEXT,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS assembly_minutes_versions (
      id TEXT PRIMARY KEY,
      assembly_id TEXT NOT NULL,
      content TEXT NOT NULL,
      editor_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(
    "DELETE FROM users WHERE id IN ('admin-1', 'lawyer-1') OR login_id IN ('admin', 'lawyer1')",
  );
  console.log("총회 운영 마이그레이션이 완료되었습니다.");
} catch (error) {
  console.error("총회 운영 마이그레이션 실패:", error);
  process.exitCode = 1;
}

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:bar_portal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

const columns = [
  ["phase1_operation_mode", "TEXT NOT NULL DEFAULT 'MANUAL'"],
  ["phase2_operation_mode", "TEXT NOT NULL DEFAULT 'MANUAL'"],
];

async function migrateExamOperationMode() {
  for (const [name, definition] of columns) {
    try {
      await db.execute(`ALTER TABLE exams ADD COLUMN ${name} ${definition}`);
      console.log(`Added ${name} column to exams`);
    } catch {
      console.log(`${name} column already present (OK)`);
    }
  }
}

migrateExamOperationMode().catch((error) => {
  console.error("Exam operation mode migration failed:", error);
  process.exitCode = 1;
});

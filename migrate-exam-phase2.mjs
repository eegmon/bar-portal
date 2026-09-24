import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:bar_portal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

const columns = [
  ["phase2_question1_score", "INTEGER DEFAULT 0"],
  ["phase2_question2_score", "INTEGER DEFAULT 0"],
  ["phase2_published", "INTEGER NOT NULL DEFAULT 0"],
  ["phase2_published_at", "TEXT DEFAULT ''"],
];

async function migrateExamPhase2() {
  for (const [name, definition] of columns) {
    try {
      await db.execute(
        `ALTER TABLE exam_submissions ADD COLUMN ${name} ${definition}`,
      );
      console.log(`✓ Added ${name} column to exam_submissions`);
    } catch {
      console.log(`ℹ ${name} column already present (OK)`);
    }
  }
}

migrateExamPhase2().catch((error) => {
  console.error("Exam phase 2 migration failed:", error);
  process.exitCode = 1;
});

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:bar_portal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

const columns = [
  ["phase1_max_score", "INTEGER NOT NULL DEFAULT 100"],
  ["phase2_question1_max_score", "INTEGER NOT NULL DEFAULT 50"],
  ["phase2_question2_max_score", "INTEGER NOT NULL DEFAULT 50"],
  ["final_passing_score", "INTEGER NOT NULL DEFAULT 0"],
];

async function migrateExamScoring() {
  for (const [name, definition] of columns) {
    try {
      await db.execute(`ALTER TABLE exams ADD COLUMN ${name} ${definition}`);
      console.log(`Added ${name} column to exams`);
    } catch {
      console.log(`${name} column already present (OK)`);
    }
  }

  await db.execute(`
    UPDATE exam_submissions
    SET phase2_question1_score = MIN(
          phase2_score,
          COALESCE((SELECT phase2_question1_max_score FROM exams WHERE exams.id = exam_submissions.exam_id), 50)
        ),
        phase2_question2_score = MAX(
          phase2_score - MIN(
            phase2_score,
            COALESCE((SELECT phase2_question1_max_score FROM exams WHERE exams.id = exam_submissions.exam_id), 50)
          ),
          0
        ),
        total_score = phase1_score + phase2_score
    WHERE phase2_score > 0 AND phase2_question1_score = 0 AND phase2_question2_score = 0
  `);
  console.log("✓ Backfilled existing phase 2 scores and raw totals");
}

migrateExamScoring().catch((error) => {
  console.error("Exam scoring migration failed:", error);
  process.exitCode = 1;
});

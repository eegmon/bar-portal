import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:bar_portal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function migratePositions() {
  try {
    await db.execute("ALTER TABLE users ADD COLUMN positions TEXT DEFAULT '[]'");
    console.log("✓ Added positions column to users table");
  } catch (err) {
    console.log("ℹ positions column already exists or info:", err.message);
  }

  // Update default accounts
  await db.execute({
    sql: "UPDATE users SET positions = ? WHERE login_id = 'admin'",
    args: [JSON.stringify(["PRESIDENT", "SECRETARY_GENERAL", "EXAM_COMM_MEMBER", "DISCIPLINE_COMM_MEMBER", "ASSEMBLY_SPEAKER"])],
  });

  await db.execute({
    sql: "UPDATE users SET positions = ? WHERE login_id = 'lawyer1'",
    args: [JSON.stringify(["ASSEMBLY_SPEAKER"])],
  });

  console.log("✅ Position migration complete!");
}

migratePositions().catch(console.error);

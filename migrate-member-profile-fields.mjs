import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:bar_portal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function addColumn(name, definition) {
  try {
    await db.execute(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
    console.log(`Added ${name} column to users`);
  } catch {
    console.log(`${name} column already present (OK)`);
  }
}

async function migrate() {
  await addColumn("qualification_proof", "TEXT DEFAULT ''");
  await addColumn("self_introduction", "TEXT DEFAULT ''");
  await db.execute(`
    UPDATE users
    SET qualification_proof = COALESCE(NULLIF(qualification_proof, ''), bio, '')
    WHERE COALESCE(qualification_proof, '') = '' AND COALESCE(bio, '') <> ''
  `);
  console.log("✓ Existing bio values preserved as qualification proof");
}

migrate().catch((error) => {
  console.error("Member profile migration failed:", error);
  process.exitCode = 1;
});

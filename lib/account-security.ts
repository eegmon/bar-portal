import { createHash, randomBytes, randomUUID } from "node:crypto";
import db from "@/lib/db";

let schemaReady: Promise<void> | null = null;

export function ensureAccountSecuritySchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS account_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          expires_at INTEGER NOT NULL,
          revoked_at TEXT DEFAULT NULL,
          ip_address TEXT NOT NULL DEFAULT '',
          user_agent TEXT NOT NULL DEFAULT ''
        )
      `);
      await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_account_sessions_user_created ON account_sessions(user_id, created_at DESC)",
      );
      await db.execute(`
        CREATE TABLE IF NOT EXISTS account_totp (
          user_id TEXT PRIMARY KEY,
          secret TEXT NOT NULL DEFAULT '',
          pending_secret TEXT NOT NULL DEFAULT '',
          enabled INTEGER NOT NULL DEFAULT 0,
          setup_attempts INTEGER NOT NULL DEFAULT 0,
          recovery_codes TEXT NOT NULL DEFAULT '[]',
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await db.execute(`
        CREATE TABLE IF NOT EXISTS auth_challenges (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          expires_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          consumed_at TEXT DEFAULT NULL
        )
      `);
      try {
        await db.execute(
          "ALTER TABLE account_totp ADD COLUMN setup_attempts INTEGER NOT NULL DEFAULT 0",
        );
      } catch {
        // The column already exists.
      }
      try {
        await db.execute(
          "ALTER TABLE auth_challenges ADD COLUMN created_at TEXT",
        );
      } catch {
        // The column already exists.
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function createAccountSession(userId: string, request: Request) {
  await ensureAccountSecuritySchema();
  await db.execute(`
    DELETE FROM account_sessions
    WHERE created_at < datetime('now', '-90 days')
      AND (revoked_at IS NOT NULL OR expires_at <= unixepoch())
  `);
  const id = randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const forwardedIp = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    .trim();
  const ipAddress = (
    request.headers.get("x-real-ip") ||
    forwardedIp ||
    ""
  ).slice(0, 80);
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 500);

  await db.execute({
    sql: `INSERT INTO account_sessions (id, user_id, expires_at, ip_address, user_agent)
          VALUES (?, ?, ?, ?, ?)`,
    args: [id, userId, expiresAt, ipAddress, userAgent],
  });
  return id;
}

export function hashChallengeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMfaChallenge(userId: string) {
  await ensureAccountSecuritySchema();
  await db.execute(
    "DELETE FROM auth_challenges WHERE expires_at <= ? OR consumed_at IS NOT NULL",
    [Math.floor(Date.now() / 1000) - 24 * 60 * 60],
  );
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  await db.execute({
    sql: "INSERT INTO auth_challenges (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    args: [hashChallengeToken(token), userId, expiresAt],
  });
  return token;
}

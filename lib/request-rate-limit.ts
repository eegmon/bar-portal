import { createHmac } from "node:crypto";
import db from "@/lib/db";
import { getSecuritySecret } from "@/lib/security-secret";

let schemaReady: Promise<void> | null = null;
let cleanupCounter = 0;

async function ensureRateLimitSchema() {
  if (!schemaReady) {
    schemaReady = db
      .execute(
        `
        CREATE TABLE IF NOT EXISTS request_rate_limits (
          bucket_key TEXT PRIMARY KEY,
          window_started_at INTEGER NOT NULL,
          attempt_count INTEGER NOT NULL
        )
      `,
      )
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

export async function checkRequestRateLimit(
  request: Request,
  scope: string,
  maxRequests: number,
  windowSeconds: number,
) {
  await ensureRateLimitSchema();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const address =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    forwardedFor?.split(",").at(-1)?.trim() ||
    "unknown";
  const bucketKey = createHmac("sha256", getSecuritySecret())
    .update(`${scope}:${address}`)
    .digest("hex");
  const now = Math.floor(Date.now() / 1000);
  const result = await db.execute({
    sql: `INSERT INTO request_rate_limits (bucket_key, window_started_at, attempt_count)
          VALUES (?, ?, 1)
          ON CONFLICT(bucket_key) DO UPDATE SET
            attempt_count = CASE
              WHEN request_rate_limits.window_started_at <= ? THEN 1
              ELSE request_rate_limits.attempt_count + 1
            END,
            window_started_at = CASE
              WHEN request_rate_limits.window_started_at <= ? THEN excluded.window_started_at
              ELSE request_rate_limits.window_started_at
            END
          RETURNING attempt_count, window_started_at`,
    args: [bucketKey, now, now - windowSeconds, now - windowSeconds],
  });

  cleanupCounter += 1;
  if (cleanupCounter % 500 === 0) {
    await db.execute({
      sql: "DELETE FROM request_rate_limits WHERE window_started_at < ?",
      args: [now - 86_400],
    });
  }

  const row = result.rows[0];
  const windowStartedAt = Number(row?.window_started_at || now);
  return {
    allowed: Number(row?.attempt_count || 0) <= maxRequests,
    retryAfterSeconds: Math.max(1, windowStartedAt + windowSeconds - now),
  };
}

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import db from "@/lib/db";
import { ensureAccountSecuritySchema } from "@/lib/account-security";
import { getSecuritySecret } from "@/lib/security-secret";
import { SessionUser } from "./types";

export * from "./types";

export interface AuthContext {
  user: SessionUser;
  sessionId: string;
}

export function signToken(user: SessionUser, sessionId: string): string {
  return jwt.sign({ ...user, sid: sessionId }, getSecuritySecret(), {
    expiresIn: "7d",
  });
}

function verifyTokenContext(token: string): AuthContext | null {
  try {
    const decoded = jwt.verify(token, getSecuritySecret()) as SessionUser & {
      sid?: string;
    };
    if (!decoded.sid) return null;
    const { sid, ...user } = decoded;
    return {
      user: { ...user, positions: user.positions || [] },
      sessionId: sid,
    };
  } catch {
    return null;
  }
}

export function verifyToken(token: string): SessionUser | null {
  return verifyTokenContext(token)?.user || null;
}

export function sessionUserFromDatabaseRow(
  user: Record<string, unknown>,
): SessionUser {
  let positions: string[] = [];
  try {
    positions = JSON.parse(String(user.positions || "[]"));
  } catch {
    positions = [];
  }
  return {
    id: String(user.id),
    loginId: String(user.login_id),
    name: String(user.name),
    role: user.role as SessionUser["role"],
    status: user.status as SessionUser["status"],
    isTrainee: Number(user.is_trainee || 0),
    positions,
  };
}

export async function getSessionContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("bar_token")?.value;
  if (!token) return null;
  const context = verifyTokenContext(token);
  if (!context) return null;

  await ensureAccountSecuritySchema();
  const session = await db.execute({
    sql: `SELECT s.id AS session_id, u.id, u.login_id, u.name, u.role,
                 u.status, u.is_trainee, u.positions
          FROM account_sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.id = ? AND s.user_id = ?
            AND s.revoked_at IS NULL AND s.expires_at > ?`,
    args: [context.sessionId, context.user.id, Math.floor(Date.now() / 1000)],
  });
  const row = session.rows[0];
  if (!row) return null;

  return {
    user: sessionUserFromDatabaseRow(row),
    sessionId: String(row.session_id),
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return (await getSessionContext())?.user || null;
}

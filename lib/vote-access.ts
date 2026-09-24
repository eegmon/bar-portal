import jwt from "jsonwebtoken";
import db from "./db";
import { SessionUser } from "./types";

const JWT_SECRET =
  process.env.JWT_SECRET || "dos-bar-association-super-secret-key-2026";
const VOTE_ACCESS_PURPOSE = "ASSEMBLY_VOTE_ACCESS";

interface VoteAccessTokenPayload extends jwt.JwtPayload {
  purpose: typeof VOTE_ACCESS_PURPOSE;
  userId: string;
  assemblyId?: string;
  agendaId?: string;
}

function parsePositions(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // 무시
  }
  return [];
}

export function signVoteAccessToken(input: {
  userId: string;
  assemblyId?: string;
  agendaId?: string;
  expiresIn?: string;
}): string {
  return jwt.sign(
    {
      purpose: VOTE_ACCESS_PURPOSE,
      userId: input.userId,
      assemblyId: input.assemblyId,
      agendaId: input.agendaId,
    },
    JWT_SECRET,
    {
      expiresIn: input.expiresIn as jwt.SignOptions["expiresIn"] || "30d",
    },
  );
}

export function verifyVoteAccessToken(
  token: string,
): VoteAccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as VoteAccessTokenPayload;
    if (decoded.purpose !== VOTE_ACCESS_PURPOSE || !decoded.userId) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export async function getVoteAccessUser(
  token: string | null | undefined,
  constraints?: {
    assemblyId?: string;
    agendaId?: string;
  },
): Promise<SessionUser | null> {
  if (!token) return null;
  const payload = verifyVoteAccessToken(token);
  if (!payload) return null;

  if (
    payload.assemblyId &&
    constraints?.assemblyId &&
    payload.assemblyId !== constraints.assemblyId
  ) {
    return null;
  }

  if (
    payload.agendaId &&
    constraints?.agendaId &&
    payload.agendaId !== constraints.agendaId
  ) {
    return null;
  }

  const userRes = await db.execute({
    sql: "SELECT id, login_id, name, role, status, is_trainee, positions FROM users WHERE id = ? LIMIT 1",
    args: [payload.userId],
  });

  if (userRes.rows.length === 0) return null;
  const user = userRes.rows[0];

  return {
    id: String(user.id),
    loginId: String(user.login_id || ""),
    name: String(user.name || ""),
    role: user.role as SessionUser["role"],
    status: user.status as SessionUser["status"],
    isTrainee: Number(user.is_trainee || 0),
    positions: parsePositions(user.positions),
  };
}

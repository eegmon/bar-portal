import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { SessionUser } from "./types";

export * from "./types";

const JWT_SECRET = process.env.JWT_SECRET || "dos-bar-association-super-secret-key-2026";

export function signToken(user: SessionUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): SessionUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionUser;
    if (!decoded.positions) {
      decoded.positions = [];
    }
    return decoded;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("bar_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

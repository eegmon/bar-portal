import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const context = await getSessionContext();
    if (context) {
      await db.execute({
        sql: "UPDATE account_sessions SET revoked_at = datetime('now') WHERE id = ? AND user_id = ?",
        args: [context.sessionId, context.user.id],
      });
    }
  } catch (error) {
    console.error("세션 종료 기록 오류:", error);
  }
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    new URL(req.url).origin;
  const response = NextResponse.redirect(new URL("/", baseUrl));
  response.cookies.set("bar_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
  return response;
}

import { NextResponse } from "next/server";
import db from "@/lib/db";
import { sessionUserFromDatabaseRow, signToken } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { parseUserPositions } from "@/lib/user-positions";
import {
  createAccountSession,
  createMfaChallenge,
  ensureAccountSecuritySchema,
} from "@/lib/account-security";
import { checkRequestRateLimit } from "@/lib/request-rate-limit";

const DISCORD_LOGIN_SYNC_TTL_MS = 5 * 60 * 1000;
const recentDiscordLoginSync = new Map<string, number>();

export async function POST(req: Request) {
  try {
    const rateLimit = await checkRequestRateLimit(req, "auth-login", 10, 600);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const { loginId, password } = await req.json();

    if (!loginId || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    const res = await db.execute({
      sql: "SELECT * FROM users WHERE login_id = ?",
      args: [loginId],
    });

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: "회원정보가 불일치 합니다." },
        { status: 401 },
      );
    }

    const user = res.rows[0];
    const isMatch = await verifyPassword(password, user.password as string);

    if (!isMatch) {
      return NextResponse.json(
        { error: "회원정보가 불일치 합니다." },
        { status: 401 },
      );
    }

    let positions = parseUserPositions(user.positions);

    // 로그인 시 디스코드 역할 최신 동기화 시도 (Discord -> Site)
    const targetDiscord =
      (user.discord_id as string) || (user.phone as string) || "";
    const lastSyncedAt = recentDiscordLoginSync.get(user.id as string) || 0;
    if (
      targetDiscord &&
      Date.now() - lastSyncedAt >= DISCORD_LOGIN_SYNC_TTL_MS
    ) {
      try {
        const { syncUserFromDiscord } = await import("@/lib/discord");
        const syncResult = await syncUserFromDiscord(
          user.id as string,
          targetDiscord,
        );
        recentDiscordLoginSync.set(user.id as string, Date.now());
        if (syncResult.success && syncResult.updatedPositions) {
          positions = syncResult.updatedPositions;
          if (syncResult.updatedRole)
            (user as any).role = syncResult.updatedRole;
          if (syncResult.isTrainee !== undefined)
            (user as any).is_trainee = syncResult.isTrainee;
        }
      } catch (syncErr) {
        console.warn("로그인 시 디스코드 동기화 무시:", syncErr);
      }
    }

    const sessionUser = sessionUserFromDatabaseRow({
      ...user,
      positions: JSON.stringify(positions),
    });
    await ensureAccountSecuritySchema();
    const mfaRes = await db.execute({
      sql: "SELECT enabled FROM account_totp WHERE user_id = ?",
      args: [user.id],
    });
    if (Number(mfaRes.rows[0]?.enabled || 0) === 1) {
      const attemptsRes = await db.execute({
        sql: `SELECT COALESCE(SUM(attempts), 0) AS failed_attempts
              FROM auth_challenges
              WHERE user_id = ? AND created_at >= datetime('now', '-15 minutes')`,
        args: [user.id],
      });
      if (Number(attemptsRes.rows[0]?.failed_attempts || 0) >= 10) {
        return NextResponse.json(
          {
            error:
              "2단계 인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          },
          { status: 429 },
        );
      }
      const challengeToken = await createMfaChallenge(user.id as string);
      return NextResponse.json({
        success: true,
        mfaRequired: true,
        challengeToken,
      });
    }

    const sessionId = await createAccountSession(user.id as string, req);
    const token = signToken(sessionUser, sessionId);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
    });

    response.cookies.set("bar_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("로그인 에러:", err);
    return NextResponse.json(
      { error: err.message || "로그인 실패" },
      { status: 500 },
    );
  }
}

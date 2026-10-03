import { NextResponse } from "next/server";
import db from "@/lib/db";
import { sessionUserFromDatabaseRow, signToken } from "@/lib/auth";
import {
  createAccountSession,
  ensureAccountSecuritySchema,
  hashChallengeToken,
} from "@/lib/account-security";
import {
  consumeRecoveryCode,
  decryptTotpSecret,
  verifyTotpCode,
} from "@/lib/totp";

export async function POST(req: Request) {
  try {
    const { challengeToken, code } = await req.json();
    if (
      typeof challengeToken !== "string" ||
      challengeToken.length > 100 ||
      typeof code !== "string" ||
      code.length > 32
    ) {
      return NextResponse.json(
        { error: "인증 정보를 확인해 주세요." },
        { status: 400 },
      );
    }

    await ensureAccountSecuritySchema();
    const challengeHash = hashChallengeToken(challengeToken);
    const result = await db.execute({
      sql: `SELECT c.user_id, c.attempts, t.secret, t.recovery_codes, u.*
            FROM auth_challenges c
            JOIN account_totp t ON t.user_id = c.user_id AND t.enabled = 1
            JOIN users u ON u.id = c.user_id
            WHERE c.token_hash = ? AND c.consumed_at IS NULL AND c.expires_at > ?`,
      args: [challengeHash, Math.floor(Date.now() / 1000)],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      return NextResponse.json(
        { error: "인증 요청이 만료되었습니다. 다시 로그인해 주세요." },
        { status: 401 },
      );
    }
    if (Number(row.attempts) >= 5) {
      return NextResponse.json(
        { error: "인증 시도 횟수를 초과했습니다. 다시 로그인해 주세요." },
        { status: 429 },
      );
    }

    let remainingRecoveryCodes: string | null = null;
    let valid = false;
    try {
      valid = verifyTotpCode(decryptTotpSecret(String(row.secret)), code);
    } catch {
      valid = false;
    }
    if (!valid) {
      remainingRecoveryCodes = consumeRecoveryCode(
        String(row.recovery_codes || "[]"),
        code,
      );
      valid = remainingRecoveryCodes !== null;
    }

    if (!valid) {
      await db.execute({
        sql: "UPDATE auth_challenges SET attempts = attempts + 1 WHERE token_hash = ? AND consumed_at IS NULL",
        args: [challengeHash],
      });
      return NextResponse.json(
        { error: "인증 코드가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    if (remainingRecoveryCodes !== null) {
      const recoveryUpdate = await db.execute({
        sql: "UPDATE account_totp SET recovery_codes = ? WHERE user_id = ? AND recovery_codes = ?",
        args: [
          remainingRecoveryCodes,
          String(row.user_id),
          String(row.recovery_codes || "[]"),
        ],
      });
      if (recoveryUpdate.rowsAffected !== 1) {
        return NextResponse.json(
          { error: "복구 코드가 이미 사용되었습니다." },
          { status: 401 },
        );
      }
    }

    const consumed = await db.execute({
      sql: `UPDATE auth_challenges SET consumed_at = datetime('now')
            WHERE token_hash = ? AND consumed_at IS NULL AND attempts < 5 AND expires_at > ?`,
      args: [challengeHash, Math.floor(Date.now() / 1000)],
    });
    if (consumed.rowsAffected !== 1) {
      return NextResponse.json(
        { error: "인증 요청을 다시 시작해 주세요." },
        { status: 401 },
      );
    }

    const sessionUser = sessionUserFromDatabaseRow(row);
    const sessionId = await createAccountSession(sessionUser.id, req);
    const token = signToken(sessionUser, sessionId);
    const response = NextResponse.json({ success: true, user: sessionUser });
    response.cookies.set("bar_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (error: unknown) {
    console.error("2단계 인증 오류:", error);
    return NextResponse.json(
      { error: "2단계 인증을 완료하지 못했습니다." },
      { status: 500 },
    );
  }
}

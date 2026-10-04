import { NextResponse } from "next/server";
import db from "@/lib/db";
import {
  ensureAccountSecuritySchema,
  hashChallengeToken,
} from "@/lib/account-security";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json();
    if (
      typeof token !== "string" ||
      token.length < 40 ||
      token.length > 100 ||
      typeof newPassword !== "string" ||
      newPassword.length < 8 ||
      newPassword.length > 128
    ) {
      return NextResponse.json(
        {
          error: "유효한 재설정 링크와 8자 이상의 새 비밀번호를 입력해 주세요.",
        },
        { status: 400 },
      );
    }

    await ensureAccountSecuritySchema();
    const tokenHash = hashChallengeToken(token);
    const now = Math.floor(Date.now() / 1000);
    const tokenResult = await db.execute({
      sql: `SELECT user_id FROM password_reset_tokens
            WHERE token_hash = ? AND expires_at > ? AND consumed_at IS NULL`,
      args: [tokenHash, now],
    });
    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "재설정 링크가 만료되었거나 이미 사용되었습니다. 관리자에게 새 링크를 요청해 주세요.",
        },
        { status: 400 },
      );
    }

    const userId = String(tokenResult.rows[0].user_id);
    const hashedPassword = await hashPassword(newPassword);
    const claim = await db.execute({
      sql: `UPDATE password_reset_tokens
            SET consumed_at = datetime('now')
            WHERE token_hash = ? AND expires_at > ? AND consumed_at IS NULL`,
      args: [tokenHash, now],
    });
    if (claim.rowsAffected !== 1) {
      return NextResponse.json(
        {
          error:
            "재설정 링크가 만료되었거나 이미 사용되었습니다. 관리자에게 새 링크를 요청해 주세요.",
        },
        { status: 400 },
      );
    }

    await db.execute({
      sql: "UPDATE users SET password = ? WHERE id = ?",
      args: [hashedPassword, userId],
    });
    await db.execute({
      sql: `UPDATE account_sessions SET revoked_at = datetime('now')
            WHERE user_id = ? AND revoked_at IS NULL`,
      args: [userId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "비밀번호 재설정 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

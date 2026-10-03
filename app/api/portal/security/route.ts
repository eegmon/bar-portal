import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { ensureAccountSecuritySchema } from "@/lib/account-security";
import {
  consumeRecoveryCode,
  createRecoveryCodes,
  createTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotpCode,
} from "@/lib/totp";

async function verifyCurrentPassword(userId: string, password: string) {
  if (!password) return false;
  const result = await db.execute({
    sql: "SELECT password FROM users WHERE id = ?",
    args: [userId],
  });
  return (
    result.rows.length > 0 &&
    bcrypt.compare(password, String(result.rows[0].password))
  );
}

async function verifyMfaCode(userId: string, code: string) {
  const result = await db.execute({
    sql: "SELECT secret, recovery_codes FROM account_totp WHERE user_id = ? AND enabled = 1",
    args: [userId],
  });
  const security = result.rows[0];
  if (!security) {
    return {
      valid: false,
      recoveryCodes: null as string | null,
      previousRecoveryCodes: null as string | null,
    };
  }

  try {
    if (verifyTotpCode(decryptTotpSecret(String(security.secret)), code)) {
      return {
        valid: true,
        recoveryCodes: null as string | null,
        previousRecoveryCodes: null as string | null,
      };
    }
  } catch {
    return {
      valid: false,
      recoveryCodes: null as string | null,
      previousRecoveryCodes: null as string | null,
    };
  }
  const previousRecoveryCodes = String(security.recovery_codes || "[]");
  const recoveryCodes = consumeRecoveryCode(previousRecoveryCodes, code);
  return {
    valid: recoveryCodes !== null,
    recoveryCodes,
    previousRecoveryCodes,
  };
}

async function persistRecoveryCodeConsumption(
  userId: string,
  verification: Awaited<ReturnType<typeof verifyMfaCode>>,
) {
  if (verification.recoveryCodes === null) return true;
  const result = await db.execute({
    sql: "UPDATE account_totp SET recovery_codes = ? WHERE user_id = ? AND recovery_codes = ? AND enabled = 1",
    args: [
      verification.recoveryCodes,
      userId,
      verification.previousRecoveryCodes || "[]",
    ],
  });
  return result.rowsAffected === 1;
}

export async function GET() {
  try {
    const context = await getSessionContext();
    if (!context)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    await ensureAccountSecuritySchema();

    const [sessionsResult, mfaResult] = await Promise.all([
      db.execute({
        sql: `SELECT id, created_at, expires_at, revoked_at, ip_address, user_agent
              FROM account_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
        args: [context.user.id],
      }),
      db.execute({
        sql: "SELECT enabled, recovery_codes FROM account_totp WHERE user_id = ?",
        args: [context.user.id],
      }),
    ]);
    const currentTime = Math.floor(Date.now() / 1000);
    const mfa = mfaResult.rows[0];
    let recoveryCodeCount = 0;
    try {
      recoveryCodeCount = JSON.parse(
        String(mfa?.recovery_codes || "[]"),
      ).length;
    } catch {
      recoveryCodeCount = 0;
    }

    return NextResponse.json({
      sessions: sessionsResult.rows.map((session) => ({
        ...session,
        isCurrent: session.id === context.sessionId,
        isActive:
          !session.revoked_at && Number(session.expires_at) > currentTime,
      })),
      mfaEnabled: Number(mfa?.enabled || 0) === 1,
      recoveryCodeCount,
    });
  } catch (error: unknown) {
    console.error("보안 정보 조회 오류:", error);
    return NextResponse.json(
      { error: "보안 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await getSessionContext();
    if (!context)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    await ensureAccountSecuritySchema();
    const body = await req.json();
    const { action } = body;

    if (action === "REVOKE_SESSION") {
      const { sessionId } = body;
      if (typeof sessionId !== "string" || sessionId === context.sessionId) {
        return NextResponse.json(
          { error: "현재 사용 중인 세션은 여기서 종료할 수 없습니다." },
          { status: 400 },
        );
      }
      const result = await db.execute({
        sql: `UPDATE account_sessions SET revoked_at = datetime('now')
              WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
        args: [sessionId, context.user.id],
      });
      if (result.rowsAffected === 0) {
        return NextResponse.json(
          { error: "활성 세션을 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      return NextResponse.json({ success: true });
    }

    if (action === "REVOKE_OTHERS") {
      await db.execute({
        sql: `UPDATE account_sessions SET revoked_at = datetime('now')
              WHERE user_id = ? AND id != ? AND revoked_at IS NULL`,
        args: [context.user.id, context.sessionId],
      });
      return NextResponse.json({ success: true });
    }

    if (action === "MFA_SETUP") {
      if (
        !(await verifyCurrentPassword(
          context.user.id,
          String(body.currentPassword || ""),
        ))
      ) {
        return NextResponse.json(
          { error: "현재 비밀번호가 일치하지 않습니다." },
          { status: 400 },
        );
      }
      const existing = await db.execute({
        sql: "SELECT enabled FROM account_totp WHERE user_id = ?",
        args: [context.user.id],
      });
      if (Number(existing.rows[0]?.enabled || 0) === 1) {
        return NextResponse.json(
          { error: "2단계 인증이 이미 활성화되어 있습니다." },
          { status: 409 },
        );
      }
      const secret = generateTotpSecret();
      await db.execute({
        sql: `INSERT INTO account_totp (user_id, pending_secret, setup_attempts) VALUES (?, ?, 0)
              ON CONFLICT(user_id) DO UPDATE SET pending_secret = excluded.pending_secret,
          setup_attempts = 0,
                updated_at = datetime('now')`,
        args: [context.user.id, encryptTotpSecret(secret)],
      });
      return NextResponse.json({
        success: true,
        secret,
        uri: createTotpUri(secret, context.user.loginId),
      });
    }

    if (action === "MFA_ENABLE") {
      if (
        !(await verifyCurrentPassword(
          context.user.id,
          String(body.currentPassword || ""),
        ))
      ) {
        return NextResponse.json(
          { error: "현재 비밀번호가 일치하지 않습니다." },
          { status: 400 },
        );
      }
      const pending = await db.execute({
        sql: "SELECT pending_secret, setup_attempts FROM account_totp WHERE user_id = ? AND enabled = 0",
        args: [context.user.id],
      });
      if (!pending.rows[0]?.pending_secret) {
        return NextResponse.json(
          { error: "먼저 인증 앱 설정을 시작해 주세요." },
          { status: 400 },
        );
      }
      if (Number(pending.rows[0].setup_attempts) >= 5) {
        return NextResponse.json(
          {
            error: "인증 시도 횟수를 초과했습니다. 설정을 다시 시작해 주세요.",
          },
          { status: 429 },
        );
      }
      const secret = decryptTotpSecret(String(pending.rows[0].pending_secret));
      if (!verifyTotpCode(secret, String(body.code || ""))) {
        await db.execute({
          sql: "UPDATE account_totp SET setup_attempts = setup_attempts + 1 WHERE user_id = ? AND setup_attempts < 5",
          args: [context.user.id],
        });
        return NextResponse.json(
          { error: "인증 앱 코드가 올바르지 않습니다." },
          { status: 400 },
        );
      }
      const recovery = createRecoveryCodes();
      await db.execute({
        sql: `UPDATE account_totp SET secret = pending_secret, pending_secret = '', enabled = 1,
          setup_attempts = 0,
                recovery_codes = ?, updated_at = datetime('now') WHERE user_id = ?`,
        args: [JSON.stringify(recovery.hashes), context.user.id],
      });
      await db.execute({
        sql: `UPDATE account_sessions SET revoked_at = datetime('now')
              WHERE user_id = ? AND id != ? AND revoked_at IS NULL`,
        args: [context.user.id, context.sessionId],
      });
      return NextResponse.json({
        success: true,
        recoveryCodes: recovery.codes,
      });
    }

    if (action === "MFA_DISABLE" || action === "MFA_REGENERATE_RECOVERY") {
      if (
        !(await verifyCurrentPassword(
          context.user.id,
          String(body.currentPassword || ""),
        ))
      ) {
        return NextResponse.json(
          { error: "현재 비밀번호가 일치하지 않습니다." },
          { status: 400 },
        );
      }
      const verification = await verifyMfaCode(
        context.user.id,
        String(body.code || ""),
      );
      if (!verification.valid) {
        return NextResponse.json(
          { error: "인증 코드가 올바르지 않습니다." },
          { status: 400 },
        );
      }
      if (
        !(await persistRecoveryCodeConsumption(context.user.id, verification))
      ) {
        return NextResponse.json(
          { error: "복구 코드가 이미 사용되었습니다." },
          { status: 400 },
        );
      }
      if (action === "MFA_DISABLE") {
        await db.execute({
          sql: `UPDATE account_totp SET secret = '', pending_secret = '', enabled = 0,
                  recovery_codes = '[]', updated_at = datetime('now') WHERE user_id = ?`,
          args: [context.user.id],
        });
        await db.execute({
          sql: `UPDATE account_sessions SET revoked_at = datetime('now')
                WHERE user_id = ? AND id != ? AND revoked_at IS NULL`,
          args: [context.user.id, context.sessionId],
        });
        return NextResponse.json({ success: true });
      }
      const recovery = createRecoveryCodes();
      await db.execute({
        sql: "UPDATE account_totp SET recovery_codes = ?, updated_at = datetime('now') WHERE user_id = ?",
        args: [JSON.stringify(recovery.hashes), context.user.id],
      });
      return NextResponse.json({
        success: true,
        recoveryCodes: recovery.codes,
      });
    }

    if (action === "CANCEL_MFA_SETUP") {
      await db.execute({
        sql: "UPDATE account_totp SET pending_secret = '', updated_at = datetime('now') WHERE user_id = ? AND enabled = 0",
        args: [context.user.id],
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "유효하지 않은 보안 작업입니다." },
      { status: 400 },
    );
  } catch (error: unknown) {
    console.error("보안 설정 오류:", error);
    return NextResponse.json(
      { error: "보안 설정을 처리하지 못했습니다." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/types";
import { syncAllUsersFromDiscord } from "@/lib/discord";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!canManageUsers(currentUser)) {
      return NextResponse.json({ error: "전체 회원 동기화 권한이 없습니다." }, { status: 403 });
    }

    const batchResult = await syncAllUsersFromDiscord();

    // 감사 로그 기록
    try {
      await db.execute({
        sql: `INSERT INTO audit_logs (id, user_id, action, details)
              VALUES (?, ?, 'DISCORD_BATCH_SYNC', ?)`,
        args: [
          crypto.randomUUID(),
          currentUser.id,
          `전체 회원 디스코드 일괄 동기화 완료 (전체: ${batchResult.total}, 성공: ${batchResult.synced}, 실패/스킵: ${batchResult.failed})`,
        ],
      });
    } catch (e) {
      console.error("Audit log error:", e);
    }

    return NextResponse.json({
      success: true,
      data: batchResult,
    });
  } catch (err: any) {
    console.error("sync-all API error:", err);
    return NextResponse.json({ error: err.message || "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

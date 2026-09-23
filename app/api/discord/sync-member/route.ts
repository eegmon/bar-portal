import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/types";
import { syncUserFromDiscord } from "@/lib/discord";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId || currentUser.id;
    const customDiscordId = body.discordId;

    // 본인이 아니면 관리자 권한 확인
    if (targetUserId !== currentUser.id && !canManageUsers(currentUser)) {
      return NextResponse.json({ error: "타인의 정보를 동기화할 권한이 없습니다." }, { status: 403 });
    }

    const syncResult = await syncUserFromDiscord(targetUserId, customDiscordId);

    if (!syncResult.success) {
      return NextResponse.json(
        { error: syncResult.message || "디스코드 정보 동기화에 실패했습니다." },
        { status: 400 }
      );
    }

    // 감사 로그 기록
    try {
      await db.execute({
        sql: `INSERT INTO audit_logs (id, user_id, action, details)
              VALUES (?, ?, 'DISCORD_SYNC', ?)`,
        args: [
          crypto.randomUUID(),
          currentUser.id,
          `디스코드 역할 동기화 수행 (대상: ${targetUserId}, 직책: ${syncResult.updatedPositions?.join(",") || "없음"}, 등급: ${syncResult.updatedRole})`,
        ],
      });
    } catch (e) {
      console.error("Audit log error:", e);
    }

    return NextResponse.json({
      success: true,
      message: syncResult.message,
      data: syncResult,
    });
  } catch (err: any) {
    console.error("sync-member API error:", err);
    return NextResponse.json({ error: err.message || "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

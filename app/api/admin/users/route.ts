import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser, canManageUsers } from "@/lib/auth";
import { sendDiscordWebhook, syncUserDiscordRoles } from "@/lib/discord";

export async function GET() {
  try {
    const admin = await getSessionUser();
    if (!admin || !canManageUsers(admin)) {
      return NextResponse.json({ error: "회원 명부 관리 권한이 필요합니다." }, { status: 403 });
    }

    const res = await db.execute(`
      SELECT 
        u.id, u.login_id, u.discord_id, u.name, u.role, u.status, u.is_trainee, 
        u.phone, u.office_name, u.office_address, u.bio, u.specialties,
        u.positions, u.bar_exam_round, u.last_renewed_at, u.created_at
      FROM users u
      ORDER BY u.created_at DESC
    `);

    const users = res.rows.map((row) => {
      let parsedPositions: string[] = [];
      try {
        parsedPositions = JSON.parse((row.positions as string) || "[]");
      } catch {
        parsedPositions = [];
      }
      return {
        ...row,
        positions: parsedPositions,
      };
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (err: any) {
    console.error("Users GET Error:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getSessionUser();
    if (!admin || !canManageUsers(admin)) {
      return NextResponse.json({ error: "회원 명부 관리 권한이 필요합니다." }, { status: 403 });
    }

    const body = await req.json();
    const { action, userId, role, status, isTrainee, officeName, positions } = body;

    if (!userId) {
      return NextResponse.json({ error: "유저 ID가 필요합니다." }, { status: 400 });
    }

    // 대상 유저 조회
    const userRes = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [userId],
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "해당 유저를 찾을 수 없습니다." }, { status: 404 });
    }

    const targetUser = userRes.rows[0];
    let userPositions: string[] = [];
    try {
      userPositions = JSON.parse((targetUser.positions as string) || "[]");
    } catch {
      userPositions = [];
    }

    // 1. 변호사 승인 액션 (PENDING -> ACTIVE / LAWYER)
    if (action === "APPROVE_LAWYER") {
      await db.execute({
        sql: `UPDATE users 
              SET role = 'LAWYER', status = 'ACTIVE', last_renewed_at = datetime('now')
              WHERE id = ?`,
        args: [userId],
      });

      // 디스코드 역할 자동 지급
      if (targetUser.discord_id) {
        await syncUserDiscordRoles({
          discordUserId: targetUser.discord_id as string,
          role: "LAWYER",
          status: "ACTIVE",
          isTrainee: Number(targetUser.is_trainee || 0),
          positions: userPositions,
        });
      }

      await sendDiscordWebhook("LAWYER_APPROVAL", {
        content: `🎉 **[변호사 등록 승인] ${targetUser.name} 변호사님의 공식 등록이 승인되었습니다.**`,
        embeds: [
          {
            title: "⚖️ 도스변호사협회 신규 변호사 등록 완료",
            description: `**${targetUser.name}** 변호사님의 정식 개업 및 변호사 자격 명부 등재가 승인되었습니다.\n• 소속: ${targetUser.office_name || "개인개업"}\n• 자격 상태: **정상 (ACTIVE)**\n• 디스코드: ${targetUser.discord_id || "미기재"} (역할 자동 동기화)`,
            color: 0x10B981,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({ success: true, message: `${targetUser.name}님의 변호사 등록이 승인되었습니다.` });
    }

    // 2. 가입 반려/거절 액션
    if (action === "REJECT_USER") {
      await db.execute({
        sql: `UPDATE users SET status = 'EXPIRED' WHERE id = ?`,
        args: [userId],
      });

      if (targetUser.discord_id) {
        await syncUserDiscordRoles({
          discordUserId: targetUser.discord_id as string,
          role: targetUser.role as string,
          status: "EXPIRED",
          isTrainee: Number(targetUser.is_trainee || 0),
          positions: userPositions,
        });
      }

      return NextResponse.json({ success: true, message: "신청이 반려 처리되었습니다." });
    }

    // 3. 일반 정보 및 세부 직책 수정
    if (action === "UPDATE_USER") {
      const newRole = String(role || targetUser.role);
      const newStatus = String(status || targetUser.status);
      const newIsTrainee: number = isTrainee !== undefined ? Number(isTrainee) : Number(targetUser.is_trainee || 0);
      const newOfficeName = officeName !== undefined ? officeName : String(targetUser.office_name || "");
      const newPositions = Array.isArray(positions) ? positions : userPositions;

      await db.execute({
        sql: `UPDATE users 
              SET role = ?, status = ?, is_trainee = ?, office_name = ?, positions = ?
              WHERE id = ?`,
        args: [newRole, newStatus, newIsTrainee, newOfficeName, JSON.stringify(newPositions), userId],
      });

      // 디스코드 역할 자동 동기화
      if (targetUser.discord_id) {
        await syncUserDiscordRoles({
          discordUserId: targetUser.discord_id as string,
          role: newRole as string,
          status: newStatus as string,
          isTrainee: newIsTrainee,
          positions: newPositions,
        });
      }

      // 상태 변경 알림
      await sendDiscordWebhook("ADMIN", {
        embeds: [
          {
            title: "👤 [회원 관리] 회원 정보 및 직책 갱신",
            description: `관리자 **${admin.name}** 님이 **${targetUser.name}** 회원의 정보를 변경하였습니다.\n• 역할: ${targetUser.role} ➔ **${newRole}**\n• 상태: ${targetUser.status} ➔ **${newStatus}**\n• 직책: **${newPositions.join(", ") || "일반"}**`,
            color: 0x6366F1,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({ success: true, message: "회원 정보 및 직책이 성공적으로 갱신되었습니다." });
    }

    return NextResponse.json({ error: "유효하지 않은 관리 액션입니다." }, { status: 400 });
  } catch (err: any) {
    console.error("Users POST Error:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

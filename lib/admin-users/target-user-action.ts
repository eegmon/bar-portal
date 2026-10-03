import { NextResponse } from "next/server";
import db from "@/lib/db";
import { sendDiscordWebhook, syncUserDiscordRoles } from "@/lib/discord";
import { parseUserPositions } from "@/lib/user-positions";
import type { SessionUser } from "@/lib/types";

export async function handleTargetUserAction(body: any, admin: SessionUser) {
  const isSuperAdmin = admin.role === "ADMIN";
  const { userId, role, status, isTrainee, officeName, positions, action } =
    body;

  if (!userId) {
    return NextResponse.json(
      { error: "유저 ID가 필요합니다." },
      { status: 400 },
    );
  }

  const userRes = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [userId],
  });

  if (userRes.rows.length === 0) {
    return NextResponse.json(
      { error: "해당 유저를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const targetUser = userRes.rows[0];
  const userPositions = parseUserPositions(targetUser.positions);

  if (targetUser.role === "ADMIN" && !isSuperAdmin) {
    return NextResponse.json(
      { error: "최고 관리자(ADMIN) 계정은 최고 관리자만 관리할 수 있습니다." },
      { status: 403 },
    );
  }

  if (action === "REVIEW_BONUS") {
    const { decision } = body;
    if (!userId || !["APPROVE", "REJECT", "REVOKE"].includes(decision)) {
      return NextResponse.json(
        { error: "잘못된 요청입니다." },
        { status: 400 },
      );
    }

    const userResult = await db.execute({
      sql: "SELECT name, bonus_eligible FROM users WHERE id = ?",
      args: [userId],
    });
    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "회원을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const current = Number(userResult.rows[0].bonus_eligible);
    const name = String(userResult.rows[0].name);
    if (decision !== "REVOKE" && current !== 2) {
      return NextResponse.json(
        { error: "심사 대기 상태의 신청이 아닙니다." },
        { status: 409 },
      );
    }
    if (decision === "REVOKE" && current !== 1) {
      return NextResponse.json(
        { error: "승인된 상태가 아닙니다." },
        { status: 409 },
      );
    }

    const next = decision === "APPROVE" ? 1 : 0;
    await db.execute({
      sql: "UPDATE users SET bonus_eligible = ? WHERE id = ?",
      args: [next, userId],
    });
    if (next === 0) {
      try {
        await db.execute({
          sql: "UPDATE exam_submissions SET bonus_approved = 0 WHERE claimed_user_id = ?",
          args: [userId],
        });
      } catch {}
    }

    const message = {
      APPROVE: `${name} 님의 가산점 신청을 승인했습니다.`,
      REJECT: `${name} 님의 가산점 신청을 반려했습니다.`,
      REVOKE: `${name} 님의 가산점 승인을 취소했습니다.`,
    }[decision as "APPROVE" | "REJECT" | "REVOKE"];
    return NextResponse.json({ success: true, bonusEligible: next, message });
  }

  if (action === "APPROVE_LAWYER") {
    await db.execute({
      sql: `UPDATE users
            SET role = 'LAWYER', status = 'ACTIVE', last_renewed_at = datetime('now')
            WHERE id = ?`,
      args: [userId],
    });

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
          color: 0x10b981,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: `${targetUser.name}님의 변호사 등록이 승인되었습니다.`,
    });
  }

  if (action === "REJECT_USER") {
    await db.execute({
      sql: "UPDATE users SET status = 'EXPIRED' WHERE id = ?",
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

    return NextResponse.json({
      success: true,
      message: "신청이 반려 처리되었습니다.",
    });
  }

  if (action === "UPDATE_USER") {
    const newRole = String(role || targetUser.role);
    const newStatus = String(status || targetUser.status);
    const newIsTrainee =
      isTrainee !== undefined
        ? Number(isTrainee)
        : Number(targetUser.is_trainee || 0);
    const newOfficeName =
      officeName !== undefined
        ? officeName
        : String(targetUser.office_name || "");
    const newPositions = Array.isArray(positions) ? positions : userPositions;

    if (newRole === "ADMIN" && !isSuperAdmin) {
      return NextResponse.json(
        {
          error: "최고 관리자(ADMIN) 권한은 최고 관리자만 부여할 수 있습니다.",
        },
        { status: 403 },
      );
    }

    await db.execute({
      sql: `UPDATE users
            SET role = ?, status = ?, is_trainee = ?, office_name = ?, positions = ?
            WHERE id = ?`,
      args: [
        newRole,
        newStatus,
        newIsTrainee,
        newOfficeName,
        JSON.stringify(newPositions),
        userId,
      ],
    });

    if (targetUser.discord_id) {
      await syncUserDiscordRoles({
        discordUserId: targetUser.discord_id as string,
        role: newRole,
        status: newStatus,
        isTrainee: newIsTrainee,
        positions: newPositions,
      });
    }

    await sendDiscordWebhook("ADMIN", {
      embeds: [
        {
          title: "👤 [회원 관리] 회원 정보 및 직책 갱신",
          description: `관리자 **${admin.name}** 님이 **${targetUser.name}** 회원의 정보를 변경하였습니다.\n• 역할: ${targetUser.role} ➔ **${newRole}**\n• 상태: ${targetUser.status} ➔ **${newStatus}**\n• 직책: **${newPositions.join(", ") || "일반"}**`,
          color: 0x6366f1,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: "회원 정보 및 직책이 성공적으로 갱신되었습니다.",
    });
  }

  return NextResponse.json(
    { error: "유효하지 않은 관리 액션입니다." },
    { status: 400 },
  );
}

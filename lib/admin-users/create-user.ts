import { NextResponse } from "next/server";
import db from "@/lib/db";
import { sendDiscordWebhook, syncUserDiscordRoles } from "@/lib/discord";
import { hashPassword } from "@/lib/password";
import type { SessionUser } from "@/lib/types";

export async function createAdminUserAction(body: any, admin: SessionUser) {
  const {
    loginId,
    password,
    name,
    discordId,
    role = "LAWYER",
    status = "ACTIVE",
    isTrainee = 0,
    officeName = "",
    positions = [],
    phone = "",
    bio = "",
    barExamRound = null,
  } = body;

  if (!loginId || !password || !name) {
    return NextResponse.json(
      { error: "아이디, 비밀번호, 성명은 필수입니다." },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "비밀번호는 최소 6자 이상이어야 합니다." },
      { status: 400 },
    );
  }

  if (role === "ADMIN" && admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: "최고 관리자(ADMIN) 권한은 최고 관리자만 부여할 수 있습니다." },
      { status: 403 },
    );
  }

  const checkUser = await db.execute({
    sql: "SELECT id FROM users WHERE login_id = ?",
    args: [loginId],
  });

  if (checkUser.rows.length > 0) {
    return NextResponse.json(
      { error: "이미 존재하는 아이디입니다." },
      { status: 400 },
    );
  }

  const hashedPassword = await hashPassword(password);
  const newUserId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const userPositions = Array.isArray(positions) ? positions : [];

  await db.execute({
    sql: `INSERT INTO users (id, login_id, password, name, discord_id, role, status, is_trainee, office_name, positions, phone, bio, bar_exam_round, last_renewed_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [
      newUserId,
      loginId,
      hashedPassword,
      name,
      discordId || "",
      role,
      status,
      Number(isTrainee) || 0,
      officeName || "",
      JSON.stringify(userPositions),
      phone || "",
      bio || "",
      barExamRound || null,
    ],
  });

  if (discordId) {
    try {
      await syncUserDiscordRoles({
        discordUserId: discordId,
        role,
        status,
        isTrainee: Number(isTrainee) || 0,
        positions: userPositions,
      });
    } catch (syncErr) {
      console.warn("디스코드 역할 동기화 실패(무시):", syncErr);
    }
  }

  await sendDiscordWebhook("ADMIN", {
    embeds: [
      {
        title: `👤 [관리자 직권] 신규 회원 계정 생성: ${name} (${loginId})`,
        description: `관리자 **${admin.name}** 님이 회원을 직권 등록하였습니다.\n• 역할: **${role}**\n• 상태: **${status}**\n• 소속: ${officeName || "미기재"}\n• 직책: ${userPositions.join(", ") || "일반"}\n• 디스코드: ${discordId || "미기재"}`,
        color: 0x10b981,
        timestamp: new Date().toISOString(),
      },
    ],
  });

  const newUser = {
    id: newUserId,
    login_id: loginId,
    name,
    discord_id: discordId || "",
    role,
    status,
    is_trainee: Number(isTrainee) || 0,
    office_name: officeName || "",
    positions: userPositions,
    phone: phone || "",
    bio: bio || "",
    bar_exam_round: barExamRound || null,
    created_at: new Date().toISOString(),
  };

  return NextResponse.json({
    success: true,
    message: `${name} 회원의 계정이 성공적으로 생성되었습니다.`,
    user: newUser,
  });
}

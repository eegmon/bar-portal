import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { signToken, SessionUser } from "@/lib/auth";
import { sendDiscordWebhook, syncUserDiscordRoles } from "@/lib/discord";

export async function POST(req: Request) {
  try {
    const { loginId, password, name, discordId, isLawyerApplicant, officeName } = await req.json();

    if (!loginId || !password || !name) {
      return NextResponse.json({ error: "아이디, 비밀번호, 성명은 필수 입력 항목입니다." }, { status: 400 });
    }

    // 아이디 중복 체크
    const checkUser = await db.execute({
      sql: "SELECT id FROM users WHERE login_id = ?",
      args: [loginId],
    });

    if (checkUser.rows.length > 0) {
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const role = isLawyerApplicant ? "LAWYER" : "CITIZEN";
    const status = isLawyerApplicant ? "PENDING" : "ACTIVE"; // 변호사 신청 시 관리자 승인 대기

    await db.execute({
      sql: `INSERT INTO users (id, login_id, password, name, discord_id, role, status, office_name, positions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]')`,
      args: [userId, loginId, hashedPassword, name, discordId || "", role, status, officeName || ""],
    });

    const sessionUser: SessionUser = {
      id: userId,
      loginId,
      name,
      role: role as any,
      status: status as any,
      isTrainee: 0,
      positions: [],
    };

    const token = signToken(sessionUser);

    // 디스코드 역할 동기화 시도
    if (discordId) {
      await syncUserDiscordRoles({
        discordUserId: discordId,
        role,
        status,
        isTrainee: 0,
        positions: [],
      });
    }

    // 디스코드 관리자/사무국 채널 알림
    await sendDiscordWebhook("ADMIN", {
      embeds: [
        {
          title: `👤 신규 회원 가입: ${name} (${loginId})`,
          description: `새로운 회원이 가입하였습니다.\n• 구분: **${isLawyerApplicant ? "변호사 자격 등록 신청 (승인 대기)" : "일반 시민/수험생"}**\n• 디스코드: ${discordId || "미기재"}\n• 소속: ${officeName || "미기재"}`,
          color: isLawyerApplicant ? 0xF59E0B : 0x3B82F6,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      isPending: isLawyerApplicant,
    });

    response.cookies.set("bar_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("회원가입 에러:", err);
    return NextResponse.json({ error: err.message || "회원가입 실패" }, { status: 500 });
  }
}

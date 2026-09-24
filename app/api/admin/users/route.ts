import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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
        u.phone, u.office_name, u.office_address, u.bio, u.qualification_proof, u.self_introduction, u.specialties,
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

    const isSuperAdmin = admin.role === "ADMIN";
    const body = await req.json();
    const { action } = body;

    // 0. 관리자 직권 신규 회원 계정 생성
    if (action === "CREATE_USER") {
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
        return NextResponse.json({ error: "아이디, 비밀번호, 성명은 필수입니다." }, { status: 400 });
      }

      if (password.length < 6) {
        return NextResponse.json({ error: "비밀번호는 최소 6자 이상이어야 합니다." }, { status: 400 });
      }

      // [보안 권한 상승 방지] 최고 관리자(ADMIN) 권한 부여는 오직 최고 관리자만 가능
      if (role === "ADMIN" && !isSuperAdmin) {
        return NextResponse.json({ error: "최고 관리자(ADMIN) 권한은 최고 관리자만 부여할 수 있습니다." }, { status: 403 });
      }

      // 아이디 중복 체크
      const checkUser = await db.execute({
        sql: "SELECT id FROM users WHERE login_id = ?",
        args: [loginId],
      });

      if (checkUser.rows.length > 0) {
        return NextResponse.json({ error: "이미 존재하는 아이디입니다." }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
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

      // 디스코드 역할 동기화 시도
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

      // 웹훅 알림
      await sendDiscordWebhook("ADMIN", {
        embeds: [
          {
            title: `👤 [관리자 직권] 신규 회원 계정 생성: ${name} (${loginId})`,
            description: `관리자 **${admin.name}** 님이 회원을 직권 등록하였습니다.\n• 역할: **${role}**\n• 상태: **${status}**\n• 소속: ${officeName || "미기재"}\n• 직책: ${userPositions.join(", ") || "일반"}\n• 디스코드: ${discordId || "미기재"}`,
            color: 0x10B981,
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

    const { userId, role, status, isTrainee, officeName, positions } = body;

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

    // [보안 권한 상승 및 관리자 계정 임의 조작 방지]
    if (targetUser.role === "ADMIN" && !isSuperAdmin) {
      return NextResponse.json(
        { error: "최고 관리자(ADMIN) 계정은 최고 관리자만 관리할 수 있습니다." },
        { status: 403 }
      );
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

      // 최고 관리자(ADMIN) 역할 승격 방지
      if (newRole === "ADMIN" && !isSuperAdmin) {
        return NextResponse.json(
          { error: "최고 관리자(ADMIN) 권한은 최고 관리자만 부여할 수 있습니다." },
          { status: 403 }
        );
      }

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

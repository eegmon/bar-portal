import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { signToken, SessionUser } from "@/lib/auth";
import { sendDiscordWebhook, syncUserDiscordRoles } from "@/lib/discord";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      loginId: rawLoginId,
      password,
      name: rawName,
      discordId: rawDiscordId,
      isLawyerApplicant,
      officeName,
      phone,
      qualificationProof,
      selfIntroduction,
      barExamRound,
    } = body;

    const loginId = (rawLoginId || "").trim();
    const name = (rawName || "").trim();
    const discordId = (rawDiscordId || "").trim();
    const proofText = (qualificationProof || "").trim();

    if (!loginId || !password || !name) {
      return NextResponse.json(
        { error: "아이디, 비밀번호, 성명은 필수 입력 항목입니다." },
        { status: 400 }
      );
    }

    if (loginId.length < 4 || loginId.length > 20) {
      return NextResponse.json(
        { error: "아이디는 4자 이상 20자 이하로 입력해 주세요." },
        { status: 400 }
      );
    }

    const idRegex = /^[a-zA-Z0-9_]+$/;
    if (!idRegex.test(loginId)) {
      return NextResponse.json(
        { error: "아이디는 영문, 숫자, 밑줄(_)만 사용할 수 있습니다." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 최소 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    if (name.length < 2) {
      return NextResponse.json(
        { error: "성명(인게임 닉네임)은 2자 이상 입력해 주세요." },
        { status: 400 }
      );
    }

    // 아이디 중복 체크 (대소문자 무관)
    const checkUser = await db.execute({
      sql: "SELECT id FROM users WHERE LOWER(login_id) = LOWER(?)",
      args: [loginId],
    });

    if (checkUser.rows.length > 0) {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디입니다." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const role = isLawyerApplicant ? "LAWYER" : "CITIZEN";
    const status = isLawyerApplicant ? "PENDING" : "ACTIVE"; // 변호사 신청 시 관리자 승인 대기

    await db.execute({
      sql: `INSERT INTO users (
              id, login_id, password, name, discord_id, role, status, 
              office_name, positions, phone, bio, qualification_proof, self_introduction, bar_exam_round,
              last_renewed_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: [
        userId,
        loginId,
        hashedPassword,
        name,
        discordId || "",
        role,
        status,
        officeName ? officeName.trim() : "",
        phone ? phone.trim() : "",
        proofText,
        proofText,
        (selfIntroduction || "").trim(),
        barExamRound ? Number(barExamRound) || null : null,
      ],
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

    // 디스코드 역할 동기화 시도 (실패해도 가입은 유지)
    if (discordId) {
      try {
        await syncUserDiscordRoles({
          discordUserId: discordId,
          role,
          status,
          isTrainee: 0,
          positions: [],
        });
      } catch (syncErr) {
        console.warn("회원가입 디스코드 역할 동기화 실패(무시):", syncErr);
      }
    }

    // 디스코드 관리자/사무국 채널 알림 (실패해도 가입은 유지)
    try {
      await sendDiscordWebhook("ADMIN", {
        embeds: [
          {
            title: `👤 신규 회원 가입: ${name} (${loginId})`,
            description: `새로운 회원이 가입하였습니다.\n• 구분: **${
              isLawyerApplicant
                ? "변호사 자격 등록 신청 (관리자 승인 대기)"
                : "일반 회원 / 수험생 (정상 활성)"
            }**\n• 디스코드: ${discordId || "미기재"}\n• 소속: ${
              officeName || "미기재"
            }\n• 연락처: ${phone || "미기재"}${
              proofText ? `\n• 자격 취득 근거/증빙: **${proofText}**` : ""
            }`,
            color: isLawyerApplicant ? 0xf59e0b : 0x3b82f6,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (webhookErr) {
      console.warn("회원가입 디스코드 웹훅 발송 실패(무시):", webhookErr);
    }

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      isPending: isLawyerApplicant,
      message: isLawyerApplicant
        ? "변호사 자격 등록 신청이 접수되었습니다. 관리자 승인 후 정회원으로 전환됩니다."
        : "도스변호사협회 회원가입이 완료되었습니다!",
    });

    response.cookies.set("bar_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("회원가입 에러:", err);
    return NextResponse.json(
      { error: err.message || "회원가입 실패" },
      { status: 500 }
    );
  }
}

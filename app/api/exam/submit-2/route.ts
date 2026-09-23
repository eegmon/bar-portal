import { NextResponse } from "next/server";
import db from "@/lib/db";
import { sendDiscordWebhook } from "@/lib/discord";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { examId, securityCode, textAnswer, fileUrl, isInstantPledged } =
      body;

    if (!examId || !securityCode || (!textAnswer && !fileUrl)) {
      return NextResponse.json(
        { error: "답안 내용 또는 파일이 누락되었습니다." },
        { status: 400 },
      );
    }

    const code = String(securityCode).trim().toUpperCase();
    const userId = `anonymous-${code}`;

    // 기존 제출 기록 확인
    const subRes = await db.execute({
      sql: "SELECT * FROM exam_submissions WHERE exam_id = ? AND security_code = ?",
      args: [examId, code],
    });

    if (subRes.rows.length === 0) {
      return NextResponse.json(
        { error: "관리자가 발급한 유효한 수험번호가 아닙니다." },
        { status: 403 },
      );
    }

    const existing = subRes.rows[0];
    if (!existing.phase1_passed) {
      return NextResponse.json(
        { error: "1차 합격자만 2차 답안을 제출할 수 있습니다." },
        { status: 403 },
      );
    }
    if (existing.is_instant_grade_pledged && !existing.phase2_feedback) {
      return NextResponse.json(
        {
          error:
            "이미 [즉시 채점 서약]으로 제출되어 답안 수정/철회가 불가합니다.",
        },
        { status: 400 },
      );
    }

    await db.execute({
      sql: `UPDATE exam_submissions
            SET phase2_text_answer = ?, phase2_file_url = ?, is_instant_grade_pledged = ?, submitted_at = datetime('now')
            WHERE id = ?`,
      args: [
        textAnswer || "",
        fileUrl || "",
        isInstantPledged ? 1 : 0,
        existing.id,
      ],
    });

    // 디스코드 채점관 전용 알림
    await sendDiscordWebhook("ADMIN", {
      embeds: [
        {
          title: `📄 제2차 변호사시험 서술형 답안 제출 (#${code})`,
          description: `익명 수험번호 #${code} 답안이 접수되었습니다.\n• 즉시 채점 서약: **${isInstantPledged ? "🔒 확정 (철회 불가)" : "📝 일반 제출 (마감 전 수정 가능)"}**\n• 답안 유형: ${fileUrl ? "파일 첨부" : "웹 서술형 작성"}`,
          color: isInstantPledged ? 0xf59e0b : 0x3b82f6,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    return NextResponse.json({
      success: true,
      securityCode: code,
      isInstantPledged: Boolean(isInstantPledged),
      message: isInstantPledged
        ? "즉시 채점 서약으로 최종 제출되었습니다. 출제위원이 곧 채점을 시작합니다."
        : "답안이 임시 저장되었습니다. 마감 시간 전까지 수정 및 철회가 가능합니다.",
    });
  } catch (err: any) {
    console.error("2차 시험 제출 에러:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}

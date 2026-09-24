import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { securityCode } = await req.json();

    if (!securityCode) {
      return NextResponse.json(
        { error: "수험번호(보안코드)를 입력해 주세요." },
        { status: 400 },
      );
    }

    const code = securityCode.trim().toUpperCase();

    // 1차 시험 응시 및 합격 여부 조회
    const res = await db.execute({
      sql: "SELECT * FROM exam_submissions WHERE security_code = ?",
      args: [code],
    });

    if (res.rows.length === 0) {
      return NextResponse.json(
        {
          eligible: false,
          error:
            "해당 수험번호의 1차 CBT 응시 기록이 없습니다. 1차 시험을 먼저 응시해 주세요.",
        },
        { status: 403 },
      );
    }

    const sub = res.rows[0];
    if (!sub.phase1_passed) {
      return NextResponse.json(
        {
          eligible: false,
          error: `수험번호 #${code} 님은 1차 필기시험 득점(${sub.phase1_score}점)이 기준에 미달하여 2차 시험 응시 자격이 없습니다.`,
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      eligible: true,
      examId: sub.exam_id,
      securityCode: code,
      phase1Score: sub.phase1_score,
      existingTextAnswer: sub.phase2_text_answer || "",
      existingFileUrl: sub.phase2_file_url || "",
      isPledged: Boolean(sub.is_instant_grade_pledged),
      isPublished: Boolean(sub.phase2_published),
      publishedAt: sub.phase2_published_at || "",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "자격 검증 실패" },
      { status: 500 },
    );
  }
}

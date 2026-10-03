import { NextResponse } from "next/server";
import db from "@/lib/db";
import { ensurePublishColumns, isPhase1Published } from "@/lib/exam-publish";
import { checkRequestRateLimit } from "@/lib/request-rate-limit";

export async function GET(req: Request) {
  try {
    const rateLimit = await checkRequestRateLimit(req, "exam-score", 30, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "조회 요청이 많습니다. 잠시 후 다시 시도해 주세요." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim().toUpperCase();

    if (!code) {
      return NextResponse.json(
        { error: "수험번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    const res = await db.execute({
      sql: `SELECT security_code, exam_id, phase1_answers, phase1_score,
                   phase1_passed, phase2_question1_score, phase2_question2_score,
                   phase2_score, bonus_score, rank, final_passed, phase2_feedback
            FROM exam_submissions WHERE security_code = ?`,
      args: [code],
    });

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: "해당 수험번호의 응시 기록을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const sub = res.rows[0];

    // 1차 성적 발표 전에는 어떤 점수/합격 정보도 반환하지 않는다.
    await ensurePublishColumns();
    const examRes = await db.execute({
      sql: "SELECT phase1_published FROM exams WHERE id = ?",
      args: [sub.exam_id as string],
    });
    if (!isPhase1Published(examRes.rows[0])) {
      return NextResponse.json({
        security_code: sub.security_code,
        phase1_published: false,
        submitted: Boolean(sub.phase1_answers && sub.phase1_answers !== "[]"),
      });
    }
    return NextResponse.json({
      security_code: sub.security_code,
      phase1_published: true,
      phase1_score: sub.phase1_score,
      phase1_passed: sub.phase1_passed,
      phase2_question1_score: sub.phase2_question1_score,
      phase2_question2_score: sub.phase2_question2_score,
      phase2_score: sub.phase2_score,
      bonus_score: sub.bonus_score,
      rank: sub.rank,
      final_passed: sub.final_passed,
      phase2_feedback: sub.phase2_feedback,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "조회 실패" },
      { status: 500 },
    );
  }
}

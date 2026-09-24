import { NextResponse } from "next/server";
import db from "@/lib/db";
import { isExamPhaseOpen } from "@/lib/exam-timing";

export async function GET() {
  try {
    const res = await db.execute({
      sql: "SELECT id, title, round_number, phase1_start, phase1_end, phase1_max_score, phase1_questions, errata_notices, status, phase1_operation_mode FROM exams ORDER BY round_number DESC LIMIT 1",
    });

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: "등록된 시험이 없습니다." },
        { status: 404 },
      );
    }

    const exam = res.rows[0];
    if (!isExamPhaseOpen(exam, "PHASE1")) {
      return NextResponse.json(
        { error: "현재 공개할 수 있는 시험 문항이 없습니다." },
        { status: 403 },
      );
    }
    const rawQuestions = JSON.parse((exam.phase1_questions as string) || "[]");
    const errataNotices = JSON.parse((exam.errata_notices as string) || "[]");

    // 수험생용 문항 목록 (정답 정보 answer, altAnswers는 클라이언트에 노출하지 않고 전달)
    const questions = rawQuestions.map((q: any) => ({
      num: q.num,
      subject: q.subject,
      title: q.title,
      choices: q.choices,
    }));

    return NextResponse.json({
      success: true,
      examId: exam.id,
      title: exam.title,
      roundNumber: exam.round_number,
      phase1MaxScore: Number(exam.phase1_max_score || 100),
      questions,
      errataNotices,
    });
  } catch (err: any) {
    console.error("Questions GET Error:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}

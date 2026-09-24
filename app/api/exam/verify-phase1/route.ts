import { NextResponse } from "next/server";
import db from "@/lib/db";
import { isExamPhaseOpen } from "@/lib/exam-timing";

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

    // exam 테이블에서 2차 오픈 여부 및 PDF URL 조회
    const examRes = await db.execute({
      sql: "SELECT * FROM exams WHERE id = ?",
      args: [sub.exam_id as string],
    });

    if (examRes.rows.length === 0) {
      return NextResponse.json(
        { eligible: false, error: "시험 정보를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const examRow = examRes.rows[0];

    // PHASE2가 열려 있지 않으면 입장 차단
    if (!isExamPhaseOpen(examRow, "PHASE2")) {
      return NextResponse.json(
        {
          eligible: false,
          error:
            "현재 제2차 시험 응시 기간이 아닙니다. 2차 시험 시작 후 다시 접속해 주세요.",
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
      phase2Doc1PdfUrl: (examRow?.phase2_doc1_pdf_url as string) || "",
      phase2Doc2PdfUrl: (examRow?.phase2_doc2_pdf_url as string) || "",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "자격 검증 실패" },
      { status: 500 },
    );
  }
}

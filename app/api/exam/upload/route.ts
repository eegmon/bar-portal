import { NextResponse } from "next/server";
import db from "@/lib/db";
import { ensurePublishColumns, isPhase1Published } from "@/lib/exam-publish";
import { isExamPhaseOpen } from "@/lib/exam-timing";
import { checkRequestRateLimit } from "@/lib/request-rate-limit";
import {
  MAX_FILE_SIZE,
  resolveFileType,
  saveExamFile,
  fileUrlOf,
} from "@/lib/exam-files";

// 수험생 2차 답안 파일 업로드 → DB(exam_files)에 저장
export async function POST(req: Request) {
  try {
    const rateLimit = await checkRequestRateLimit(
      req,
      "exam-answer-upload",
      6,
      60,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "파일 업로드 요청이 많습니다. 잠시 후 다시 시도해 주세요." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const formData = await req.formData();
    const examId = String(formData.get("examId") || "");
    const securityCode = String(formData.get("securityCode") || "")
      .trim()
      .toUpperCase();
    const file = formData.get("file");
    if (!examId || !securityCode || !(file instanceof File)) {
      return NextResponse.json(
        { error: "시험, 수험번호, 파일이 필요합니다." },
        { status: 400 },
      );
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일은 1바이트 이상 10MB 이하만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }
    const type = resolveFileType(file);
    if (!type)
      return NextResponse.json(
        { error: "PDF, DOC, DOCX, HWP 파일만 업로드할 수 있습니다." },
        { status: 400 },
      );
    await ensurePublishColumns();
    const submissionRes = await db.execute({
      sql: `SELECT es.id, es.phase1_passed, es.is_instant_grade_pledged,
           e.phase1_published, e.status, e.phase2_start,
           e.phase2_end, e.phase2_operation_mode
            FROM exam_submissions es JOIN exams e ON e.id = es.exam_id
            WHERE es.exam_id = ? AND es.security_code = ?`,
      args: [examId, securityCode],
    });
    if (
      submissionRes.rows.length === 0 ||
      !submissionRes.rows[0].phase1_passed ||
      !isPhase1Published(submissionRes.rows[0]) ||
      !isExamPhaseOpen(submissionRes.rows[0], "PHASE2")
    ) {
      return NextResponse.json(
        { error: "유효한 1차 합격 수험번호가 아닙니다." },
        { status: 403 },
      );
    }
    if (submissionRes.rows[0].is_instant_grade_pledged)
      return NextResponse.json(
        { error: "최종 제출 후에는 파일을 변경할 수 없습니다." },
        { status: 400 },
      );

    const id = await saveExamFile({
      kind: "answer",
      examId,
      securityCode,
      file,
      mime: type.mime,
    });
    return NextResponse.json({
      success: true,
      fileUrl: fileUrlOf(id),
      fileName: file.name,
    });
  } catch (error: unknown) {
    console.error("시험 파일 업로드 오류:", error);
    return NextResponse.json(
      { error: "파일 업로드에 실패했습니다." },
      { status: 500 },
    );
  }
}

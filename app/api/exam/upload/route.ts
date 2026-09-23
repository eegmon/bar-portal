import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import db from "@/lib/db";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["application/pdf", ".pdf"],
  ["application/msword", ".doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".docx",
  ],
  ["application/x-hwp", ".hwp"],
]);

export async function POST(req: Request) {
  try {
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
    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension)
      return NextResponse.json(
        { error: "PDF, DOC, DOCX, HWP 파일만 업로드할 수 있습니다." },
        { status: 400 },
      );
    const submissionRes = await db.execute({
      sql: "SELECT id, phase1_passed, is_instant_grade_pledged FROM exam_submissions WHERE exam_id = ? AND security_code = ?",
      args: [examId, securityCode],
    });
    if (
      submissionRes.rows.length === 0 ||
      !submissionRes.rows[0].phase1_passed
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

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "exam",
      examId,
    );
    await mkdir(uploadDir, { recursive: true });
    const filename = `${securityCode}-${Date.now()}-${randomBytes(8).toString("hex")}${extension}`;
    await writeFile(
      path.join(uploadDir, filename),
      Buffer.from(await file.arrayBuffer()),
      { flag: "wx" },
    );
    return NextResponse.json({
      success: true,
      fileUrl: `/uploads/exam/${encodeURIComponent(examId)}/${filename}`,
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

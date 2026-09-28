import { NextResponse } from "next/server";
import { getSessionUser, canManageExam } from "@/lib/auth";
import {
  MAX_FILE_SIZE,
  resolveFileType,
  saveExamFile,
  fileUrlOf,
} from "@/lib/exam-files";

// 관리자: 문제지 파일 업로드 → DB 저장 후 다운로드 URL 반환
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !canManageExam(user)) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일은 1바이트 이상 10MB 이하만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }
    const type = resolveFileType(file);
    if (!type) {
      return NextResponse.json(
        { error: "PDF, DOC, DOCX, HWP 파일만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }
    const id = await saveExamFile({ kind: "problem", file, mime: type.mime });
    return NextResponse.json({
      success: true,
      fileUrl: fileUrlOf(id),
      fileName: file.name,
    });
  } catch (error) {
    console.error("문제지 업로드 오류:", error);
    return NextResponse.json({ error: "업로드에 실패했습니다." }, { status: 500 });
  }
}

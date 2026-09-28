import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser, canManageExam } from "@/lib/auth";
import { ensureFilesTable } from "@/lib/exam-files";

// 파일 다운로드
//  - problem(문제지): 링크를 아는 사람 누구나 (기존 공개 URL 방식과 동일, id는 추측 불가)
//  - answer(수험생 답안): 시험 관리자만
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{32}$/.test(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  try {
    await ensureFilesTable();
    const res = await db.execute({
      sql: "SELECT kind, filename, mime, data FROM exam_files WHERE id = ?",
      args: [id],
    });
    if (res.rows.length === 0) {
      return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
    }
    const row = res.rows[0];

    if (row.kind === "answer") {
      const user = await getSessionUser();
      if (!user || !canManageExam(user)) {
        return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
      }
    }

    const body = Buffer.from(row.data as ArrayBuffer);
    const name = String(row.filename);
    return new NextResponse(body, {
      headers: {
        "Content-Type": String(row.mime),
        "Content-Length": String(body.length),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": row.kind === "answer" ? "private, no-store" : "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("파일 다운로드 오류:", error);
    return NextResponse.json({ error: "다운로드에 실패했습니다." }, { status: 500 });
  }
}

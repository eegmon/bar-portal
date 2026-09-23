import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "수험번호를 입력해 주세요." }, { status: 400 });
    }

    const res = await db.execute({
      sql: "SELECT * FROM exam_submissions WHERE security_code = ?",
      args: [code],
    });

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "해당 수험번호의 응시 기록을 찾을 수 없습니다." }, { status: 404 });
    }

    const sub = res.rows[0];
    return NextResponse.json(sub);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "조회 실패" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const loginId = (searchParams.get("loginId") || "").trim().toLowerCase();

    if (!loginId) {
      return NextResponse.json({ error: "아이디를 입력해주세요." }, { status: 400 });
    }

    if (loginId.length < 4 || loginId.length > 20) {
      return NextResponse.json(
        { available: false, message: "아이디는 4~20자 사이여야 합니다." },
        { status: 200 }
      );
    }

    const idRegex = /^[a-zA-Z0-9_]+$/;
    if (!idRegex.test(loginId)) {
      return NextResponse.json(
        { available: false, message: "영문, 숫자, 밑줄(_)만 사용할 수 있습니다." },
        { status: 200 }
      );
    }

    const res = await db.execute({
      sql: "SELECT id FROM users WHERE LOWER(login_id) = ?",
      args: [loginId],
    });

    if (res.rows.length > 0) {
      return NextResponse.json(
        { available: false, message: "이미 사용 중인 아이디입니다." },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { available: true, message: "사용 가능한 아이디입니다." },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Check ID Error:", err);
    return NextResponse.json({ error: "중복 확인 중 오류가 발생했습니다." }, { status: 500 });
  }
}

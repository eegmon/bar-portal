import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { signToken, SessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { loginId, password } = await req.json();

    if (!loginId || !password) {
      return NextResponse.json({ error: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
    }

    const res = await db.execute({
      sql: "SELECT * FROM users WHERE login_id = ?",
      args: [loginId],
    });

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "존재하지 않는 회원입니다." }, { status: 401 });
    }

    const user = res.rows[0];
    const isMatch = await bcrypt.compare(password, user.password as string);

    if (!isMatch) {
      return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
    }

    let positions: string[] = [];
    try {
      positions = JSON.parse((user.positions as string) || "[]");
    } catch {
      positions = [];
    }

    const sessionUser: SessionUser = {
      id: user.id as string,
      loginId: user.login_id as string,
      name: user.name as string,
      role: user.role as any,
      status: user.status as any,
      isTrainee: Number(user.is_trainee || 0),
      positions,
    };

    const token = signToken(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
    });

    response.cookies.set("bar_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("로그인 에러:", err);
    return NextResponse.json({ error: err.message || "로그인 실패" }, { status: 500 });
  }
}

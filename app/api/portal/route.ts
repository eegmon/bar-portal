import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── 프로필 수정 ──────────────────────────────────────────────
    if (action === "UPDATE_PROFILE") {
      const { officeName, officeAddress, bio, specialties, discordId, phone } = body;

      await db.execute({
        sql: `UPDATE users
              SET office_name = ?, office_address = ?, bio = ?, specialties = ?, discord_id = ?, phone = ?
              WHERE id = ?`,
        args: [
          officeName ?? "",
          officeAddress ?? "",
          bio ?? "",
          JSON.stringify(Array.isArray(specialties) ? specialties : []),
          discordId ?? "",
          phone ?? "",
          user.id,
        ],
      });

      return NextResponse.json({ success: true, message: "프로필이 업데이트되었습니다." });
    }

    // ── 비밀번호 변경 ────────────────────────────────────────────
    if (action === "CHANGE_PASSWORD") {
      const { currentPassword, newPassword } = body;
      if (!currentPassword || !newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: "현재 비밀번호와 새 비밀번호(8자 이상)를 입력해 주세요." }, { status: 400 });
      }

      const res = await db.execute({ sql: "SELECT password FROM users WHERE id = ?", args: [user.id] });
      if (res.rows.length === 0) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

      const isMatch = await bcrypt.compare(currentPassword, res.rows[0].password as string);
      if (!isMatch) return NextResponse.json({ error: "현재 비밀번호가 일치하지 않습니다." }, { status: 400 });

      const hashed = await bcrypt.hash(newPassword, 10);
      await db.execute({ sql: "UPDATE users SET password = ? WHERE id = ?", args: [hashed, user.id] });

      return NextResponse.json({ success: true, message: "비밀번호가 변경되었습니다." });
    }

    // ── 법학과정 가산점 신청 ──────────────────────────────────────
    if (action === "APPLY_BONUS") {
      const { schoolName, graduationYear } = body;
      if (!schoolName || !graduationYear) {
        return NextResponse.json({ error: "학교명과 졸업연도를 입력해 주세요." }, { status: 400 });
      }

      // bonus_eligible = 2 : 심사중 상태
      await db.execute({
        sql: `UPDATE users SET bonus_eligible = 2, bio = CASE WHEN bio IS NULL OR bio = '' THEN ? ELSE bio || '\n[가산점신청] ' || ? END WHERE id = ?`,
        args: [
          `[가산점신청] ${schoolName} ${graduationYear}년 졸업`,
          `${schoolName} ${graduationYear}년 졸업`,
          user.id,
        ],
      });

      return NextResponse.json({ success: true, message: "법학과정 가산점 신청이 접수되었습니다. 관리자 심사 후 확정됩니다." });
    }

    return NextResponse.json({ error: "유효하지 않은 명령입니다." }, { status: 400 });
  } catch (err: any) {
    console.error("Portal API 오류:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

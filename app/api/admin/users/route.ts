import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser, canManageUsers } from "@/lib/auth";
import { parseUserPositions } from "@/lib/user-positions";
import { createAdminUserAction } from "@/lib/admin-users/create-user";
import { handleTargetUserAction } from "@/lib/admin-users/target-user-action";

export async function GET() {
  try {
    const admin = await getSessionUser();
    if (!admin || !canManageUsers(admin)) {
      return NextResponse.json(
        { error: "회원 명부 관리 권한이 필요합니다." },
        { status: 403 },
      );
    }

    const res = await db.execute(`
      SELECT 
        u.id, u.login_id, u.discord_id, u.name, u.role, u.status, u.is_trainee, 
        u.phone, u.office_name, u.office_address, u.bio, u.qualification_proof, u.self_introduction, u.specialties,
        u.positions, u.bar_exam_round, u.last_renewed_at, u.created_at, u.bonus_eligible
      FROM users u
      ORDER BY u.created_at DESC
    `);

    const users = res.rows.map((row) => ({
      ...row,
      positions: parseUserPositions(row.positions),
    }));

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (err: any) {
    console.error("Users GET Error:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getSessionUser();
    if (!admin || !canManageUsers(admin)) {
      return NextResponse.json(
        { error: "회원 명부 관리 권한이 필요합니다." },
        { status: 403 },
      );
    }

    const body = await req.json();
    if (body.action === "CREATE_USER") {
      return await createAdminUserAction(body, admin);
    }
    return await handleTargetUserAction(body, admin);
  } catch (err: any) {
    console.error("Users POST Error:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}

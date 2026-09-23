import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const res = await db.execute(
      "SELECT key, value, updated_at FROM settings WHERE key LIKE 'rules_%' ORDER BY key ASC"
    );
    const rules: Record<string, string> = {};
    for (const row of res.rows) {
      rules[row.key as string] = row.value as string;
    }
    return NextResponse.json({ success: true, rules });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const isAdmin =
      user.role === "ADMIN" ||
      (user.positions ?? []).some((p) => ["PRESIDENT", "SECRETARY_GENERAL"].includes(p));
    if (!isAdmin) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

    const { rules } = await req.json();
    if (!rules || typeof rules !== "object") {
      return NextResponse.json({ error: "rules 객체가 필요합니다." }, { status: 400 });
    }

    for (const [key, value] of Object.entries(rules)) {
      if (!key.startsWith("rules_")) continue;
      await db.execute({
        sql: `INSERT INTO settings (key, value, updated_at)
              VALUES (?, ?, datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        args: [key, value as string],
      });
    }

    return NextResponse.json({ success: true, message: "규정집이 저장되었습니다." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

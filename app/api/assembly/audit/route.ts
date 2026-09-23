import { NextResponse } from "next/server";
import db from "@/lib/db";
import { canManageAssembly, getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !canManageAssembly(user)) return NextResponse.json({ error: "총회 관리 권한이 필요합니다." }, { status: 403 });
  const url = new URL(req.url);
  const assemblyId = url.searchParams.get("assemblyId");
  const result = await db.execute({
    sql: `SELECT l.*, a.title as agenda_title, ass.title as assembly_title
          FROM assembly_audit_logs l
          LEFT JOIN agendas a ON a.id = l.agenda_id
          LEFT JOIN assemblies ass ON ass.id = l.assembly_id
          ${assemblyId ? "WHERE l.assembly_id = ?" : ""}
          ORDER BY l.created_at DESC`,
    args: assemblyId ? [assemblyId] : [],
  });
  if (url.searchParams.get("format") === "csv") {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = ["id,assembly,agenda,actor,action,details,created_at", ...result.rows.map((row) => [row.id, row.assembly_title, row.agenda_title, row.actor_id, row.action, row.details, row.created_at].map(escape).join(","))];
    return new Response(`\uFEFF${rows.join("\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=assembly-audit-logs.csv" } });
  }
  return NextResponse.json({ success: true, logs: result.rows });
}
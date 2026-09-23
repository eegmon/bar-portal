import { NextResponse } from "next/server";
import db from "@/lib/db";
import { sendDiscordWebhook } from "@/lib/discord";

export async function GET(req: Request) {
  const authorization = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
  }

  const expired = await db.execute(`
    SELECT a.id, a.assembly_id, a.title
    FROM agendas a
    WHERE a.status = 'VOTING' AND a.voting_deadline != '' AND datetime(a.voting_deadline) <= datetime('now')
  `);
  for (const agenda of expired.rows) {
    await db.execute({
      sql: "UPDATE agendas SET status = 'CLOSED', voting_closed_at = datetime('now') WHERE id = ? AND status = 'VOTING'",
      args: [agenda.id],
    });
    await db.execute({
      sql: "INSERT INTO assembly_audit_logs (id, assembly_id, agenda_id, actor_id, action, details) VALUES (?, ?, ?, ?, ?, ?)",
      args: [`audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, agenda.assembly_id, agenda.id, "SYSTEM", "AUTO_CLOSE_VOTING", JSON.stringify({ reason: "voting_deadline" })],
    });
    await sendDiscordWebhook("ASSEMBLY", {
      embeds: [{ title: `⏱️ 표결 자동 마감: ${agenda.title}`, description: "설정된 투표 마감 시각에 따라 표결이 자동 종료되었습니다.", color: 0x64748B, timestamp: new Date().toISOString() }],
    });
  }

  return NextResponse.json({ success: true, closedCount: expired.rows.length });
}
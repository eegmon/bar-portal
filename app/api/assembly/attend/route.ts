import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sendDiscordWebhook } from "@/lib/discord";

/**
 * POST /api/assembly/attend
 * 변호사 본인이 직접 총회 출석을 확인(체크인)합니다.
 * - IN_SESSION 상태인 총회에서만 허용
 * - LAWYER/ACTIVE 계정만 허용
 * - 이미 출석 처리된 경우 재처리 불가
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }
    if (user.role !== "LAWYER" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "변호사 회원만 출석 확인을 할 수 있습니다." },
        { status: 403 },
      );
    }
    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `현재 자격 상태(${user.status})로는 출석 확인을 할 수 없습니다.` },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { assemblyId } = body;

    if (!assemblyId) {
      return NextResponse.json(
        { error: "총회 ID가 필요합니다." },
        { status: 400 },
      );
    }

    // 총회 상태 확인
    const assRes = await db.execute({
      sql: "SELECT * FROM assemblies WHERE id = ?",
      args: [assemblyId],
    });
    if (assRes.rows.length === 0) {
      return NextResponse.json(
        { error: "총회를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    const assembly = assRes.rows[0];
    if (assembly.status !== "IN_SESSION") {
      return NextResponse.json(
        { error: "현재 개회 중인 총회에서만 출석 확인을 할 수 있습니다." },
        { status: 400 },
      );
    }

    // 현재 VOTING 중인 안건이 있는지 확인
    // → 있으면 지각 출석이므로 의장 승인 필요 (PENDING)
    // → 없으면 일반 출석이므로 즉시 승인 (APPROVED)
    const votingAgendaRes = await db.execute({
      sql: "SELECT id FROM agendas WHERE assembly_id = ? AND status = 'VOTING' LIMIT 1",
      args: [assemblyId],
    });
    const hasVotingAgenda = votingAgendaRes.rows.length > 0;
    const votingAgendaId  = hasVotingAgenda ? String(votingAgendaRes.rows[0].id) : null;

    // 지각 출석: PENDING (의장 승인 필요) / 일반 출석: APPROVED (즉시)
    const approvalStatus  = hasVotingAgenda ? "PENDING" : "APPROVED";
    const attendedFlag    = hasVotingAgenda ? 0 : 1; // 승인 전까지 presentRights 미반영

    // 기존 출석 기록 확인
    const existingRes = await db.execute({
      sql: "SELECT * FROM assembly_attendances WHERE assembly_id = ? AND user_id = ?",
      args: [assemblyId, user.id],
    });

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (existing.attended === 1 && existing.approval_status === "APPROVED") {
        return NextResponse.json(
          { error: "이미 출석 확인이 완료되었습니다.", alreadyAttended: true },
          { status: 400 },
        );
      }
      if (existing.approval_status === "PENDING") {
        return NextResponse.json(
          { error: "출석 확인 요청이 이미 접수되어 의장 승인을 기다리고 있습니다.", alreadyPending: true },
          { status: 400 },
        );
      }
      if (existing.is_proxy === 1) {
        return NextResponse.json(
          { error: "의결권을 위임한 상태에서는 직접 출석 확인을 할 수 없습니다. 위임을 취소하려면 관리자에게 문의하세요." },
          { status: 400 },
        );
      }
      await db.execute({
        sql: "UPDATE assembly_attendances SET attended = ?, attended_at = datetime('now'), approval_status = ? WHERE id = ?",
        args: [attendedFlag, approvalStatus, existing.id],
      });
    } else {
      const attendanceId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await db.execute({
        sql: `INSERT INTO assembly_attendances
              (id, assembly_id, user_id, attended, attended_at, is_proxy, approval_status, signature, voting_power)
              VALUES (?, ?, ?, ?, datetime('now'), 0, ?, ?, 1)`,
        args: [attendanceId, assemblyId, user.id, attendedFlag, approvalStatus, user.name],
      });
    }

    // 자격 갱신은 즉시 처리 (출석 승인과 무관하게 참석 의사 표명으로 갱신)
    await db.execute({
      sql: "UPDATE users SET last_renewed_at = datetime('now') WHERE id = ?",
      args: [user.id],
    });

    // 디스코드 알림
    try {
      if (hasVotingAgenda) {
        // 지각 출석 → 의장/관리자 채널에 승인 요청 알림
        await sendDiscordWebhook("ADMIN", {
          embeds: [
            {
              title: "⏳ 총회 지각 출석 확인 — 의장 승인 필요",
              description: `**${user.name}** 변호사님께서 표결 진행 중에 출석을 확인하셨습니다.\n\n• 총회: ${assembly.title}\n• 시각: ${new Date().toLocaleString("ko-KR")}\n\n⚠️ 정족수 반영을 위해 **의장의 승인**이 필요합니다.\n관리자 패널 → 총회 탭 → 출석·위임장 승인 목록에서 처리해 주세요.`,
              color: 0xf59e0b,
            },
          ],
        });
      } else {
        // 일반 출석 → 일반 알림
        await sendDiscordWebhook("ADMIN", {
          embeds: [
            {
              title: "✅ 총회 출석 확인",
              description: `**${user.name}** 변호사님께서 총회 출석을 확인하셨습니다.\n• 총회: ${assembly.title}\n• 시각: ${new Date().toLocaleString("ko-KR")}`,
              color: 0x10b981,
            },
          ],
        });
      }
    } catch {
      // 디스코드 알림 실패는 무시
    }

    const message = hasVotingAgenda
      ? "출석 확인이 접수되었습니다. 현재 표결 진행 중으로, 정족수 반영을 위해 의장의 승인이 필요합니다. 자격은 즉시 연장됩니다."
      : "출석 확인이 완료되었습니다. 당월 자격이 1개월 연장됩니다.";

    return NextResponse.json({
      success: true,
      pending: hasVotingAgenda,   // true면 의장 승인 대기 상태
      message,
      assemblyId,
      votingAgendaId,
    });
  } catch (err: unknown) {
    console.error("출석 확인 API 에러:", err);
    return NextResponse.json(
      { error: "출석 확인 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}

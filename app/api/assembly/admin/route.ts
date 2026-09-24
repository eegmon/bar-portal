import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser, canManageAssembly } from "@/lib/auth";
import { sendDiscordWebhook } from "@/lib/discord";

function getChoiceLabels(rawConfig: unknown): string[] {
  try {
    const parsed = JSON.parse(String(rawConfig || "[]"));
    if (Array.isArray(parsed))
      return parsed
        .map((choice) => (typeof choice === "string" ? choice : choice?.label))
        .filter(Boolean);
  } catch {
    /* 기본 선택지를 사용합니다. */
  }
  return ["찬성", "반대", "기권"];
}

async function writeAudit(
  assemblyId: unknown,
  agendaId: unknown,
  actorId: string,
  action: string,
  details: Record<string, unknown> = {},
) {
  await db.execute({
    sql: "INSERT INTO assembly_audit_logs (id, assembly_id, agenda_id, actor_id, action, details) VALUES (?, ?, ?, ?, ?, ?)",
    args: [
      `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      assemblyId ? String(assemblyId) : null,
      agendaId ? String(agendaId) : null,
      actorId,
      action,
      JSON.stringify(details),
    ],
  });
}

function isChair(user: { role: string; positions?: string[] }) {
  return (
    user.role === "ADMIN" ||
    (user.positions || []).some((position) =>
      ["PRESIDENT", "ASSEMBLY_SPEAKER", "ASSEMBLY_VICE_SPEAKER"].includes(
        position,
      ),
    )
  );
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !canManageAssembly(user)) {
      return NextResponse.json(
        { error: "총회 의장단 또는 권한이 있는 임원만 수행할 수 있습니다." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { action } = body;

    // 1. 신규 총회(정기/임시총회) 일정 개설
    if (action === "CREATE_ASSEMBLY") {
      const { title, roundNumber, isRegular, heldAt } = body;
      if (!title || !roundNumber || !heldAt) {
        return NextResponse.json(
          { error: "총회 명칭, 회차, 개최 일시는 필수입니다." },
          { status: 400 },
        );
      }

      const assemblyId = `assembly-${Date.now()}`;
      await db.execute({
        sql: `INSERT INTO assemblies (id, title, round_number, is_regular, held_at, status, minutes_text)
              VALUES (?, ?, ?, ?, ?, 'SCHEDULED', '')`,
        args: [
          assemblyId,
          title,
          Number(roundNumber),
          isRegular ? 1 : 0,
          heldAt,
        ],
      });

      // 디스코드 소집 공고 알림
      const assemblyTypeStr = isRegular ? "정기총회" : "임시총회(임시회)";
      await sendDiscordWebhook("ASSEMBLY_NOTICE", {
        content: `<@&1466405257704640542> **[총회 소집 공고] ${title} 소집의 건**`,
        embeds: [
          {
            title: `🏛️ 도스변호사협회 ${assemblyTypeStr} 소집 공고`,
            description: `**${title}** 일정이 공식 개설되었습니다.\n• 구분: **${assemblyTypeStr}** (제${roundNumber}회)\n• 일시: **${heldAt}**\n• 회칙 근거: 회칙 제12조\n\n모든 회원 변호사님들께서는 일정을 확인하시고 참석 또는 사전 위임/재등록 신청을 진행해 주시기 바랍니다.`,
            color: isRegular ? 0x10b981 : 0x6366f1,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const newAssembly = {
        id: assemblyId,
        title,
        round_number: Number(roundNumber),
        is_regular: isRegular ? 1 : 0,
        held_at: heldAt,
        status: "SCHEDULED",
        minutes_text: "",
        created_at: new Date().toISOString(),
      };

      return NextResponse.json({
        success: true,
        assemblyId,
        assembly: newAssembly,
        message: `${assemblyTypeStr} 일정이 등록되었습니다.`,
      });
    }

    // 2. 신규 안건 상정
    if (action === "CREATE_AGENDA") {
      const {
        assemblyId,
        title,
        description,
        isSecret,
        choices,
        quorumNeeded,
        votingDeadline,
        votingMethod,
      } = body;
      if (!assemblyId || !title) {
        return NextResponse.json(
          { error: "총회 선택 및 안건명은 필수입니다." },
          { status: 400 },
        );
      }
      const choiceConfig =
        Array.isArray(choices) && choices.length >= 2
          ? [
              ...new Set(
                choices.map((choice) => String(choice).trim()).filter(Boolean),
              ),
            ]
          : ["찬성", "반대", "기권"];
      if (choiceConfig.length < 2) {
        return NextResponse.json(
          { error: "안건 선택지는 2개 이상이어야 합니다." },
          { status: 400 },
        );
      }
      const quorum = Number(quorumNeeded || 0);
      if (!Number.isInteger(quorum) || quorum < 0) {
        return NextResponse.json(
          { error: "정족수는 0 이상의 정수여야 합니다." },
          { status: 400 },
        );
      }
      const method = ["MAJORITY", "TWO_THIRDS", "PLURALITY", "RANKED"].includes(
        votingMethod,
      )
        ? votingMethod
        : "MAJORITY";

      const agendaId = `agenda-${Date.now()}`;
      const orderRes = await db.execute({
        sql: "SELECT COALESCE(MAX(agenda_order), -1) + 1 as next_order FROM agendas WHERE assembly_id = ?",
        args: [assemblyId],
      });
      const agendaOrder = Number(orderRes.rows[0]?.next_order || 0);
      await db.execute({
        sql: `INSERT INTO agendas (id, assembly_id, title, description, is_secret, status, agenda_order, choice_config, quorum_needed, voting_deadline, voting_method)
              VALUES (?, ?, ?, ?, ?, 'READY', ?, ?, ?, ?, ?)`,
        args: [
          agendaId,
          assemblyId,
          title,
          description || "",
          isSecret ? 1 : 0,
          agendaOrder,
          JSON.stringify(choiceConfig),
          quorum,
          votingDeadline || "",
          method,
        ],
      });

      const newAgenda = {
        id: agendaId,
        assembly_id: assemblyId,
        title,
        description: description || "",
        is_secret: isSecret ? 1 : 0,
        status: "READY",
        agenda_order: agendaOrder,
        choice_config: JSON.stringify(choiceConfig),
        quorum_needed: quorum,
        voting_deadline: votingDeadline || "",
        voting_method: method,
        result_status: "PENDING",
        created_at: new Date().toISOString(),
      };

      return NextResponse.json({
        success: true,
        agendaId,
        agenda: newAgenda,
        message: "신규 안건이 상정되었습니다.",
      });
    }

    // [신규] 상정된 안건 수정 (READY/ON_HOLD 상태에서만 허용)
    if (action === "UPDATE_AGENDA") {
      const {
        agendaId,
        title,
        description,
        isSecret,
        choices,
        quorumNeeded,
        votingDeadline,
        votingMethod,
      } = body;
      if (!agendaId || !title?.trim()) {
        return NextResponse.json(
          { error: "안건 ID와 제목은 필수입니다." },
          { status: 400 },
        );
      }
      const agRes = await db.execute({
        sql: "SELECT a.*, ass.status as assembly_status FROM agendas a JOIN assemblies ass ON ass.id = a.assembly_id WHERE a.id = ?",
        args: [agendaId],
      });
      if (agRes.rows.length === 0) {
        return NextResponse.json(
          { error: "안건을 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      const agenda = agRes.rows[0];
      if (!["READY", "ON_HOLD"].includes(String(agenda.status))) {
        return NextResponse.json(
          { error: "표결이 시작되지 않은 안건(대기/보류)만 수정할 수 있습니다." },
          { status: 400 },
        );
      }
      const choiceConfig =
        Array.isArray(choices) && choices.length >= 2
          ? [...new Set(choices.map((c: string) => String(c).trim()).filter(Boolean))]
          : null;
      if (choiceConfig !== null && choiceConfig.length < 2) {
        return NextResponse.json(
          { error: "선택지는 2개 이상이어야 합니다." },
          { status: 400 },
        );
      }
      const quorum = quorumNeeded !== undefined ? Number(quorumNeeded) : null;
      if (quorum !== null && (!Number.isInteger(quorum) || quorum < 0)) {
        return NextResponse.json(
          { error: "정족수는 0 이상의 정수여야 합니다." },
          { status: 400 },
        );
      }
      const method =
        votingMethod && ["MAJORITY", "TWO_THIRDS", "PLURALITY", "RANKED"].includes(votingMethod)
          ? votingMethod
          : null;

      await db.execute({
        sql: `UPDATE agendas SET
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          is_secret = COALESCE(?, is_secret),
          choice_config = COALESCE(?, choice_config),
          quorum_needed = COALESCE(?, quorum_needed),
          voting_deadline = COALESCE(?, voting_deadline),
          voting_method = COALESCE(?, voting_method)
          WHERE id = ?`,
        args: [
          title.trim(),
          description !== undefined ? String(description) : null,
          isSecret !== undefined ? (isSecret ? 1 : 0) : null,
          choiceConfig !== null ? JSON.stringify(choiceConfig) : null,
          quorum !== null ? quorum : null,
          votingDeadline !== undefined ? (votingDeadline || null) : null,
          method,
          agendaId,
        ],
      });

      await writeAudit(agenda.assembly_id, agendaId, user.id, "UPDATE_AGENDA", {
        title: title.trim(),
        isSecret,
        votingMethod: method,
      });

      const updatedRes = await db.execute({
        sql: "SELECT * FROM agendas WHERE id = ?",
        args: [agendaId],
      });

      return NextResponse.json({
        success: true,
        agenda: updatedRes.rows[0],
        message: "안건이 수정되었습니다.",
      });
    }

    // [신규] 변호사 본인 출석 확인 (IN_SESSION 총회에서 직접 출석 등록)
    if (action === "MARK_ATTENDED") {
      const { assemblyId } = body;
      if (!assemblyId) {
        return NextResponse.json(
          { error: "총회 ID가 필요합니다." },
          { status: 400 },
        );
      }
      // 이 액션은 canManageAssembly 체크 없이 일반 변호사도 가능
      // 하지만 현재 user는 위에서 canManageAssembly로 걸렸으므로,
      // 이 액션은 별도 공개 엔드포인트로 분리
      return NextResponse.json(
        { error: "이 액션은 /api/assembly/attend 를 사용하세요." },
        { status: 400 },
      );
    }

    // [신규] 총회 삭제 (관련 안건, 투표함, 출석, 의결권, 회의록 정리)
    if (action === "DELETE_ASSEMBLY") {
      const { assemblyId } = body;
      if (!assemblyId) {
        return NextResponse.json(
          { error: "삭제할 총회 ID가 필요합니다." },
          { status: 400 },
        );
      }

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
      const targetAssembly = assRes.rows[0];

      // 1. 투표함 및 투표참여로그 삭제
      await db.execute({
        sql: "DELETE FROM ballot_box WHERE agenda_id IN (SELECT id FROM agendas WHERE assembly_id = ?)",
        args: [assemblyId],
      });
      await db.execute({
        sql: "DELETE FROM voter_logs WHERE agenda_id IN (SELECT id FROM agendas WHERE assembly_id = ?)",
        args: [assemblyId],
      });
      // 2. 안건 삭제
      await db.execute({
        sql: "DELETE FROM agendas WHERE assembly_id = ?",
        args: [assemblyId],
      });
      // 3. 출석 및 위임 삭제
      await db.execute({
        sql: "DELETE FROM assembly_attendances WHERE assembly_id = ?",
        args: [assemblyId],
      });
      // 4. 의결권 수동 설정 삭제
      await db.execute({
        sql: "DELETE FROM assembly_voting_rights WHERE assembly_id = ?",
        args: [assemblyId],
      });
      // 5. 회의록 버전 삭제
      await db.execute({
        sql: "DELETE FROM assembly_minutes_versions WHERE assembly_id = ?",
        args: [assemblyId],
      });
      // 6. 감사 로그 기록
      await writeAudit(assemblyId, null, user.id, "DELETE_ASSEMBLY", {
        title: targetAssembly.title,
        roundNumber: targetAssembly.round_number,
      });
      // 7. 총회 삭제
      await db.execute({
        sql: "DELETE FROM assemblies WHERE id = ?",
        args: [assemblyId],
      });

      return NextResponse.json({
        success: true,
        message: `제${targetAssembly.round_number}회 총회(${targetAssembly.title}) 일정이 성공적으로 삭제되었습니다.`,
      });
    }

    // 3. 총회 상태 변경 (SCHEDULED -> IN_SESSION -> CLOSED)
    if (action === "UPDATE_ASSEMBLY_STATUS") {
      const { assemblyId, status } = body;
      if (!assemblyId || !status) {
        return NextResponse.json(
          { error: "총회 ID 및 상태가 필요합니다." },
          { status: 400 },
        );
      }

      if (!["IN_SESSION", "CLOSED"].includes(status)) {
        return NextResponse.json(
          { error: "허용되지 않은 총회 상태입니다." },
          { status: 400 },
        );
      }
      const assemblyRes = await db.execute({
        sql: "SELECT status FROM assemblies WHERE id = ?",
        args: [assemblyId],
      });
      if (assemblyRes.rows.length === 0) {
        return NextResponse.json(
          { error: "총회를 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      const currentAssemblyStatus = assemblyRes.rows[0].status as string;
      if (
        (status === "IN_SESSION" && currentAssemblyStatus !== "SCHEDULED") ||
        (status === "CLOSED" && currentAssemblyStatus !== "IN_SESSION")
      ) {
        return NextResponse.json(
          { error: "총회 상태 순서에 맞지 않는 변경입니다." },
          { status: 400 },
        );
      }

      await db.execute({
        sql: "UPDATE assemblies SET status = ? WHERE id = ?",
        args: [status, assemblyId],
      });

      return NextResponse.json({ success: true, status });
    }

    // 4. 개회 후 안건 순서 변경
    if (action === "REORDER_AGENDAS") {
      const { assemblyId, orderedAgendaIds } = body;
      if (
        !assemblyId ||
        !Array.isArray(orderedAgendaIds) ||
        orderedAgendaIds.length === 0
      ) {
        return NextResponse.json(
          { error: "총회와 안건 순서 정보가 필요합니다." },
          { status: 400 },
        );
      }

      const assemblyRes = await db.execute({
        sql: "SELECT status FROM assemblies WHERE id = ?",
        args: [assemblyId],
      });
      if (assemblyRes.rows.length === 0) {
        return NextResponse.json(
          { error: "총회를 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      if (assemblyRes.rows[0].status !== "IN_SESSION") {
        return NextResponse.json(
          { error: "총회 개회 후에만 안건 순서를 변경할 수 있습니다." },
          { status: 400 },
        );
      }

      const agendaRes = await db.execute({
        sql: "SELECT id, status FROM agendas WHERE assembly_id = ?",
        args: [assemblyId],
      });
      const currentIds = agendaRes.rows.map((row) => row.id as string);
      const requestedIds = orderedAgendaIds.map((id: unknown) => String(id));
      if (
        requestedIds.length !== currentIds.length ||
        new Set(requestedIds).size !== currentIds.length ||
        requestedIds.some((id: string) => !currentIds.includes(id))
      ) {
        return NextResponse.json(
          { error: "해당 총회의 전체 안건 순서가 아닙니다." },
          { status: 400 },
        );
      }
      if (
        agendaRes.rows.some((row) =>
          ["VOTING", "CLOSED"].includes(row.status as string),
        )
      ) {
        return NextResponse.json(
          {
            error:
              "표결 중이거나 종료된 안건이 있어 순서를 변경할 수 없습니다.",
          },
          { status: 400 },
        );
      }

      for (const [index, agendaId] of requestedIds.entries()) {
        await db.execute({
          sql: "UPDATE agendas SET agenda_order = ? WHERE id = ? AND assembly_id = ?",
          args: [index, agendaId, assemblyId],
        });
      }
      return NextResponse.json({
        success: true,
        orderedAgendaIds: requestedIds,
      });
    }

    // 5. 안건 보류 및 재상정
    if (action === "UPDATE_AGENDA_STATUS") {
      const { agendaId, status } = body;
      if (!agendaId || !["ON_HOLD", "READY"].includes(status)) {
        return NextResponse.json(
          { error: "안건 상태는 보류 또는 재상정만 지정할 수 있습니다." },
          { status: 400 },
        );
      }

      const agendaRes = await db.execute({
        sql: `SELECT a.status, ass.status as assembly_status
              FROM agendas a JOIN assemblies ass ON ass.id = a.assembly_id
              WHERE a.id = ?`,
        args: [agendaId],
      });
      if (agendaRes.rows.length === 0) {
        return NextResponse.json(
          { error: "안건을 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      const agenda = agendaRes.rows[0];
      if (agenda.assembly_status !== "IN_SESSION") {
        return NextResponse.json(
          { error: "총회 개회 후에만 안건을 보류하거나 재상정할 수 있습니다." },
          { status: 400 },
        );
      }
      const validTransition =
        (status === "ON_HOLD" && agenda.status === "READY") ||
        (status === "READY" && agenda.status === "ON_HOLD");
      if (!validTransition) {
        return NextResponse.json(
          { error: "현재 안건 상태에서 허용되지 않는 변경입니다." },
          { status: 400 },
        );
      }

      await db.execute({
        sql: "UPDATE agendas SET status = ? WHERE id = ?",
        args: [status, agendaId],
      });
      return NextResponse.json({ success: true, status });
    }

    // 6. 출석·위임장 승인/반려 및 출석 체크
    if (action === "UPDATE_ATTENDANCE") {
      const { attendanceId, status, attended } = body;
      if (!attendanceId || !["APPROVED", "REJECTED"].includes(status)) {
        return NextResponse.json(
          { error: "출석 기록과 승인 상태가 필요합니다." },
          { status: 400 },
        );
      }
      const attendanceRes = await db.execute({
        sql: "SELECT * FROM assembly_attendances WHERE id = ?",
        args: [attendanceId],
      });
      if (attendanceRes.rows.length === 0)
        return NextResponse.json(
          { error: "출석 기록을 찾을 수 없습니다." },
          { status: 404 },
        );
      const attendance = attendanceRes.rows[0];
      const assemblyRes = await db.execute({
        sql: "SELECT status FROM assemblies WHERE id = ?",
        args: [attendance.assembly_id],
      });
      if (assemblyRes.rows[0]?.status === "IN_SESSION" && !isChair(user)) {
        return NextResponse.json(
          { error: "총회 개회 후 명부 변경은 의장 허가가 필요합니다." },
          { status: 403 },
        );
      }
      await db.execute({
        sql: "UPDATE assembly_attendances SET approval_status = ?, attended = ?, attended_at = CASE WHEN ? = 1 THEN datetime('now') ELSE attended_at END WHERE id = ?",
        args: [status, attended ? 1 : 0, attended ? 1 : 0, attendanceId],
      });
      if (status === "APPROVED" && attended) {
        await db.execute({
          sql: "UPDATE users SET status = 'ACTIVE', last_renewed_at = datetime('now') WHERE id = ? AND role = 'LAWYER'",
          args: [attendance.user_id],
        });
      }
      await writeAudit(
        attendance.assembly_id,
        null,
        user.id,
        status === "APPROVED" ? "APPROVE_ATTENDANCE" : "REJECT_ATTENDANCE",
        { attendanceId, attended: Boolean(attended) },
      );
      return NextResponse.json({
        success: true,
        status,
        attended: Boolean(attended),
      });
    }

    // 6-1. 오프라인(현장) 참석자 수동 출석 등록 - 온라인 신청 없이 현장에 나온 회원을 의장이 직접 등록
    if (action === "ADD_ATTENDANCE") {
      if (!isChair(user)) {
        return NextResponse.json(
          { error: "현장 출석 수동 등록은 총회 의장단만 수행할 수 있습니다." },
          { status: 403 },
        );
      }
      const { assemblyId, userId } = body;
      if (!assemblyId || !userId) {
        return NextResponse.json(
          { error: "총회와 회원이 필요합니다." },
          { status: 400 },
        );
      }
      const assemblyRes = await db.execute({
        sql: "SELECT id FROM assemblies WHERE id = ?",
        args: [assemblyId],
      });
      if (assemblyRes.rows.length === 0) {
        return NextResponse.json(
          { error: "총회를 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      const memberRes = await db.execute({
        sql: "SELECT id, name, role, status FROM users WHERE id = ?",
        args: [userId],
      });
      if (
        memberRes.rows.length === 0 ||
        memberRes.rows[0].role !== "LAWYER" ||
        memberRes.rows[0].status !== "ACTIVE"
      ) {
        return NextResponse.json(
          { error: "활성 변호사 회원만 출석 등록할 수 있습니다." },
          { status: 400 },
        );
      }
      // 이미 해당 총회에 (위임/재등록 포함) 출석 기록이 있으면 그 기록을 출석 처리로 갱신,
      // 없으면 새로 생성합니다.
      const existing = await db.execute({
        sql: "SELECT id FROM assembly_attendances WHERE assembly_id = ? AND user_id = ? AND is_proxy = 0",
        args: [assemblyId, userId],
      });
      if (existing.rows.length > 0) {
        await db.execute({
          sql: "UPDATE assembly_attendances SET attended = 1, approval_status = 'APPROVED', attended_at = datetime('now') WHERE id = ?",
          args: [existing.rows[0].id],
        });
      } else {
        const attId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await db.execute({
          sql: `INSERT INTO assembly_attendances (id, assembly_id, user_id, attended, is_proxy, approval_status, signature)
                VALUES (?, ?, ?, 1, 0, 'APPROVED', ?)`,
          args: [attId, assemblyId, userId, `${user.name} 의장 현장 출석 확인`],
        });
      }
      await db.execute({
        sql: "UPDATE users SET status = 'ACTIVE', last_renewed_at = datetime('now') WHERE id = ? AND role = 'LAWYER'",
        args: [userId],
      });
      await writeAudit(assemblyId, null, user.id, "ADD_ATTENDANCE", {
        userId,
        userName: memberRes.rows[0].name,
        note: "오프라인(현장) 출석 수동 등록",
      });
      return NextResponse.json({ success: true, assemblyId, userId });
    }

    // 7. 특정 총회의 회원별 의결권 수동 설정
    if (action === "SET_VOTING_RIGHT") {
      const { assemblyId, userId, votingPower, reason } = body;
      const power = Number(votingPower);
      if (
        !assemblyId ||
        !userId ||
        !Number.isInteger(power) ||
        power < 0 ||
        !reason?.trim()
      ) {
        return NextResponse.json(
          {
            error: "총회, 회원, 0 이상의 의결권 정수, 설정 사유가 필요합니다.",
          },
          { status: 400 },
        );
      }
      const memberRes = await db.execute({
        sql: "SELECT id, role, status FROM users WHERE id = ?",
        args: [userId],
      });
      if (
        memberRes.rows.length === 0 ||
        memberRes.rows[0].role !== "LAWYER" ||
        memberRes.rows[0].status !== "ACTIVE"
      ) {
        return NextResponse.json(
          { error: "활성 변호사 회원만 의결권을 설정할 수 있습니다." },
          { status: 400 },
        );
      }
      const assemblyRes = await db.execute({
        sql: "SELECT status FROM assemblies WHERE id = ?",
        args: [assemblyId],
      });
      if (assemblyRes.rows[0]?.status === "IN_SESSION" && !isChair(user)) {
        return NextResponse.json(
          { error: "총회 개회 후 의결권 변경은 의장 허가가 필요합니다." },
          { status: 403 },
        );
      }
      await db.execute({
        sql: `INSERT INTO assembly_voting_rights (assembly_id, user_id, voting_power, reason, updated_by, updated_at)
              VALUES (?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(assembly_id, user_id) DO UPDATE SET voting_power = excluded.voting_power, reason = excluded.reason, updated_by = excluded.updated_by, updated_at = datetime('now')`,
        args: [assemblyId, userId, power, String(reason).trim(), user.id],
      });
      await writeAudit(assemblyId, null, user.id, "SET_VOTING_RIGHT", {
        userId,
        votingPower: power,
        reason: String(reason).trim(),
      });
      return NextResponse.json({
        success: true,
        assemblyId,
        userId,
        votingPower: power,
      });
    }

    if (action === "REMOVE_VOTING_RIGHT") {
      const { assemblyId, userId } = body;
      if (!assemblyId || !userId)
        return NextResponse.json(
          { error: "총회와 회원이 필요합니다." },
          { status: 400 },
        );
      const assemblyRes = await db.execute({
        sql: "SELECT status FROM assemblies WHERE id = ?",
        args: [assemblyId],
      });
      if (assemblyRes.rows[0]?.status === "IN_SESSION" && !isChair(user)) {
        return NextResponse.json(
          { error: "총회 개회 후 의결권 변경은 의장 허가가 필요합니다." },
          { status: 403 },
        );
      }
      await db.execute({
        sql: "DELETE FROM assembly_voting_rights WHERE assembly_id = ? AND user_id = ?",
        args: [assemblyId, userId],
      });
      await writeAudit(assemblyId, null, user.id, "REMOVE_VOTING_RIGHT", {
        userId,
      });
      return NextResponse.json({ success: true });
    }

    // 9. 표결 마감 연장 및 사유 기록
    if (action === "EXTEND_DEADLINE") {
      const { agendaId, votingDeadline, reason } = body;
      if (!agendaId || !votingDeadline || !reason?.trim()) {
        return NextResponse.json(
          { error: "새 마감 시각과 연장 사유가 필요합니다." },
          { status: 400 },
        );
      }
      const agendaRes = await db.execute({
        sql: "SELECT * FROM agendas WHERE id = ?",
        args: [agendaId],
      });
      if (agendaRes.rows.length === 0)
        return NextResponse.json(
          { error: "안건을 찾을 수 없습니다." },
          { status: 404 },
        );
      const agenda = agendaRes.rows[0];
      if (agenda.status !== "VOTING")
        return NextResponse.json(
          { error: "표결 중인 안건만 마감 시간을 연장할 수 있습니다." },
          { status: 400 },
        );
      if (new Date(String(votingDeadline)).getTime() <= Date.now())
        return NextResponse.json(
          { error: "미래 시각만 지정할 수 있습니다." },
          { status: 400 },
        );
      await db.execute({
        sql: "UPDATE agendas SET voting_deadline = ? WHERE id = ?",
        args: [votingDeadline, agendaId],
      });
      await writeAudit(
        agenda.assembly_id,
        agendaId,
        user.id,
        "EXTEND_DEADLINE",
        { votingDeadline, reason: String(reason).trim() },
      );
      return NextResponse.json({ success: true, votingDeadline });
    }

    // 8. 의장의 표결 개시 선언
    if (action === "START_VOTING") {
      const { agendaId } = body;
      if (!agendaId) {
        return NextResponse.json(
          { error: "안건 ID가 누락되었습니다." },
          { status: 400 },
        );
      }

      const agRes = await db.execute({
        sql: "SELECT * FROM agendas WHERE id = ?",
        args: [agendaId],
      });

      if (agRes.rows.length === 0) {
        return NextResponse.json(
          { error: "안건을 찾을 수 없습니다." },
          { status: 404 },
        );
      }

      const agenda = agRes.rows[0];

      const assemblyRes = await db.execute({
        sql: "SELECT status FROM assemblies WHERE id = ?",
        args: [agenda.assembly_id],
      });
      if (
        assemblyRes.rows[0]?.status !== "IN_SESSION" ||
        agenda.status !== "READY"
      ) {
        return NextResponse.json(
          { error: "개회 중인 대기 안건만 표결을 개시할 수 있습니다." },
          { status: 400 },
        );
      }

      await db.execute({
        sql: "UPDATE agendas SET status = 'VOTING', voting_started_at = datetime('now') WHERE id = ?",
        args: [agendaId],
      });
      await writeAudit(agenda.assembly_id, agendaId, user.id, "START_VOTING", {
        title: agenda.title,
      });

      // 디스코드 총회 채널 실시간 알림
      await sendDiscordWebhook("ASSEMBLY_VOTE", {
        content: "@everyone **[총회 의장] 안건 표결 개시 선언**",
        embeds: [
          {
            title: `🗳️ 의장의 표결 선포: ${agenda.title}`,
            description: `의장이 본 안건에 대한 표결을 공식 선포하였습니다.\n회원 변호사님들께서는 전자투표 시스템에 접속하여 표결권을 행사해 주시기 바랍니다.\n\n• 투표 방식: **${agenda.is_secret ? "🔒 무기명 비밀투표" : "📝 기명투표"}** (회칙 제17조의4)`,
            color: 0x10b981,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({ success: true, status: "VOTING" });
    }

    // 7. 의장의 표결 종료 및 결과 선포
    if (action === "CLOSE_VOTING") {
      const { agendaId } = body;
      if (!agendaId) {
        return NextResponse.json(
          { error: "안건 ID가 누락되었습니다." },
          { status: 400 },
        );
      }

      const agRes = await db.execute({
        sql: "SELECT * FROM agendas WHERE id = ?",
        args: [agendaId],
      });

      if (agRes.rows.length === 0) {
        return NextResponse.json(
          { error: "안건을 찾을 수 없습니다." },
          { status: 404 },
        );
      }

      const agenda = agRes.rows[0];
      if (agenda.status !== "VOTING") {
        return NextResponse.json(
          { error: "현재 표결 중인 안건만 종료할 수 있습니다." },
          { status: 400 },
        );
      }

      // 투표 결과 집계
      const tallyRes = await db.execute({
        sql: "SELECT choice, SUM(votes_count) as total FROM ballot_box WHERE agenda_id = ? GROUP BY choice",
        args: [agendaId],
      });

      const totalVotersRes = await db.execute({
        sql: "SELECT COUNT(*) as count FROM voter_logs WHERE agenda_id = ?",
        args: [agendaId],
      });

      const voterCount = totalVotersRes.rows[0]?.count || 0;
      const tallyText =
        tallyRes.rows
          .map((r) => `• **${r.choice}**: ${r.total}표`)
          .join("\n") || "투표 내역 없음";
      let rankedTally: { choice: string; total: number }[] = [];
      if (agenda.voting_method === "RANKED") {
        const rankedRes = await db.execute({
          sql: "SELECT choice, votes_count FROM ballot_box WHERE agenda_id = ? AND choice LIKE '__RANKING:%'",
          args: [agendaId],
        });
        const rankings: string[][] = [];
        for (const row of rankedRes.rows) {
          try {
            const parsed = JSON.parse(
              String(row.choice).slice("__RANKING:".length),
            );
            for (
              let index = 0;
              index < Number(row.votes_count || 0);
              index += 1
            )
              rankings.push(parsed);
          } catch {
            /* 잘못된 순위 표는 집계에서 제외합니다. */
          }
        }
        const remaining = new Set<string>(
          getChoiceLabels(agenda.choice_config),
        );
        while (remaining.size > 0 && rankings.length > 0) {
          const counts = new Map<string, number>();
          for (const ballot of rankings) {
            const preferred = ballot.find((choice) => remaining.has(choice));
            if (preferred)
              counts.set(preferred, (counts.get(preferred) || 0) + 1);
          }
          const round = [...remaining].map((choice) => ({
            choice,
            total: counts.get(choice) || 0,
          }));
          rankedTally = round.sort((a, b) => b.total - a.total);
          const winner = rankedTally[0];
          const total = round.reduce((sum, item) => sum + item.total, 0);
          if (winner && winner.total > total / 2) break;
          const lowest = round.sort((a, b) => a.total - b.total)[0];
          if (!lowest) break;
          remaining.delete(lowest.choice);
        }
      }
      const totalRightsRes = await db.execute({
        sql: "SELECT COALESCE(SUM(COALESCE(v.voting_power, 1)), 0) as total FROM users u LEFT JOIN assembly_voting_rights v ON v.user_id = u.id AND v.assembly_id = ? WHERE u.role = 'LAWYER' AND u.status = 'ACTIVE'",
        args: [agenda.assembly_id],
      });
      const presentRes = await db.execute({
        sql: "SELECT COALESCE(SUM(CASE WHEN attended = 1 OR is_proxy = 1 THEN COALESCE(voting_power, 1) ELSE 0 END), 0) as present_rights FROM assembly_attendances WHERE assembly_id = ? AND approval_status = 'APPROVED'",
        args: [agenda.assembly_id],
      });
      const totalRights = Number(totalRightsRes.rows[0]?.total || 0);
      const presentRights = Number(presentRes.rows[0]?.present_rights || 0);
      const quorumNeeded = Number(
        agenda.quorum_needed || Math.ceil(totalRights / 3),
      );
      const resultTally =
        agenda.voting_method === "RANKED"
          ? rankedTally
          : tallyRes.rows.map((row) => ({
              choice: String(row.choice),
              total: Number(row.total || 0),
            }));
      const approval = Number(
        resultTally.find((row) =>
          ["찬성", "FOR", "YES"].includes(String(row.choice)),
        )?.total || 0,
      );
      const opposition = Number(
        resultTally.find((row) =>
          ["반대", "AGAINST", "NO"].includes(String(row.choice)),
        )?.total || 0,
      );
      const quorumMet = presentRights >= quorumNeeded;
      const totalDecisive = approval + opposition;
      const maxVotes = Math.max(
        ...resultTally.map((row) => Number(row.total || 0)),
        0,
      );
      const resultStatus =
        quorumMet &&
        (agenda.voting_method === "RANKED"
          ? resultTally.length > 0 &&
            resultTally[0].total >
              Number(totalVotersRes.rows[0]?.count || 0) / 2
          : agenda.voting_method === "TWO_THIRDS"
            ? totalDecisive > 0 && approval / totalDecisive >= 2 / 3
            : agenda.voting_method === "PLURALITY"
              ? maxVotes > 0 && resultTally[0]?.total === maxVotes
              : approval > opposition)
          ? "PASS"
          : "REJECT";

      await db.execute({
        sql: "UPDATE agendas SET status = 'CLOSED', voting_closed_at = datetime('now'), result_status = ? WHERE id = ?",
        args: [resultStatus, agendaId],
      });
      const assemblyRes = await db.execute({
        sql: "SELECT minutes_text FROM assemblies WHERE id = ?",
        args: [agenda.assembly_id],
      });
      const currentMinutes = String(assemblyRes.rows[0]?.minutes_text || "");
      const resultText =
        agenda.voting_method === "RANKED"
          ? rankedTally
              .map((row) => `• **${row.choice}**: ${row.total}표`)
              .join("\n")
          : tallyText;
      const minutesSection = `\n\n[안건 표결 자동 집계] ${agenda.title}\n- 표결 종료: ${new Date().toISOString()}\n- 출석 의결권: ${presentRights}표 / 전체 의결권 ${totalRights}표\n- 의결권 정족수: ${quorumNeeded}표 기준, ${quorumMet ? "충족" : "미충족"}\n- 투표 참여 인원: ${voterCount}명\n${resultText}\n- 의결 결과: ${resultStatus === "PASS" ? "가결" : "부결"}`;
      await db.execute({
        sql: "UPDATE assemblies SET minutes_text = ? WHERE id = ?",
        args: [`${currentMinutes}${minutesSection}`, agenda.assembly_id],
      });
      await writeAudit(agenda.assembly_id, agendaId, user.id, "CLOSE_VOTING", {
        voterCount,
        presentRights,
        totalRights,
        quorumMet,
        resultStatus,
      });

      // 디스코드 결과 선포
      await sendDiscordWebhook("ASSEMBLY_VOTE", {
        content: "@everyone **[총회 의장] 안건 표결 종료 및 결과 선포**",
        embeds: [
          {
            title: `📊 표결 집계 결과 선포: ${agenda.title}`,
            description: `**[투표 참여 인원: ${voterCount}명 / 출석 의결권: ${presentRights}표]**\n정족수: **${quorumMet ? "충족" : "미충족"}**\n\n${resultText}\n\n결과: **${resultStatus === "PASS" ? "가결" : "부결"}**`,
            color: 0x3b82f6,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({
        success: true,
        status: "CLOSED",
        resultStatus,
        quorumMet,
        tally: tallyRes.rows,
      });
    }

    // 9. 표결 결과 확정 및 재개 이력
    if (action === "CONFIRM_RESULT" || action === "REOPEN_RESULT") {
      const { agendaId } = body;
      if (!agendaId)
        return NextResponse.json(
          { error: "안건 ID가 필요합니다." },
          { status: 400 },
        );
      const agRes = await db.execute({
        sql: "SELECT * FROM agendas WHERE id = ?",
        args: [agendaId],
      });
      if (agRes.rows.length === 0)
        return NextResponse.json(
          { error: "안건을 찾을 수 없습니다." },
          { status: 404 },
        );
      const agenda = agRes.rows[0];
      const allowed = [
        "ADMIN",
        "PRESIDENT",
        "SECRETARY_GENERAL",
        "ASSEMBLY_SPEAKER",
        "ASSEMBLY_VICE_SPEAKER",
      ];
      if (
        user.role !== "ADMIN" &&
        !(user.positions || []).some((position) => allowed.includes(position))
      ) {
        return NextResponse.json(
          { error: "의장 또는 사무총장 권한이 필요합니다." },
          { status: 403 },
        );
      }
      if (action === "CONFIRM_RESULT") {
        if (agenda.status !== "CLOSED")
          return NextResponse.json(
            { error: "종료된 표결만 확정할 수 있습니다." },
            { status: 400 },
          );
        await db.execute({
          sql: "UPDATE agendas SET status = 'RESULT_CONFIRMED', result_confirmed_at = datetime('now'), result_confirmed_by = ? WHERE id = ?",
          args: [user.id, agendaId],
        });
        await writeAudit(
          agenda.assembly_id,
          agendaId,
          user.id,
          "CONFIRM_RESULT",
          { resultStatus: agenda.result_status },
        );
        return NextResponse.json({ success: true, status: "RESULT_CONFIRMED" });
      }
      if (agenda.status !== "RESULT_CONFIRMED")
        return NextResponse.json(
          { error: "확정된 결과만 재개 이력을 남길 수 있습니다." },
          { status: 400 },
        );
      await db.execute({
        sql: "UPDATE agendas SET status = 'CLOSED' WHERE id = ?",
        args: [agendaId],
      });
      await writeAudit(
        agenda.assembly_id,
        agendaId,
        user.id,
        "REOPEN_RESULT",
        {},
      );
      return NextResponse.json({ success: true, status: "CLOSED" });
    }

    // 10. 총회 의사록 작성 및 수정 (회칙 제18조)
    if (action === "UPDATE_MINUTES") {
      const { assemblyId, minutesText, broadcastDiscord } = body;
      if (!assemblyId) {
        return NextResponse.json(
          { error: "총회 ID가 누락되었습니다." },
          { status: 400 },
        );
      }

      const previousMinutesRes = await db.execute({
        sql: "SELECT minutes_text FROM assemblies WHERE id = ?",
        args: [assemblyId],
      });
      if (
        previousMinutesRes.rows.length > 0 &&
        previousMinutesRes.rows[0].minutes_text
      ) {
        await db.execute({
          sql: "INSERT INTO assembly_minutes_versions (id, assembly_id, content, editor_id) VALUES (?, ?, ?, ?)",
          args: [
            `minutes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            assemblyId,
            previousMinutesRes.rows[0].minutes_text,
            user.id,
          ],
        });
      }
      await db.execute({
        sql: "UPDATE assemblies SET minutes_text = ? WHERE id = ?",
        args: [minutesText || "", assemblyId],
      });
      await writeAudit(assemblyId, null, user.id, "UPDATE_MINUTES", {
        broadcastDiscord: Boolean(broadcastDiscord),
      });

      // 총회 정보 조회
      const assRes = await db.execute({
        sql: "SELECT * FROM assemblies WHERE id = ?",
        args: [assemblyId],
      });
      const ass = assRes.rows[0];

      if (broadcastDiscord && ass) {
        await sendDiscordWebhook("ASSEMBLY_NOTICE", {
          content: `@everyone 📜 **[총회 공식 의사록 공표] ${ass.title} 의사록**`,
          embeds: [
            {
              title: `🏛️ 도스변호사협회 ${ass.title} 공식 의사록 (회칙 제18조)`,
              description: minutesText
                ? minutesText.length > 2000
                  ? minutesText.slice(0, 1950) +
                    "...\n[전체 내용은 포털에서 열람]"
                  : minutesText
                : "의사록 내용 없음",
              color: 0x10b981,
              footer: { text: "도스변호사협회 총회 의장단 및 사무국" },
              timestamp: new Date().toISOString(),
            },
          ],
        });
      }

      return NextResponse.json({
        success: true,
        message: "총회 의사록이 성공적으로 저장 및 공표되었습니다.",
      });
    }

    return NextResponse.json(
      { error: "유효하지 않은 명령입니다." },
      { status: 400 },
    );
  } catch (err: any) {
    console.error("총회 관리 API 에러:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}

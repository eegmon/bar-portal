import { NextResponse } from "next/server";
import db from "@/lib/db";
import { canManageAssembly, getSessionUser } from "@/lib/auth";
import { sendDiscordWebhook } from "@/lib/discord";
import { getVoteAccessUser } from "@/lib/vote-access";

const DEFAULT_CHOICES = ["찬성", "반대", "기권"];

function getChoices(rawConfig: unknown): string[] {
  try {
    const parsed = JSON.parse(String(rawConfig || "[]"));
    if (Array.isArray(parsed)) {
      const values = parsed
        .map((choice) => (typeof choice === "string" ? choice : choice?.label))
        .filter(
          (choice): choice is string =>
            typeof choice === "string" && choice.trim().length > 0,
        );
      if (values.length >= 2) return [...new Set(values)];
    }
  } catch {
    // 기본 선택지를 사용합니다.
  }
  return DEFAULT_CHOICES;
}

async function resolveVotingUser(
  req: Request,
  constraints?: { assemblyId?: string; agendaId?: string },
) {
  const sessionUser = await getSessionUser();
  if (sessionUser) return sessionUser;

  const url = new URL(req.url);
  const accessToken =
    req.headers.get("x-vote-access-token") ||
    url.searchParams.get("accessToken");

  return getVoteAccessUser(accessToken, constraints);
}

export async function GET(req: Request) {
  try {
    const agendaId = new URL(req.url).searchParams.get("agendaId");
    const user = await resolveVotingUser(req, { agendaId: agendaId || undefined });
    if (!user)
      return NextResponse.json(
        { error: "로그인 또는 유효한 개인 투표 링크가 필요합니다." },
        { status: 401 },
      );
    if (!agendaId)
      return NextResponse.json(
        { error: "안건 ID가 필요합니다." },
        { status: 400 },
      );
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
    const totalRightsRes = await db.execute({
      sql: "SELECT COALESCE(SUM(COALESCE(v.voting_power, 1)), 0) as total FROM users u LEFT JOIN assembly_voting_rights v ON v.user_id = u.id AND v.assembly_id = ? WHERE u.role = 'LAWYER' AND u.status = 'ACTIVE'",
      args: [agenda.assembly_id],
    });

    // 법인회원 의결권 합계 (승인된 법인의 구성원 변호사 2인당 1표, 1인 0표)
    const firmRightsRes = await db.execute({
      sql: `SELECT COALESCE(SUM(partner_cnt / 2), 0) as firm_total
            FROM (
              SELECT f.id, COUNT(fm.lawyer_id) as partner_cnt
              FROM law_firms f
              JOIN firm_members fm ON fm.firm_id = f.id AND fm.is_partner = 1
              WHERE f.status = 'APPROVED'
              GROUP BY f.id
            )`,
      args: [],
    });

    const presentRes = await db.execute({
      sql: "SELECT COALESCE(SUM(CASE WHEN attended = 1 OR is_proxy = 1 THEN COALESCE(voting_power, 1) ELSE 0 END), 0) as present_rights FROM assembly_attendances WHERE assembly_id = ? AND approval_status = 'APPROVED'",
      args: [agenda.assembly_id],
    });
    const castRes = await db.execute({
      sql: "SELECT COALESCE(SUM(votes_count), 0) as casted FROM ballot_box WHERE agenda_id = ?",
      args: [agendaId],
    });
    const voterRes = await db.execute({
      sql: "SELECT COUNT(*) as voters FROM voter_logs WHERE agenda_id = ?",
      args: [agendaId],
    });
    const tallyRes = await db.execute({
      sql: "SELECT choice, SUM(votes_count) as total FROM ballot_box WHERE agenda_id = ? GROUP BY choice",
      args: [agendaId],
    });
    const personalRights = Number(totalRightsRes.rows[0]?.total || 0);
    const firmRights = Number(firmRightsRes.rows[0]?.firm_total || 0);
    const totalRights = personalRights + firmRights;
    const presentRights = Number(presentRes.rows[0]?.present_rights || 0);
    const casted = Number(castRes.rows[0]?.casted || 0);
    const stats = {
      totalRights,
      presentRights,
      voters: Number(voterRes.rows[0]?.voters || 0),
      casted,
      votingRate: totalRights
        ? Number(((casted / totalRights) * 100).toFixed(2))
        : 0,
      quorumNeeded: Number(agenda.quorum_needed || Math.ceil(totalRights / 3)),
      quorumMet:
        presentRights >=
        Number(agenda.quorum_needed || Math.ceil(totalRights / 3)),
      tally: tallyRes.rows.map((row) => ({
        choice: row.choice,
        total: Number(row.total || 0),
      })),
    };
    if (
      !canManageAssembly(user) &&
      !["CLOSED", "RESULT_CONFIRMED"].includes(String(agenda.status))
    )
      stats.tally = [];
    return NextResponse.json({ success: true, stats });
  } catch (err: unknown) {
    console.error("투표 현황 조회 에러:", err);
    return NextResponse.json(
      { error: "투표 현황 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agendaId, allocations, ranking } = body;

    if (!agendaId || !allocations || Object.keys(allocations).length === 0) {
      return NextResponse.json(
        { error: "투표 데이터가 누락되었습니다." },
        { status: 400 },
      );
    }

    // 1. 로그인 또는 개인 링크 인증 검증
    const user = await resolveVotingUser(req, { agendaId });
    if (!user) {
      return NextResponse.json(
        {
          error:
            "총회 전자투표는 로그인한 회원 또는 유효한 개인별 투표 링크 사용자만 참여할 수 있습니다.",
        },
        { status: 401 },
      );
    }

    if (user.role !== "LAWYER" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "변호사 자격이 있는 정회원만 투표권이 있습니다." },
        { status: 403 },
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: `현재 자격 상태(${user.status})로는 의결권을 행사할 수 없습니다.`,
        },
        { status: 403 },
      );
    }

    // 2. 안건 상태 검증 (회칙 제17조의4: 의장이 표결을 선언한 상태여야 함)
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
    const attendanceRes = await db.execute({
      sql: `SELECT id FROM assembly_attendances
            WHERE assembly_id = ? AND user_id = ? AND is_proxy = 0
              AND approval_status = 'APPROVED' AND attended = 1
            LIMIT 1`,
      args: [agenda.assembly_id, user.id],
    });
    if (attendanceRes.rows.length === 0) {
      return NextResponse.json(
        { error: "해당 총회에서 출석 확인된 회원만 투표할 수 있습니다." },
        { status: 403 },
      );
    }
    if (agenda.assembly_status !== "IN_SESSION" || agenda.status !== "VOTING") {
      return NextResponse.json(
        {
          error: "현재 개회 중인 표결 안건이 아닙니다.",
        },
        { status: 400 },
      );
    }

    if (
      agenda.voting_deadline &&
      new Date(String(agenda.voting_deadline)).getTime() <= Date.now()
    ) {
      await db.execute({
        sql: "UPDATE agendas SET status = 'CLOSED', voting_closed_at = datetime('now') WHERE id = ? AND status = 'VOTING'",
        args: [agendaId],
      });
      return NextResponse.json(
        { error: "투표 마감 시간이 지났습니다." },
        { status: 400 },
      );
    }

    const allowedChoices = getChoices(agenda.choice_config);
    if (agenda.voting_method === "RANKED") {
      if (
        !Array.isArray(ranking) ||
        ranking.length !== allowedChoices.length ||
        new Set(ranking).size !== ranking.length ||
        ranking.some(
          (choice: unknown) => !allowedChoices.includes(String(choice)),
        )
      ) {
        return NextResponse.json(
          { error: "모든 선택지를 한 번씩 순위에 배치해야 합니다." },
          { status: 400 },
        );
      }
    }
    for (const [choice, rawCount] of Object.entries(
      allocations as Record<string, unknown>,
    )) {
      const count = Number(rawCount);
      if (
        !allowedChoices.includes(choice) ||
        !Number.isInteger(count) ||
        count < 0
      ) {
        return NextResponse.json(
          { error: "허용되지 않은 선택지 또는 표 수입니다." },
          { status: 400 },
        );
      }
    }

    // 3. 중복 투표 체크 (voter_logs)
    const checkLog = await db.execute({
      sql: "SELECT * FROM voter_logs WHERE agenda_id = ? AND user_id = ?",
      args: [agendaId, user.id],
    });

    if (checkLog.rows.length > 0) {
      return NextResponse.json(
        { error: "이미 본 안건에 표결을 완료하셨습니다. (중복 투표 불가)" },
        { status: 400 },
      );
    }

    // 4. DB에서 실제 보유 의결권 계산 (본인 1표 + 위임받은 표 수)
    const ownRightRes = await db.execute({
      sql: "SELECT COALESCE(v.voting_power, 1) as voting_power FROM users u LEFT JOIN assembly_voting_rights v ON v.user_id = u.id AND v.assembly_id = ? WHERE u.id = ?",
      args: [agenda.assembly_id, user.id],
    });
    let calculatedVotingPower = Number(ownRightRes.rows[0]?.voting_power || 1);
    try {
      const proxyRes = await db.execute({
        sql: "SELECT COALESCE(SUM(COALESCE(voting_power, 1)), 0) as proxy_power FROM assembly_attendances WHERE assembly_id = ? AND proxy_to_user_id = ? AND is_proxy = 1 AND approval_status = 'APPROVED'",
        args: [agenda.assembly_id, user.id],
      });
      const proxyPower = Number(proxyRes.rows[0]?.proxy_power || 0);
      calculatedVotingPower += proxyPower;
    } catch (e) {
      console.error("위임표 계산 에러:", e);
    }

    // 행사하려는 표 수 합계 검증
    const totalCasted =
      agenda.voting_method === "RANKED"
        ? calculatedVotingPower
        : Object.values(allocations as Record<string, unknown>).reduce<number>(
            (sum, rawCount) => sum + Number(rawCount),
            0,
          );
    if (totalCasted !== calculatedVotingPower) {
      return NextResponse.json(
        {
          error: `행사하신 표 수(${totalCasted}표)가 보유 의결권(${calculatedVotingPower}표)과 일치하지 않습니다.`,
        },
        { status: 400 },
      );
    }

    const voteStatements = [
      {
        sql: "INSERT INTO voter_logs (agenda_id, user_id, voted_at) VALUES (?, ?, datetime('now'))",
        args: [agendaId, user.id],
      },
    ];
    if (agenda.voting_method === "RANKED") {
      voteStatements.push({
        sql: "INSERT INTO ballot_box (id, agenda_id, choice, votes_count) VALUES (?, ?, ?, ?)",
        args: [
          `ballot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          agendaId,
          `__RANKING__:${JSON.stringify(ranking)}`,
          calculatedVotingPower,
        ],
      });
    }
    for (const [choice, count] of Object.entries(
      allocations as Record<string, unknown>,
    )) {
      if (agenda.voting_method === "RANKED") continue;
      const voteCount = Number(count);
      if (voteCount > 0) {
        const ballotId = `ballot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        voteStatements.push({
          sql: "INSERT INTO ballot_box (id, agenda_id, choice, votes_count) VALUES (?, ?, ?, ?)",
          args: [ballotId, agendaId, choice, voteCount],
        });
      }
    }
    try {
      await db.batch(voteStatements, "write");
    } catch (error) {
      if (String(error).toLowerCase().includes("unique")) {
        return NextResponse.json(
          { error: "이미 본 안건에 표결이 접수되었습니다." },
          { status: 409 },
        );
      }
      throw error;
    }

    // 7. 디스코드 실시간 알림
    await sendDiscordWebhook("ASSEMBLY_VOTE", {
      embeds: [
        {
          title: `🗳️ [총회 전자투표] 표결 접수 (${agenda.title})`,
          description: `회원 한 분이 총 **${totalCasted}표**(본인표 + 위임표)의 의결권을 행사하였습니다.\n• 투표 방식: **${agenda.is_secret ? "🔒 무기명 비밀투표" : "📝 기명투표"}**`,
          color: 0x10b981,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    return NextResponse.json({
      success: true,
      totalCasted,
      message: `총 ${totalCasted}표의 의결권이 안전하게 행사되었습니다.`,
    });
  } catch (err: any) {
    console.error("투표 처리 에러:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}

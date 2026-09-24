import Link from "next/link";
import { Vote, ArrowLeft, LogIn } from "lucide-react";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getVoteAccessUser } from "@/lib/vote-access";
import VoteClient from "./VoteClient";

export const dynamic = "force-dynamic";

export default async function AssemblyVoteServerPage({
  searchParams,
}: {
  searchParams: Promise<{
    agendaId?: string;
    assemblyId?: string;
    accessToken?: string;
  }>;
}) {
  const { agendaId, assemblyId: assemblyIdParam, accessToken } = await searchParams;

  // 세션 로그인 우선, 없으면 개인 투표 링크 토큰으로 인증
  const sessionUser = await getSessionUser();
  const linkUser    = !sessionUser
    ? await getVoteAccessUser(accessToken, {
        assemblyId: assemblyIdParam,
        agendaId,
      })
    : null;
  const user = sessionUser ?? linkUser;
  const hasInvalidAccessToken = Boolean(accessToken) && !linkUser && !sessionUser;

  // ── 비로그인 / 토큰 무효 ──────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 w-full">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl mx-auto flex items-center justify-center">
            <Vote className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">총회 전자투표 접근 제한</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              도스변호사협회에 등록된{" "}
              <strong className="text-slate-200">정회원 변호사 계정</strong>으로
              로그인하거나, 개인별로 발급된 전자투표 링크를 통해 참여할 수 있습니다.
            </p>
            {hasInvalidAccessToken && (
              <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                유효하지 않거나 만료된 개인 투표 링크입니다. 새 링크를 발급받아 다시 접속해 주세요.
              </p>
            )}
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            변호사 회원 로그인하기
          </Link>
        </div>
      </div>
    );
  }

  // ── 데이터 페치 ────────────────────────────────────────────────────────────
  let votingPower      = 1;
  let proxyList:       any[] = [];
  let agendas:         any[] = [];
  let assemblies:      any[] = [];
  let userVotedAgendas: string[] = [];
  let resolvedAssemblyId = assemblyIdParam ?? "";

  try {
    const assRes = await db.execute("SELECT * FROM assemblies ORDER BY round_number DESC");
    assemblies   = assRes.rows;

    // agendaId만 있고 assemblyId 없을 때 → DB 역탐색
    if (agendaId && !resolvedAssemblyId) {
      const lookup = await db.execute({
        sql:  "SELECT assembly_id FROM agendas WHERE id = ? LIMIT 1",
        args: [agendaId],
      });
      if (lookup.rows.length > 0)
        resolvedAssemblyId = String(lookup.rows[0].assembly_id);
    }

    // 그래도 없으면 현재 개회 중인 총회 자동 선택
    if (!resolvedAssemblyId) {
      const inSession = assemblies.find((a) => a.status === "IN_SESSION");
      if (inSession) resolvedAssemblyId = String(inSession.id);
    }

    if (resolvedAssemblyId) {
      const agRes = await db.execute({
        sql:  "SELECT * FROM agendas WHERE assembly_id = ? ORDER BY agenda_order ASC, created_at ASC",
        args: [resolvedAssemblyId],
      });
      agendas = agRes.rows;

      const proxyRes = await db.execute({
        sql: `SELECT aa.*, u.name AS grantor_name, f.name AS firm_name
              FROM assembly_attendances aa
              LEFT JOIN users u  ON aa.user_id  = u.id
              LEFT JOIN law_firms f ON aa.firm_id = f.id
              WHERE aa.assembly_id      = ?
                AND aa.proxy_to_user_id = ?
                AND aa.is_proxy         = 1
                AND aa.approval_status  = 'APPROVED'`,
        args: [resolvedAssemblyId, user.id],
      });
      proxyList = proxyRes.rows;

      const ownRes = await db.execute({
        sql:  "SELECT COALESCE(v.voting_power, 1) AS voting_power FROM users u LEFT JOIN assembly_voting_rights v ON v.user_id = u.id AND v.assembly_id = ? WHERE u.id = ?",
        args: [resolvedAssemblyId, user.id],
      });
      const proxyPower = proxyList.reduce((s, p: any) => s + Number(p.voting_power ?? 1), 0);
      votingPower      = Number(ownRes.rows[0]?.voting_power ?? 1) + proxyPower;

      const votedRes = await db.execute({
        sql:  "SELECT agenda_id FROM voter_logs WHERE user_id = ?",
        args: [user.id],
      });
      userVotedAgendas = votedRes.rows.map((r: any) => String(r.agenda_id));
    }
  } catch (err) {
    console.error("Vote page data fetch error:", err);
  }

  // ── 출석 상태 조회 (투표 자격 판단) ─────────────────────────────────────────
  // ADMIN 또는 링크 유저는 검증 면제, 일반 변호사는 APPROVED 필요
  type AttendanceStatus = "APPROVED" | "PENDING" | "NONE" | "EXEMPT";
  let attendanceStatus: AttendanceStatus =
    (user.role === "ADMIN" || linkUser) ? "EXEMPT" : "NONE";

  if (resolvedAssemblyId && attendanceStatus === "NONE") {
    try {
      const attRes = await db.execute({
        sql:  "SELECT approval_status, attended, is_proxy FROM assembly_attendances WHERE assembly_id = ? AND user_id = ? LIMIT 1",
        args: [resolvedAssemblyId, user.id],
      });
      const att = attRes.rows[0];
      if (att) {
        const isApproved =
          att.approval_status === "APPROVED" &&
          (att.attended === 1 || att.is_proxy === 1);
        attendanceStatus = isApproved
          ? "APPROVED"
          : (att.approval_status as AttendanceStatus) ?? "NONE";
      }
    } catch (err) {
      console.error("Attendance status fetch error:", err);
    }
  }

  const initialAgendaId =
    agendaId ||
    agendas.find((a) => a.status === "VOTING")?.id ||
    agendas[0]?.id;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* 헤더 */}
      <div>
        <Link
          href={resolvedAssemblyId ? `/assembly?assemblyId=${resolvedAssemblyId}` : "/assembly"}
          className="text-slate-400 hover:text-white text-xs flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 총회 허브로 돌아가기
        </Link>
        <h1 className="text-2xl font-extrabold text-white">정기총회 실시간 전자투표</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          회칙 제17조의4에 의거하여 의장이 표결을 선포한 안건에 대해 보유 의결권을 행사합니다.
        </p>
      </div>

      {/* 총회 선택 폼 — accessToken을 hidden으로 유지해 총회 변경 시에도 링크 인증 유지 */}
      <form
        method="get"
        className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center gap-3"
      >
        {accessToken && (
          <input type="hidden" name="accessToken" value={accessToken} />
        )}
        <label htmlFor="assemblyId" className="text-xs font-bold text-white shrink-0">
          투표할 총회 선택
        </label>
        <select
          id="assemblyId"
          name="assemblyId"
          defaultValue={resolvedAssemblyId}
          className="flex-1 min-w-60 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">총회를 선택하세요</option>
          {assemblies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.status === "IN_SESSION" ? "🟢 " : ""}
              {a.title} · {a.held_at}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors"
        >
          총회 열기
        </button>
      </form>

      {/* 투표 UI */}
      {resolvedAssemblyId && agendas.length > 0 ? (
        <VoteClient
          user={{ ...user, positions: user.positions ?? [] }}
          votingPower={votingPower}
          proxyList={proxyList}
          agendas={agendas}
          userVotedAgendas={userVotedAgendas}
          initialAgendaId={initialAgendaId}
          assemblyId={resolvedAssemblyId}
          accessToken={accessToken}
          attendanceStatus={attendanceStatus}
        />
      ) : (
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-xl text-center text-sm text-slate-500 space-y-2">
          <Vote className="w-8 h-8 text-slate-700 mx-auto" />
          <p>총회를 선택하면 표결 안건이 표시됩니다.</p>
        </div>
      )}
    </div>
  );
}

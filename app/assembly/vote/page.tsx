import { redirect } from "next/navigation";
import Link from "next/link";
import { Vote, ArrowLeft, LogIn, AlertCircle } from "lucide-react";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import VoteClient from "./VoteClient";

export const dynamic = "force-dynamic";

export default async function AssemblyVoteServerPage({
  searchParams,
}: {
  searchParams: Promise<{ agendaId?: string; assemblyId?: string }>;
}) {
  const user = await getSessionUser();
  const { agendaId, assemblyId } = await searchParams;

  // 1. 비로그인 처리
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 w-full">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl mx-auto flex items-center justify-center">
            <Vote className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white">
              총회 전자투표 로그인 필요
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              총회 전자투표는 도스변호사협회에 등록된{" "}
              <strong>정회원 변호사 계정</strong>으로 로그인하신 후 의결권을
              행사하실 수 있습니다.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              변호사 회원 로그인하기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. 변호사 자격 및 의결권 수량 계산
  let votingPower = 1; // 기본 1표
  let proxyList: any[] = [];
  let agendas: any[] = [];
  let assemblies: any[] = [];
  let userVotedAgendas: string[] = [];

  try {
    // 안건 목록 조회
    const assemblyRes = await db.execute(
      "SELECT * FROM assemblies ORDER BY round_number DESC",
    );
    assemblies = assemblyRes.rows;
    const selectedAssemblyId = assemblyId || "";
    const agRes = await db.execute({
      sql: "SELECT * FROM agendas WHERE assembly_id = ? ORDER BY agenda_order ASC, created_at ASC",
      args: [selectedAssemblyId],
    });
    agendas = agRes.rows;
    const selectedAgenda = agendas.find(
      (agenda) => agenda.id === (agendaId || agendas[0]?.id),
    );
    const activeAssemblyId = selectedAgenda?.assembly_id || selectedAssemblyId;

    // 위임받은 표 수 조회
    const proxyRes = await db.execute({
      sql: `SELECT aa.*, u.name as grantor_name 
            FROM assembly_attendances aa
            LEFT JOIN users u ON aa.user_id = u.id
            WHERE aa.assembly_id = ? AND aa.proxy_to_user_id = ? AND aa.is_proxy = 1 AND aa.approval_status = 'APPROVED'`,
      args: [activeAssemblyId, user.id],
    });
    proxyList = proxyRes.rows;
    const ownRightRes = await db.execute({
      sql: "SELECT COALESCE(v.voting_power, 1) as voting_power FROM users u LEFT JOIN assembly_voting_rights v ON v.user_id = u.id AND v.assembly_id = ? WHERE u.id = ?",
      args: [activeAssemblyId, user.id],
    });
    votingPower =
      Number(ownRightRes.rows[0]?.voting_power || 1) + proxyList.length;

    // 이미 투표한 안건 조회
    const votedRes = await db.execute({
      sql: "SELECT agenda_id FROM voter_logs WHERE user_id = ?",
      args: [user.id],
    });
    userVotedAgendas = votedRes.rows.map((r: any) => r.agenda_id as string);
  } catch (err) {
    console.error("Vote page data fetch error:", err);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* 헤더 */}
      <div>
        <Link
          href="/assembly"
          className="text-slate-400 hover:text-white text-xs flex items-center gap-1 mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 총회 허브로
        </Link>
        <h1 className="text-2xl font-extrabold text-white">
          정기총회 실시간 전자투표
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          회칙 제17조의4에 의거하여 의장이 표결을 선포한 안건에 대해 보유
          의결권을 행사합니다.
        </p>
      </div>

      <form
        method="get"
        className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center gap-3"
      >
        <label htmlFor="assemblyId" className="text-xs font-bold text-white">
          투표할 총회 선택
        </label>
        <select
          id="assemblyId"
          name="assemblyId"
          defaultValue={assemblyId || ""}
          className="flex-1 min-w-60 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">총회를 선택하세요</option>
          {assemblies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} · {item.held_at}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg"
        >
          총회 열기
        </button>
      </form>

      {assemblyId && agendas.length > 0 ? (
        <VoteClient
          user={user}
          votingPower={votingPower}
          proxyList={proxyList}
          agendas={agendas}
          userVotedAgendas={userVotedAgendas}
          initialAgendaId={agendaId || agendas[0]?.id}
        />
      ) : (
        <div className="p-10 bg-slate-900 border border-slate-800 rounded-xl text-center text-sm text-slate-500">
          총회를 선택하면 해당 총회의 표결 안건이 표시됩니다.
        </div>
      )}
    </div>
  );
}

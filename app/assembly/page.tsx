import Link from "next/link";
import {
  Vote,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  FileText,
  ScrollText,
  UserCheck,
  Clock,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import AttendButton from "./AttendButton";

export const dynamic = "force-dynamic";

export default async function AssemblyHubPage({
  searchParams,
}: {
  searchParams: Promise<{ assemblyId?: string }>;
}) {
  const user = await getSessionUser();
  const { assemblyId } = await searchParams;

  let assembly: any = null;
  let assemblies: any[] = [];
  let agendas: any[] = [];
  let attendanceInfo: any = null;
  let assembliesWithMinutes: any[] = [];

  try {
    const assRes = await db.execute(
      "SELECT * FROM assemblies ORDER BY round_number DESC",
    );
    assemblies = assRes.rows;
    assembly = assemblies.find((item) => item.id === assemblyId) || null;

    // assemblyId 없으면 IN_SESSION 총회를 자동 선택
    if (!assembly) {
      assembly = assemblies.find((item) => item.status === "IN_SESSION") || null;
    }

    if (assembly) {
      const agRes = await db.execute({
        sql: "SELECT * FROM agendas WHERE assembly_id = ? ORDER BY agenda_order ASC, created_at ASC",
        args: [assembly.id],
      });
      agendas = agRes.rows;

      if (user) {
        const attRes = await db.execute({
          sql: "SELECT * FROM assembly_attendances WHERE assembly_id = ? AND user_id = ?",
          args: [assembly.id, user.id],
        });
        if (attRes.rows.length > 0) {
          attendanceInfo = attRes.rows[0];
        }
      }
    }

    const minRes = await db.execute(
      "SELECT id, title, round_number, is_regular, held_at, status, minutes_text FROM assemblies WHERE minutes_text IS NOT NULL AND minutes_text != '' ORDER BY round_number DESC",
    );
    assembliesWithMinutes = minRes.rows;
  } catch (err) {
    console.error("Assembly fetch error:", err);
  }

  const isInSession = assembly?.status === "IN_SESSION";

  // 현재 표결 진행 중인 안건이 하나라도 있는지 (지각 출석 판단에 사용)
  const hasVotingAgenda = agendas.some((ag) => ag.status === "VOTING");

  const canCheckIn =
    user &&
    (user.role === "LAWYER" || user.role === "ADMIN") &&
    user.status === "ACTIVE" &&
    isInSession &&
    attendanceInfo?.approval_status !== "APPROVED" &&
    attendanceInfo?.is_proxy !== 1;

  // 출석 승인 완료 (직접 출석 또는 위임 모두 포함)
  const alreadyAttended =
    attendanceInfo?.approval_status === "APPROVED" &&
    (attendanceInfo?.attended === 1 || attendanceInfo?.is_proxy === 1);

  // 위임 신청 (승인 여부 무관)
  const hasProxy =
    attendanceInfo?.is_proxy === 1 &&
    (attendanceInfo?.approval_status === "APPROVED" ||
      attendanceInfo?.approval_status === "PENDING");

  // 지각 출석 의장 승인 대기
  const isPendingAttendance = attendanceInfo?.approval_status === "PENDING";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* 헤더 */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
          <Vote className="w-4 h-4" />
          도스변호사협회 회칙 제3장 · 최고의결기관 총회
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          총회 및 전자투표 시스템
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          매월 첫째 주 일요일 정기총회 출석 연동 자격 갱신, 불참자 의결권 위임장
          제출 및 실시간 전자투표를 진행합니다.
        </p>
      </div>

      {/* 총회 선택 폼 */}
      <form
        method="get"
        className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center gap-3"
      >
        <label htmlFor="assemblyId" className="text-xs font-bold text-white shrink-0">
          열람할 총회 선택
        </label>
        <select
          id="assemblyId"
          name="assemblyId"
          defaultValue={assembly?.id || assemblyId || ""}
          className="flex-1 min-w-60 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">총회를 선택하세요</option>
          {assemblies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.status === "IN_SESSION" ? "🟢 " : ""}
              {item.title} · {item.held_at} ·{" "}
              {item.status === "IN_SESSION"
                ? "개회중"
                : item.status === "CLOSED"
                  ? "폐회"
                  : "예정"}
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

      {assembly ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 좌측 2열 */}
          <div className="lg:col-span-2 space-y-6">

            {/* 총회 현황 카드 */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    isInSession
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : assembly.status === "CLOSED"
                        ? "bg-slate-700/40 text-slate-400 border-slate-600/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {isInSession
                    ? "🟢 총회 개회중 — 투표 진행"
                    : assembly.status === "CLOSED"
                      ? "⬛ 폐회"
                      : "🕐 개최 예정"}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {assembly.held_at}
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white">{assembly.title}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  의사정족수: 전체 의결권 3분의 1 이상 출석 (회칙 제15조제1항)
                </p>
              </div>

              {/* 나의 출석 상태 패널 */}
              <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      나의 당월 자격 갱신 및 출석 상태
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {alreadyAttended ? (
                        <span className="text-emerald-400 font-semibold">
                          ✅ 출석 확인 완료 — 당월 자격 1개월 자동 연장됨
                        </span>
                      ) : isPendingAttendance ? (
                        <span className="text-amber-400 font-semibold">
                          ⏳ 출석 확인 접수 — 의장 승인 대기 중 (승인 후 투표 가능)
                        </span>
                      ) : hasProxy ? (
                        <span className="text-blue-400 font-semibold">
                          ✅ 의결권 위임 신청 완료 (
                          {attendanceInfo?.approval_status === "APPROVED"
                            ? "승인됨"
                            : "승인 대기중"}
                          )
                        </span>
                      ) : user ? (
                        <span className="text-amber-400">
                          ⚠️ 아직 출석 확인 또는 위임 신청이 없습니다.
                        </span>
                      ) : (
                        "로그인하여 출석 상태를 확인하세요."
                      )}
                    </p>
                  </div>

                  {/* 출석확인 버튼 (IN_SESSION + LAWYER) */}
                  {isInSession && user && (
                    <div className="flex items-center gap-2 shrink-0">
                      {canCheckIn && (
                        <AttendButton
                          assemblyId={assembly.id}
                          assemblyTitle={assembly.title}
                          hasVotingAgenda={hasVotingAgenda}
                        />
                      )}
                      {attendanceInfo?.approval_status === "APPROVED" && (attendanceInfo?.attended === 1 || attendanceInfo?.is_proxy === 1) && (
                        <span className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-xs rounded-lg flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          출석 완료
                        </span>
                      )}
                      {attendanceInfo?.approval_status === "PENDING" && (
                        <span className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold text-xs rounded-lg flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          의장 승인 대기 중
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 불참자 버튼 행 */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800">
                  {!alreadyAttended && !hasProxy && (
                    <Link
                      href="/assembly/proxy"
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      불참자 재등록·위임 신청
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  {isInSession && (
                    <Link
                      href={`/assembly/vote?assemblyId=${assembly.id}`}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center gap-1.5"
                    >
                      <Vote className="w-3.5 h-3.5" />
                      전자투표장 입장
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* 상정 안건 목록 */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-amber-500" />
                상정 안건 목록 (의사일정)
                <span className="text-xs text-slate-500 font-normal">
                  총 {agendas.length}건
                </span>
              </h3>

              {agendas.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  상정된 안건이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {agendas.map((ag, idx) => (
                    <div
                      key={ag.id}
                      className={`p-4 rounded-xl border transition-all ${
                        ag.status === "VOTING"
                          ? "bg-emerald-950/30 border-emerald-500/40 shadow-sm shadow-emerald-900/30"
                          : ag.status === "CLOSED" || ag.status === "RESULT_CONFIRMED"
                            ? "bg-slate-950/50 border-slate-800/60 opacity-80"
                            : ag.status === "ON_HOLD"
                              ? "bg-slate-950/30 border-slate-700/40 opacity-60"
                              : "bg-slate-950 border-slate-800"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* 순서 번호 */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                            ag.status === "VOTING"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : ag.status === "CLOSED" || ag.status === "RESULT_CONFIRMED"
                                ? "bg-slate-800 text-slate-500"
                                : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {idx + 1}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          {/* 배지 행 */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                ag.status === "VOTING"
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                  : ag.status === "CLOSED"
                                    ? "bg-slate-700/60 text-slate-400 border-slate-600/40"
                                    : ag.status === "RESULT_CONFIRMED"
                                      ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                      : ag.status === "ON_HOLD"
                                        ? "bg-slate-700/60 text-slate-500 border-slate-600/40"
                                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              }`}
                            >
                              {ag.status === "VOTING"
                                ? "🟢 투표 진행중"
                                : ag.status === "CLOSED"
                                  ? "⬛ 표결 종료"
                                  : ag.status === "RESULT_CONFIRMED"
                                    ? "✅ 결과 확정"
                                    : ag.status === "ON_HOLD"
                                      ? "⏸ 보류"
                                      : "🕐 표결 대기"}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded border ${
                                ag.is_secret
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                  : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                              }`}
                            >
                              {ag.is_secret ? "🔒 무기명" : "기명투표"}
                            </span>
                            {ag.result_status && ag.result_status !== "PENDING" && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
                                  ag.result_status === "PASS"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : "bg-red-500/20 text-red-300 border-red-500/30"
                                }`}
                              >
                                {ag.result_status === "PASS" ? "가결" : "부결"}
                              </span>
                            )}
                          </div>

                          {/* 제목 */}
                          <h4 className="text-sm font-bold text-white leading-snug">
                            {ag.title}
                          </h4>
                          {ag.description && (
                            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                              {ag.description}
                            </p>
                          )}

                          {/* 마감 시간 */}
                          {ag.status === "VOTING" && ag.voting_deadline && (
                            <div className="flex items-center gap-1 text-[11px] text-amber-400">
                              <Clock className="w-3 h-3" />
                              투표 마감: {ag.voting_deadline}
                            </div>
                          )}
                        </div>

                        {/* 투표 버튼 */}
                        {ag.status === "VOTING" && (
                          <Link
                            href={`/assembly/vote?assemblyId=${assembly.id}&agendaId=${ag.id}`}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shrink-0 transition-colors flex items-center gap-1.5 shadow-md"
                          >
                            <Vote className="w-3.5 h-3.5" />
                            표결하기
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 공식 의사록 */}
            {assembly.minutes_text ? (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ScrollText className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="text-base font-bold text-white">
                        📜 총회 공식 의사록 (회칙 제18조)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {assembly.title} 의사의 경과 및 결과 공표
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    공식 등록 완료
                  </span>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {assembly.minutes_text}
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>
                    * 회칙 제18조제3항에 따라 총회 종료 후 협회 포털에 상시 공표됩니다.
                  </span>
                  <span className="font-semibold text-slate-400">도스변호사협회 총회 의장단</span>
                </div>
              </div>
            ) : isInSession ? (
              <div className="p-5 bg-amber-900/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <span>총회 개회 중입니다. 의사록은 총회 폐회 후 의장단이 작성·공표합니다.</span>
              </div>
            ) : null}

            {/* 역대 총회 의사록 아카이브 */}
            {assembliesWithMinutes.length > 0 && (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  역대 총회 의사록 보관소
                  <span className="text-xs text-slate-500 font-normal">
                    ({assembliesWithMinutes.length}건)
                  </span>
                </h3>

                <div className="space-y-3">
                  {assembliesWithMinutes.map((item) => (
                    <details
                      key={item.id}
                      className="group bg-slate-950 border border-slate-800 rounded-xl overflow-hidden"
                    >
                      <summary className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors list-none">
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              item.is_regular
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            }`}
                          >
                            {item.is_regular ? "정기총회" : "임시총회"} · 제{item.round_number}회
                          </span>
                          <span className="text-sm font-bold text-white group-open:text-amber-400 transition-colors">
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{item.held_at}</span>
                          <ChevronRight className="w-4 h-4 text-amber-400 group-open:rotate-90 transition-transform" />
                        </div>
                      </summary>

                      <div className="p-4 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                        {item.minutes_text}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 우측: 의결권 안내 */}
          <div className="space-y-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                의결권 행사 기준 (회칙 제14조)
              </h3>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="pb-3 border-b border-slate-800">
                  <div className="font-semibold text-slate-200">개인회원</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    1명당 1개의 의결권 행사
                  </div>
                </div>
                <div className="pb-3 border-b border-slate-800">
                  <div className="font-semibold text-slate-200">법인회원 (법무법인 등)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    법인 구성원 2명당 1개의 의결권 행사
                  </div>
                </div>
                <div className="pb-3 border-b border-slate-800">
                  <div className="font-semibold text-slate-200">의결권 위임 (불참 회원)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    개인회원에게 서면으로 의결권을 위임할 수 있으며 수임인이
                    합산하여 대리 행사
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-200">표 분배 및 무기명 보장</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    보유한 다수의 의결권을 후보/선택지별로 분배하여 교차 투표 가능
                  </div>
                </div>
              </div>
            </div>

            {/* 빠른 링크 */}
            {isInSession && (
              <div className="p-5 bg-slate-900 border border-emerald-500/20 rounded-2xl space-y-3">
                <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                  <Vote className="w-4 h-4" />
                  빠른 접근
                </h3>
                <div className="space-y-2">
                  {agendas
                    .filter((ag) => ag.status === "VOTING")
                    .map((ag) => (
                      <Link
                        key={ag.id}
                        href={`/assembly/vote?assemblyId=${assembly.id}&agendaId=${ag.id}`}
                        className="block p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl hover:border-emerald-500/60 transition-colors"
                      >
                        <div className="text-[10px] text-emerald-400 font-bold mb-0.5">
                          🟢 투표 진행중
                        </div>
                        <div className="text-xs text-white font-semibold truncate">
                          {ag.title}
                        </div>
                      </Link>
                    ))}
                  {agendas.filter((ag) => ag.status === "VOTING").length === 0 && (
                    <p className="text-xs text-slate-500">현재 진행 중인 표결 안건 없음</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-16 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3">
          <Vote className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-slate-400 font-semibold">총회를 선택해 주세요.</p>
          <p className="text-xs text-slate-600">
            위 드롭다운에서 총회를 선택하면 안건과 출석·의결 정보를 확인할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}

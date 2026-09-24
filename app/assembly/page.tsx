import Link from "next/link";
import {
  Vote,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  FileText,
  ScrollText,
} from "lucide-react";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

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

      <form
        method="get"
        className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center gap-3"
      >
        <label htmlFor="assemblyId" className="text-xs font-bold text-white">
          열람할 총회 선택
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
              {item.title} · {item.held_at} · {item.status}
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

      {assembly ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 좌측 2열: 총회 현황 및 의결권 안내 */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold">
                  {assembly.status === "IN_SESSION"
                    ? "🟢 총회 개회중 (투표 진행)"
                    : "예정된 총회"}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {assembly.held_at}
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white">
                  {assembly.title}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  의사정족수: 전체 의결권 3분의 1 이상의 출석 (회칙 제15조제1항)
                </p>
              </div>

              {/* 자격 갱신 & 출석 상태 배너 */}
              <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    나의 당월 자격 갱신 및 출석 상태
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {attendanceInfo
                      ? attendanceInfo.attended
                        ? "✅ 정기총회 출석 체크 완료 (당월 자격 1개월 자동 연장됨)"
                        : attendanceInfo.is_proxy
                          ? "✅ 의결권 위임 및 재등록신청서 제출 완료 (자격 유지됨)"
                          : "미출석 상태"
                      : "아직 출석체크 또는 재등록신청서가 접수되지 않았습니다."}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/assembly/proxy"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-lg border border-slate-700 transition-colors"
                  >
                    불참자 재등록·위임 신청
                  </Link>
                  <Link
                    href="/assembly/vote"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-md transition-colors"
                  >
                    전자투표장 입장
                  </Link>
                </div>
              </div>
            </div>

            {/* 현재 상정 안건 목록 */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-amber-500" />
                상정 안건 목록 (의사일정)
              </h3>

              <div className="space-y-3">
                {agendas.map((ag) => (
                  <div
                    key={ag.id}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            ag.is_secret
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {ag.is_secret ? "무기명 비밀투표" : "기명투표"}
                        </span>
                        <span
                          className={`text-xs font-semibold ${ag.status === "VOTING" ? "text-emerald-400" : ag.status === "ON_HOLD" ? "text-slate-400" : ag.status === "CLOSED" ? "text-slate-500" : "text-amber-400"}`}
                        >
                          {ag.status === "VOTING"
                            ? "투표 진행중"
                            : ag.status === "ON_HOLD"
                              ? "안건 보류"
                              : ag.status === "CLOSED"
                                ? "표결 종료"
                                : "표결 대기"}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white">
                        {ag.title}
                      </h4>
                      <p className="text-xs text-slate-400">{ag.description}</p>
                    </div>

                    {ag.status === "VOTING" && (
                      <Link
                        href={`/assembly/vote?agendaId=${ag.id}`}
                        className="px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-lg shrink-0 transition-colors"
                      >
                        표결하기
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 공식 의사록 공표 열람 (회칙 제18조) */}
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
                    공식 의사록 등록 완료
                  </span>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {assembly.minutes_text}
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>
                    * 회칙 제18조제3항에 따라 총회 종료 후 협회 포털에 상시
                    공표됩니다.
                  </span>
                  <span className="font-semibold text-slate-400">
                    도스변호사협회 총회 의장단
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-sm text-slate-500">
                총회를 선택하면 해당 총회의 안건과 출석·의결 정보를 확인할 수
                있습니다.
              </div>
            )}

            {/* 역대 총회 의사록 아카이브 */}
            {assembliesWithMinutes.length > 0 && (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  역대 총회 의사록 보관소 ({assembliesWithMinutes.length}건)
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
                            {item.is_regular ? "정기총회" : "임시총회"} · 제
                            {item.round_number}회
                          </span>
                          <span className="text-sm font-bold text-white group-open:text-amber-400 transition-colors">
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{item.held_at}</span>
                          <span className="text-amber-400 font-semibold group-open:rotate-90 transition-transform">
                            ▶
                          </span>
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

          {/* 우측 1열: 의결권 및 회칙 안내 */}
          <div className="space-y-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                의결권 행사 기준 (회칙 제14조)
              </h3>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="pb-2 border-b border-slate-800">
                  <div className="font-semibold text-slate-200">개인회원</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    1명당 1개의 의결권 행사
                  </div>
                </div>

                <div className="pb-2 border-b border-slate-800">
                  <div className="font-semibold text-slate-200">
                    법인회원 (법무법인 등)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    법인 구성원 2명당 1개의 의결권 행사
                  </div>
                </div>

                <div className="pb-2 border-b border-slate-800">
                  <div className="font-semibold text-slate-200">
                    의결권 위임 (불참 회원)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    개인회원에게 서면으로 의결권을 위임할 수 있으며 수임인이
                    합산하여 대리 행사
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-200">
                    표 분배 및 무기명 보장
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    보유한 다수의 의결권을 후보/선택지별로 분배하여 교차 투표
                    가능
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400">
          현재 등록된 총회 일정이 없습니다.
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Vote,
  Shield,
  CheckCircle2,
  AlertCircle,
  Lock,
  Plus,
  Minus,
  Send,
  Play,
  Square,
  Users,
  Link2,
  RefreshCw,
  Clock,
  BarChart3,
  Info,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Agenda {
  id: string;
  title: string;
  description?: string;
  status: string;
  is_secret: number;
  voting_method: string;
  choice_config: string;
  voting_deadline?: string;
  result_status?: string;
}

interface LiveStats {
  totalRights: number;
  presentRights: number;
  voters: number;
  casted: number;
  votingRate: number;
  quorumNeeded: number;
  quorumMet: boolean;
  tally: { choice: string; total: number }[];
  /** 기명투표 + 관리자 + 종료 후에만 포함 */
  namedVotes?: { userId: string; userName: string; choice: string; votes_count: number }[];
}

/**
 * 출석 상태
 * - "APPROVED" : 출석 승인 완료 → 투표 가능
 * - "PENDING"  : 지각 출석, 의장 승인 대기 → 투표 불가
 * - "NONE"     : 출석 미확인 → 투표 불가
 * - "EXEMPT"   : ADMIN 또는 개인 투표 링크 사용자 → 검증 면제
 */
type AttendanceStatus = "APPROVED" | "PENDING" | "NONE" | "EXEMPT";

interface VoteClientProps {
  user: { id: string; name: string; role: string; positions?: string[] };
  votingPower: number;
  proxyList: any[];
  agendas: Agenda[];
  userVotedAgendas: string[];
  initialAgendaId?: string;
  assemblyId: string;
  /** 개인 투표 링크 JWT — 없으면 일반 세션 투표 */
  accessToken?: string;
  attendanceStatus: AttendanceStatus;
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function isChair(user: VoteClientProps["user"]): boolean {
  return (
    user.role === "ADMIN" ||
    (user.positions ?? []).some((p) =>
      ["PRESIDENT", "ASSEMBLY_SPEAKER", "ASSEMBLY_VICE_SPEAKER", "SECRETARY_GENERAL"].includes(p),
    )
  );
}

function parseChoices(agenda: Agenda | undefined): string[] {
  if (!agenda) return ["찬성", "반대", "기권"];
  try {
    const parsed = JSON.parse(agenda.choice_config || "[]");
    if (Array.isArray(parsed) && parsed.length >= 2)
      return parsed
        .map((c: any) => (typeof c === "string" ? c : c?.label))
        .filter(Boolean);
  } catch { /* fall through */ }
  return ["찬성", "반대", "기권"];
}

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    VOTING:           { label: "🟢 표결중",   cls: "bg-emerald-500/30 text-emerald-200" },
    CLOSED:           { label: "⬛ 마감",      cls: "bg-slate-700 text-slate-400" },
    RESULT_CONFIRMED: { label: "✅ 확정",      cls: "bg-blue-500/30 text-blue-200" },
    ON_HOLD:          { label: "⏸ 보류",       cls: "bg-slate-700 text-slate-500" },
    READY:            { label: "🕐 대기",       cls: "bg-amber-500/30 text-amber-200" },
  };
  const s = map[status] ?? { label: status, cls: "bg-slate-800 text-slate-400" };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}

function Countdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setRemaining("마감됨"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(h > 0 ? `${h}시간 ${m}분 ${s}초` : m > 0 ? `${m}분 ${s}초` : `${s}초`);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [deadline]);
  return (
    <span className={`font-mono font-bold ${remaining === "마감됨" ? "text-red-400" : "text-amber-400"}`}>
      {remaining}
    </span>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function VoteClient({
  user,
  votingPower,
  proxyList,
  agendas,
  userVotedAgendas,
  initialAgendaId,
  assemblyId,
  accessToken,
  attendanceStatus,
}: VoteClientProps) {
  const chair = isChair(user);

  const [selectedId, setSelectedId]     = useState(
    initialAgendaId || agendas.find((a) => a.status === "VOTING")?.id || agendas[0]?.id || "",
  );
  const [allocations, setAllocations]   = useState<Record<string, number>>({});
  const [ranking, setRanking]           = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [votedOk, setVotedOk]           = useState(false);
  const [isActing, setIsActing]         = useState(false);
  const [liveStats, setLiveStats]       = useState<LiveStats | null>(null);
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null);
  const [copied, setCopied]             = useState(false);
  const [agendaList, setAgendaList]     = useState<Agenda[]>(agendas);
  const [votedAgendas, setVotedAgendas] = useState<string[]>(userVotedAgendas);
  const statsTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const current  = agendaList.find((a) => a.id === selectedId);
  const isVoted  = votedAgendas.includes(selectedId);
  const choices  = parseChoices(current);
  const isRanked = current?.voting_method === "RANKED";
  const allocSum = Object.values(allocations).reduce((a, b) => a + b, 0);
  const remaining = votingPower - allocSum;

  const selectAgenda = (id: string) => {
    setSelectedId(id);
    setAllocations({});
    setVotedOk(false);
    setLiveStats(null);
  };

  useEffect(() => { setRanking(choices); }, [selectedId, current?.choice_config]);

  // 실시간 통계 폴링 (accessToken 있으면 쿼리에 포함)
  const fetchStats = useCallback(async () => {
    if (!selectedId) return;
    try {
      const params = new URLSearchParams({ agendaId: selectedId });
      if (accessToken) params.set("accessToken", accessToken);
      const res  = await fetch(`/api/assembly/vote?${params.toString()}`);
      const data = await res.json();
      if (res.ok) { setLiveStats(data.stats); setLastRefresh(new Date()); }
    } catch { /* 네트워크 오류 무시 */ }
  }, [selectedId, accessToken]);

  useEffect(() => {
    fetchStats();
    statsTimer.current = setInterval(fetchStats, 10_000);
    return () => { if (statsTimer.current) clearInterval(statsTimer.current); };
  }, [fetchStats]);

  // 투표 링크 복사
  const copyLink = async () => {
    const url = `${window.location.origin}/assembly/vote?assemblyId=${assemblyId}&agendaId=${selectedId}`;
    try { await navigator.clipboard.writeText(url); }
    catch { prompt("아래 링크를 복사하세요:", url); return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  const adjust = (choice: string, delta: number) => {
    const cur  = allocations[choice] ?? 0;
    const next = cur + delta;
    if (next < 0) return;
    if (delta > 0 && remaining <= 0) return;
    setAllocations((p) => ({ ...p, [choice]: next }));
  };

  const allIn = (choice: string) => {
    const next: Record<string, number> = {};
    choices.forEach((c) => { next[c] = c === choice ? votingPower : 0; });
    setAllocations(next);
  };

  const moveRank = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ranking.length) return;
    const next = [...ranking];
    [next[i], next[j]] = [next[j], next[i]];
    setRanking(next);
  };

  // 투표 제출 — accessToken 있으면 헤더에 포함
  const submitVote = async () => {
    if (!isRanked && allocSum !== votingPower) {
      alert(`보유 의결권 ${votingPower}표를 모두 배분해 주세요. (현재 ${allocSum}/${votingPower})`);
      return;
    }
    const confirmMsg = current?.is_secret
      ? "🔒 [무기명 비밀투표 안내]\n투표자 정보와 선택값이 분리되어 익명 저장됩니다.\n표결을 최종 제출하시겠습니까?"
      : "표결을 최종 제출하시겠습니까?";
    if (!confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      const res  = await fetch("/api/assembly/vote", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { "x-vote-access-token": accessToken } : {}),
        },
        body: JSON.stringify({
          agendaId:    selectedId,
          allocations: isRanked ? { __RANKING__: votingPower } : allocations,
          ranking:     isRanked ? ranking : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "투표 실패");
      setVotedOk(true);
      setVotedAgendas((p) => [...p, selectedId]);
      await fetchStats();
    } catch (e: any) {
      alert(`오류: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 의장 표결 제어
  const chairAction = async (action: "START_VOTING" | "CLOSE_VOTING") => {
    const msg = action === "START_VOTING"
      ? "본 안건에 대한 표결을 공식 개시(선포)하시겠습니까?"
      : "본 안건의 표결을 종료하고 결과를 집계·선포하시겠습니까?";
    if (!confirm(msg)) return;

    setIsActing(true);
    try {
      const res  = await fetch("/api/assembly/admin", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action, agendaId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "처리 실패");

      setAgendaList((prev) =>
        prev.map((a) =>
          a.id === selectedId
            ? { ...a, status: action === "START_VOTING" ? "VOTING" : "CLOSED" }
            : a,
        ),
      );
      alert(
        action === "START_VOTING"
          ? "✅ 표결 개시가 공식 선포되었습니다!"
          : `✅ 표결 종료 및 결과 집계 완료. 결과: ${data.resultStatus === "PASS" ? "가결" : "부결"}`,
      );
      await fetchStats();
    } catch (e: any) {
      alert(`오류: ${e.message}`);
    } finally {
      setIsActing(false);
    }
  };

  const rateWidth = liveStats
    ? Math.min(100, Math.round((liveStats.casted / (liveStats.totalRights || 1)) * 100))
    : 0;

  // ── 출석 미승인 차단 화면 ────────────────────────────────────────────────────
  if (attendanceStatus !== "APPROVED" && attendanceStatus !== "EXEMPT") {
    return (
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5">
        <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center border ${
          attendanceStatus === "PENDING"
            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
            : "bg-red-500/10 border-red-500/30 text-red-400"
        }`}>
          {attendanceStatus === "PENDING"
            ? <Clock className="w-7 h-7" />
            : <AlertCircle className="w-7 h-7" />}
        </div>

        <div className="text-center space-y-1.5">
          <h3 className="text-lg font-bold text-white">
            {attendanceStatus === "PENDING"
              ? "출석 확인 접수 — 의장 승인 대기 중"
              : "출석 확인이 필요합니다"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {attendanceStatus === "PENDING" ? (
              <>
                표결 진행 중에 출석을 확인하셨습니다.{" "}
                <strong className="text-amber-300">정족수 반영 및 투표 자격</strong>을
                위해 의장의 승인이 필요합니다.
                <br />승인 후 새로고침하면 투표에 참여하실 수 있습니다.
              </>
            ) : (
              <>
                총회 전자투표는{" "}
                <strong className="text-white">출석 확인이 완료된 회원</strong>만
                참여할 수 있습니다.
                <br />총회 페이지에서 먼저 출석을 확인해 주세요.
              </>
            )}
          </p>
        </div>

        <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${
          attendanceStatus === "PENDING"
            ? "bg-amber-500/5 border-amber-500/20 text-amber-200"
            : "bg-slate-950 border-slate-800 text-slate-400"
        }`}>
          {attendanceStatus === "PENDING" ? (
            <>
              <p className="font-semibold text-amber-300">⏳ 현재 상태</p>
              <p>• 출석 확인이 접수되어 관리자 패널에 표시되었습니다.</p>
              <p>• 의장이 승인하면 정족수에 반영되고 투표가 열립니다.</p>
              <p>• 자격 갱신은 이미 처리되었습니다.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-300">안내</p>
              <p>• 직접 참석: 총회 페이지의 &quot;출석 확인하기&quot; 버튼을 눌러주세요.</p>
              <p>• 불참 시: 사전에 의결권 위임장을 제출하면 대리 투표가 가능합니다.</p>
              <p>• 회칙 제17조의4에 의거하여 출석한 회원만 의결권을 행사합니다.</p>
            </>
          )}
        </div>

        <div className="flex justify-center gap-3">
          <a
            href={`/assembly?assemblyId=${assemblyId}`}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            총회 페이지에서 출석 확인하기
          </a>
          {attendanceStatus === "PENDING" && (
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              새로고침
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── 정상 투표 UI ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* 안건 탭 */}
      <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {agendaList.map((ag) => (
          <button
            key={ag.id}
            onClick={() => selectAgenda(ag.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              selectedId === ag.id
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span className="max-w-[9rem] truncate">{ag.title.split(":")[0]}</span>
            <StatusBadge status={ag.status} />
            {votedAgendas.includes(ag.id) && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* 의장/관리자 제어 패널 */}
      {chair && current && (
        <div className="p-4 bg-slate-900 border border-amber-500/40 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2 text-xs text-amber-300 font-bold">
            <Shield className="w-4 h-4 text-amber-400" />
            [총회 의장 제어 패널]&nbsp;
            <span className="text-slate-400 font-normal">안건 상태:</span>
            <StatusBadge status={current.status} />
          </div>
          <div className="flex items-center gap-2">
            {current.status === "READY" && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => chairAction("START_VOTING")}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow"
              >
                <Play className="w-3.5 h-3.5" /> 표결 개시 선언 (Start)
              </button>
            )}
            {current.status === "VOTING" && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => chairAction("CLOSE_VOTING")}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow"
              >
                <Square className="w-3.5 h-3.5" /> 표결 종료 및 결과 선포 (Close)
              </button>
            )}
            {isActing && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
          </div>
        </div>
      )}

      {/* 보유 의결권 + 링크 공유 */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs text-slate-400">
            투표권자: <strong className="text-white">{user.name} 변호사</strong>
          </span>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            나의 행사 가능 의결권:{" "}
            <span className="text-emerald-400 font-mono text-2xl">{votingPower}표</span>
          </div>
          <p className="text-[11px] text-slate-500">
            • 본인 기본 의결권{" "}
            {proxyList.length > 0
              ? `+ 위임받은 의결권 (${proxyList.reduce((s, p) => s + Number(p.voting_power || 1), 0)}표)`
              : ""}
          </p>
          {proxyList.length > 0 && (
            <div className="text-[11px] text-emerald-400/90 pt-1 space-y-0.5">
              {proxyList.map((p, i) => (
                <div key={i}>
                  • {p.firm_id
                    ? `🏢 [법인위임: ${p.firm_name || "법무법인"}] ${p.grantor_name} (${p.voting_power || 1}표)`
                    : `👤 [개인위임] ${p.grantor_name || "회원"} (1표)`}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {current?.is_secret ? (
            <span className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> 무기명 비밀투표
            </span>
          ) : (
            <span className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <Vote className="w-3.5 h-3.5" /> 기명 표결
            </span>
          )}
          <button
            onClick={copyLink}
            title="이 안건 투표 링크 복사"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            {copied ? "복사됨 ✓" : "투표 링크 공유"}
          </button>
        </div>
      </div>

      {/* 실시간 통계 */}
      {liveStats && current && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              실시간 표결 현황
            </span>
            <button
              onClick={fetchStats}
              className="flex items-center gap-1 text-slate-500 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {lastRefresh && (
                <span className="text-[10px]">
                  {lastRefresh.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            {[
              { label: "전체 의결권", value: `${liveStats.totalRights}표`,  cls: "text-white" },
              { label: "출석 의결권", value: `${liveStats.presentRights}표`, cls: "text-white" },
              { label: "투표 행사표", value: `${liveStats.casted}표`,        cls: "text-white" },
              { label: "현재 투표율", value: `${liveStats.votingRate}%`,     cls: "text-emerald-400" },
              {
                label: "정족수",
                value: liveStats.quorumMet ? "충족 ✓" : "미충족",
                cls:   liveStats.quorumMet ? "text-emerald-400" : "text-amber-400",
              },
            ].map((s) => (
              <div key={s.label} className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                <div className="text-slate-500 mb-0.5">{s.label}</div>
                <div className={`text-base font-bold font-mono ${s.cls}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* 투표율 프로그레스 */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>투표 진행률</span><span>{rateWidth}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${rateWidth}%` }} />
            </div>
          </div>

          {/* 집계 결과 (관리자 또는 종료 후) */}
          {liveStats.tally.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              {liveStats.tally.map((item) => {
                const pct = liveStats.casted ? Math.round((item.total / liveStats.casted) * 100) : 0;
                return (
                  <div key={item.choice} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-semibold">{item.choice}</span>
                      <span className="text-white font-bold font-mono">{item.total}표 ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 기명투표 상세 명단 (관리자 + 종료 후) */}
          {liveStats.namedVotes && liveStats.namedVotes.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                기명 투표 상세 명단 ({liveStats.namedVotes.length}명)
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {liveStats.namedVotes.map((v) => (
                  <div
                    key={`${v.userId}-${v.choice}`}
                    className="flex items-center justify-between text-[11px] px-3 py-1.5 bg-slate-950 rounded-lg border border-slate-800"
                  >
                    <span className="text-slate-300 font-semibold">{v.userName} 변호사</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      v.choice === "찬성" || v.choice === "FOR" || v.choice === "YES"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : v.choice === "반대" || v.choice === "AGAINST" || v.choice === "NO"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-slate-700 text-slate-400"
                    }`}>
                      {v.choice} {v.votes_count > 1 ? `(${v.votes_count}표)` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 마감 카운트다운 */}
      {current?.status === "VOTING" && current.voting_deadline && (
        <div className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-amber-300 font-semibold">투표 마감까지:</span>
          <Countdown deadline={current.voting_deadline} />
        </div>
      )}

      {/* ── 상태별 본문 ───────────────────────────────────────────────────────── */}

      {/* ① 투표 완료 */}
      {(isVoted || votedOk) ? (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">본 안건에 대한 표결을 완료하셨습니다.</h3>
          <p className="text-xs text-slate-400">
            중복 투표 방지 규정에 따라 이미 제출된 표는 수정하거나 다시 투표할 수 없습니다.
          </p>
        </div>

      /* ② 표결 대기 */
      ) : current?.status === "READY" ? (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">의장의 표결 선언을 기다리는 중입니다.</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            회칙 제17조의4에 의거하여 의장이 본 안건의 심의를 마치고 표결 개시를 선포해야 투표함이 열립니다.
          </p>
          {chair && (
            <button
              disabled={isActing}
              onClick={() => chairAction("START_VOTING")}
              className="mx-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow"
            >
              <Play className="w-4 h-4" /> 지금 표결 개시 선언하기
            </button>
          )}
        </div>

      /* ③ 보류 */
      ) : current?.status === "ON_HOLD" ? (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">이 안건은 현재 보류 상태입니다.</h3>
          <p className="text-xs text-slate-500">의장의 결정에 따라 재상정될 수 있습니다.</p>
        </div>

      /* ④ 표결 종료 */
      ) : current?.status === "CLOSED" || current?.status === "RESULT_CONFIRMED" ? (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-full mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">본 안건의 표결이 종료되었습니다.</h3>
          {current.result_status && current.result_status !== "PENDING" && (
            <span className={`inline-block px-4 py-1 rounded-full text-sm font-extrabold ${
              current.result_status === "PASS"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-red-500/20 text-red-300 border border-red-500/40"
            }`}>
              {current.result_status === "PASS" ? "✅ 가결" : "❌ 부결"}
            </span>
          )}
          <p className="text-xs text-slate-400">집계 결과가 총회 의사록에 기록되었습니다.</p>
        </div>

      /* ⑤ 안건 없음 */
      ) : !current ? (
        <div className="p-10 bg-slate-900 border border-slate-800 rounded-xl text-center text-sm text-slate-500">
          표결할 안건을 선택해 주세요.
        </div>

      /* ⑥ 표결 진행 중 */
      ) : (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4 space-y-1">
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[11px] font-bold">
              🟢 의장 표결 선포 완료
            </span>
            <h2 className="text-lg font-bold text-white">{current.title}</h2>
            {current.description && (
              <p className="text-xs text-slate-400">{current.description}</p>
            )}
          </div>

          {/* 선호투표(RANKED) */}
          {isRanked ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                선호하는 순서대로 배치하세요. 1순위부터 즉시결선(IRV) 방식으로 집계됩니다.
              </p>
              {ranking.map((choice, i) => (
                <div key={choice} className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    <strong className="text-amber-400 mr-2">{i + 1}순위</strong>
                    {choice}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveRank(i, -1)}
                      disabled={i === 0}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-lg"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRank(i, 1)}
                      disabled={i === ranking.length - 1}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-lg"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          /* 일반 배분 투표 */
          ) : (
            <>
              {/* 배분 현황 */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-400">
                    배분 완료: <strong className="text-white font-mono">{allocSum}</strong> / {votingPower}표
                  </span>
                  <span className={`font-bold ${remaining === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                    {remaining === 0 ? "✅ 전량 배분 완료" : `⚠️ 남은 표: ${remaining}표`}
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${votingPower ? Math.round((allocSum / votingPower) * 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* 선택지 카드 */}
              <div className="space-y-3">
                {choices.map((choice) => {
                  const v = allocations[choice] ?? 0;
                  return (
                    <div
                      key={choice}
                      className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                        v > 0
                          ? "bg-slate-800/80 border-emerald-500/50 shadow-sm"
                          : "bg-slate-950/60 border-slate-800"
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="text-sm font-bold text-white">{choice}</span>
                        <div>
                          <button
                            type="button"
                            onClick={() => allIn(choice)}
                            className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                          >
                            전부 투표 ({votingPower}표)
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => adjust(choice, -1)}
                          disabled={v <= 0}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center text-lg font-bold font-mono text-emerald-400">{v}</span>
                        <button
                          type="button"
                          onClick={() => adjust(choice, 1)}
                          disabled={remaining <= 0}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* 제출 버튼 */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Info className="w-3.5 h-3.5" />
              {current.is_secret
                ? "무기명으로 처리되어 투표자 신원이 분리 저장됩니다."
                : "기명 투표로 처리됩니다."}
            </div>
            <button
              type="button"
              disabled={isSubmitting || (!isRanked && allocSum !== votingPower)}
              onClick={submitVote}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? "투표 처리중..." : `총 ${votingPower}표 최종 투표하기`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

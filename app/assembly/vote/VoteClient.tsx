"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";

interface VoteClientProps {
  user: {
    id: string;
    name: string;
    role: string;
    positions?: string[];
  };
  votingPower: number;
  proxyList: any[];
  agendas: any[];
  userVotedAgendas: string[];
  initialAgendaId?: string;
  accessToken?: string;
}

export default function VoteClient({
  user,
  votingPower,
  proxyList,
  agendas,
  userVotedAgendas,
  initialAgendaId,
  accessToken,
}: VoteClientProps) {
  const isChair =
    user.role === "ADMIN" ||
    (user.positions || []).some((p) =>
      ["PRESIDENT", "ASSEMBLY_SPEAKER", "ASSEMBLY_VICE_SPEAKER"].includes(p)
    );

  const [selectedAgendaId, setSelectedAgendaId] = useState(
    initialAgendaId || agendas[0]?.id || "",
  );
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [votedResult, setVotedResult] = useState<any>(null);
  const [isChairmanActing, setIsChairmanActing] = useState(false);
  const [liveStats, setLiveStats] = useState<any>(null);
  const [ranking, setRanking] = useState<string[]>([]);

  const currentAgenda = agendas.find((a) => a.id === selectedAgendaId);
  const isVoted = userVotedAgendas.includes(selectedAgendaId);

  // 안건별 선택지 정의
  const getChoicesForAgenda = (agenda: any) => {
    try {
      const configured = JSON.parse(agenda?.choice_config || "[]");
      if (Array.isArray(configured) && configured.length >= 2) {
        return configured
          .map((choice: any) =>
            typeof choice === "string" ? choice : choice.label,
          )
          .filter(Boolean);
      }
    } catch {
      // 기본 선택지를 사용합니다.
    }
    return ["찬성", "반대", "기권"];
  };

  const choices = getChoicesForAgenda(currentAgenda);
  const choiceConfig = currentAgenda?.choice_config;

  useEffect(() => {
    setRanking(getChoicesForAgenda({ choice_config: choiceConfig }));
  }, [selectedAgendaId, choiceConfig]);

  useEffect(() => {
    if (!selectedAgendaId) return;
    let active = true;
    const loadStats = async () => {
      const params = new URLSearchParams({ agendaId: selectedAgendaId });
      if (accessToken) params.set("accessToken", accessToken);
      const res = await fetch(
        `/api/assembly/vote?${params.toString()}`,
      );
      const data = await res.json();
      if (active && res.ok) setLiveStats(data.stats);
    };
    void loadStats();
    const timer = window.setInterval(loadStats, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedAgendaId, accessToken]);

  // 현재 배분된 총 표 수
  const allocatedSum = Object.values(allocations).reduce((a, b) => a + b, 0);
  const remainingVotes = votingPower - allocatedSum;

  const handleAgendaChange = (agId: string) => {
    setSelectedAgendaId(agId);
    setAllocations({});
    setVotedResult(null);
  };

  const moveRanking = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ranking.length) return;
    const next = [...ranking];
    [next[index], next[target]] = [next[target], next[index]];
    setRanking(next);
  };

  const handleAdjust = (choice: string, delta: number) => {
    const current = allocations[choice] || 0;
    const next = current + delta;
    if (next < 0) return;
    if (delta > 0 && remainingVotes <= 0) return;

    setAllocations((prev) => ({
      ...prev,
      [choice]: next,
    }));
  };

  const handleQuickAllIn = (choice: string) => {
    const next: Record<string, number> = {};
    choices.forEach((c) => {
      next[c] = c === choice ? votingPower : 0;
    });
    setAllocations(next);
  };

  // 1. 회원 투표 제출
  const handleVoteSubmit = async () => {
    const isRanked = currentAgenda?.voting_method === "RANKED";
    if (!isRanked && allocatedSum !== votingPower) {
      alert(
        `보유하신 의결권 ${votingPower}표를 모두 배분해 주세요. (현재 ${allocatedSum}/${votingPower}표 배분)`,
      );
      return;
    }

    if (currentAgenda?.is_secret) {
      if (
        !confirm(
          "🔒 [무기명 비밀투표 안내]\n투표자 정보와 선택값이 분리되어 익명 저장됩니다.\n표결을 최종 제출하시겠습니까?",
        )
      ) {
        return;
      }
    } else {
      if (!confirm("표결을 최종 제출하시겠습니까?")) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/assembly/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken
            ? { "x-vote-access-token": accessToken }
            : {}),
        },
        body: JSON.stringify({
          agendaId: selectedAgendaId,
          allocations: isRanked ? { __RANKING__: votingPower } : allocations,
          ranking: isRanked ? ranking : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "투표 실패");
      setVotedResult(data);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. 의장 표결 제어 (개시 / 종료)
  const handleChairmanAction = async (
    action: "START_VOTING" | "CLOSE_VOTING",
  ) => {
    const msg =
      action === "START_VOTING"
        ? "본 안건에 대한 표결을 공식 개시(선포)하시겠습니까?"
        : "본 안건의 표결을 종료하고 결과를 선포하시겠습니까?";
    if (!confirm(msg)) return;

    setIsChairmanActing(true);
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          agendaId: selectedAgendaId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "의장 처리 실패");

      alert(
        action === "START_VOTING"
          ? "✅ 표결 개시가 공식 선포되었습니다!"
          : "✅ 표결이 종료되었습니다.",
      );
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsChairmanActing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 안건 탭 선택 */}
      <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {agendas.map((ag) => (
          <button
            key={ag.id}
            onClick={() => handleAgendaChange(ag.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              selectedAgendaId === ag.id
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span>{ag.title.split(":")[0]}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded ${
                ag.status === "VOTING"
                  ? "bg-emerald-500/30 text-emerald-200"
                  : ag.status === "CLOSED"
                    ? "bg-slate-700 text-slate-400"
                    : "bg-amber-500/30 text-amber-200"
              }`}
            >
              {ag.status === "VOTING"
                ? "표결중"
                : ag.status === "CLOSED"
                  ? "마감"
                  : "대기"}
            </span>
          </button>
        ))}
      </div>

      {/* 의장/관리자 전용 제어 바 (ADMIN 권한 또는 총회 의장단 직책 보유 시 표시) */}
      {isChair && (
        <div className="p-4 bg-slate-900 border border-amber-500/40 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2 text-xs text-amber-300 font-bold">
            <Shield className="w-4 h-4 text-amber-400" />
            [총회 의장 제어 패널] 안건 상태:{" "}
            <span className="text-white font-mono">
              {currentAgenda?.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentAgenda?.status !== "VOTING" && (
              <button
                type="button"
                disabled={isChairmanActing}
                onClick={() => handleChairmanAction("START_VOTING")}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow"
              >
                <Play className="w-3.5 h-3.5" />
                표결 개시 선언 (Start)
              </button>
            )}

            {currentAgenda?.status === "VOTING" && (
              <button
                type="button"
                disabled={isChairmanActing}
                onClick={() => handleChairmanAction("CLOSE_VOTING")}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow"
              >
                <Square className="w-3.5 h-3.5" />
                표결 종료 및 결과 선포 (Close)
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1. 보유 의결권 계산기 안내 박스 */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs text-slate-400">
            투표권자: <strong className="text-white">{user.name} 변호사</strong>
          </span>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            나의 행사 가능 의결권:{" "}
            <span className="text-emerald-400 font-mono text-2xl">
              {votingPower}표
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            • 본인 기본 의결권{" "}
            {proxyList.length > 0
              ? `+ 위임받은 의결권 (${proxyList.reduce((sum, p) => sum + Number(p.voting_power || 1), 0)}표)`
              : ""}
          </p>
          {proxyList.length > 0 && (
            <div className="text-[11px] text-emerald-400/90 pt-1 space-y-0.5">
              {proxyList.map((p, i) => (
                <div key={i}>
                  • {p.firm_id ? `🏢 [법인위임: ${p.firm_name || "법무법인"}] ${p.grantor_name} 변호사 (${p.voting_power || 1}표)` : `👤 [개인위임] ${p.grantor_name || "회원"} 변호사 (1표)`}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentAgenda?.is_secret ? (
            <div className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              무기명 비밀투표
            </div>
          ) : (
            <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <Vote className="w-3.5 h-3.5 text-blue-400" />
              기명 표결
            </div>
          )}
        </div>
      </div>

      {liveStats && currentAgenda && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 text-xs text-slate-300">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <span className="text-slate-500 block">전체 의결권</span>
              <strong className="text-white">{liveStats.totalRights}표</strong>
            </div>
            <div>
              <span className="text-slate-500 block">출석 의결권</span>
              <strong className="text-white">
                {liveStats.presentRights}표
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">투표 행사표</span>
              <strong className="text-white">{liveStats.casted}표</strong>
            </div>
            <div>
              <span className="text-slate-500 block">현재 투표율</span>
              <strong className="text-emerald-400">
                {liveStats.votingRate}%
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">정족수</span>
              <strong
                className={
                  liveStats.quorumMet ? "text-emerald-400" : "text-amber-400"
                }
              >
                {liveStats.quorumMet ? "충족" : "미충족"}
              </strong>
            </div>
          </div>
          {liveStats.tally?.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
              {liveStats.tally.map(
                (item: { choice: string; total: number }) => (
                  <span
                    key={item.choice}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg"
                  >
                    {item.choice}:{" "}
                    <strong className="text-white">{item.total}표</strong>
                  </span>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {/* 안건 상태에 따른 화면 분기 */}
      {votedResult || isVoted ? (
        /* 이미 투표 완료한 경우 */
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">
            본 안건에 대한 표결을 완료하셨습니다.
          </h3>
          <p className="text-xs text-slate-400">
            중복 투표 방지 규정에 따라 이미 제출된 표는 수정하거나 다시 투표할
            수 없습니다.
          </p>
        </div>
      ) : currentAgenda?.status === "READY" ? (
        /* 의장의 표결 선언 대기 상태 */
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">
            의장의 표결 선언을 기다리는 중입니다.
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            회칙 제17조의4에 의거하여 의장이 본 안건의 심의를 마치고 표결 개시를
            선포해야 투표함이 열립니다.
          </p>
        </div>
      ) : currentAgenda?.status === "CLOSED" ? (
        /* 표결 종료 상태 */
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-full mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">
            본 안건의 표결이 종료되었습니다.
          </h3>
          <p className="text-xs text-slate-400">
            집계 결과가 총회 의사록에 기록되었습니다.
          </p>
        </div>
      ) : (
        /* 표결 진행 중 (VOTING 상태) */
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[11px] font-bold">
                🟢 의장 표결 선포 완료
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">
              {currentAgenda?.title}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {currentAgenda?.description}
            </p>
          </div>

          {currentAgenda?.voting_method === "RANKED" ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                선호하는 순서대로 배치하세요. 1순위부터 즉시결선 방식으로
                집계됩니다.
              </p>
              {ranking.map((choice, index) => (
                <div
                  key={choice}
                  className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
                >
                  <span className="text-sm font-bold text-white">
                    <strong className="text-amber-400 mr-2">
                      {index + 1}순위
                    </strong>
                    {choice}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveRanking(index, -1)}
                      disabled={index === 0}
                      className="px-2 py-1 bg-slate-800 text-slate-300 rounded disabled:opacity-30"
                    >
                      위
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRanking(index, 1)}
                      disabled={index === ranking.length - 1}
                      className="px-2 py-1 bg-slate-800 text-slate-300 rounded disabled:opacity-30"
                    >
                      아래
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* 배분 현황 프로그레스 바 */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  배분 완료:{" "}
                  <strong className="text-white font-mono">
                    {allocatedSum}
                  </strong>{" "}
                  / {votingPower}표
                </span>
                <span
                  className={`font-bold ${remainingVotes === 0 ? "text-emerald-400" : "text-amber-400"}`}
                >
                  {remainingVotes === 0
                    ? "✅ 전량 배분 완료"
                    : `⚠️ 남은 표: ${remainingVotes}표`}
                </span>
              </div>

              {/* 선택지별 수량 조절 목록 */}
              <div className="space-y-3">
                {choices.map((choice) => {
                  const currentVotes = allocations[choice] || 0;
                  return (
                    <div
                      key={choice}
                      className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                        currentVotes > 0
                          ? "bg-slate-800/80 border-emerald-500/50 shadow-sm"
                          : "bg-slate-950/60 border-slate-800"
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="text-sm font-bold text-white">
                          {choice}
                        </span>
                        <div>
                          <button
                            type="button"
                            onClick={() => handleQuickAllIn(choice)}
                            className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                          >
                            전부 투표 ({votingPower}표)
                          </button>
                        </div>
                      </div>

                      {/* 수량 증감 버튼 (+/-) */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleAdjust(choice, -1)}
                          disabled={currentVotes <= 0}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <span className="w-10 text-center text-lg font-bold font-mono text-emerald-400">
                          {currentVotes}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleAdjust(choice, 1)}
                          disabled={remainingVotes <= 0}
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

          {/* 투표 제출 버튼 */}
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              disabled={
                isSubmitting ||
                (currentAgenda?.voting_method !== "RANKED" &&
                  allocatedSum !== votingPower)
              }
              onClick={handleVoteSubmit}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              <Send className="w-4 h-4" />
              {isSubmitting
                ? "투표 처리중..."
                : `총 ${votingPower}표 최종 투표하기`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

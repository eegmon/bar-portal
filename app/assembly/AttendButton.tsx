"use client";

import { useState } from "react";
import { UserCheck, Loader2, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

interface AttendButtonProps {
  assemblyId: string;
  assemblyTitle: string;
  /** 현재 표결 진행 중인 안건이 있는지 (서버에서 전달) */
  hasVotingAgenda?: boolean;
}

export default function AttendButton({
  assemblyId,
  assemblyTitle,
  hasVotingAgenda = false,
}: AttendButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<"done" | "pending" | null>(null);
  const router = useRouter();

  const handleAttend = async () => {
    const confirmMsg = hasVotingAgenda
      ? `[출석 확인 — 표결 진행 중]\n\n현재 안건 표결이 진행 중입니다.\n출석 확인을 요청하면 의장의 승인 후 정족수에 반영됩니다.\n\n• 자격 연장은 즉시 처리됩니다.\n• 투표는 승인 여부와 무관하게 참여 가능합니다.\n\n출석 확인을 요청하시겠습니까?`
      : `[출석 확인]\n\n${assemblyTitle}에 직접 참석하여 출석을 확인하시겠습니까?\n\n✅ 확인 시 당월 자격이 1개월 연장됩니다.`;

    if (!confirm(confirmMsg)) return;

    setIsLoading(true);
    try {
      const res  = await fetch("/api/assembly/attend", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ assemblyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "출석 확인 실패");

      if (data.pending) {
        setResult("pending");
        alert(
          `⏳ 출석 확인이 접수되었습니다.\n\n표결 진행 중 출석이므로 정족수 반영을 위해 의장의 승인이 필요합니다.\n자격은 즉시 연장되었습니다.`,
        );
      } else {
        setResult("done");
        alert(`✅ ${data.message}`);
      }
      router.refresh();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 이미 승인된 출석
  if (result === "done") {
    return (
      <span className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-xs rounded-lg flex items-center gap-1.5">
        <UserCheck className="w-3.5 h-3.5" />
        출석 완료
      </span>
    );
  }

  // 의장 승인 대기 중
  if (result === "pending") {
    return (
      <span className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold text-xs rounded-lg flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        의장 승인 대기 중
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAttend}
      disabled={isLoading}
      className={`px-4 py-2 font-bold text-xs rounded-lg shadow transition-colors flex items-center gap-1.5 disabled:opacity-60 ${
        hasVotingAgenda
          ? "bg-amber-500 hover:bg-amber-400 text-slate-950"   // 표결 중 → 주의색
          : "bg-emerald-600 hover:bg-emerald-500 text-white"   // 일반 출석 → 초록
      }`}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : hasVotingAgenda ? (
        <Clock className="w-3.5 h-3.5" />
      ) : (
        <UserCheck className="w-3.5 h-3.5" />
      )}
      {isLoading
        ? "처리 중..."
        : hasVotingAgenda
          ? "출석 확인 (의장 승인 필요)"
          : "출석 확인하기"}
    </button>
  );
}

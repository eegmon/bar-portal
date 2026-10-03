"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, RefreshCw } from "lucide-react";

interface ExamBonusPanelProps {
  examId: string;
  initialMultiplier?: number | null;
}

export default function ExamBonusPanel({
  examId,
  initialMultiplier,
}: ExamBonusPanelProps) {
  const [bonusSubmissions, setBonusSubmissions] = useState<any[]>([]);
  const [bonusMultiplierEdit, setBonusMultiplierEdit] = useState(
    initialMultiplier != null ? String(Number(initialMultiplier) * 100) : "10",
  );
  const [isLoadingBonus, setIsLoadingBonus] = useState(false);
  const [isSavingBonusMultiplier, setIsSavingBonusMultiplier] = useState(false);
  const [isTogglingBonus, setIsTogglingBonus] = useState<string | null>(null);

  const loadBonusSubmissions = useCallback(async () => {
    setIsLoadingBonus(true);
    try {
      const res = await fetch(`/api/exam/admin?examId=${examId}`);
      const data = await res.json();
      if (data.success) {
        setBonusSubmissions(data.submissions || []);
        if (data.bonusMultiplier != null) {
          setBonusMultiplierEdit(
            String(Math.round(data.bonusMultiplier * 100)),
          );
        }
      }
    } catch (err: any) {
      alert(`가산점 목록 로드 실패: ${err.message}`);
    } finally {
      setIsLoadingBonus(false);
    }
  }, [examId]);

  useEffect(() => {
    void loadBonusSubmissions();
  }, [loadBonusSubmissions]);

  const handleSaveBonusMultiplier = async () => {
    const multiplier = Number(bonusMultiplierEdit) / 100;
    if (isNaN(multiplier) || multiplier < 0 || multiplier > 1) {
      alert("가산점 배율은 0~100% 사이로 입력해 주세요.");
      return;
    }
    setIsSavingBonusMultiplier(true);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_EXAM_BONUS_MULTIPLIER",
          examId,
          bonusMultiplier: multiplier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      alert(`✅ 가산점 배율이 ${bonusMultiplierEdit}%로 저장되었습니다.`);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSavingBonusMultiplier(false);
    }
  };

  const handleToggleBonusApproval = async (
    submissionId: string,
    currentApproved: number,
  ) => {
    setIsTogglingBonus(submissionId);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SET_BONUS_APPROVAL",
          submissionId,
          approved: !currentApproved,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "처리 실패");
      alert(data.message);
      setBonusSubmissions((prev) =>
        prev.map((submission) =>
          submission.id === submissionId
            ? {
                ...submission,
                bonus_approved: currentApproved ? 0 : 1,
              }
            : submission,
        ),
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsTogglingBonus(null);
    }
  };

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            법학과정 가산점 승인 관리
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            수험번호를 클레임한 응시자 중{" "}
            <strong className="text-indigo-300">
              가산점 자격(bonus_eligible=1)
            </strong>
            이 있는 계정을 확인하고 회차별 가산점을 승인합니다. 가산점은{" "}
            <strong className="text-amber-300">GRADE_PHASE2(2차 채점)</strong>시
            자동 반영됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={loadBonusSubmissions}
          disabled={isLoadingBonus}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isLoadingBonus ? "animate-spin" : ""}`}
          />
          {isLoadingBonus ? "로딩중..." : "목록 새로고침"}
        </button>
      </div>

      <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3">
        <h3 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
          <Award className="w-4 h-4" /> 이 회차 가산점 배율 설정
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={bonusMultiplierEdit}
              onChange={(e) => setBonusMultiplierEdit(e.target.value)}
              className="w-16 bg-transparent text-white text-sm font-mono focus:outline-none"
            />
            <span className="text-slate-400 text-xs">%</span>
          </div>
          <button
            type="button"
            onClick={handleSaveBonusMultiplier}
            disabled={isSavingBonusMultiplier}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors"
          >
            {isSavingBonusMultiplier ? "저장중..." : "배율 저장"}
          </button>
          <span className="text-[11px] text-slate-500">
            1차 득점 × {bonusMultiplierEdit}% = 가산점 (소수점 반올림)
          </span>
        </div>
      </div>

      {bonusSubmissions.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          {isLoadingBonus
            ? "불러오는 중..."
            : "클레임된 수험번호가 없습니다. 목록 새로고침을 눌러주세요."}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">
            총 {bonusSubmissions.length}명이 수험번호를 클레임했습니다. 가산점
            자격이 있는 응시자만 승인 버튼이 활성화됩니다.
          </p>
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
            {bonusSubmissions.map((submission) => {
              const hasEligibility = Number(submission.bonus_eligible) === 1;
              const isApproved = Number(submission.bonus_approved) === 1;
              return (
                <div
                  key={submission.id}
                  className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs ${hasEligibility ? "bg-slate-900" : "bg-slate-950/60"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-400">
                      #{submission.security_code}
                    </span>
                    <div>
                      <p className="font-bold text-white">
                        {submission.claimed_name || "이름 없음"}
                        <span className="ml-1.5 text-slate-500 font-normal">
                          ({submission.claimed_login_id})
                        </span>
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        1차: {submission.phase1_score ?? "-"}점
                        {hasEligibility && (
                          <span className="ml-2 text-indigo-300">
                            → 예상 가산: +
                            {Math.round(
                              Number(submission.phase1_score || 0) *
                                (Number(bonusMultiplierEdit) / 100),
                            )}
                            점
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasEligibility ? (
                      <>
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-bold ${isApproved ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" : "bg-slate-800 text-slate-500 border-slate-700"}`}
                        >
                          {isApproved ? "✅ 가산점 승인됨" : "⏸ 미승인"}
                        </span>
                        <button
                          type="button"
                          disabled={isTogglingBonus === submission.id}
                          onClick={() =>
                            handleToggleBonusApproval(
                              submission.id,
                              submission.bonus_approved,
                            )
                          }
                          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${isApproved ? "bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-600/40" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}
                        >
                          {isTogglingBonus === submission.id
                            ? "처리중..."
                            : isApproved
                              ? "승인 취소"
                              : "가산점 승인"}
                        </button>
                      </>
                    ) : (
                      <span className="px-2 py-0.5 rounded border text-[10px] text-slate-600 border-slate-800">
                        가산점 자격 없음
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Search, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MyScorePage() {
  const [securityCode, setSecurityCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [scoreData, setScoreData] = useState<any>(null);
  const [error, setError] = useState("");

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityCode.trim()) return;

    setLoading(true);
    setError("");
    setScoreData(null);

    try {
      const res = await fetch(`/api/exam/score?code=${encodeURIComponent(securityCode.trim().toUpperCase())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "성적 조회 실패");
      setScoreData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full space-y-8">
      <div>
        <Link href="/exam" className="text-slate-400 hover:text-white text-xs flex items-center gap-1 mb-1">
          <ArrowLeft className="w-3.5 h-3.5" /> 시험 센터 허브로
        </Link>
        <h1 className="text-2xl font-extrabold text-white">변호사시험 성적 및 석차 조회</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          변호사법 제75조에 의거하여 합격자 공고일로부터 2개월간 본인의 성적 및 석차를 비공개 열람할 수 있습니다.
        </p>
      </div>

      {/* 보안코드 조회 폼 */}
      <form onSubmit={handleLookup} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">수험번호 / 개인 보안코드</label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value.toUpperCase())}
              placeholder="예: DOS-A8F3"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white font-mono tracking-wider focus:outline-none focus:border-blue-500 uppercase"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-md"
            >
              <Search className="w-3.5 h-3.5" />
              {loading ? "조회중..." : "성적 조회"}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </form>

      {/* 성적표 결과 */}
      {scoreData && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <span className="text-xs font-mono px-2.5 py-1 bg-slate-800 text-blue-400 rounded-md">
                #{scoreData.security_code}
              </span>
              <h2 className="text-xl font-bold text-white mt-1.5">개인 종합 성적표</h2>
            </div>
            <div>
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  scoreData.final_passed
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : scoreData.phase1_passed
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}
              >
                {scoreData.final_passed
                  ? "🎉 최종 합격"
                  : scoreData.phase1_passed
                  ? "2차 채점 대기중"
                  : "1차 불합격"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">1차 필기</div>
              <div className="text-base font-bold text-white mt-0.5">{scoreData.phase1_score}점</div>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">2차 서술</div>
              <div className="text-base font-bold text-white mt-0.5">{scoreData.phase2_score || "-"}점</div>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">가산점 (10%)</div>
              <div className="text-base font-bold text-amber-400 mt-0.5">+{scoreData.bonus_score}점</div>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">전체 석차</div>
              <div className="text-base font-bold text-blue-400 mt-0.5">
                {scoreData.rank ? `${scoreData.rank}등` : "-"}
              </div>
            </div>
          </div>

          {scoreData.phase2_feedback && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <div className="font-semibold text-slate-300">출제위원 채점 코멘트:</div>
              <p className="text-slate-400 leading-relaxed">{scoreData.phase2_feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

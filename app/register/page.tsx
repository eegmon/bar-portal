"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, UserPlus, Lock, User, MessageSquare, Building, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [isLawyerApplicant, setIsLawyerApplicant] = useState(false);
  const [officeName, setOfficeName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId,
          password,
          name,
          discordId,
          isLawyerApplicant,
          officeName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "회원가입 실패");

      if (data.isPending) {
        alert("회원가입이 완료되었습니다!\n변호사 자격 등록 신청 건은 협회 사무국의 승인 후 정회원으로 전환됩니다.");
      } else {
        alert("회원가입이 완료되었습니다!");
      }

      router.push("/portal");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-16 w-full space-y-6">
      <div className="text-center space-y-2">
        <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl w-12 h-12 mx-auto flex items-center justify-center text-slate-950 shadow-lg">
          <Scale className="w-6 h-6 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">도스변호사협회 회원가입</h1>
        <p className="text-xs text-slate-400">
          변호사시험 응시, 총회 전자투표 및 변호사 행정 포털 이용을 위한 통합 계정을 생성합니다.
        </p>
      </div>

      <form onSubmit={handleRegister} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">아이디 *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="영문, 숫자 조합 4자 이상"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">비밀번호 *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">성명 (인게임 캐릭터명) *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 홍길동"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">디스코드 닉네임 / ID (선택)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <MessageSquare className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="예: gildong_01 (역할 자동 동기화용)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* 변호사 자격 등록 신청 여부 */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isLawyerApplicant}
              onChange={(e) => setIsLawyerApplicant(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
            />
            <div className="text-xs space-y-0.5">
              <div className="font-semibold text-white">변호사 자격등록 신청 (기존 자격자 또는 시험 합격자)</div>
              <p className="text-[11px] text-slate-400">
                체크 시 협회 관리자의 승인을 거쳐 정회원 변호사로 전환됩니다.
              </p>
            </div>
          </label>

          {isLawyerApplicant && (
            <div className="pt-2 border-t border-slate-800">
              <label className="block text-[11px] text-slate-400 mb-1">소속 법률사무소 / 법무법인명</label>
              <input
                type="text"
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                placeholder="예: 법률사무소 도스"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-colors flex items-center justify-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          {loading ? "가입 처리중..." : "회원가입 완료"}
        </button>

        <div className="text-center pt-2">
          <Link href="/login" className="text-xs text-slate-400 hover:text-amber-400 transition-colors">
            이미 계정이 있으신가요? 👉 로그인하기
          </Link>
        </div>
      </form>
    </div>
  );
}

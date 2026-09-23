"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Scale,
  UserPlus,
  Lock,
  User,
  MessageSquare,
  Building,
  AlertCircle,
  CheckCircle2,
  Phone,
  Award,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  // 폼 필드 상태
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [phone, setPhone] = useState("");
  const [isLawyerApplicant, setIsLawyerApplicant] = useState(false);
  const [officeName, setOfficeName] = useState("");
  const [qualificationProof, setQualificationProof] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);

  // 아이디 중복 확인 상태
  const [idChecked, setIdChecked] = useState(false);
  const [idChecking, setIdChecking] = useState(false);
  const [idMessage, setIdMessage] = useState("");
  const [isIdAvailable, setIsIdAvailable] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 아이디 변경 시 중복확인 초기화
  const handleLoginIdChange = (val: string) => {
    setLoginId(val);
    setIdChecked(false);
    setIsIdAvailable(false);
    setIdMessage("");
  };

  // 아이디 중복 확인 요청
  const handleCheckId = async () => {
    const trimmed = loginId.trim();
    if (!trimmed) {
      setIdMessage("아이디를 입력해주세요.");
      setIsIdAvailable(false);
      return;
    }

    if (trimmed.length < 4 || trimmed.length > 20) {
      setIdMessage("아이디는 4~20자 사이여야 합니다.");
      setIsIdAvailable(false);
      return;
    }

    const idRegex = /^[a-zA-Z0-9_]+$/;
    if (!idRegex.test(trimmed)) {
      setIdMessage("영문, 숫자, 밑줄(_)만 사용할 수 있습니다.");
      setIsIdAvailable(false);
      return;
    }

    setIdChecking(true);
    try {
      const res = await fetch(`/api/auth/check-id?loginId=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setIdChecked(true);
      setIsIdAvailable(data.available);
      setIdMessage(data.message || (data.available ? "사용 가능한 아이디입니다." : "이미 사용 중인 아이디입니다."));
    } catch {
      setIdChecked(true);
      setIsIdAvailable(false);
      setIdMessage("중복 확인 중 통신 오류가 발생했습니다.");
    } finally {
      setIdChecking(false);
    }
  };

  const isPasswordMatch = password && passwordConfirm && password === passwordConfirm;
  const isPasswordMismatch = passwordConfirm && password !== passwordConfirm;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!agreedTerms) {
      setError("도스변호사협회 포털 이용약관에 동의해야 가입할 수 있습니다.");
      return;
    }

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (!idChecked || !isIdAvailable) {
      // 아이디 중복확인을 안 눌렀으면 자동 1회 체크 시도
      try {
        const res = await fetch(`/api/auth/check-id?loginId=${encodeURIComponent(loginId.trim())}`);
        const data = await res.json();
        if (!data.available) {
          setError(data.message || "이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.");
          return;
        }
      } catch {
        setError("아이디 중복 확인에 실패했습니다. 다시 시도해주세요.");
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: loginId.trim(),
          password,
          name: name.trim(),
          discordId: discordId.trim(),
          isLawyerApplicant,
          officeName: isLawyerApplicant ? officeName.trim() : "",
          phone: phone.trim(),
          qualificationProof: isLawyerApplicant ? qualificationProof.trim() : "",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "회원가입 실패");

      if (data.isPending) {
        alert(
          "🎉 회원가입 및 변호사 자격 등록 신청이 완료되었습니다!\n\n협회 사무국의 승인 심사 후 정회원 변호사로 등록되며, 승인 전까지는 일반회원 권한으로 포털을 이용하실 수 있습니다."
        );
      } else {
        alert("🎉 도스변호사협회 회원가입이 완료되었습니다!\n환영합니다.");
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
    <div className="max-w-xl mx-auto px-4 py-12 w-full space-y-6">
      {/* 상단 헤더 */}
      <div className="text-center space-y-2">
        <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl w-14 h-14 mx-auto flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/10">
          <Scale className="w-7 h-7 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          도스변호사협회 회원가입
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          변호사시험 응시, 총회 전자투표 및 변호사 행정 포털 이용을 위한 통합 계정을 생성합니다.
        </p>
      </div>

      {/* 가입 폼 */}
      <form
        onSubmit={handleRegister}
        className="p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-5"
      >
        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 회원 구분 선택 라디오 카드 */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300">
            가입 목적 및 회원 구분 <span className="text-rose-400">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div
              onClick={() => setIsLawyerApplicant(false)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                !isLawyerApplicant
                  ? "bg-amber-500/10 border-amber-500 text-white shadow-md shadow-amber-500/5"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  일반회원 / 수험생
                </div>
                {!isLawyerApplicant && <Check className="w-4 h-4 text-amber-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                변호사시험 응시생, 시험 준비생, 일반 시민 (즉시 활성)
              </p>
            </div>

            <div
              onClick={() => setIsLawyerApplicant(true)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                isLawyerApplicant
                  ? "bg-amber-500/10 border-amber-500 text-white shadow-md shadow-amber-500/5"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  변호사 자격등록 신청
                </div>
                {isLawyerApplicant && <Check className="w-4 h-4 text-amber-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                기존 변호사 또는 합격자의 정식 변호사 등록 (사무국 승인제)
              </p>
            </div>
          </div>
        </div>

        {/* 아이디 & 중복확인 */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            로그인 아이디 <span className="text-rose-400">*</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={loginId}
                onChange={(e) => handleLoginIdChange(e.target.value)}
                placeholder="영문, 숫자 4~20자"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={handleCheckId}
              disabled={idChecking || !loginId.trim()}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 shrink-0 transition-colors"
            >
              {idChecking ? "확인중..." : "중복 확인"}
            </button>
          </div>
          {idMessage && (
            <p
              className={`text-[11px] mt-1.5 flex items-center gap-1 ${
                isIdAvailable ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isIdAvailable ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              {idMessage}
            </p>
          )}
        </div>

        {/* 비밀번호 & 비밀번호 확인 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-300">
                비밀번호 <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showPassword ? "숨기기" : "보기"}
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상 입력"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              비밀번호 확인 <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호 재입력"
                className={`w-full bg-slate-950 border rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none font-mono ${
                  isPasswordMatch
                    ? "border-emerald-500 focus:border-emerald-500"
                    : isPasswordMismatch
                    ? "border-rose-500 focus:border-rose-500"
                    : "border-slate-700 focus:border-amber-500"
                }`}
              />
            </div>
            {isPasswordMismatch && (
              <p className="text-[11px] text-rose-400 mt-1">비밀번호가 일치하지 않습니다.</p>
            )}
            {isPasswordMatch && (
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> 비밀번호가 일치합니다.
              </p>
            )}
          </div>
        </div>

        {/* 성명 & 연락처 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              성명 (인게임 캐릭터명) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 홍길동"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              연락처 / 전화번호 (선택)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="예: 010-1234-5678"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* 디스코드 ID */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            디스코드 사용자명 또는 고유 ID (선택)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <MessageSquare className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="예: gildong 또는 18자리 숫자 ID (역할 자동 동기화용)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            💡 디스코드 계정을 입력하시면 공식 디스코드 서버 내 변호사/수험생 역할이 자동으로 동기화됩니다.
          </p>
        </div>

        {/* 변호사 자격 등록 신청 시 추가 정보 */}
        {isLawyerApplicant && (
          <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/30 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              변호사 등록 신청 부가 정보
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  소속 법률사무소 / 법무법인명 (선택)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Building className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={officeName}
                    onChange={(e) => setOfficeName(e.target.value)}
                    placeholder="예: 법무법인 도스 또는 개인개업 (미소속 시 공란)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  자격 취득 근거 또는 증빙사항 <span className="text-amber-400">*</span>
                </label>
                <textarea
                  rows={2}
                  required={isLawyerApplicant}
                  value={qualificationProof}
                  onChange={(e) => setQualificationProof(e.target.value)}
                  placeholder="예: 제1회 변호사시험 합격 / 이전 활동 이력 / 판결문 또는 공문 링크 등"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  * 사무국 승인 심사 시 자격 검증 자료로 활용됩니다.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-amber-300/80">
              * 변호사 등록 신청은 가입 후 협회 사무국의 자격 확인 절차(승인)를 거쳐 정회원으로 전환됩니다.
            </p>
          </div>
        )}

        {/* 약관 동의 체크박스 */}
        <div className="pt-2 border-t border-slate-800">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
            />
            <span className="text-xs text-slate-300">
              도스변호사협회 <strong className="text-amber-400">포털 이용약관</strong> 및{" "}
              <strong className="text-amber-400">개인정보 처리방침</strong>에 동의합니다.{" "}
              <span className="text-rose-400">(필수)</span>
            </span>
          </label>
        </div>

        {/* 가입 제출 버튼 */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 mt-2"
        >
          <UserPlus className="w-4 h-4" />
          {loading ? "회원가입 처리 중..." : "회원가입 완료 및 포털 시작하기"}
        </button>

        {/* 로그인 링크 */}
        <div className="text-center pt-2">
          <Link
            href="/login"
            className="text-xs text-slate-400 hover:text-amber-400 transition-colors"
          >
            이미 계정이 있으신가요? <span className="text-amber-400 font-bold underline ml-1">로그인하기</span>
          </Link>
        </div>
      </form>
    </div>
  );
}

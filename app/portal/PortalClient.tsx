"use client";

import { useState } from "react";
import {
  Scale, CheckCircle2, Clock, Calendar, Edit, Save,
  Lock, Award, RefreshCw
} from "lucide-react";
import Link from "next/link";

interface PortalClientProps {
  lawyerProfile: any;
}

const DEFAULT_SPECIALTIES = ["형사", "민사", "행정", "헌법"];

export default function PortalClient({ lawyerProfile }: PortalClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "profile" | "security" | "bonus">("overview");

  // 프로필 편집 상태
  const [officeName, setOfficeName] = useState(lawyerProfile?.office_name || "");
  const [officeAddress, setOfficeAddress] = useState(lawyerProfile?.office_address || "");
  const [selfIntroduction, setSelfIntroduction] = useState(lawyerProfile?.self_introduction || "");
  const [discordId, setDiscordId] = useState(lawyerProfile?.discord_id || "");
  const [phone, setPhone] = useState(lawyerProfile?.phone || "");
  const [contact, setContact] = useState(lawyerProfile?.contact || "");
  const [isAvailable, setIsAvailable] = useState(Boolean(lawyerProfile?.is_available));
  const [specialties, setSpecialties] = useState<string[]>(
    (() => { try { return JSON.parse(lawyerProfile?.specialties || "[]"); } catch { return []; } })()
  );
  const [customSpecialty, setCustomSpecialty] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSyncingDiscord, setIsSyncingDiscord] = useState(false);

  // 비밀번호 변경 상태
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [isChangingPw, setIsChangingPw] = useState(false);

  // 가산점 신청 상태
  const [bonusSchool, setBonusSchool] = useState("");
  const [bonusEvidence, setBonusEvidence] = useState("");
  const [isApplyingBonus, setIsApplyingBonus] = useState(false);
  const bonusStatus = lawyerProfile?.bonus_eligible;

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const addCustomSpecialty = () => {
    const trimmed = customSpecialty.trim().replace(/^#/, "");
    if (!trimmed) return;
    if (!specialties.includes(trimmed)) {
      setSpecialties((prev) => [...prev, trimmed]);
    }
    setCustomSpecialty("");
  };

  const removeSpecialty = (s: string) => {
    setSpecialties((prev) => prev.filter((x) => x !== s));
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_PROFILE", officeName, officeAddress, selfIntroduction, specialties, discordId, phone, contact, isAvailable }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("✅ 프로필이 저장되었습니다.");
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSyncDiscord = async () => {
    setIsSyncingDiscord(true);
    try {
      const res = await fetch("/api/discord/sync-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`🔄 디스코드 동기화 완료!\n직책: ${data.data?.updatedPositions?.join(", ") || "없음"}\n등급: ${data.data?.updatedRole || "-"}\n\n변경사항이 있으면 재로그인 후 반영됩니다.`);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSyncingDiscord(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { alert("새 비밀번호가 일치하지 않습니다."); return; }
    if (newPw.length < 8) { alert("새 비밀번호는 8자 이상이어야 합니다."); return; }
    setIsChangingPw(true);
    try {
      const res = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CHANGE_PASSWORD", currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("✅ 비밀번호가 변경되었습니다.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleApplyBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusSchool.trim() || !bonusEvidence.trim()) {
      alert("학교명과 증빙자료를 입력해 주세요.");
      return;
    }
    setIsApplyingBonus(true);
    try {
      const res = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPLY_BONUS", schoolName: bonusSchool, evidence: bonusEvidence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("✅ " + data.message);
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsApplyingBonus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 상단 프로필 카드 */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl flex items-center justify-center text-slate-950 font-bold text-2xl shadow-md">
            {lawyerProfile?.name?.[0] || "변"}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              {lawyerProfile?.name}
              <span className="text-[11px] px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                {lawyerProfile?.is_trainee ? "견습변호사" : "정회원 변호사"}
              </span>
            </h2>
            <p className="text-sm text-slate-400">{officeName || "소속 법률사무소 미지정"}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[11px] px-2 py-0.5 rounded font-bold border ${
                lawyerProfile?.status === "ACTIVE"
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : "bg-red-500/10 text-red-300 border-red-500/30"
              }`}>
                {lawyerProfile?.status === "ACTIVE" ? "✓ 정상 개업" : lawyerProfile?.status}
              </span>
              {bonusStatus === 1 && (
                <span className="text-[11px] px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded font-bold">
                  ⭐ 법학과정 가산점 10% 적용
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 최근 갱신: {lawyerProfile?.last_renewed_at?.slice(0, 10) || "-"}</span>
          <Link href="/assembly/proxy" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            총회 재등록신청서
          </Link>
          <button
            type="button"
            onClick={handleSyncDiscord}
            disabled={isSyncingDiscord}
            className="px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800/70 text-indigo-300 rounded-lg border border-indigo-700/50 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDiscord ? "animate-spin" : ""}`} />
            {isSyncingDiscord ? "동기화 중..." : "디스코드 역할 동기화"}
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
        {[
          { id: "overview", label: "자격 현황", icon: <Scale className="w-4 h-4" /> },
          { id: "profile", label: "프로필 수정", icon: <Edit className="w-4 h-4" /> },
          { id: "security", label: "비밀번호 변경", icon: <Lock className="w-4 h-4" /> },
          { id: "bonus", label: "법학과정 가산점", icon: <Award className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === tab.id
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 자격 현황 ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 월별 자격 유지 */}
          <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              변호사법 제6조제4항 · 월별 자격 유지 규정
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              변호사는 매월 첫째 주 일요일 <strong>정기총회에 참석</strong>하거나{" "}
              <strong>재등록신청서(의결권 위임 권장)</strong>를 작성하여 제출하여야 자격이 유지됩니다.
            </p>
            <div className="flex gap-2 pt-1">
              <Link href="/assembly" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors">
                총회 참석하기
              </Link>
              <Link href="/assembly/proxy" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors">
                재등록신청서 작성
              </Link>
            </div>
          </div>

          {/* 자격 정보 상세 */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              자격 등록 상세 정보
            </h3>
            <div className="space-y-2.5 text-xs">
              {[
                ["등록 상태", lawyerProfile?.status === "ACTIVE" ? "✅ 정상 개업" : lawyerProfile?.status],
                ["변호사 구분", lawyerProfile?.is_trainee ? "견습변호사" : "정회원 변호사"],
                ["시험 합격 회차", lawyerProfile?.bar_exam_round ? `제${lawyerProfile.bar_exam_round}회` : "미기재"],
                ["소속 법률사무소", officeName || "미지정"],
                ["최근 갱신일", lawyerProfile?.last_renewed_at?.slice(0, 10) || "-"],
                ["법학과정 가산점", bonusStatus === 1 ? "✅ 승인됨 (+10%)" : bonusStatus === 2 ? "⏳ 심사중" : "미신청"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-slate-800 pb-2 last:border-0">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-200 font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 전문분야 */}
          {specialties.length > 0 && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 md:col-span-2">
              <h3 className="text-sm font-bold text-white">전문분야</h3>
              <div className="flex flex-wrap gap-2">
                {specialties.map((s) => (
                  <span key={s} className="px-3 py-1 bg-slate-950 text-slate-300 border border-slate-700 rounded-full text-xs">#{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 탭 2: 프로필 수정 ── */}
      {activeTab === "profile" && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-5 max-w-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-amber-400" />
              프로필 정보 수정
            </h2>
            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {isSavingProfile ? "저장중..." : "변경사항 저장"}
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">성명 (변경 불가)</label>
                <input type="text" disabled value={lawyerProfile?.name || ""} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">연락처 (디스코드 등)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="예: discord@username"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* 공개 연락처 + 상담 가능 여부 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold text-xs">
                  공개 연락처 <span className="text-slate-500 font-normal">(변호사 검색에 노출)</span>
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="예: discord: username / 카카오: ID"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold text-xs">
                  상담 의뢰 가능 여부 <span className="text-slate-500 font-normal">(변호사 검색에 노출)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAvailable((v) => !v)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-xs font-bold transition-all ${
                    isAvailable
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                      : "bg-slate-950 border-slate-700 text-slate-400"
                  }`}
                >
                  <span>{isAvailable ? "✅ 상담 의뢰 수락 중" : "🔒 상담 의뢰 일시 중단"}</span>
                  <span className={`w-8 h-4 rounded-full transition-colors relative ${isAvailable ? "bg-emerald-500" : "bg-slate-700"}`}>
                    <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${isAvailable ? "left-4" : "left-0.5"}`} />
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">소속 법률사무소 / 법무법인명</label>
              <input type="text" value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="법무법인 도스" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500" />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">사무소 주소</label>
              <input type="text" value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)} placeholder="도스시 법조로 1" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500" />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">디스코드 ID (역할 자동 지급용 고유ID / 닉네임)</label>
              <input type="text" value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="예: username 또는 18자리 숫자 ID" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-amber-500" />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">
                명부 공개 자기소개 <span className="text-slate-500 font-normal">(변호사 명부 카드에 표시)</span>
              </label>
              <textarea
                rows={3}
                value={selfIntroduction}
                onChange={(e) => setSelfIntroduction(e.target.value)}
                placeholder="의뢰인의 기본적 인권 옹호와 신뢰를 최우선으로 하는 변호사입니다."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5 font-semibold">전문분야 (기본 선택 및 자유 추가)</label>
              
              {/* 기본 4대 전문분야 */}
              <div className="flex flex-wrap gap-2 mb-2">
                {DEFAULT_SPECIALTIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      specialties.includes(s)
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                        : "bg-slate-950 text-slate-400 border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    {specialties.includes(s) ? "✓ " : ""}{s}
                  </button>
                ))}
              </div>

              {/* 기타 직접 입력된 태그들 */}
              {specialties.filter((s) => !DEFAULT_SPECIALTIES.includes(s)).length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-2.5 pt-1">
                  {specialties
                    .filter((s) => !DEFAULT_SPECIALTIES.includes(s))
                    .map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-semibold flex items-center gap-1.5"
                      >
                        #{s}
                        <button
                          type="button"
                          onClick={() => removeSpecialty(s)}
                          className="hover:text-red-400 font-bold ml-0.5 focus:outline-none"
                          title="삭제"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              )}

              {/* 기타 직접 추가 입력창 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSpecialty}
                  onChange={(e) => setCustomSpecialty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomSpecialty();
                    }
                  }}
                  placeholder="기타 전문분야 직접 입력 (예: 기업법무, 가사 등)"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={addCustomSpecialty}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg text-xs font-semibold shrink-0"
                >
                  + 직접 추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 탭 3: 비밀번호 변경 ── */}
      {activeTab === "security" && (
        <form onSubmit={handleChangePassword} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-5 max-w-md">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lock className="w-5 h-5 text-blue-400" />
            비밀번호 변경
          </h2>
          <div className="space-y-4 text-xs">
            {[
              { label: "현재 비밀번호", value: currentPw, setter: setCurrentPw },
              { label: "새 비밀번호 (8자 이상)", value: newPw, setter: setNewPw },
              { label: "새 비밀번호 확인", value: confirmPw, setter: setConfirmPw },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <label className="block text-slate-400 mb-1 font-semibold">{label}</label>
                <input
                  type="password"
                  required
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button type="submit" disabled={isChangingPw} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow">
              {isChangingPw ? "변경중..." : "비밀번호 변경"}
            </button>
          </div>
        </form>
      )}

      {/* ── 탭 4: 법학과정 가산점 신청 ── */}
      {activeTab === "bonus" && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-5 max-w-lg">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" />
              법학과정 이수 가산점 신청
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              법학전문대학원(로스쿨) 또는 법학과를 이수한 변호사는 변호사시험 1차 점수에 10% 가산점이 적용됩니다.
            </p>
          </div>

          {bonusStatus === 1 ? (
            <div className="p-5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-center space-y-2">
              <Award className="w-8 h-8 text-indigo-400 mx-auto" />
              <p className="text-sm font-bold text-indigo-300">법학과정 가산점이 승인되었습니다!</p>
              <p className="text-xs text-slate-400">시험 1차 점수에 10% 가산점이 자동 적용됩니다.</p>
            </div>
          ) : bonusStatus === 2 ? (
            <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center space-y-2">
              <Clock className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-sm font-bold text-amber-300">관리자 심사 중입니다.</p>
              <p className="text-xs text-slate-400">승인 완료 시 자동 반영됩니다.</p>
            </div>
          ) : (
            <form onSubmit={handleApplyBonus} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">이수 학교 / 학과명 *</label>
                <input
                  type="text"
                  required
                  value={bonusSchool}
                  onChange={(e) => setBonusSchool(e.target.value)}
                  placeholder="예: 도스대학교 법학전문대학원 또는 OO대학교 법학과"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  증빙자료 (학위증 / 졸업증명서 / 수료증 이미지 링크 또는 상세 설명) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={bonusEvidence}
                  onChange={(e) => setBonusEvidence(e.target.value)}
                  placeholder="예: 졸업증명서/학위증 이미지 링크(Imgur, Discord 등) 또는 문서 발급 번호 / 상세 증빙 정보"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                * 신청 후 협회 관리자(사무국)가 제출된 증빙자료를 검토하여 가산점을 승인합니다. 허위 신청 시 자격이 취소될 수 있습니다.
              </p>
              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button type="submit" disabled={isApplyingBonus} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow">
                  {isApplyingBonus ? "신청중..." : "가산점 신청 제출"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

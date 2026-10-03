"use client";

import { useState } from "react";
import {
  Users,
  Crown,
  MapPin,
  Phone,
  Calendar,
  UserPlus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import UserSearchCombobox, {
  type UserOption,
} from "@/components/UserSearchCombobox";
import LawyerAvatar from "@/app/lawyers/LawyerAvatar";

const FIRM_TYPES: Record<string, string> = {
  INDIVIDUAL: "개인 법률사무소",
  FIRM: "법무법인",
  JOINT: "합동법률사무소",
  NOTARY_FIRM: "공증인가법무법인",
  NOTARY_JOINT: "공증인가합동법률사무소",
};

interface FirmDetailClientProps {
  firm: any;
  initialMembers: any[];
  lawyerCandidates: UserOption[];
  isAdmin: boolean;
  isRepresentative: boolean;
}

export default function FirmDetailClient({
  firm,
  initialMembers,
  lawyerCandidates,
  isAdmin,
  isRepresentative,
}: FirmDetailClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [addLawyerId, setAddLawyerId] = useState("");
  const [addIsPartner, setAddIsPartner] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const canManage = isAdmin || isRepresentative;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedLawyer = lawyerCandidates.find(
      (lawyer) => lawyer.id === addLawyerId,
    );
    if (!selectedLawyer?.login_id) return;
    setIsAdding(true);
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_MEMBER",
          firmId: firm.id,
          lawyerLoginId: selectedLawyer.login_id,
          isPartner: addIsPartner,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "추가 실패");
      alert(`✅ ${data.message}`);
      setAddLawyerId("");
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (lawyerId: string, name: string) => {
    if (!confirm(`${name} 변호사를 구성원에서 제거하시겠습니까?`)) return;
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REMOVE_MEMBER",
          firmId: firm.id,
          lawyerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers((prev) => prev.filter((m) => m.id !== lawyerId));
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleTogglePartner = async (
    lawyerId: string,
    currentIsPartner: boolean,
  ) => {
    setTogglingId(lawyerId);
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TOGGLE_PARTNER",
          firmId: firm.id,
          lawyerId,
          isPartner: !currentIsPartner,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === lawyerId
            ? { ...m, is_partner: !currentIsPartner ? 1 : 0 }
            : m,
        ),
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const partnerCount = members.filter((m) => m.is_partner === 1).length;
  const votingPower = Math.floor(partnerCount / 2);

  return (
    <div className="space-y-6">
      {/* 기본 정보 카드 */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded font-semibold">
                {FIRM_TYPES[firm.type] || firm.type}
              </span>
              {firm.is_notary ? (
                <span className="text-xs px-2.5 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded font-semibold">
                  공증인가
                </span>
              ) : null}
              <span
                className={`text-xs px-2.5 py-0.5 rounded font-bold border ${
                  firm.status === "APPROVED"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : firm.status === "PENDING"
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      : "bg-red-500/10 text-red-400 border-red-500/30"
                }`}
              >
                {firm.status === "APPROVED"
                  ? "정상 등록"
                  : firm.status === "PENDING"
                    ? "승인 대기"
                    : "해산/취소"}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{firm.name}</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-right">
              <span className="text-slate-400">대표변호사: </span>
              <strong className="text-white ml-1">
                {firm.rep_name || "미지정"}
              </strong>
              {firm.rep_login_id && (
                <span className="text-slate-500 font-mono ml-1">
                  ({firm.rep_login_id})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 상세 메타정보 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="flex items-start gap-2 text-slate-300">
            <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-500 block text-[11px]">
                사무소 주소
              </span>
              <span className="font-semibold">{firm.address || "미기재"}</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-slate-300">
            <Phone className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-500 block text-[11px]">
                대표 연락처
              </span>
              <span className="font-semibold">{firm.contact || "미기재"}</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-slate-300">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-500 block text-[11px]">
                등록 일자
              </span>
              <span className="font-semibold">{firm.created_at || "-"}</span>
            </div>
          </div>
        </div>

        {/* 의결권 안내 배너 */}
        {firm.status === "APPROVED" && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-amber-400 font-bold">
                🗳️ 총회 법인회원 산정 의결권:{" "}
              </span>
              <strong className="text-white text-base ml-1">
                {votingPower}표
              </strong>
              <span className="text-slate-400 ml-2 text-[11px]">
                (등록 구성원 변호사 {partnerCount}명 기준 · 2인당 1표)
              </span>
            </div>
            {votingPower > 0 && (
              <Link
                href="/assembly/proxy"
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs transition-colors"
              >
                법인 의결권 위임장 작성 →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 구성원 목록 카드 */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            소속 및 구성원 변호사 명단 ({members.length}명)
          </h3>
          <span className="text-xs text-slate-400">
            구성원(파트너) {partnerCount}명 · 일반 소속{" "}
            {members.length - partnerCount}명
          </span>
        </div>

        {members.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            등록된 소속 변호사가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {members.map((m) => {
              const isRep = firm.representative_id === m.id;
              let specialties: string[] = [];
              try {
                specialties = JSON.parse(m.specialties || "[]");
              } catch {
                specialties = [];
              }

              return (
                <div
                  key={m.id}
                  className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                        <LawyerAvatar
                          name={m.name || "변"}
                          isActive={m.status === "ACTIVE"}
                          size={28}
                        />
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-white text-sm">
                          {m.name}
                        </span>
                        <span className="text-slate-500 font-mono text-xs ml-1">
                          ({m.login_id})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isRep && (
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-bold flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" /> 대표
                        </span>
                      )}
                      {m.is_partner ? (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded text-[10px] font-bold">
                          구성원 변호사
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">
                          소속 변호사
                        </span>
                      )}
                    </div>
                  </div>
                  {specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {specialties.map((s) => (
                        <span
                          key={s}
                          className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-300"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* 관리자 / 대표 권한 액션 */}
                  {canManage && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900 text-xs">
                      <button
                        type="button"
                        disabled={togglingId === m.id}
                        onClick={() =>
                          handleTogglePartner(m.id, !!m.is_partner)
                        }
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                          m.is_partner
                            ? "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                            : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 text-slate-300"
                        }`}
                      >
                        {togglingId === m.id
                          ? "변경중..."
                          : m.is_partner
                            ? "소속으로 전환"
                            : "구성원으로 전환"}
                      </button>
                      {!isRep && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id, m.name)}
                          className="px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded text-[10px] flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> 제거
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 구성원 추가 폼 */}
        {canManage && (
          <form
            onSubmit={handleAddMember}
            className="pt-4 border-t border-slate-800 space-y-3"
          >
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
              구성원 변호사 추가
            </h4>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <UserSearchCombobox
                users={lawyerCandidates.filter(
                  (lawyer) =>
                    !members.some((member) => member.id === lawyer.id),
                )}
                value={addLawyerId}
                onChange={(id) => setAddLawyerId(id)}
                placeholder="변호사 이름 또는 아이디 검색..."
                className="flex-1 min-w-0"
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={addIsPartner}
                  onChange={(e) => setAddIsPartner(e.target.checked)}
                  className="rounded text-amber-500"
                />
                구성원(파트너)
              </label>
              <button
                type="submit"
                disabled={isAdding || !addLawyerId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow disabled:opacity-50"
              >
                {isAdding ? "추가중..." : "추가"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

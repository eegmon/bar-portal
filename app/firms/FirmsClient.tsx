"use client";

import { useState } from "react";
import {
  Building, Plus, CheckCircle2, XCircle, Users, UserPlus,
  Trash2, Search, Edit, Save, ChevronDown, ChevronUp, Crown,
} from "lucide-react";

const FIRM_TYPES: Record<string, string> = {
  INDIVIDUAL: "개인 법률사무소",
  FIRM: "법무법인",
  JOINT: "합동법률사무소",
  NOTARY_FIRM: "공증인가법무법인",
  NOTARY_JOINT: "공증인가합동법률사무소",
};

interface FirmsClientProps {
  initialFirms: any[];
  pendingFirms: any[];
  myFirm: any;
  myFirmMembers: any[];
  currentUser: any;
  isAdmin: boolean;
  isLawyer: boolean;
}

export default function FirmsClient({
  initialFirms,
  pendingFirms: initialPending,
  myFirm: initialMyFirm,
  myFirmMembers: initialMembers,
  currentUser,
  isAdmin,
  isLawyer,
}: FirmsClientProps) {
  const [activeTab, setActiveTab] = useState<"list" | "my" | "register" | "pending" | "admin_create">("list");
  const [firms, setFirms] = useState(initialFirms);
  const [pendingFirms, setPendingFirms] = useState(initialPending);
  const [myFirm] = useState(initialMyFirm);
  const [members, setMembers] = useState(initialMembers);
  const [searchQuery, setSearchQuery] = useState("");

  // 법인 카드 펼치기 상태
  const [expandedFirmId, setExpandedFirmId] = useState<string | null>(null);
  // 법인별 구성원 캐시
  const [firmMembersCache, setFirmMembersCache] = useState<Record<string, any[]>>({});
  const [loadingMembersId, setLoadingMembersId] = useState<string | null>(null);

  // ── 법인 신청 폼 상태
  const [newFirmName, setNewFirmName] = useState("");
  const [newFirmType, setNewFirmType] = useState("FIRM");
  const [newFirmAddress, setNewFirmAddress] = useState("");
  const [newFirmContact, setNewFirmContact] = useState("");
  const [newFirmIsNotary, setNewFirmIsNotary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── 관리자 직접 개설 폼 상태
  const [adminFirmName, setAdminFirmName] = useState("");
  const [adminFirmType, setAdminFirmType] = useState("FIRM");
  const [adminFirmAddress, setAdminFirmAddress] = useState("");
  const [adminFirmContact, setAdminFirmContact] = useState("");
  const [adminFirmIsNotary, setAdminFirmIsNotary] = useState(false);
  const [adminFirmRepLoginId, setAdminFirmRepLoginId] = useState("");
  const [isAdminCreating, setIsAdminCreating] = useState(false);

  // ── 내 법인 정보 수정 상태
  const [isEditingFirm, setIsEditingFirm] = useState(false);
  const [editFirmName, setEditFirmName] = useState(myFirm?.name || "");
  const [editFirmType, setEditFirmType] = useState(myFirm?.type || "FIRM");
  const [editFirmAddress, setEditFirmAddress] = useState(myFirm?.address || "");
  const [editFirmContact, setEditFirmContact] = useState(myFirm?.contact || "");
  const [editFirmRepLoginId, setEditFirmRepLoginId] = useState("");
  const [isSavingFirm, setIsSavingFirm] = useState(false);

  // ── 구성원 추가 상태
  const [addMemberLoginId, setAddMemberLoginId] = useState("");
  const [addMemberIsPartner, setAddMemberIsPartner] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const filteredFirms = firms.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.address || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 법인 카드 토글 (구성원 로딩 포함)
  const handleToggleFirmCard = async (firmId: string) => {
    if (expandedFirmId === firmId) {
      setExpandedFirmId(null);
      return;
    }
    setExpandedFirmId(firmId);
    if (firmMembersCache[firmId]) return;
    setLoadingMembersId(firmId);
    try {
      const res = await fetch(`/api/firms?firmId=${firmId}&members=1`);
      const data = await res.json();
      if (data.members) {
        setFirmMembersCache((prev) => ({ ...prev, [firmId]: data.members }));
      }
    } catch {
      /* 무시 */
    } finally {
      setLoadingMembersId(null);
    }
  };

  const handleCreateFirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirmName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_FIRM",
          name: newFirmName,
          type: newFirmType,
          address: newFirmAddress,
          contact: newFirmContact,
          isNotary: newFirmIsNotary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "신청 실패");
      alert("✅ 법인 등록 신청이 접수되었습니다. 관리자 승인 후 활성화됩니다.");
      setNewFirmName(""); setNewFirmType("FIRM"); setNewFirmAddress(""); setNewFirmContact("");
      setActiveTab("my");
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminCreateFirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminFirmName.trim()) return;
    setIsAdminCreating(true);
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADMIN_CREATE_FIRM",
          name: adminFirmName,
          type: adminFirmType,
          address: adminFirmAddress,
          contact: adminFirmContact,
          isNotary: adminFirmIsNotary,
          representativeLoginId: adminFirmRepLoginId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "개설 실패");
      alert(`✅ ${data.message}`);
      setAdminFirmName(""); setAdminFirmType("FIRM"); setAdminFirmAddress("");
      setAdminFirmContact(""); setAdminFirmRepLoginId(""); setAdminFirmIsNotary(false);
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsAdminCreating(false);
    }
  };

  const handleSaveFirmInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myFirm) return;
    setIsSavingFirm(true);
    try {
      const body: any = {
        action: "UPDATE_FIRM",
        firmId: myFirm.id,
        name: editFirmName,
        type: editFirmType,
        address: editFirmAddress,
        contact: editFirmContact,
      };
      if (editFirmRepLoginId.trim()) body.representativeLoginId = editFirmRepLoginId;
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "수정 실패");
      alert("✅ 법인 정보가 수정되었습니다.");
      setIsEditingFirm(false);
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSavingFirm(false);
    }
  };

  const handleApproveFirm = async (firmId: string) => {
    if (!confirm("이 법인 등록 신청을 승인하시겠습니까?")) return;
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE_FIRM", firmId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("✅ 법인이 승인되었습니다.");
      const approved = pendingFirms.find((f) => f.id === firmId);
      if (approved) {
        setFirms((prev) => [{ ...approved, status: "APPROVED", member_count: 1 }, ...prev]);
        setPendingFirms((prev) => prev.filter((f) => f.id !== firmId));
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleRejectFirm = async (firmId: string) => {
    if (!confirm("이 법인 등록 신청을 반려하시겠습니까?")) return;
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT_FIRM", firmId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("반려 처리되었습니다.");
      setPendingFirms((prev) => prev.filter((f) => f.id !== firmId));
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myFirm || !addMemberLoginId.trim()) return;
    setIsAddingMember(true);
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_MEMBER",
          firmId: myFirm.id,
          lawyerLoginId: addMemberLoginId,
          isPartner: addMemberIsPartner,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`✅ ${data.message}`);
      setAddMemberLoginId("");
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (lawyerId: string, lawyerName: string) => {
    if (!myFirm || !confirm(`${lawyerName} 변호사를 구성원에서 제거하시겠습니까?\n해당 변호사의 소속 사무소명이 초기화됩니다.`)) return;
    try {
      const res = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REMOVE_MEMBER", firmId: myFirm.id, lawyerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMembers((prev) => prev.filter((m) => m.id !== lawyerId));
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const isRepresentative = myFirm?.representative_id === currentUser?.id;

  return (
    <div className="space-y-6">
      {/* 탭 */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveTab("list")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === "list" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
          }`}
        >
          <Building className="w-4 h-4" />
          등록 법인 목록 ({firms.length}개)
        </button>

        {isLawyer && (
          <button
            onClick={() => setActiveTab("my")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "my" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            내 법인 관리
          </button>
        )}

        {isLawyer && !myFirm && (
          <button
            onClick={() => setActiveTab("register")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "register" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <Plus className="w-4 h-4" />
            법인 등록 신청
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab("admin_create")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "admin_create" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <Crown className="w-4 h-4" />
            직권 개설
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "pending" ? "bg-red-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            승인 대기
            {pendingFirms.length > 0 && (
              <span className="px-1.5 bg-red-500 text-white rounded-full text-[10px] animate-pulse">
                {pendingFirms.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── 탭 1: 법인 목록 ── */}
      {activeTab === "list" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="법인명 또는 주소 검색..."
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {filteredFirms.length === 0 ? (
            <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
              등록된 법무법인이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredFirms.map((firm) => {
                const isExpanded = expandedFirmId === firm.id;
                const cachedMembers = firmMembersCache[firm.id];
                return (
                  <div key={firm.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-colors">
                    <div className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded font-semibold">
                              {FIRM_TYPES[firm.type] || firm.type}
                            </span>
                            {firm.is_notary ? (
                              <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded font-semibold">공증인가</span>
                            ) : null}
                          </div>
                          <h3 className="text-sm font-bold text-white">{firm.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">대표: {firm.rep_name || "미지정"}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded font-bold shrink-0">정상 등록</span>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{firm.address || "도스시"}</span>
                        <span className="font-semibold text-slate-300">
                          {firm.member_count}명 · 파트너 {firm.partner_count || 0}명
                        </span>
                      </div>

                      {/* 구성원 펼치기 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleToggleFirmCard(firm.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {isExpanded ? (
                          <><ChevronUp className="w-3.5 h-3.5" /> 구성원 접기</>
                        ) : (
                          <><ChevronDown className="w-3.5 h-3.5" /> 구성원 보기 ({firm.member_count}명)</>
                        )}
                      </button>
                    </div>

                    {/* 구성원 목록 펼침 영역 */}
                    {isExpanded && (
                      <div className="border-t border-slate-800 bg-slate-950/60 p-4 space-y-2">
                        {loadingMembersId === firm.id ? (
                          <p className="text-xs text-slate-500 text-center py-2">불러오는 중...</p>
                        ) : cachedMembers && cachedMembers.length > 0 ? (
                          cachedMembers.map((m: any) => (
                            <div key={m.id} className="flex items-center gap-2 text-xs">
                              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 font-bold text-[10px] shrink-0">
                                {m.name?.[0]}
                              </span>
                              <span className="font-semibold text-slate-200">{m.name}</span>
                              {m.is_partner ? (
                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded text-[10px]">구성원</span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">소속</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-500 text-center py-2">등록된 구성원이 없습니다.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 탭 2: 내 법인 관리 ── */}
      {activeTab === "my" && isLawyer && (
        <div className="space-y-6">
          {myFirm ? (
            <>
              {/* 법인 기본 정보 */}
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Building className="w-5 h-5 text-amber-400" />
                      {myFirm.name}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {FIRM_TYPES[myFirm.type] || myFirm.type} · 대표: {myFirm.rep_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      myFirm.status === "APPROVED"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                        : myFirm.status === "PENDING"
                        ? "bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {myFirm.status === "APPROVED" ? "정상 등록" : myFirm.status === "PENDING" ? "승인 대기중" : "등록 취소"}
                    </span>
                    {(isRepresentative || isAdmin) && !isEditingFirm && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditFirmName(myFirm.name || "");
                          setEditFirmType(myFirm.type || "FIRM");
                          setEditFirmAddress(myFirm.address || "");
                          setEditFirmContact(myFirm.contact || "");
                          setEditFirmRepLoginId("");
                          setIsEditingFirm(true);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5" /> 정보 수정
                      </button>
                    )}
                  </div>
                </div>

                {/* 정보 수정 폼 */}
                {isEditingFirm ? (
                  <form onSubmit={handleSaveFirmInfo} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block text-slate-400">
                        법인명 *
                        <input
                          type="text"
                          required
                          value={editFirmName}
                          onChange={(e) => setEditFirmName(e.target.value)}
                          className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </label>
                      <label className="block text-slate-400">
                        법인 종류
                        <select
                          value={editFirmType}
                          onChange={(e) => setEditFirmType(e.target.value)}
                          className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                        >
                          {Object.entries(FIRM_TYPES).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-slate-400">
                        주소
                        <input
                          type="text"
                          value={editFirmAddress}
                          onChange={(e) => setEditFirmAddress(e.target.value)}
                          className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </label>
                      <label className="block text-slate-400">
                        연락처
                        <input
                          type="text"
                          value={editFirmContact}
                          onChange={(e) => setEditFirmContact(e.target.value)}
                          className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </label>
                    </div>
                    <label className="block text-slate-400">
                      대표변호사 변경 <span className="text-slate-500 font-normal">(로그인 아이디 입력, 비워두면 유지)</span>
                      <input
                        type="text"
                        value={editFirmRepLoginId}
                        onChange={(e) => setEditFirmRepLoginId(e.target.value)}
                        placeholder="새 대표변호사 아이디"
                        className="mt-1 w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                      />
                    </label>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingFirm(false)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingFirm}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSavingFirm ? "저장중..." : "변경사항 저장"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div><span className="text-slate-500">주소</span><p className="text-slate-200 mt-0.5">{myFirm.address || "미기재"}</p></div>
                    <div><span className="text-slate-500">연락처</span><p className="text-slate-200 mt-0.5">{myFirm.contact || "미기재"}</p></div>
                  </div>
                )}

                {myFirm.status === "APPROVED" && !isEditingFirm && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-amber-400 font-bold">🗳️ 총회 법인회원 산정 의결권: </span>
                      <strong className="text-white text-sm ml-1">{myFirm.voting_power || 0}표</strong>
                      <span className="text-slate-400 ml-2 text-[11px]">
                        (구성원 변호사 {myFirm.partner_count || 0}명 기준 · 2인당 1표, 1인 0표)
                      </span>
                    </div>
                    {(myFirm.voting_power || 0) > 0 ? (
                      <a
                        href="/assembly/proxy"
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs transition-colors"
                      >
                        법인 의결권 위임장 작성 →
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        * 구성원 변호사가 2인 이상 등록되어야 의결권 1표가 발생합니다.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 구성원 목록 */}
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  구성원 변호사 ({members.length}명)
                </h3>

                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{m.name}</span>
                        <span className="text-slate-400">({m.login_id})</span>
                        {m.is_partner ? (
                          <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded text-[10px] font-bold">구성원 변호사</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">소속 변호사</span>
                        )}
                        {myFirm.representative_id === m.id && (
                          <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-bold flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5" /> 대표
                          </span>
                        )}
                      </div>
                      {(isRepresentative || isAdmin) && m.id !== myFirm.representative_id && (
                        <button
                          onClick={() => handleRemoveMember(m.id, m.name)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* 구성원 추가 폼 (대표변호사 또는 관리자) */}
                {(isRepresentative || isAdmin) && (
                  <form onSubmit={handleAddMember} className="pt-3 border-t border-slate-800 space-y-3">
                    <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                      구성원 변호사 추가
                    </h4>
                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                      <input
                        type="text"
                        value={addMemberLoginId}
                        onChange={(e) => setAddMemberLoginId(e.target.value)}
                        placeholder="추가할 변호사 로그인 아이디"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={addMemberIsPartner}
                          onChange={(e) => setAddMemberIsPartner(e.target.checked)}
                          className="rounded text-amber-500"
                        />
                        구성원 변호사
                      </label>
                      <button
                        type="submit"
                        disabled={isAddingMember}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow"
                      >
                        {isAddingMember ? "추가중..." : "추가"}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      추가 시 해당 변호사의 소속 사무소명이 자동으로 법인명으로 업데이트됩니다.
                    </p>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="p-10 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3">
              <Building className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-slate-400 text-sm">소속된 법무법인이 없습니다.</p>
              <button
                onClick={() => setActiveTab("register")}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow"
              >
                법인 등록 신청하기
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 탭 3: 신규 법인 등록 신청 ── */}
      {activeTab === "register" && isLawyer && !myFirm && (
        <form onSubmit={handleCreateFirm} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-5 max-w-xl">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              법무법인 / 법률사무소 등록 신청
            </h2>
            <p className="text-xs text-slate-400 mt-1">관리자 승인 후 공식 등록됩니다. (변호사법 제23조~제40조)</p>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-[11px] leading-relaxed">
            📜 <strong>법인 의결권 안내:</strong> 구성원 변호사(파트너) 2인 이상 등록 시 총회에서 <strong>2명당 1표(1명 0표)</strong>의 법인회원 의결권이 산정됩니다.
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">법인 종류 *</label>
              <select value={newFirmType} onChange={(e) => setNewFirmType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white">
                {Object.entries(FIRM_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">법인명 / 사무소명 *</label>
              <input type="text" required value={newFirmName} onChange={(e) => setNewFirmName(e.target.value)}
                placeholder="예: 법무법인 도스"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">주소</label>
              <input type="text" value={newFirmAddress} onChange={(e) => setNewFirmAddress(e.target.value)}
                placeholder="도스시 법조로 1"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">연락처</label>
              <input type="text" value={newFirmContact} onChange={(e) => setNewFirmContact(e.target.value)}
                placeholder="02-000-0000"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newFirmIsNotary} onChange={(e) => setNewFirmIsNotary(e.target.checked)} className="rounded text-blue-500" />
              <span className="text-slate-300">공증인가 법인</span>
            </label>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button type="submit" disabled={isSubmitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow">
              {isSubmitting ? "신청중..." : "등록 신청 제출"}
            </button>
          </div>
        </form>
      )}

      {/* ── 탭 4: 관리자 직권 개설 ── */}
      {activeTab === "admin_create" && isAdmin && (
        <form onSubmit={handleAdminCreateFirm} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-5 max-w-xl">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-indigo-400" />
              법무법인 직권 개설 (즉시 승인)
            </h2>
            <p className="text-xs text-slate-400 mt-1">관리자가 직접 개설하며 신청 절차 없이 즉시 등록됩니다.</p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">법인 종류 *</label>
              <select value={adminFirmType} onChange={(e) => setAdminFirmType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white">
                {Object.entries(FIRM_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">법인명 / 사무소명 *</label>
              <input type="text" required value={adminFirmName} onChange={(e) => setAdminFirmName(e.target.value)}
                placeholder="예: 법무법인 도스"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">주소</label>
              <input type="text" value={adminFirmAddress} onChange={(e) => setAdminFirmAddress(e.target.value)}
                placeholder="도스시 법조로 1"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">연락처</label>
              <input type="text" value={adminFirmContact} onChange={(e) => setAdminFirmContact(e.target.value)}
                placeholder="02-000-0000"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">
                대표변호사 <span className="text-slate-500 font-normal">(로그인 아이디, 선택)</span>
              </label>
              <input type="text" value={adminFirmRepLoginId} onChange={(e) => setAdminFirmRepLoginId(e.target.value)}
                placeholder="대표변호사 로그인 아이디"
                className="w-full bg-slate-950 border border-amber-500/40 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-amber-500 placeholder:text-slate-600" />
              <p className="text-[11px] text-slate-500 mt-1">입력 시 해당 변호사가 구성원(파트너)으로 자동 등록되고 소속 사무소명이 동기화됩니다.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={adminFirmIsNotary} onChange={(e) => setAdminFirmIsNotary(e.target.checked)} className="rounded text-blue-500" />
              <span className="text-slate-300">공증인가 법인</span>
            </label>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button type="submit" disabled={isAdminCreating}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" />
              {isAdminCreating ? "개설중..." : "직권 개설 (즉시 등록)"}
            </button>
          </div>
        </form>
      )}

      {/* ── 탭 5: 관리자 승인 대기 ── */}
      {activeTab === "pending" && isAdmin && (
        <div className="space-y-4">
          {pendingFirms.length === 0 ? (
            <div className="p-10 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400">
              승인 대기 중인 법인 신청이 없습니다.
            </div>
          ) : (
            pendingFirms.map((firm) => (
              <div key={firm.id} className="p-5 bg-slate-950 border border-amber-500/20 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded font-semibold">
                        {FIRM_TYPES[firm.type] || firm.type}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded animate-pulse font-bold">
                        승인 대기
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">{firm.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">신청인: {firm.rep_name} · {firm.address || "주소 미기재"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleApproveFirm(firm.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 승인
                    </button>
                    <button onClick={() => handleRejectFirm(firm.id)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> 반려
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

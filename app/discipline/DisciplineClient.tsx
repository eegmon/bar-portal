"use client";

import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Calendar,
  Plus,
  XCircle,
  Gavel,
  Search,
  Send,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { SessionUser } from "@/lib/types";

interface DisciplineItem {
  id: string;
  lawyer_id: string;
  lawyer_name?: string;
  office_name?: string;
  petitioner_type: string;
  type: string;
  reason: string;
  duration_months: number;
  fine_amount: number;
  is_published: number;
  status: string;
  ruled_at: string;
}

interface LawyerOption {
  id: string;
  name: string;
  office_name?: string;
}

interface DisciplineClientProps {
  currentUser: SessionUser | null;
  canManage: boolean;
  initialDisciplines: DisciplineItem[];
  lawyerList: LawyerOption[];
}

export default function DisciplineClient({
  currentUser,
  canManage,
  initialDisciplines,
  lawyerList,
}: DisciplineClientProps) {
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>(initialDisciplines);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");

  // 신규 징계 등록 모달
  const [showModal, setShowModal] = useState(false);
  const [targetLawyerId, setTargetLawyerId] = useState(lawyerList[0]?.id || "");
  const [petitionerType, setPetitionerType] = useState("협회장 청구");
  const [disciplineType, setDisciplineType] = useState("SUSPENSION");
  const [reason, setReason] = useState("");
  const [durationMonths, setDurationMonths] = useState(1);
  const [fineAmount, setFineAmount] = useState(5000000);
  const [isPublished, setIsPublished] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 필터링된 징계 목록
  const filteredDisciplines = disciplines.filter((d) => {
    // 비관리자는 공시된 항목(is_published === 1)만 열람
    if (!canManage && !d.is_published) return false;

    const matchSearch =
      (d.lawyer_name && d.lawyer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.office_name && d.office_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.reason && d.reason.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchType = filterType === "ALL" || d.type === filterType;
    return matchSearch && matchType;
  });

  const getDisciplineBadge = (type: string) => {
    switch (type) {
      case "PERMANENT_EXPULSION":
        return { label: "영구제명", color: "bg-red-500/20 text-red-400 border-red-500/30" };
      case "EXPULSION":
        return { label: "제명", color: "bg-red-500/20 text-red-400 border-red-500/30" };
      case "SUSPENSION":
        return { label: "정직", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
      case "FINE":
        return { label: "과태료", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
      default:
        return { label: "견책", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
    }
  };

  // 징계 등록 제출
  const handleCreateDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLawyerId || !reason.trim()) {
      alert("피징계 변호사와 처분 사유를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/discipline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_DISCIPLINE",
          lawyerId: targetLawyerId,
          petitionerType,
          type: disciplineType,
          reason,
          durationMonths: disciplineType === "SUSPENSION" ? durationMonths : 0,
          fineAmount: disciplineType === "FINE" ? fineAmount : 0,
          isPublished,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "징계 등록 실패");

      alert("⚖️ 변호사 징계처분이 정상적으로 의결 및 공시되었습니다!");
      setShowModal(false);
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 징계 처분 상태 변경 (철회/복권)
  const handleUpdateStatus = async (disciplineId: string, newStatus: string) => {
    const confirmMsg =
      newStatus === "REVOKED"
        ? "본 징계처분을 철회하고 해당 변호사를 정상 자격으로 복권하시겠습니까?"
        : "본 징계처분의 집행을 완료 처리하시겠습니까?";

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/discipline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_STATUS",
          disciplineId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "상태 변경 실패");

      alert(data.message || "상태가 변경되었습니다.");
      setDisciplines((prev) =>
        prev.map((d) => (d.id === disciplineId ? { ...d, status: newStatus } : d))
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  // 공시 여부 토글
  const handleTogglePublish = async (disciplineId: string, currentVal: number) => {
    const newVal = currentVal ? 0 : 1;
    try {
      const res = await fetch("/api/discipline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TOGGLE_PUBLISH",
          disciplineId,
          isPublished: Boolean(newVal),
        }),
      });
      if (!res.ok) throw new Error("공시 상태 변경 실패");

      setDisciplines((prev) =>
        prev.map((d) => (d.id === disciplineId ? { ...d, is_published: newVal } : d))
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* 관리자 툴바 & 필터 바 */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="변호사명, 법률사무소, 처분 사유 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
          >
            <option value="ALL">모든 징계 유형</option>
            <option value="PERMANENT_EXPULSION">영구제명</option>
            <option value="EXPULSION">제명</option>
            <option value="SUSPENSION">정직 (업무정지)</option>
            <option value="FINE">과태료</option>
            <option value="REPRIMAND">견책</option>
          </select>
        </div>

        {/* 징계위원회 위원 / 협회장 / 검찰총장 전용 버튼 */}
        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
          >
            <Gavel className="w-4 h-4" />
            신규 징계처분 심의 및 등록·공시
          </button>
        )}
      </div>

      {/* 징계 공시 카드 목록 */}
      {filteredDisciplines.length === 0 ? (
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full mx-auto flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">현재 공시 중인 징계 처분이 없습니다.</h3>
          <p className="text-xs text-slate-400">
            도스변호사협회 소속 회원들은 높은 직업윤리와 품위유지의무를 준수하고 있습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisciplines.map((d) => {
            const badge = getDisciplineBadge(d.type);
            const isRevoked = d.status === "REVOKED";
            const isCompleted = d.status === "COMPLETED";

            return (
              <div
                key={d.id}
                className={`p-6 bg-slate-900 border rounded-2xl shadow-lg space-y-4 transition-colors ${
                  isRevoked
                    ? "border-slate-800/60 opacity-60"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded border ${badge.color}`}>
                      {badge.label}
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {d.lawyer_name || "소속 변호사"}
                      <span className="text-xs font-normal text-slate-400 ml-2">
                        ({d.office_name || "개인개업"})
                      </span>
                    </h3>

                    {/* 상태 배지 */}
                    {isRevoked ? (
                      <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
                        처분 철회됨 (복권)
                      </span>
                    ) : isCompleted ? (
                      <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded">
                        집행 완료
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded font-bold animate-pulse">
                        처분 집행중
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      처분일: {d.ruled_at?.split(" ")[0] || d.ruled_at}
                    </span>
                  </div>
                </div>

                {/* 세부 내용 */}
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-slate-500">청구 주체:</span>{" "}
                      <strong className="text-slate-200">{d.petitioner_type}</strong>
                    </div>
                    {d.duration_months > 0 && (
                      <div>
                        <span className="text-slate-500">업무정지 기간:</span>{" "}
                        <strong className="text-amber-400">{d.duration_months}개월</strong>
                      </div>
                    )}
                    {d.fine_amount > 0 && (
                      <div>
                        <span className="text-slate-500">과태료:</span>{" "}
                        <strong className="text-yellow-400">{d.fine_amount.toLocaleString()}원</strong>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">근거 법령:</span>{" "}
                      <span className="text-slate-400">변호사법 제5장 및 회칙 제36조</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <strong className="text-slate-400 block mb-1">처분 사유 및 결정 요지:</strong>
                    <p className="text-slate-200 whitespace-pre-wrap">{d.reason}</p>
                  </div>
                </div>

                {/* 관리자 제어 툴바 */}
                {canManage && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePublish(d.id, d.is_published)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1"
                      >
                        {d.is_published ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-emerald-400" /> 공시 활성중
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-slate-500" /> 비공시
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isRevoked && (
                        <button
                          onClick={() => handleUpdateStatus(d.id, "REVOKED")}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-red-400 rounded border border-slate-700 flex items-center gap-1 font-semibold"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> 처분 철회 및 복권
                        </button>
                      )}
                      {!isCompleted && !isRevoked && (
                        <button
                          onClick={() => handleUpdateStatus(d.id, "COMPLETED")}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow flex items-center gap-1"
                        >
                          집행 완료 처리
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 신규 징계 처분 심의 및 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateDiscipline}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gavel className="w-5 h-5 text-red-500" />
                변호사징계위원회 징계처분 의결 및 공시 등록
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">피징계 변호사 선택 *</label>
                <select
                  value={targetLawyerId}
                  onChange={(e) => setTargetLawyerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {lawyerList.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} 변호사 ({l.office_name || "개인개업"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">청구 주체</label>
                  <select
                    value={petitionerType}
                    onChange={(e) => setPetitionerType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="협회장 청구">협회장 청구 (변호사법 제53조)</option>
                    <option value="검찰총장 지시">검찰총장 지시 (변호사법 제54조)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">징계 종류 *</label>
                  <select
                    value={disciplineType}
                    onChange={(e) => setDisciplineType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                  >
                    <option value="SUSPENSION">정직 (업무정지)</option>
                    <option value="EXPULSION">제명 (변협 퇴출)</option>
                    <option value="PERMANENT_EXPULSION">영구제명 (자격 박탈)</option>
                    <option value="FINE">과태료 처분</option>
                    <option value="REPRIMAND">견책</option>
                  </select>
                </div>
              </div>

              {disciplineType === "SUSPENSION" && (
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">정직 기간 (개월)</label>
                  <input
                    type="number"
                    min={1}
                    max={36}
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              )}

              {disciplineType === "FINE" && (
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">과태료 금액 (원)</label>
                  <input
                    type="number"
                    step={1000000}
                    value={fineAmount}
                    onChange={(e) => setFineAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">처분 사유 및 결정 요지 *</label>
                <textarea
                  rows={4}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 변호사법 제24조 품위유지의무 위반 및 의뢰인과의 이익상반 사건 수임 금지 위반"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white leading-relaxed focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="rounded border-slate-700 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-slate-300 font-semibold">
                    디스코드 징계 공시 채널(`DISCIPLINE`) 및 포털에 즉시 공개
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-700"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg shadow-md transition-colors"
              >
                {isSubmitting ? "의결 처리중..." : "징계 처분 확정 및 공시"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

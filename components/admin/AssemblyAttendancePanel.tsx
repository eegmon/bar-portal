"use client";

import {
  AlertTriangle,
  ArrowUp,
  ExternalLink,
  Link2,
  Plus,
  Search,
  UserCheck,
} from "lucide-react";
import UserSearchCombobox from "@/components/UserSearchCombobox";

interface AssemblyAttendancePanelProps {
  selectedAssembly: any;
  selectedAssemblyId: string;
  absentMemberCount: number;
  isExpiringAbsentMembers: boolean;
  onExpireAbsentMembers: (assembly: any, absentCount: number) => void;
  users: any[];
  assemblies: any[];
  attendances: any[];
  attendanceSearch: string;
  onAttendanceSearchChange: (value: string) => void;
  offlineAttendeeId: string;
  onOfflineAttendeeChange: (value: string) => void;
  isAddingAttendance: boolean;
  onAddOfflineAttendance: () => void;
  adminProxyGrantorId: string;
  onAdminProxyGrantorChange: (value: string) => void;
  adminProxyToId: string;
  onAdminProxyToChange: (value: string) => void;
  isSettingAdminProxy: boolean;
  onSetAdminProxy: () => void;
  approvingReregistrationId: string | null;
  onApproveReregistration: (attendance: any) => void;
  onAttendanceDecision: (
    attendanceId: string,
    status: "APPROVED" | "REJECTED",
    attended: boolean,
  ) => void;
  revokingProxyId: string | null;
  onRevokeProxy: (attendanceId: string) => void;
  rightAssemblyId: string;
  onRightAssemblyChange: (value: string) => void;
  rightUserId: string;
  onRightUserChange: (value: string) => void;
  rightPower: number;
  onRightPowerChange: (value: number) => void;
  rightReason: string;
  onRightReasonChange: (value: string) => void;
  onSaveVotingRight: () => void;
  votingRights: any[];
  onRemoveVotingRight: (assemblyId: string, userId: string) => void;
}

export default function AssemblyAttendancePanel({
  selectedAssembly,
  selectedAssemblyId,
  absentMemberCount,
  isExpiringAbsentMembers,
  onExpireAbsentMembers,
  users,
  assemblies,
  attendances,
  attendanceSearch,
  onAttendanceSearchChange,
  offlineAttendeeId,
  onOfflineAttendeeChange,
  isAddingAttendance,
  onAddOfflineAttendance,
  adminProxyGrantorId,
  onAdminProxyGrantorChange,
  adminProxyToId,
  onAdminProxyToChange,
  isSettingAdminProxy,
  onSetAdminProxy,
  approvingReregistrationId,
  onApproveReregistration,
  onAttendanceDecision,
  revokingProxyId,
  onRevokeProxy,
  rightAssemblyId,
  onRightAssemblyChange,
  rightUserId,
  onRightUserChange,
  rightPower,
  onRightPowerChange,
  rightReason,
  onRightReasonChange,
  onSaveVotingRight,
  votingRights,
  onRemoveVotingRight,
}: AssemblyAttendancePanelProps) {
  const activeLawyers = users.filter(
    (user) => user.role === "LAWYER" && user.status === "ACTIVE",
  );
  const filteredVotingRights = votingRights.filter(
    (right) => !rightAssemblyId || right.assembly_id === rightAssemblyId,
  );

  return (
    <div className="space-y-4">
      {selectedAssembly && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-red-950/20 border border-red-800/40 rounded-xl">
          <div className="space-y-1">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              총회 불출석자 자격 만료
            </div>
            <p className="text-[11px] text-slate-400">
              총회 당시 등록된 회원 중 승인된 출석·위임 및 처리 대기 신청을
              제외한 {absentMemberCount}명
            </p>
          </div>
          <button
            onClick={() =>
              onExpireAbsentMembers(selectedAssembly, absentMemberCount)
            }
            disabled={
              selectedAssembly.status !== "CLOSED" ||
              absentMemberCount === 0 ||
              isExpiringAbsentMembers
            }
            title={
              selectedAssembly.status !== "CLOSED"
                ? "총회 폐회 후 처리할 수 있습니다."
                : undefined
            }
            className="px-3 py-2 bg-red-700 hover:bg-red-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-lg transition-colors"
          >
            {isExpiringAbsentMembers
              ? "처리 중..."
              : selectedAssembly.status !== "CLOSED"
                ? "폐회 후 처리 가능"
                : `자격 만료 처리 (${absentMemberCount}명)`}
          </button>
        </div>
      )}

      {selectedAssemblyId && (
        <div className="p-4 bg-slate-950 border border-emerald-800/40 rounded-xl space-y-2">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            현장(오프라인) 참석자 수동 출석 등록
          </div>
          <p className="text-[11px] text-slate-500">
            온라인 신청을 하지 않았지만 현장에 나온 회원을 의장이 직접 출석
            처리합니다.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[200px]">
              <UserSearchCombobox
                users={activeLawyers}
                value={offlineAttendeeId}
                onChange={onOfflineAttendeeChange}
                placeholder="이름 또는 아이디로 검색..."
              />
            </div>
            <button
              onClick={onAddOfflineAttendance}
              disabled={!offlineAttendeeId || isAddingAttendance}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAddingAttendance ? "등록 중..." : "현장 출석 등록"}
            </button>
          </div>
        </div>
      )}

      {selectedAssemblyId && (
        <div className="p-4 bg-slate-950 border border-blue-800/40 rounded-xl space-y-2">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-blue-400" />
            관리자 직권 위임 처리
          </div>
          <p className="text-[11px] text-slate-500">
            의장이 특정 회원의 의결권을 다른 변호사에게 강제 위임합니다. 기존
            출석/위임 기록은 자동 무효화됩니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">
                위임인 (의결권 보유자)
              </label>
              <UserSearchCombobox
                users={activeLawyers}
                value={adminProxyGrantorId}
                onChange={onAdminProxyGrantorChange}
                placeholder="위임인 검색..."
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">
                수임인 (의결권 행사자)
              </label>
              <UserSearchCombobox
                users={activeLawyers.filter(
                  (user) => user.id !== adminProxyGrantorId,
                )}
                value={adminProxyToId}
                onChange={onAdminProxyToChange}
                placeholder="수임인 검색..."
              />
            </div>
          </div>
          <button
            onClick={onSetAdminProxy}
            disabled={
              !adminProxyGrantorId || !adminProxyToId || isSettingAdminProxy
            }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow flex items-center gap-1.5"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            {isSettingAdminProxy ? "처리 중..." : "직권 위임 처리"}
          </button>
        </div>
      )}

      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-300">
          <span>출석·위임 신청 현황 ({attendances.length}건)</span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={attendanceSearch}
                onChange={(e) => onAttendanceSearchChange(e.target.value)}
                placeholder="이름 검색..."
                className="pl-7 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-36"
              />
            </div>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-bold">
              대기{" "}
              {
                attendances.filter((item) => item.approval_status === "PENDING")
                  .length
              }
              건
            </span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold">
              승인{" "}
              {
                attendances.filter(
                  (item) => item.approval_status === "APPROVED",
                ).length
              }
              건
            </span>
          </div>
        </div>
        {attendances.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            접수된 출석 또는 위임 신청이 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {attendances
              .filter(
                (item) =>
                  !attendanceSearch.trim() ||
                  (item.grantor_name &&
                    item.grantor_name
                      .toLowerCase()
                      .includes(attendanceSearch.toLowerCase())) ||
                  (item.proxy_name &&
                    item.proxy_name
                      .toLowerCase()
                      .includes(attendanceSearch.toLowerCase())),
              )
              .map((item) => {
                const member = users.find((user) => user.id === item.user_id);
                const isReregistration =
                  Number(item.is_proxy) !== 1 &&
                  Number(item.attended) !== 1 &&
                  (((item.approval_status === "PENDING" ||
                    item.approval_status === "REJECTED") &&
                    ["EXPIRED", "SUSPENDED"].includes(
                      String(member?.status),
                    )) ||
                    (item.approval_status === "APPROVED" &&
                      member?.status === "ACTIVE"));

                return (
                  <div
                    key={item.id}
                    className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border text-xs transition-colors ${
                      item.approval_status === "PENDING"
                        ? "bg-amber-500/5 border-amber-500/20"
                        : item.approval_status === "REJECTED"
                          ? "bg-red-950/20 border-red-800/30 opacity-60"
                          : "bg-slate-900 border-slate-800"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-white">
                          {item.grantor_name || "회원"}
                        </strong>
                        {item.is_proxy ? (
                          <>
                            <span className="text-slate-400">
                              → {item.proxy_name || "수임인"}
                            </span>
                            {item.firm_id ? (
                              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-bold">
                                🏢 법인 ({item.voting_power || 1}표)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded text-[10px]">
                                개인위임
                              </span>
                            )}
                            {item.evidence_url && (
                              <a
                                href={item.evidence_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-400 hover:text-indigo-300 underline text-[11px] flex items-center gap-0.5"
                              >
                                <ExternalLink className="w-3 h-3" /> 증빙
                              </a>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">
                            {isReregistration ? "재등록 신청" : "직접 출석"}
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-[10px] font-bold ${
                          item.approval_status === "PENDING"
                            ? "text-amber-400"
                            : item.approval_status === "APPROVED"
                              ? "text-emerald-400"
                              : "text-red-400"
                        }`}
                      >
                        {item.approval_status === "PENDING"
                          ? "⏳ 승인 대기"
                          : item.approval_status === "APPROVED"
                            ? isReregistration
                              ? "✅ 재등록 수리됨"
                              : item.attended
                                ? "✅ 출석 확인됨"
                                : "✅ 위임 승인됨"
                            : "❌ 반려됨"}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {item.approval_status !== "APPROVED" &&
                        (isReregistration ? (
                          <button
                            onClick={() => onApproveReregistration(item)}
                            disabled={approvingReregistrationId === item.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
                          >
                            {approvingReregistrationId === item.id
                              ? "수리 중..."
                              : "재등록 신청 수리"}
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              onAttendanceDecision(
                                item.id,
                                "APPROVED",
                                item.is_proxy !== 1,
                              )
                            }
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                          >
                            {item.is_proxy === 1 ? "위임 승인" : "승인·출석"}
                          </button>
                        ))}
                      {item.approval_status !== "REJECTED" && (
                        <button
                          onClick={() =>
                            onAttendanceDecision(item.id, "REJECTED", false)
                          }
                          className="px-3 py-1.5 bg-red-900/60 hover:bg-red-900/80 text-red-300 rounded-lg text-xs font-bold"
                        >
                          반려
                        </button>
                      )}
                      {item.is_proxy === 1 &&
                        item.approval_status !== "REJECTED" && (
                          <button
                            onClick={() => onRevokeProxy(item.id)}
                            disabled={revokingProxyId === item.id}
                            className="px-3 py-1.5 bg-orange-900/60 hover:bg-orange-900/80 text-orange-300 rounded-lg text-xs font-bold disabled:opacity-50"
                          >
                            {revokingProxyId === item.id
                              ? "처리중..."
                              : "위임 회수"}
                          </button>
                        )}
                      {item.approval_status === "APPROVED" &&
                        item.is_proxy !== 1 &&
                        !item.attended && (
                          <button
                            onClick={() =>
                              onAttendanceDecision(item.id, "APPROVED", true)
                            }
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
                          >
                            출석 체크
                          </button>
                        )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-950 border border-amber-500/20 rounded-xl space-y-3">
        <div className="text-xs font-bold text-white">
          총회별 수동 의결권 설정
        </div>
        <p className="text-[11px] text-slate-500">
          설정하지 않은 회원은 기본 1표입니다. 승인된 위임표는 별도로
          추가됩니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select
            value={rightAssemblyId}
            onChange={(e) => onRightAssemblyChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white"
          >
            <option value="">총회 선택</option>
            {assemblies.map((assembly) => (
              <option key={assembly.id} value={assembly.id}>
                {assembly.title}
              </option>
            ))}
          </select>
          <UserSearchCombobox
            users={activeLawyers}
            value={rightUserId}
            onChange={onRightUserChange}
            placeholder="회원 검색..."
            className="bg-slate-900"
          />
          <input
            type="number"
            min={0}
            value={rightPower}
            onChange={(e) => onRightPowerChange(Number(e.target.value))}
            placeholder="의결권 수"
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white"
          />
          <input
            type="text"
            value={rightReason}
            onChange={(e) => onRightReasonChange(e.target.value)}
            placeholder="설정 사유"
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white"
          />
        </div>
        <button
          onClick={onSaveVotingRight}
          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold"
        >
          의결권 저장
        </button>
        {filteredVotingRights.length > 0 && (
          <div className="space-y-1 border-t border-slate-800 pt-2">
            {filteredVotingRights.map((right) => (
              <div
                key={`${right.assembly_id}-${right.user_id}`}
                className="flex justify-between items-center text-xs text-slate-300 p-2 bg-slate-900 rounded-lg"
              >
                <span>
                  <span className="text-slate-500 text-[10px] mr-1">
                    {assemblies.find(
                      (assembly) => assembly.id === right.assembly_id,
                    )?.title || right.assembly_id}
                  </span>
                  {right.user_name || right.user_id}
                </span>
                <span className="flex items-center gap-2">
                  <strong className="text-amber-400 font-mono">
                    {right.voting_power}표
                  </strong>
                  <span className="text-slate-500 text-[10px]">
                    {right.reason}
                  </span>
                  <button
                    onClick={() =>
                      onRemoveVotingRight(right.assembly_id, right.user_id)
                    }
                    className="text-red-400 hover:text-red-300 text-[10px]"
                  >
                    삭제
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

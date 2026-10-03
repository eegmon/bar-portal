"use client";

import {
  AlertTriangle,
  Building,
  CheckCircle2,
  ExternalLink,
  Scale,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { formatDbUtcAsKst } from "@/lib/kst";

interface AdminFirmGovernancePanelProps {
  firms: any[];
  pendingFirms: any[];
  firmSearchQuery: string;
  onFirmSearchChange: (value: string) => void;
  isProcessingFirm: boolean;
  onApproveFirm: (firmId: string) => void;
  onRejectFirm: (firmId: string) => void;
}

export default function AdminFirmGovernancePanel({
  firms,
  pendingFirms,
  firmSearchQuery,
  onFirmSearchChange,
  isProcessingFirm,
  onApproveFirm,
  onRejectFirm,
}: AdminFirmGovernancePanelProps) {
  const normalizedQuery = firmSearchQuery.toLowerCase();
  const filteredFirms = firms.filter(
    (firm) =>
      firm.name.toLowerCase().includes(normalizedQuery) ||
      (firm.address || "").toLowerCase().includes(normalizedQuery) ||
      (firm.rep_name || "").toLowerCase().includes(normalizedQuery),
  );
  const totalVotingPower = firms.reduce(
    (total, firm) => total + (firm.voting_power || 0),
    0,
  );

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-amber-400" />
            법무법인 및 합동법률사무소 관리 (총회 의결권)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            등록 신청된 법무법인을 심사·승인하고, 회칙에 의거한{" "}
            <strong>구성원 변호사 2명당 1표(1명 0표)</strong> 의결권 산정 현황을
            총괄 관리합니다.
          </p>
        </div>

        <Link
          href="/firms"
          target="_blank"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          법인 포털 페이지 바로가기
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <div className="text-xs font-semibold text-slate-400">
            정상 등록 법인
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">
            {firms.length}개소
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            관리자 정식 승인 완료
          </div>
        </div>

        <div className="p-4 bg-slate-950 border border-amber-500/20 rounded-xl">
          <div className="text-xs font-semibold text-amber-400">
            법인회원 총 의결권 산출 합계
          </div>
          <div className="text-2xl font-extrabold text-amber-300 mt-1">
            {totalVotingPower}표
          </div>
          <div className="text-[11px] text-amber-400/70 mt-0.5">
            구성원 변호사 2인당 1표 기준 (1인 0표)
          </div>
        </div>

        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <div className="text-xs font-semibold text-slate-400">
            승인 심사 대기
          </div>
          <div className="text-2xl font-extrabold text-rose-400 mt-1">
            {pendingFirms.length}건
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            신규 등록 신청 접수분
          </div>
        </div>
      </div>

      {pendingFirms.length > 0 && (
        <div className="p-5 bg-amber-500/5 border border-amber-500/30 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            신규 법무법인 등록 승인 대기 목록 ({pendingFirms.length}건)
          </h3>
          <div className="space-y-3">
            {pendingFirms.map((firm) => (
              <div
                key={firm.id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-bold">
                      {firm.type}
                    </span>
                    {firm.is_notary ? (
                      <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded font-bold">
                        공증인가
                      </span>
                    ) : null}
                    <span className="text-[10px] text-slate-500">
                      신청일:{" "}
                      {firm.created_at
                        ? formatDbUtcAsKst(firm.created_at).slice(0, 10)
                        : "-"}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">
                    {firm.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    대표:{" "}
                    <strong className="text-slate-200">
                      {firm.rep_name || "미지정"}
                    </strong>{" "}
                    ({firm.rep_login_id || ""}) · 주소:{" "}
                    {firm.address || "미기재"} · 연락처:{" "}
                    {firm.contact || "미기재"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessingFirm}
                    onClick={() => onApproveFirm(firm.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" /> 승인
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingFirm}
                    onClick={() => onRejectFirm(firm.id)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> 반려
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-400" />
            등록 법무법인 명부 및 의결권 현황
          </h3>

          <div className="flex items-center gap-2 w-full sm:w-64 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="법인명 또는 주소 검색..."
              value={firmSearchQuery}
              onChange={(event) => onFirmSearchChange(event.target.value)}
              className="bg-transparent border-none outline-none w-full text-xs placeholder-slate-500"
            />
          </div>
        </div>

        {filteredFirms.length === 0 ? (
          <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
            등록된 법무법인이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-3">법인명 / 구분</th>
                  <th className="p-3">대표변호사</th>
                  <th className="p-3">소재지 / 연락처</th>
                  <th className="p-3 text-center">총 소속인원</th>
                  <th className="p-3 text-center">구성원(파트너) 수</th>
                  <th className="p-3 text-center">총회 의결권</th>
                  <th className="p-3 text-right">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                {filteredFirms.map((firm) => (
                  <tr
                    key={firm.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {firm.name}
                        {firm.is_notary ? (
                          <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-[10px]">
                            공증
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {firm.type}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-200">
                        {firm.rep_name || "미지정"}
                      </span>
                      {firm.rep_login_id && (
                        <span className="text-[10px] text-slate-500 block">
                          ({firm.rep_login_id})
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="text-slate-300 truncate max-w-xs">
                        {firm.address || "미기재"}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {firm.contact || "-"}
                      </div>
                    </td>
                    <td className="p-3 text-center font-medium">
                      {firm.member_count || 0}명
                    </td>
                    <td className="p-3 text-center font-bold text-amber-300">
                      {firm.partner_count || 0}명
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${(firm.voting_power || 0) > 0 ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-slate-800 text-slate-500 border-slate-700"}`}
                      >
                        {firm.voting_power || 0}표
                      </span>
                      {(firm.partner_count || 0) === 1 && (
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          (1인: 0표)
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                        정상 등록
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-400">
        <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
          <Scale className="w-4 h-4" />
          회칙 제14조 법인회원 의결권 규정 안내
        </h4>
        <p>
          • <strong>의결권 산정:</strong> 등록된{" "}
          <strong>구성원 변호사(파트너) 2명당 1표</strong>가 부여됩니다. 구성원
          변호사가 1명인 법인은 의결권이 0표입니다.
        </p>
        <p>
          • <strong>소속 변호사(Associate):</strong> 고용된 소속 변호사는 법인
          의결권 모수에 포함되지 않으며, 변호사 개인회원으로서의 1표를 별도로
          행사합니다.
        </p>
        <p>
          • <strong>의결권 행사:</strong> 법인회원의 의결권은{" "}
          <strong>구성원 회의(만장일치 결의)</strong>를 거쳐 의장에게 서면
          통지하거나, 개인회원(대표변호사 본인 또는 수임 변호사)에게 위임하여
          행사합니다.
        </p>
      </div>
    </div>
  );
}

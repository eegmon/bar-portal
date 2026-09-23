"use client";

import { useState } from "react";
import { Scale, FileCheck, Clock, Calendar, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface PortalClientProps {
  lawyerProfile: any;
}

export default function PortalClient({ lawyerProfile }: PortalClientProps) {
  const [caseTitle, setCaseTitle] = useState("2026가합1024 손해배상(기)");
  const [clientName, setClientName] = useState("김의뢰");
  const [assignedLawyer, setAssignedLawyer] = useState(`${lawyerProfile?.name || "이도스"} 변호사`);

  const handleIssueNotice = () => {
    alert(`[변호사법 제31조] 담당변호사 지정 통지서가 전자 발급되었습니다.\n• 사건: ${caseTitle}\n• 의뢰인: ${clientName}\n• 지정 변호사: ${assignedLawyer}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 좌측 1열: 변호사 프로필 카드 */}
      <div className="space-y-6">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl flex items-center justify-center text-slate-950 font-bold text-xl shadow-md">
              {lawyerProfile?.name?.[0] || "변"}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {lawyerProfile?.name}
                <span className="text-[11px] px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                  {lawyerProfile?.is_trainee ? "견습변호사" : "정회원 변호사"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">{lawyerProfile?.office_name || "소속 법률사무소 미지정"}</p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">자격 등록 상태</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {lawyerProfile?.status === "ACTIVE" ? "정상 개업 (ACTIVE)" : lawyerProfile?.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">최근 갱신일</span>
              <span className="text-slate-300 font-mono">{lawyerProfile?.last_renewed_at || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">소재지</span>
              <span className="text-slate-300">{lawyerProfile?.office_address || "도스시"}</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/assembly/proxy"
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              정기총회 불참 시 재등록신청서 작성
            </Link>
          </div>
        </div>
      </div>

      {/* 우측 2열: 변호사법 기반 핵심 업무 도구 */}
      <div className="lg:col-span-2 space-y-6">
        {/* 1. 월별 자격 유지 상태 알림 배너 */}
        <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-2xl shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              변호사법 제6조제4항 · 월별 자격 유지 규정
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              당월 자격 유지중
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            변호사는 매월 첫째 주 일요일 <strong>정기총회에 참석</strong>하거나 <strong>재등록신청서(의결권 위임 권장)</strong>를 작성하여 제출하여야 자격이 유지됩니다.
          </p>
        </div>

        {/* 2. 사건 수임 및 담당변호사 지정서 발급 (변호사법 제31조) */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-400" />
                담당변호사 지정 통지서 발급 (법 제31조)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                법무법인 또는 2인 이상 합동사무소의 사건 수임 시 의뢰인에게 교부할 전자 통지서
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">사건명 / 사건번호</label>
                <input
                  type="text"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">의뢰인 성명</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">지정 담당변호사</label>
              <input
                type="text"
                value={assignedLawyer}
                onChange={(e) => setAssignedLawyer(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleIssueNotice}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow transition-colors"
              >
                지정 통지서 전자 발급
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  Vote,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Send,
  Scale,
  UserCheck,
} from "lucide-react";
import Link from "next/link";

interface LawyerOption {
  id: string;
  name: string;
  office_name?: string;
}

export default function ProxyPage() {
  const [activeTab, setActiveTab] = useState<"reregister" | "proxy">(
    "reregister",
  );

  // 자격 재등록 신청서 폼 상태
  const [reLawyerName, setReLawyerName] = useState("");
  const [reAffiliation, setReAffiliation] = useState("");
  const [reReason, setReReason] = useState("");
  const [reSignature, setReSignature] = useState("");

  // 의결권 위임장 폼 상태
  const [proxyLawyerName, setProxyLawyerName] = useState("");
  const [proxyLawyerId, setProxyLawyerId] = useState("");
  const [proxyReason, setProxyReason] = useState("");
  const [proxySignature, setProxySignature] = useState("");
  const [proxyEvidenceUrl, setProxyEvidenceUrl] = useState("");

  const [lawyerList, setLawyerList] = useState<LawyerOption[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    type: "reregister" | "proxy";
    name: string;
    proxyName?: string;
  } | null>(null);

  // 등록된 변호사 목록 로드
  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          const activeLawyers = data.users
            .filter((u: any) => u.role === "LAWYER" && u.status === "ACTIVE")
            .map((u: any) => ({
              id: u.id,
              name: u.name,
              office_name: u.office_name,
            }));
          if (activeLawyers.length > 0) {
            setLawyerList(activeLawyers);
            setProxyLawyerId(activeLawyers[0].id);
          }
        }
      })
      .catch(() => setLawyerList([]));
  }, []);

  // 재등록 신청서 제출
  const handleReregisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reLawyerName.trim() || !reSignature.trim()) {
      alert("신청인 성명과 전자 서명을 모두 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/assembly/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "REREGISTER",
          assemblyId: "assembly-2026-09",
          lawyerName: reLawyerName,
          affiliation: reAffiliation,
          reason: reReason,
          signature: reSignature,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "재등록 신청 실패");
      setSubmittedData({ type: "reregister", name: reLawyerName });
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 의결권 위임장 제출
  const handleProxySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proxyLawyerName.trim() || !proxySignature.trim()) {
      alert("위임인 성명과 전자 서명을 모두 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selected = lawyerList.find((l) => l.id === proxyLawyerId);
      const targetLawyerLabel = selected
        ? `${selected.name} 변호사 (${selected.office_name || "법률사무소"})`
        : "지정 변호사";

      const res = await fetch("/api/assembly/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PROXY",
          assemblyId: "assembly-2026-09",
          lawyerName: proxyLawyerName,
          reason: proxyReason,
          proxyLawyerId,
          signature: proxySignature,
          evidenceUrl: proxyEvidenceUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "위임장 접수 실패");
      setSubmittedData({
        type: "proxy",
        name: proxyLawyerName,
        proxyName: targetLawyerLabel,
      });
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedData) {
    const isRereg = submittedData.type === "reregister";
    return (
      <div className="max-w-xl mx-auto px-4 py-16 w-full">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-white">
              {isRereg
                ? "정기총회 불참 자격 재등록 완료"
                : "정기총회 의결권 위임장 접수 완료"}
            </h1>
            <p className="text-sm text-slate-400">
              {isRereg
                ? "정기총회 불참 사유서 및 자격 재등록 신청이 정상 접수되어 변호사 자격이 1개월 연장되었습니다."
                : "의결권 위임장이 정상 접수되어 수임 변호사에게 의결권이 합산 위임되었습니다."}
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5 text-left">
            <p>
              • <strong>{isRereg ? "신청인" : "위임인"}:</strong>{" "}
              {submittedData.name} 변호사
            </p>
            {!isRereg && (
              <p>
                • <strong>수임 대리인:</strong> {submittedData.proxyName}
              </p>
            )}
            <p>
              • <strong>자격 상태:</strong> ✅ 정상 유지 (ACTIVE · 1개월 갱신)
            </p>
            <p>
              • <strong>처리 근거:</strong> 변호사법 제6조제4항 및 회칙 제14조
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
            <button
              onClick={() => setSubmittedData(null)}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors"
            >
              추가 신청서 작성
            </button>
            <Link
              href="/assembly"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-md transition-colors"
            >
              총회 허브로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
      <div>
        <Link
          href="/assembly"
          className="text-slate-400 hover:text-white text-xs flex items-center gap-1 mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 총회 허브로
        </Link>
        <h1 className="text-2xl font-extrabold text-white">
          총회 불출석 민원 서식
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          총회에 불출석하는 회원은 <strong>자격 재등록 신청서</strong>를
          제출하여 자격을 유지할 수 있으며, 필요 시 동료 회원에게{" "}
          <strong>의결권 위임장</strong>을 별도로 제출할 수 있습니다.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab("reregister")}
          className={`py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === "reregister"
              ? "bg-amber-500 text-slate-950 shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <FileText className="w-4 h-4" />
          [서식1] 자격 재등록 신청서 (불참 필수)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("proxy")}
          className={`py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === "proxy"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Vote className="w-4 h-4" />
          [서식2] 의결권 위임장 (선택/별도 제출)
        </button>
      </div>

      {/* 탭 1: 자격 재등록 신청서 */}
      {activeTab === "reregister" && (
        <form
          onSubmit={handleReregisterSubmit}
          className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-amber-400 border-b border-slate-800 pb-3">
            <Scale className="w-4 h-4" />
            정기총회 불참에 따른 변호사 자격 재등록 신청서
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 leading-relaxed">
            📜 <strong>변호사법 제6조제4항:</strong> 정기총회에 출석하지 아니한
            회원은 본 재등록신청서를 제출하시면 변호사 등록이 유지(1개월
            연장)됩니다. 출석 회원은 제출이 불필요합니다.
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                신청인 성명 *
              </label>
              <input
                type="text"
                required
                value={reLawyerName}
                onChange={(e) => setReLawyerName(e.target.value)}
                placeholder="예: 홍길동"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                소속 법률사무소 / 법무법인 (선택)
              </label>
              <input
                type="text"
                value={reAffiliation}
                onChange={(e) => setReAffiliation(e.target.value)}
                placeholder="예: 법률사무소 도스 / 개인개업"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                총회 불출석 사유 *
              </label>
              <input
                type="text"
                required
                value={reReason}
                onChange={(e) => setReReason(e.target.value)}
                placeholder="예: 재판 기일 출석, 수사기관 입회 등 직무 수행"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                전자 서명 (성명 정자 기재) *
              </label>
              <input
                type="text"
                required
                value={reSignature}
                onChange={(e) => setReSignature(e.target.value)}
                placeholder="본인 성명을 정자로 입력하여 서명하세요"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white font-serif tracking-wider focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                증빙 문서 URL (선택)
              </label>
              <input
                type="url"
                value={proxyEvidenceUrl}
                onChange={(e) => setProxyEvidenceUrl(e.target.value)}
                placeholder="위임장 스캔본 또는 증빙 문서 링크"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting
                ? "신청서 접수 처리중..."
                : "자격 재등록 신청서 단독 제출 (자격 1개월 연장)"}
            </button>
          </div>
        </form>
      )}

      {/* 탭 2: 의결권 위임장 */}
      {activeTab === "proxy" && (
        <form
          onSubmit={handleProxySubmit}
          className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-blue-400 border-b border-slate-800 pb-3">
            <Vote className="w-4 h-4" />
            정기총회 의결권 위임장 (대리 참석 위임)
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-200 leading-relaxed">
            💡 <strong>회칙 제14조제4항:</strong> 총회에 출석할 수 없는 회원은
            특정 회원 변호사에게 의결권을 위임할 수 있습니다. 위임 시 수임
            변호사는 전자투표 시 본인의 표와 위임받은 표를 합산하여 행사합니다.
            (재등록 신청서와 별도로 제출 가능)
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                위임인 (본인 성명) *
              </label>
              <input
                type="text"
                required
                value={proxyLawyerName}
                onChange={(e) => setProxyLawyerName(e.target.value)}
                placeholder="예: 홍길동"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                수임인 (의결권을 위임받을 동료 변호사 선택) *
              </label>
              <select
                value={proxyLawyerId}
                onChange={(e) => setProxyLawyerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {lawyerList.map((lawyer) => (
                  <option key={lawyer.id} value={lawyer.id}>
                    {lawyer.name} 변호사 ({lawyer.office_name || "법률사무소"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                위임 사유 (선택)
              </label>
              <input
                type="text"
                value={proxyReason}
                onChange={(e) => setProxyReason(e.target.value)}
                placeholder="예: 공판 참석으로 인한 출석 불가"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                전자 서명 (성명 정자 기재) *
              </label>
              <input
                type="text"
                required
                value={proxySignature}
                onChange={(e) => setProxySignature(e.target.value)}
                placeholder="위 위임 사실을 확인하며 본인 성명을 입력하세요"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white font-serif tracking-wider focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? "위임장 접수 처리중..." : "의결권 위임장 제출"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

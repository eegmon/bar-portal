"use client";

import { useState, useEffect } from "react";
import {
  Vote,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Send,
  Scale,
  Building,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface LawyerOption {
  id: string;
  name: string;
  office_name?: string;
}

interface AssemblyOption {
  id: string;
  title: string;
  round_number: number;
  status: string;
  held_at: string;
  is_regular: number;
}

interface FirmOption {
  id: string;
  name: string;
  type: string;
  representative_id: string;
  is_partner: number;
  member_count: number;
  partner_count: number;
  voting_power: number;
}

export default function ProxyPage() {
  const [activeTab, setActiveTab] = useState<"reregister" | "proxy">(
    "reregister",
  );

  // 총회 및 로그인 정보 상태
  const [assemblies, setAssemblies] = useState<AssemblyOption[]>([]);
  const [selectedAssemblyId, setSelectedAssemblyId] = useState("");
  const [myFirms, setMyFirms] = useState<FirmOption[]>([]);
  const [lawyerList, setLawyerList] = useState<LawyerOption[]>([]);

  // 자격 재등록 신청서 폼 상태
  const [reLawyerName, setReLawyerName] = useState("");
  const [reAffiliation, setReAffiliation] = useState("");
  const [reReason, setReReason] = useState("");
  const [reSignature, setReSignature] = useState("");

  // 의결권 위임장 폼 상태
  const [delegationTarget, setDelegationTarget] = useState<"PERSONAL" | "FIRM">(
    "PERSONAL",
  );
  const [selectedFirmId, setSelectedFirmId] = useState("");
  const [proxyLawyerName, setProxyLawyerName] = useState("");
  const [proxyLawyerId, setProxyLawyerId] = useState("");
  const [proxyReason, setProxyReason] = useState("");
  const [proxySignature, setProxySignature] = useState("");
  const [proxyEvidenceUrl, setProxyEvidenceUrl] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    type: "reregister" | "proxy" | "firm_proxy";
    name: string;
    proxyName?: string;
    firmName?: string;
    votingPower?: number;
  } | null>(null);

  // 초기 데이터 로드 (/api/assembly/proxy)
  useEffect(() => {
    fetch("/api/assembly/proxy")
      .then((res) => res.json())
      .then((data) => {
        if (data.assemblies && Array.isArray(data.assemblies)) {
          setAssemblies(data.assemblies);
          if (data.assemblies.length > 0) {
            setSelectedAssemblyId(data.assemblies[0].id);
          }
        }
        if (data.lawyers && Array.isArray(data.lawyers)) {
          setLawyerList(data.lawyers);
          if (data.lawyers.length > 0) {
            setProxyLawyerId(data.lawyers[0].id);
          }
        }
        if (data.myFirms && Array.isArray(data.myFirms)) {
          setMyFirms(data.myFirms);
          if (data.myFirms.length > 0) {
            setSelectedFirmId(data.myFirms[0].id);
          }
        }
        if (data.user) {
          if (!reLawyerName) setReLawyerName(data.user.name || "");
          if (!proxyLawyerName) setProxyLawyerName(data.user.name || "");
        }
      })
      .catch((err) => console.error("위임장 초기 데이터 로드 실패:", err));
  }, [proxyLawyerName, reLawyerName]);

  // 선택된 법인 정보
  const currentFirm = myFirms.find((f) => f.id === selectedFirmId);

  // 재등록 신청서 제출
  const handleReregisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reLawyerName.trim() || !reSignature.trim()) {
      alert("신청인 성명과 전자 서명을 모두 입력해 주세요.");
      return;
    }
    if (!selectedAssemblyId) {
      alert("총회 일정을 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/assembly/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "REREGISTER",
          assemblyId: selectedAssemblyId,
          lawyerName: reLawyerName.trim(),
          affiliation: reAffiliation.trim(),
          reason: reReason.trim(),
          signature: reSignature.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "재등록 신청 실패");
      setSubmittedData({ type: "reregister", name: reLawyerName.trim() });
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 의결권 위임장 제출 (개인 또는 법인)
  const handleProxySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proxyLawyerName.trim() || !proxySignature.trim()) {
      alert("위임인 성명과 전자 서명을 모두 입력해 주세요.");
      return;
    }
    if (!selectedAssemblyId) {
      alert("대상 총회를 선택해 주세요.");
      return;
    }
    if (!proxyLawyerId) {
      alert("의결권을 위임받을 수임 변호사를 선택해 주세요.");
      return;
    }

    // 법인 위임인 경우 유효성 검사
    if (delegationTarget === "FIRM") {
      if (!currentFirm) {
        alert("위임할 법무법인을 선택해 주세요.");
        return;
      }
      if ((currentFirm.voting_power || 0) < 1) {
        alert(
          `해당 법인의 등록 구성원 변호사는 ${currentFirm.partner_count || 0}명으로, 의결권이 0표이므로 위임 신고서를 제출할 수 없습니다. (2인당 1표 필요)`,
        );
        return;
      }
      if (!proxyEvidenceUrl.trim()) {
        alert(
          "회칙 제3항 및 제5항에 따라 구성원 회의(만장일치 결의) 서면 증빙 URL을 필수로 입력해 주세요.",
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const selectedLawyer = lawyerList.find((l) => l.id === proxyLawyerId);
      const targetLawyerLabel = selectedLawyer
        ? `${selectedLawyer.name} 변호사 (${selectedLawyer.office_name || "법률사무소"})`
        : "지정 변호사";

      const isFirm = delegationTarget === "FIRM";
      const payload: any = {
        type: isFirm ? "FIRM_PROXY" : "PROXY",
        assemblyId: selectedAssemblyId,
        lawyerName: proxyLawyerName.trim(),
        reason: proxyReason.trim(),
        proxyLawyerId,
        signature: proxySignature.trim(),
        evidenceUrl: proxyEvidenceUrl.trim(),
      };
      if (isFirm && currentFirm) {
        payload.firmId = currentFirm.id;
      }

      const res = await fetch("/api/assembly/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "위임장 접수 실패");

      if (isFirm && currentFirm) {
        setSubmittedData({
          type: "firm_proxy",
          name: proxyLawyerName.trim(),
          proxyName: targetLawyerLabel,
          firmName: currentFirm.name,
          votingPower: currentFirm.voting_power,
        });
      } else {
        setSubmittedData({
          type: "proxy",
          name: proxyLawyerName.trim(),
          proxyName: targetLawyerLabel,
          votingPower: 1,
        });
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 제출 완료 화면 ──
  if (submittedData) {
    const isRereg = submittedData.type === "reregister";
    const isFirmProxy = submittedData.type === "firm_proxy";

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
                : isFirmProxy
                  ? "법무법인 의결권 위임 신고서 접수 완료"
                  : "정기총회 개인 의결권 위임장 접수 완료"}
            </h1>
            <p className="text-sm text-slate-400">
              {isRereg
                ? "정기총회 불참 사유서 및 자격 재등록 신청이 정상 접수되어 변호사 자격이 1개월 연장되었습니다."
                : isFirmProxy
                  ? "법인회원 의결권 위임 신고서가 정상 접수되었습니다. 관리자(의장)가 구성원 회의 결의 서면을 확인 후 승인하면 수임인에게 의결권이 부여됩니다."
                  : "의결권 위임장이 정상 접수되어 수임 변호사에게 의결권(1표)이 합산 위임되었습니다."}
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2 text-left">
            {isFirmProxy ? (
              <>
                <p>
                  • <strong>위임 법인:</strong> {submittedData.firmName}
                </p>
                <p>
                  • <strong>신청인(대표/파트너):</strong> {submittedData.name}{" "}
                  변호사
                </p>
                <p>
                  • <strong>수임 대리인:</strong> {submittedData.proxyName}
                </p>
                <p>
                  • <strong>위임 의결권 수:</strong>{" "}
                  <strong className="text-amber-400">
                    {submittedData.votingPower}표
                  </strong>{" "}
                  (구성원 2인당 1표)
                </p>
                <p>
                  • <strong>처리 상태:</strong> ⏳ 관리자 승인 대기 (회칙
                  제14조제3항~제5항)
                </p>
              </>
            ) : (
              <>
                <p>
                  • <strong>{isRereg ? "신청인" : "위임인"}:</strong>{" "}
                  {submittedData.name} 변호사
                </p>
                {!isRereg && (
                  <>
                    <p>
                      • <strong>수임 대리인:</strong> {submittedData.proxyName}
                    </p>
                    <p>
                      • <strong>위임 의결권:</strong> 1표 (개인 의결권)
                    </p>
                  </>
                )}
                <p>
                  • <strong>자격 상태:</strong> ✅ 정상 유지 (ACTIVE · 1개월
                  갱신)
                </p>
                <p>
                  • <strong>처리 근거:</strong> 변호사법 제6조제4항 및 회칙
                  제14조
                </p>
              </>
            )}
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
          총회 불출석 민원 및 의결권 위임 서식
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          총회에 불출석하는 회원은 <strong>자격 재등록 신청서</strong>를
          제출하여 자격을 연장할 수 있으며, 개인 또는 법인 명의로 동료 회원에게{" "}
          <strong>의결권 위임장</strong>을 제출할 수 있습니다.
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
          [서식2] 의결권 위임장 (개인 / 법인)
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
            {assemblies.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  대상 총회 일정 *
                </label>
                <select
                  value={selectedAssemblyId}
                  onChange={(e) => setSelectedAssemblyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {assemblies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.held_at})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                신청인 성명 *
              </label>
              <input
                type="text"
                required
                value={reLawyerName}
                onChange={(e) => setReLawyerName(e.target.value)}
                placeholder="예: eegmon"
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
                placeholder="예: 법무법인 도스 / 개인개업"
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

      {/* 탭 2: 의결권 위임장 (개인 또는 법인) */}
      {activeTab === "proxy" && (
        <form
          onSubmit={handleProxySubmit}
          className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-blue-400 border-b border-slate-800 pb-3">
            <Vote className="w-4 h-4" />
            정기총회 의결권 위임장
          </div>

          {/* 위임 구분: 개인회원 위임 vs 법인회원 위임 */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              위임 주체 구분 *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                  delegationTarget === "PERSONAL"
                    ? "bg-blue-600/10 border-blue-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="delegationTarget"
                  checked={delegationTarget === "PERSONAL"}
                  onChange={() => setDelegationTarget("PERSONAL")}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <div className="font-bold text-xs">개인회원 의결권 위임</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    변호사 개인 1표를 동료 변호사에게 위임
                  </div>
                </div>
              </label>

              <label
                className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                  delegationTarget === "FIRM"
                    ? "bg-amber-500/10 border-amber-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="delegationTarget"
                  checked={delegationTarget === "FIRM"}
                  onChange={() => setDelegationTarget("FIRM")}
                  className="mt-0.5 text-amber-500"
                />
                <div>
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-amber-400" />
                    법인회원 의결권 위임
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    구성원 회의 만장일치 결의에 따른 법인 의결권 위임 (2인당
                    1표)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* 법인 위임 선택 시 안내 및 법인 선택 영역 */}
          {delegationTarget === "FIRM" && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
              <div className="text-xs text-amber-200 leading-relaxed space-y-1">
                <p>
                  📜 <strong>회칙 제14조제3항~제5항:</strong>
                </p>
                <p>
                  • 법인회원의 의결권은{" "}
                  <strong>구성원 회의(만장일치 결의)</strong>를 거쳐 의장에게
                  서면으로 통지하여야 하며, 개인회원에게 위임할 수 있습니다.
                </p>
                <p>
                  • 위임 시에는{" "}
                  <strong>위임을 증명할 서면(구성원 회의록 등)</strong>이
                  포함되어 있어야 합니다.
                </p>
                <p>
                  • 의결권 산정: 등록된{" "}
                  <strong>구성원 변호사(파트너) 2명당 1표</strong> (1명 0표).
                </p>
              </div>

              {myFirms.length === 0 ? (
                <div className="p-3 bg-slate-950 rounded-lg border border-red-500/30 text-rose-300 text-xs">
                  ⚠️ 로그인하신 계정에 등록된 승인 법무법인이 없거나 대표/구성원
                  권한이 없습니다. 법인 등록을 먼저 진행해 주세요.
                </div>
              ) : (
                <div className="space-y-2 pt-1 border-t border-amber-500/20">
                  <label className="block text-xs font-semibold text-amber-300">
                    위임 대상 법무법인 선택 *
                  </label>
                  <select
                    value={selectedFirmId}
                    onChange={(e) => setSelectedFirmId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {myFirms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.type}) · 구성원 {f.partner_count}명 →{" "}
                        {f.voting_power}표
                      </option>
                    ))}
                  </select>

                  {currentFirm && (
                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        소속 {currentFirm.member_count}명 · 파트너{" "}
                        {currentFirm.partner_count}명
                      </span>
                      <span className="font-bold text-amber-400">
                        행사 가능 의결권: {currentFirm.voting_power}표
                      </span>
                    </div>
                  )}

                  {currentFirm && (currentFirm.voting_power || 0) <= 0 && (
                    <div className="p-2.5 bg-red-950/40 border border-red-800/40 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      구성원 변호사가 2인 미만이므로 현재 법인 의결권이
                      0표입니다. 구성원을 추가 등록해 주세요.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 개인 위임 안내 */}
          {delegationTarget === "PERSONAL" && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-200 leading-relaxed">
              💡 <strong>회칙 제14조제4항:</strong> 총회에 출석할 수 없는 회원은
              특정 회원 변호사에게 본인 의결권(1표)을 위임할 수 있습니다. 위임
              시 수임 변호사는 전자투표 시 본인의 표와 위임받은 표를 합산하여
              행사합니다.
            </div>
          )}

          <div className="space-y-4">
            {assemblies.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  대상 총회 일정 *
                </label>
                <select
                  value={selectedAssemblyId}
                  onChange={(e) => setSelectedAssemblyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {assemblies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.held_at})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {delegationTarget === "FIRM"
                  ? "위임 신청인 (대표/구성원 변호사 성명) *"
                  : "위임인 (본인 성명) *"}
              </label>
              <input
                type="text"
                required
                value={proxyLawyerName}
                onChange={(e) => setProxyLawyerName(e.target.value)}
                placeholder="예: eegmon"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                수임인 (의결권을 위임받아 총회에서 행사할 변호사 선택) *
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
              {delegationTarget === "FIRM" && (
                <p className="text-[11px] text-slate-500 mt-1">
                  * 법인회원의 경우 대표변호사 본인이 수임하거나 소속/동료
                  변호사를 지정할 수 있습니다.
                </p>
              )}
            </div>

            {/* 증빙 서면 URL (법인 위임 시 필수, 개인 위임 시 선택) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>
                  {delegationTarget === "FIRM"
                    ? "구성원 회의 만장일치 결의 증빙 서면 URL *"
                    : "증빙 문서 URL (선택)"}
                </span>
                {delegationTarget === "FIRM" && (
                  <span className="text-[10px] text-amber-400 font-bold">
                    회칙 제5항 필수
                  </span>
                )}
              </label>
              <input
                type="url"
                required={delegationTarget === "FIRM"}
                value={proxyEvidenceUrl}
                onChange={(e) => setProxyEvidenceUrl(e.target.value)}
                placeholder={
                  delegationTarget === "FIRM"
                    ? "예: https://... (구성원 회의록 또는 전자서명부 링크)"
                    : "위임장 스캔본 또는 증빙 문서 링크"
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              {delegationTarget === "FIRM" && (
                <p className="text-[11px] text-slate-400 mt-1">
                  회칙 제5항: 서면에는 위임을 증명할 자료(구성원 회의 결의서
                  등)가 포함되어 있어야 하며, 관리자(의장)가 승인한 후 의결권이
                  부여됩니다.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                위임 사유 (선택)
              </label>
              <input
                type="text"
                value={proxyReason}
                onChange={(e) => setProxyReason(e.target.value)}
                placeholder="예: 구성원 회의 만장일치 의결에 따른 위임"
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
              disabled={
                isSubmitting ||
                (delegationTarget === "FIRM" &&
                  (currentFirm?.voting_power || 0) <= 0)
              }
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting
                ? "위임장 접수 처리중..."
                : delegationTarget === "FIRM"
                  ? `법인 의결권(${currentFirm?.voting_power || 0}표) 위임 신고서 제출`
                  : "개인 의결권(1표) 위임장 제출"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

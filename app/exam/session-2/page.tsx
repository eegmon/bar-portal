"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  AlertCircle,
  ArrowLeft,
  Send,
  Lock,
  ShieldCheck,
  CheckCircle2,
  FileUp,
  X,
  FileCheck,
} from "lucide-react";
import Link from "next/link";

export default function Session2Page() {
  const [securityCode, setSecurityCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [phase1Score, setPhase1Score] = useState<number | null>(null);
  const [examId, setExamId] = useState("");

  const [textAnswer, setTextAnswer] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [isInstantPledged, setIsInstantPledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<any>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [publishedAt, setPublishedAt] = useState("");
  const [phase2Doc1PdfUrl, setPhase2Doc1PdfUrl] = useState("");
  const [phase2Doc2PdfUrl, setPhase2Doc2PdfUrl] = useState("");

  // 1차 합격 여부 검증
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityCode.trim()) return;

    setVerifyLoading(true);
    setVerifyError("");

    try {
      const res = await fetch("/api/exam/verify-phase1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ securityCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "자격 검증 실패");

      setIsVerified(true);
      setExamId(data.examId || "");
      setPhase1Score(data.phase1Score);
      if (data.existingTextAnswer) setTextAnswer(data.existingTextAnswer);
      if (data.existingFileUrl) {
        setFileUrl(data.existingFileUrl);
        setFileName("기존_제출된_파일.pdf");
      }
      if (data.isPledged) setIsInstantPledged(true);
      setIsPublished(Boolean(data.isPublished));
      setPublishedAt(data.publishedAt || "");
      setPhase2Doc1PdfUrl(data.phase2Doc1PdfUrl || "");
      setPhase2Doc2PdfUrl(data.phase2Doc2PdfUrl || "");
    } catch (err: any) {
      setVerifyError(err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  // 파일을 서버 저장소에 업로드하고 URL만 제출 데이터에 보관합니다.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPublished) return;
    const file = e.target.files?.[0];
    if (!file) return;

    // 용량 제한 (최대 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("파일 크기는 최대 10MB 이하만 업로드 가능합니다.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("examId", examId);
      formData.append("securityCode", securityCode);
      formData.append("file", file);
      const res = await fetch("/api/exam/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "파일 업로드 실패");
      setFileName(data.fileName || file.name);
      setFileUrl(data.fileUrl);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    if (isPublished) return;
    setFileUrl("");
    setFileName("");
  };

  const handleSubmit = async (
    e: React.FormEvent | React.MouseEvent,
    publish: boolean,
  ) => {
    if (isPublished) return;
    e.preventDefault();
    if (!textAnswer.trim() && !fileUrl.trim()) {
      alert("PDF 답안 파일을 첨부하거나 답안 내용을 작성해 주세요.");
      return;
    }

    if (publish) {
      if (
        !confirm(
          "⚠️ 최종 게시 안내\n답안을 최종 게시하시겠습니까?\n게시 후에는 답안을 철회하거나 수정할 수 없습니다.",
        )
      ) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/exam/submit-2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          securityCode,
          textAnswer,
          fileUrl,
          isInstantPledged: publish && isInstantPledged,
          publish,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "제출 실패");
      setSubmittedStatus(data);
      if (publish) {
        setIsPublished(true);
        setPublishedAt(new Date().toISOString());
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. 자격 검증 전: 1차 합격자 게이트키퍼 화면
  if (!isVerified) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 w-full">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-6 text-center">
          <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-2xl mx-auto flex items-center justify-center">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">
              제2차 과제 제출실 입장 인증
            </h1>
            <p className="text-xs text-slate-400">
              제2차 시험은{" "}
              <strong>제1차 CBT 객관식 시험에 합격(통과)한 수험생</strong>에
              한하여 응시가 허용됩니다.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                개인 보안코드 (수험번호)
              </label>
              <input
                type="text"
                required
                value={securityCode}
                onChange={(e) => setSecurityCode(e.target.value.toUpperCase())}
                placeholder="예: DOS-A8F3"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white font-mono tracking-wider focus:outline-none focus:border-blue-500 uppercase"
              />
            </div>

            {verifyError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{verifyError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifyLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              {verifyLoading
                ? "1차 합격 여부 검증중..."
                : "1차 합격 인증 및 2차 시험장 입장"}
            </button>
          </form>

          <div className="pt-2">
            <Link
              href="/exam/cbt-1"
              className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
            >
              아직 1차 CBT 시험을 응시하지 않으셨나요? 👉 1차 시험장 가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. 검증 완료 후: 2차 문제지 열람 및 PDF 답안 제출 화면
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <Link
            href="/exam"
            className="text-slate-400 hover:text-white text-xs flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 시험 센터 허브로 돌아가기
          </Link>
          <h1 className="text-2xl font-extrabold text-white">
            제2차 시험 과제 제출실 (24시간)
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            수험번호{" "}
            <strong className="text-blue-400 font-mono">#{securityCode}</strong>{" "}
            (1차 필기: {phase1Score}점 합격) 님의 2차 과제 제출 공간입니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 1차 합격 인증됨
          </span>
        </div>
      </div>

      {/* 1. 문제지 다운로드 박스 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
            <FileText className="w-4 h-4" />
            제1문 문제지 (논술형)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            분량 제한은 없으나 지나치게 과도하거나 적은 분량은 감점 사유가
            됩니다.
          </p>
          {phase2Doc1PdfUrl ? (
            <a
              href={phase2Doc1PdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold rounded-lg border border-blue-500/40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              제1문_논술형_문제지.pdf
            </a>
          ) : (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 text-slate-500 text-xs rounded-lg border border-slate-700">
              <Download className="w-3.5 h-3.5" />
              문제지 미등록 (관리자 문의)
            </div>
          )}
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <FileText className="w-4 h-4" />
            제2문 문제지 (실무기록형 서류/도장 포함)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            표, 서류, 직인이 포함되어 있으므로 반드시 원본 PDF 형식으로
            열람하시기 바랍니다.
          </p>
          {phase2Doc2PdfUrl ? (
            <a
              href={phase2Doc2PdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-semibold rounded-lg border border-amber-500/40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              제2문_실무기록_문제지.pdf
            </a>
          ) : (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 text-slate-500 text-xs rounded-lg border border-slate-700">
              <Download className="w-3.5 h-3.5" />
              문제지 미등록 (관리자 문의)
            </div>
          )}
        </div>
      </div>

      {/* 2. 제출 안내 및 규칙 */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-white">답안 제출 규칙</p>
          <p>
            • <strong>PDF 파일 직접 업로드</strong>를 적극 권장합니다 (HWP, DOCX
            또는 웹 텍스트 작성도 가능).
          </p>
          <p>
            • <strong>수정 및 철회:</strong> 마감 전까지는 자유롭게 답안을
            수정하거나 철회할 수 있습니다.
          </p>
          <p>
            • <strong>즉시 채점 서약:</strong> 아래 서약 체크 시 제출 즉시
            채점이 시작되며 철회가 불가합니다.
          </p>
        </div>
      </div>

      {/* 3. 답안 작성 & PDF 파일 업로드 폼 */}
      <form
        onSubmit={(e) => handleSubmit(e, false)}
        className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6 shadow-xl"
      >
        {isPublished && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              2차 답안이{" "}
              {publishedAt ? new Date(publishedAt).toLocaleString("ko-KR") : ""}{" "}
              최종 게시되어 수정할 수 없습니다.
            </span>
          </div>
        )}
        {/* PDF 파일 직접 첨부 영역 */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-white flex items-center gap-2">
            <FileUp className="w-4 h-4 text-blue-400" />
            2차 과제 PDF 답안 파일 첨부 (권장)
          </label>

          {fileUrl ? (
            <div className="p-4 bg-slate-950 border border-blue-500/40 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-blue-300">
                <FileCheck className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">
                    {fileName || "첨부_답안.pdf"}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    PDF 파일이 정상적으로 첨부되었습니다.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors"
                title="파일 삭제"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/60 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group">
              <FileUp className="w-8 h-8 text-slate-500 group-hover:text-blue-400 transition-colors" />
              <div className="text-xs text-slate-300 font-semibold">
                클릭하여{" "}
                <span className="text-blue-400 font-bold">PDF 답안 파일</span>을
                업로드하세요
              </div>
              <p className="text-[11px] text-slate-500">
                PDF, HWP, HWPX, DOCX 지원 (최대 10MB)
              </p>
              <input
                type="file"
                accept=".pdf,.hwp,.hwpx,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* 웹 직접 서술형 작성 영역 */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            답안 본문 직접 작성 (파일 첨부 대신 또는 추가 기재 시)
          </label>
          <textarea
            rows={8}
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            disabled={isPublished}
            placeholder="[제1문 답안]&#10;1. 쟁점의 정리...&#10;&#10;[제2문 답안]&#10;소장 또는 준비서면..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3.5 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 조기 채점 서약 체크박스 */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isInstantPledged}
              disabled={isPublished}
              onChange={(e) => setIsInstantPledged(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
            />
            <div className="text-xs space-y-0.5">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                답안을 수정하지 않고 [즉시 채점]을 요청합니다. (조기 채점 서약)
              </div>
              <p className="text-amber-200/80">
                체크 시 답안이 즉시 잠금 처리되어 출제위원 채점이 바로 시작되며,
                이후 수정이나 철회가 불가합니다.
              </p>
            </div>
          </label>
        </div>

        {submittedStatus && (
          <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
            {submittedStatus.message}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting || isUploading || isPublished}
            className="flex items-center justify-center gap-1.5 px-6 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs rounded-lg shadow-md transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            임시 저장
          </button>
          <button
            type="button"
            disabled={isSubmitting || isUploading || isPublished}
            onClick={(e) => handleSubmit(e, true)}
            className="flex items-center justify-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs rounded-lg shadow-md transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {isSubmitting ? "게시 중..." : "2차 답안 최종 게시"}
          </button>
        </div>
      </form>
    </div>
  );
}

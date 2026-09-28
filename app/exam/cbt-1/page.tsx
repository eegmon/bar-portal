"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  ArrowLeft,
  Send,
  Loader2,
  FileText,
  Download,
} from "lucide-react";
import Link from "next/link";

interface Question {
  num: number;
  subject: string;
  title: string;
  choices: string[];
}

const DRAFT_KEY = "bar-portal:cbt1:draft";
const EXAM_SECONDS = 120 * 60;

interface Draft {
  examId: string;
  securityCode: string;
  startedAt: number; // 서버 기준 시작 시각(ms)
  clockOffset: number; // 서버시각 - 내 기기시각(ms)
  answers: Record<number, number>;
}

export default function CBT1Page() {
  const [securityCode, setSecurityCode] = useState("");
  const [isCodeSet, setIsCodeSet] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXAM_SECONDS); // 120분 (초 단위)
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [isEntering, setIsEntering] = useState(false);
  const [enterError, setEnterError] = useState("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "offline" | "rejected"
  >("idle");
  const [saveRetry, setSaveRetry] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // 동적 문항 및 정정 공지 상태
  const [examId, setExamId] = useState("exam-2026-09");
  const [examTitle, setExamTitle] = useState("2026년도 제18회 도스변호사시험");
  const [phase1MaxScore, setPhase1MaxScore] = useState(100);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [errataNotices, setErrataNotices] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [phase1PdfUrl, setPhase1PdfUrl] = useState("");
  const [phase1Rules, setPhase1Rules] = useState("");
  const [questionsError, setQuestionsError] = useState("");

  // 최신 문항 및 정오표 비동기 조회
  useEffect(() => {
    fetch("/api/exam/questions")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.questions) {
          setQuestions(data.questions);
          if (data.examId) setExamId(data.examId);
          if (data.title) setExamTitle(data.title);
          if (data.phase1MaxScore) setPhase1MaxScore(data.phase1MaxScore);
          if (data.errataNotices) setErrataNotices(data.errataNotices);
          if (data.phase1PdfUrl) setPhase1PdfUrl(data.phase1PdfUrl);
          if (data.phase1Rules) setPhase1Rules(data.phase1Rules);
        } else {
          setQuestionsError(data.error || "문항을 불러올 수 없습니다.");
        }
      })
      .catch((err) => {
        console.error("문항 로드 실패:", err);
        setQuestionsError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => {
        setIsLoadingQuestions(false);
      });
  }, []);

  // 입장/복원: 서버에 시작 시각을 기록하고, 서버에 저장된 임시답안을 받아온다.
  // 서버에 닿지 않으면(오프라인) 이 기기의 저장본으로 이어서 진행한다.
  const enterExam = async (code: string, local?: Draft) => {
    setEnterError("");
    setIsEntering(true);
    try {
      const res = await fetch("/api/exam/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", examId, securityCode: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "입장 실패");
      setClockOffset(data.serverNow - Date.now());
      setStartedAt(data.startedAt);
      // 서버 저장본 + 이 기기 저장본 병합 (이 기기 쪽이 더 최신)
      setAnswers({ ...(data.answers || {}), ...(local?.answers || {}) });
      setSecurityCode(code);
      setIsCodeSet(true);
    } catch (err: any) {
      if (err instanceof TypeError && local) {
        // 네트워크 오류: 이 기기 저장본으로 계속 진행
        setClockOffset(local.clockOffset || 0);
        setStartedAt(local.startedAt);
        setAnswers(local.answers || {});
        setSecurityCode(local.securityCode);
        setIsCodeSet(true);
        setSaveStatus("offline");
      } else {
        if (local) {
          try { localStorage.removeItem(DRAFT_KEY); } catch {}
        }
        setEnterError(
          err instanceof TypeError
            ? "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
            : err.message,
        );
      }
    } finally {
      setIsEntering(false);
    }
  };

  const saveToServer = async (a: Record<number, number>) => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/exam/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          examId,
          securityCode,
          answers: a,
        }),
      });
      setSaveStatus(res.ok ? "saved" : "rejected");
    } catch {
      setSaveStatus("offline"); // 서버 다운/네트워크 끊김 → 아래 effect가 재시도
    }
  };

  // 페이지 진입 시: 문항 로드가 끝나면 이 기기 저장본이 있는지 확인
  useEffect(() => {
    if (isLoadingQuestions || draftChecked) return;
    if (questionsError) {
      setDraftChecked(true);
      return;
    }
    (async () => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d: Draft = JSON.parse(raw);
          if (d.examId === examId) await enterExam(d.securityCode, d);
          else localStorage.removeItem(DRAFT_KEY);
        }
      } catch {}
      setDraftChecked(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingQuestions, questionsError, examId, draftChecked]);

  // 이 기기(localStorage)에 즉시 저장 — 서버가 죽어도 남는 2차 안전장치
  useEffect(() => {
    if (!draftChecked || !isCodeSet || startedAt === null || result) return;
    try {
      const d: Draft = { examId, securityCode, startedAt, clockOffset, answers };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {}
  }, [draftChecked, isCodeSet, startedAt, clockOffset, result, examId, securityCode, answers]);

  // 서버 자동저장: 답안이 바뀌면 1.2초 뒤 저장, 실패하면 8초마다 재시도
  useEffect(() => {
    if (!draftChecked || !isCodeSet || startedAt === null || result) return;
    const t = setTimeout(() => saveToServer(answers), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, draftChecked, isCodeSet, startedAt, result, saveRetry]);

  useEffect(() => {
    if (saveStatus !== "offline") return;
    const t = setTimeout(() => setSaveRetry((n) => n + 1), 8000);
    return () => clearTimeout(t);
  }, [saveStatus, saveRetry]);

  // 타이머: 서버 시작 시각 기준 (새로고침·기기 변경해도 시간이 이어짐)
  useEffect(() => {
    if (!isCodeSet || startedAt === null || result) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() + clockOffset - startedAt) / 1000);
      setTimeLeft(Math.max(0, EXAM_SECONDS - elapsed));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isCodeSet, startedAt, clockOffset, result]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleSelect = (qNum: number, choiceIdx: number) => {
    setAnswers((prev) => ({
      ...prev,
      [qNum]: choiceIdx + 1,
    }));
  };

  const handleSubmit = async () => {
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      if (
        !confirm(
          `아직 마킹하지 않은 문항이 있습니다. (${answeredCount}/${questions.length}문 마킹)\n그래도 최종 제출하시겠습니까? (제출 후 수정 불가)`,
        )
      ) {
        return;
      }
    } else {
      if (
        !confirm(
          "답안지를 최종 제출하시겠습니까?\n단 1회만 제출 가능하며, 제출 후 수정할 수 없습니다.",
        )
      ) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/exam/submit-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          securityCode,
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 이미 제출된 경우에만 임시 저장 삭제 (그 외 실패는 재시도 가능하게 유지)
        if (String(data.error || "").includes("이미 제출")) {
          try { localStorage.removeItem(DRAFT_KEY); } catch {}
        }
        throw new Error(data.error || "제출 실패");
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setResult(data);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 0. 임시 저장 확인 중
  if (!draftChecked) {
    return (
      <div className="flex justify-center py-32 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  // 1. 보안코드 입력 전 화면
  if (!isCodeSet) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 w-full">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/30 rounded-xl mx-auto flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              제1차 변호사시험 CBT 입장
            </h1>
            <p className="text-xs text-slate-400">
              {examTitle} · 공정한 블라인드 채점을 위해 본인의{" "}
              <strong>개인 보안코드</strong>를 입력해 주세요.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                개인 보안코드 (수험번호)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={securityCode}
                  onChange={(e) =>
                    setSecurityCode(e.target.value.toUpperCase())
                  }
                  placeholder="예: DOS-A8F3"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white font-mono tracking-wider focus:outline-none focus:border-blue-500 uppercase"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                시험관리자로부터 발급받은 수험번호를 입력해 주세요.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">시험 규칙 안내</p>
              {phase1Rules ? (
                // 관리자가 입력한 규칙: 줄바꿈 보존
                <div className="whitespace-pre-line leading-relaxed">
                  {phase1Rules}
                </div>
              ) : (
                // 기본 안내 (규칙 미설정 시 fallback)
                <>
                  <p>
                    • 시험 시간: 120분 · 만점 {phase1MaxScore}점 (
                    {questions.length > 0 ? questions.length : 10}문 객관식)
                  </p>
                  <p>
                    • 답안 제출은 <strong>단 1회만 허용</strong>되며 중복 제출은
                    불가합니다.
                  </p>
                  <p>
                    • 문제에 질의가 있을 경우 디스코드 [⚠️┃이의제기] 채널을 이용해
                    주십시오.
                  </p>
                </>
              )}
            </div>

            {phase1PdfUrl && (
              <a
                href={phase1PdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-3.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl text-xs text-blue-300 font-semibold transition-colors"
              >
                <Download className="w-4 h-4 shrink-0" />
                <div>
                  <div>1차 필기 문제지 PDF 다운로드</div>
                  <div className="text-[11px] text-blue-400/70 font-normal mt-0.5">
                    시험 시작 전 문제지를 미리 확인하세요
                  </div>
                </div>
                <FileText className="w-4 h-4 shrink-0 ml-auto opacity-60" />
              </a>
            )}

            <button
              type="button"
              disabled={
                !securityCode.trim() ||
                isLoadingQuestions ||
                !!questionsError ||
                isEntering
              }
              onClick={() => enterExam(securityCode.trim().toUpperCase())}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isEntering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 입장 확인중...
                </>
              ) : isLoadingQuestions ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 시험 문항
                  로딩중...
                </>
              ) : questionsError ? (
                "시험 문항 로드 실패 (입장 불가)"
              ) : (
                "CBT 시험장 입장하기 (120분 시작)"
              )}
            </button>

            {enterError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
                {enterError}
              </div>
            )}

            {questionsError && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">현재 1차 CBT 시험 문항을 불러올 수 없습니다.</p>
                  <p className="text-amber-200/80">{questionsError}</p>
                  <p className="text-amber-200/60">시험 진행 상태가 아니거나, 아직 시작 전일 수 있습니다. 시험 일정을 확인하거나 관리자에게 문의해 주세요.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. 시험 제출 완료 화면
  if (result && result.published === false) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 w-full">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-mono px-2.5 py-1 bg-slate-800 text-slate-300 rounded-md">
              보안코드: #{result.securityCode}
            </span>
            <h1 className="text-2xl font-extrabold text-white mt-2">
              제1차 CBT 답안 제출 완료
            </h1>
            <p className="text-sm text-slate-400">
              답안지가 정상 접수되었습니다. 성적과 합격 여부는 관리자의 성적
              발표 후 <strong className="text-slate-200">내 성적 조회</strong>에서
              확인할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/exam/my-score"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow-md transition-colors"
            >
              내 성적 조회
            </Link>
            <Link
              href="/exam"
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors"
            >
              시험 센터 허브로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 w-full">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-6">
          <div
            className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
              result.passed
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "bg-red-500/10 text-red-400 border border-red-500/30"
            }`}
          >
            {result.passed ? (
              <CheckCircle className="w-8 h-8" />
            ) : (
              <AlertTriangle className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-1">
            <span className="text-xs font-mono px-2.5 py-1 bg-slate-800 text-slate-300 rounded-md">
              보안코드: #{result.securityCode}
            </span>
            <h1 className="text-2xl font-extrabold text-white mt-2">
              제1차 CBT 답안 제출 완료
            </h1>
            <p className="text-sm text-slate-400">
              답안지가 변호사시험관리위원회에 정상 접수 및 자동 채점되었습니다.
            </p>
          </div>

          <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 max-w-md mx-auto space-y-3">
            <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
              <span className="text-slate-400">1차 필기 득점</span>
              <span className="font-bold text-xl text-white">
                {result.score}점 / 100점
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">1차 시험 합격 여부</span>
              <span
                className={`font-bold px-3 py-1 rounded-full text-xs ${
                  result.passed
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}
              >
                {result.passed ? "1차 합격 (통과)" : "불합격 (과락)"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link
              href="/exam/session-2"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow-md transition-colors"
            >
              제2차 과제 제출실로 이동
            </Link>
            <Link
              href="/exam"
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors"
            >
              시험 센터 홈으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. 실제 시험 진행 중 화면
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* 상단 고정 CBT 상태 바 */}
      <header className="sticky top-16 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 py-3 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/exam"
              className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> 나가기
            </Link>
            <div className="h-4 w-px bg-slate-700" />
            <div className="text-xs text-slate-300 font-mono">
              수험번호:{" "}
              <strong className="text-blue-400">#{securityCode}</strong>
            </div>
            <div className="text-xs text-slate-400">
              마킹 현황:{" "}
              <strong className="text-amber-400">
                {Object.keys(answers).length}
              </strong>{" "}
              / {questions.length}문
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* 자동저장 상태 */}
            <div
              className={`text-[11px] ${
                saveStatus === "offline" || saveStatus === "rejected"
                  ? "text-red-400"
                  : "text-slate-500"
              }`}
            >
              {saveStatus === "saving" && "저장 중…"}
              {saveStatus === "saved" && "✓ 서버에 자동저장됨"}
              {saveStatus === "offline" &&
                "⚠ 서버 저장 실패 · 이 기기에 보관 중 (자동 재시도)"}
              {saveStatus === "rejected" && "⚠ 서버가 저장을 거부했습니다"}
            </div>

            {/* 120분 타이머 */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-950 border border-amber-500/40 rounded-lg text-amber-400 font-mono font-bold text-sm shadow-inner">
              <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>남은시간 {formatTime(timeLeft)}</span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-md transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? "채점중..." : "최종 답안 제출"}
            </button>
          </div>
        </div>
      </header>

      {/* 실시간 문제 정정 긴급 공지 배너 */}
      {errataNotices.length > 0 && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-start gap-2 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {errataNotices.map((n: any, idx: number) => (
                <div key={idx}>
                  <strong>[실시간 문제 정정 공지]</strong> {n.content}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 문제 영역 & OMR 패널 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* 좌측 3열: 문항 카드 */}
        <div className="lg:col-span-3 space-y-6">
          {questions.map((q) => (
            <div
              key={q.num}
              id={`q-${q.num}`}
              className={`p-6 bg-slate-900 border rounded-xl shadow-md transition-colors ${
                answers[q.num] ? "border-slate-800" : "border-slate-800/80"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-xs font-bold font-mono">
                  제 {q.num} 문
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {q.subject}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white mb-4 leading-relaxed">
                {q.title}
              </h3>

              <div className="space-y-2.5">
                {q.choices.map((choice, cIdx) => {
                  const isSelected = answers[q.num] === cIdx + 1;
                  return (
                    <label
                      key={cIdx}
                      onClick={() => handleSelect(q.num, cIdx)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-600/15 border-blue-500/60 text-white font-medium shadow-sm"
                          : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 transition-colors ${
                          isSelected
                            ? "bg-blue-500 text-white"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {cIdx + 1}
                      </span>
                      <span className="leading-relaxed flex-1">{choice}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 우측 1열: OMR 답안 마킹표 (스티키) */}
        <div className="lg:col-span-1">
          <div className="sticky top-32 p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-amber-500" />
                OMR 답안 마킹표
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                클릭 시 해당 문항으로 이동
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {questions.map((q) => {
                const marked = answers[q.num];
                return (
                  <a
                    key={q.num}
                    href={`#q-${q.num}`}
                    className={`p-2 rounded-lg border flex items-center justify-between transition-colors ${
                      marked
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span>#{q.num}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono text-[11px]">
                      {marked ? `${marked}번` : "-"}
                    </span>
                  </a>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-md transition-colors"
              >
                {isSubmitting ? "제출 처리중..." : "답안지 최종 제출하기"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

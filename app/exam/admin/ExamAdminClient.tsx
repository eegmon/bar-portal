"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Send,
  CheckCircle2,
  Award,
  FileText,
  Lock,
  Users,
  Edit,
  Save,
  Plus,
  Trash2,
  Download,
  FileUp,
} from "lucide-react";

interface QuestionData {
  num: number;
  subject: string;
  title: string;
  choices: string[];
  answer: number;
  altAnswers?: number[];
  explanation?: string;
}

export default function ExamAdminClient({
  exam,
  submissions,
}: {
  exam: any;
  submissions: any[];
}) {
  const [activeTab, setActiveTab] = useState<
    "errata" | "questions" | "grading"
  >("errata");

  // 1. 실시간 문제 정정 방송 상태
  const [errataText, setErrataText] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [notices, setNotices] = useState<any[]>(
    JSON.parse(exam.errata_notices || "[]"),
  );
  const [issueCount, setIssueCount] = useState(10);
  const [issuedCodes, setIssuedCodes] = useState<string[]>([]);
  const [isIssuingCodes, setIsIssuingCodes] = useState(false);

  // 2. 1차 CBT 문항 편집기 상태
  const initialQuestions: QuestionData[] = JSON.parse(
    exam.phase1_questions || "[]",
  );
  const [questions, setQuestions] = useState<QuestionData[]>(
    initialQuestions.length > 0
      ? initialQuestions
      : Array.from({ length: 10 }, (_, i) => ({
          num: i + 1,
          subject: "공법",
          title: "",
          choices: ["", "", "", "", ""],
          answer: 1,
          altAnswers: [],
          explanation: "",
        })),
  );
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);

  // 3. 2차 채점 상태
  const [gradingState, setGradingState] = useState<
    Record<string, { score: number; feedback: string }>
  >({});
  const [isGrading, setIsGrading] = useState<string | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);

  // 1. 실시간 문제 정정 방송
  const handleBroadcastErrata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!errataText.trim()) return;

    setIsBroadcasting(true);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "BROADCAST_ERRATA",
          examId: exam.id,
          noticeText: errataText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "방송 실패");

      setNotices((prev) => [...prev, data.notice]);
      setErrataText("");
      alert(
        "🚨 실시간 문제 정정이 수험생 화면 및 디스코드 시험 공지 채널로 즉시 방송되었습니다!",
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleIssueCodes = async () => {
    setIsIssuingCodes(true);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ISSUE_CANDIDATE_CODES",
          examId: exam.id,
          count: issueCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "수험번호 발급 실패");
      setIssuedCodes(data.issuedCodes || []);
      alert(data.message);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsIssuingCodes(false);
    }
  };

  // 2. CBT 문항 편집 핸들러
  const handleQuestionChange = (
    qIdx: number,
    field: keyof QuestionData,
    value: any,
  ) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIdx] = { ...updated[qIdx], [field]: value };
      return updated;
    });
  };

  const handleChoiceChange = (
    qIdx: number,
    choiceIdx: number,
    value: string,
  ) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const newChoices = [...updated[qIdx].choices];
      newChoices[choiceIdx] = value;
      updated[qIdx] = { ...updated[qIdx], choices: newChoices };
      return updated;
    });
  };

  // 선지 추가 (예: 4지선다 -> 5지선다)
  const handleAddChoice = (qIdx: number) => {
    setQuestions((prev) => {
      const updated = [...prev];
      if (updated[qIdx].choices.length >= 8) {
        alert("선지는 최대 8개까지만 추가할 수 있습니다.");
        return prev;
      }
      const newChoices = [...updated[qIdx].choices, ""];
      updated[qIdx] = { ...updated[qIdx], choices: newChoices };
      return updated;
    });
  };

  // 선지 삭제 (최소 2개)
  const handleRemoveChoice = (qIdx: number, choiceIdx: number) => {
    setQuestions((prev) => {
      const updated = [...prev];
      if (updated[qIdx].choices.length <= 2) {
        alert("선지는 최소 2개 이상이어야 합니다.");
        return prev;
      }
      const newChoices = updated[qIdx].choices.filter(
        (_, idx) => idx !== choiceIdx,
      );
      let newAnswer = updated[qIdx].answer;
      if (newAnswer > newChoices.length) {
        newAnswer = newChoices.length;
      }
      updated[qIdx] = {
        ...updated[qIdx],
        choices: newChoices,
        answer: newAnswer,
      };
      return updated;
    });
  };

  const handleAltAnswersChange = (qIdx: number, valStr: string) => {
    const nums = valStr
      .split(/[,;\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter(
        (n) => !isNaN(n) && n >= 1 && n <= questions[qIdx].choices.length,
      );

    setQuestions((prev) => {
      const updated = [...prev];
      updated[qIdx] = { ...updated[qIdx], altAnswers: nums };
      return updated;
    });
  };

  const handleSaveAllQuestions = async () => {
    setIsSavingQuestions(true);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_QUESTIONS",
          examId: exam.id,
          questions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "문항 저장 실패");

      alert(
        "📝 제1차 CBT 문항 및 선지/정오표가 성공적으로 저장되었습니다! (수험생 시험장 및 자동채점 API에 실시간 반영됨)",
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSavingQuestions(false);
    }
  };

  // 3. 2차 채점표 저장
  const handleSaveGrade = async (subId: string, isPass: boolean) => {
    const current = gradingState[subId] || { score: 70, feedback: "" };
    setIsGrading(subId);

    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GRADE_PHASE2",
          submissionId: subId,
          phase2Score: current.score,
          feedback: current.feedback,
          isPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "채점 실패");

      alert(
        `✅ 수험생 채점이 완료되었습니다. (총점: ${data.totalScore}점, 최종판정: ${isPass ? "합격" : "불합격"})`,
      );
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsGrading(null);
    }
  };

  // 4. 최종 합격자 공고 릴리즈
  const handleReleasePassers = async () => {
    if (
      !confirm(
        "🎉 최종 합격자 명단을 디스코드 전체 채널 및 포털에 공식 발표하시겠습니까?",
      )
    ) {
      return;
    }

    setIsReleasing(true);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RELEASE_PASSERS",
          examId: exam.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "발표 실패");

      alert(
        `총 ${data.count}명의 최종 합격자 명단이 디스코드 채널로 공식 공고되었습니다!`,
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsReleasing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 3개 탭 네비게이션 */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab("errata")}
          className={`py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === "errata"
              ? "bg-amber-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          [탭 1] 실시간 문제 정정 긴급 방송
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("questions")}
          className={`py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === "questions"
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Edit className="w-4 h-4" />
          [탭 2] 1차 CBT 문항 & 선지수 편집기 ({questions.length}문)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("grading")}
          className={`py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === "grading"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          [탭 3] 2차 PDF 채점표 사정 & 공고 ({submissions.length}명)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 탭 1: 실시간 문제 정정 긴급 방송 */}
      {/* ========================================================================= */}
      {activeTab === "errata" && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
          <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                관리자 수험번호 발급
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                발급된 번호만 시험장에 입장할 수 있으며, 응시자 신원과 연결하지
                않는 익명 수험번호입니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                min={1}
                max={500}
                value={issueCount}
                onChange={(e) => setIssueCount(Number(e.target.value))}
                className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={handleIssueCodes}
                disabled={isIssuingCodes}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg"
              >
                {isIssuingCodes ? "발급중..." : "수험번호 발급"}
              </button>
              {issuedCodes.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard?.writeText(issuedCodes.join("\n"))
                  }
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700"
                >
                  목록 복사
                </button>
              )}
            </div>
            {issuedCodes.length > 0 && (
              <textarea
                readOnly
                value={issuedCodes.join("\n")}
                rows={4}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-emerald-300 font-mono"
              />
            )}
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                실시간 문제 정정 긴급 방송 송출기
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                방송 즉시 1차 CBT 응시 중인 모든 수험생 화면 상단에 팝업 및
                디스코드 시험 공지 채널로 전송됩니다.
              </p>
            </div>
            <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 font-mono">
              실시간 전송 지원
            </span>
          </div>

          <form onSubmit={handleBroadcastErrata} className="space-y-3">
            <textarea
              rows={3}
              required
              value={errataText}
              onChange={(e) => setErrataText(e.target.value)}
              placeholder="예: 2번 문제에서 병이 순경 -> 경장 -> 경사 순서로 진급한 것으로 수정하여 풀이하시기 바랍니다. (2, 3번 복수정답 인정)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />

            <div className="flex justify-between items-center">
              <div className="text-[11px] text-slate-500">
                수험생 화면에 즉시 점등되며, 이의제기 채널과도 연동됩니다.
              </div>
              <button
                type="submit"
                disabled={isBroadcasting}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {isBroadcasting ? "전송중..." : "긴급 정정 방송 송출"}
              </button>
            </div>
          </form>

          {/* 이전 송출 목록 */}
          {notices.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-400">
                최근 송출된 정정 공지:
              </div>
              {notices.map((n, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300"
                >
                  <span className="text-amber-400 font-mono font-bold">
                    [{n.createdAt?.split("T")[0] || "공지"}]
                  </span>{" "}
                  {n.content}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 탭 2: 1차 CBT 문항 및 선지수 실시간 편집기 */}
      {/* ========================================================================= */}
      {activeTab === "questions" && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-400" />
                제1차 필기시험 CBT 문항 & 선지 수 실시간 편집기
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                각 문항별로 지문, 선지 개수(2지~8지선다 자유 증감), 선지 내용,
                정답 번호 및 복수정답을 자유롭게 편집할 수 있습니다.
              </p>
            </div>

            <button
              type="button"
              disabled={isSavingQuestions}
              onClick={handleSaveAllQuestions}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSavingQuestions
                ? "저장중..."
                : "문항 및 선지 전체 저장 및 즉시 반영"}
            </button>
          </div>

          <div className="space-y-6">
            {questions.map((q, qIdx) => (
              <div
                key={q.num}
                className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4 hover:border-slate-700 transition-colors"
              >
                {/* 문항 헤더 */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-mono font-bold">
                      제 {q.num} 문
                    </span>
                    <select
                      value={q.subject}
                      onChange={(e) =>
                        handleQuestionChange(qIdx, "subject", e.target.value)
                      }
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                    >
                      <option value="공법">공법 (헌법/행정법)</option>
                      <option value="형사법">형사법 (형법/형소법)</option>
                      <option value="민사법">민사법 (민법/민소법)</option>
                      <option value="소송법">소송법</option>
                      <option value="법조윤리">법조윤리 (변호사법)</option>
                    </select>
                    <span className="text-[11px] text-slate-500">
                      (선지 {q.choices.length}개)
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-400 font-semibold">
                        정답 번호:
                      </span>
                      <select
                        value={q.answer}
                        onChange={(e) =>
                          handleQuestionChange(
                            qIdx,
                            "answer",
                            Number(e.target.value),
                          )
                        }
                        className="bg-slate-900 border border-amber-500/40 text-amber-400 font-bold rounded px-2 py-1 text-xs"
                      >
                        {q.choices.map((_, nIdx) => (
                          <option key={nIdx + 1} value={nIdx + 1}>
                            {nIdx + 1}번
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">복수정답:</span>
                      <input
                        type="text"
                        value={(q.altAnswers || []).join(", ")}
                        onChange={(e) =>
                          handleAltAnswersChange(qIdx, e.target.value)
                        }
                        placeholder="예: 2, 3"
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 문제 지문 */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    문제 지문 (Title / Prompt)
                  </label>
                  <textarea
                    rows={2}
                    value={q.title}
                    onChange={(e) =>
                      handleQuestionChange(qIdx, "title", e.target.value)
                    }
                    placeholder="문제를 입력하세요"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 가변 선지 목록 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-400">
                      선지 목록 (Choices 1~{q.choices.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddChoice(qIdx)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 text-[11px] rounded border border-slate-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> 선지 추가 (
                      {q.choices.length + 1}번)
                    </button>
                  </div>

                  {q.choices.map((choice, cIdx) => (
                    <div key={cIdx} className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                          q.answer === cIdx + 1 ||
                          (q.altAnswers || []).includes(cIdx + 1)
                            ? "bg-amber-500 text-slate-950 font-bold shadow"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {cIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={choice}
                        onChange={(e) =>
                          handleChoiceChange(qIdx, cIdx, e.target.value)
                        }
                        placeholder={`보기 ${cIdx + 1}번 내용`}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                      {q.choices.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChoice(qIdx, cIdx)}
                          title="선지 삭제"
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              disabled={isSavingQuestions}
              onClick={handleSaveAllQuestions}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSavingQuestions
                ? "저장중..."
                : "문항 및 선지 전체 저장 및 즉시 반영"}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 탭 3: 2차 채점 및 최종 합격 공고 (PDF 답안 지원) */}
      {/* ========================================================================= */}
      {activeTab === "grading" && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                수험생 응시 현황 및 2차 서술형/PDF 채점표 사정
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                수험생이 제출한 PDF 파일 다운로드 및 텍스트 답안을 검토하여
                채점합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReleasePassers}
              disabled={isReleasing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
              {isReleasing
                ? "공고 전송중..."
                : "최종 합격자 명단 공식 발표 (디스코드)"}
            </button>
          </div>

          {submissions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              아직 접수된 수험생 답안이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => {
                const currentScore =
                  gradingState[sub.id]?.score ?? (sub.phase2_score || 70);
                const currentFeedback =
                  gradingState[sub.id]?.feedback ?? (sub.phase2_feedback || "");

                return (
                  <div
                    key={sub.id}
                    className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 bg-slate-800 text-blue-400 font-mono font-bold text-xs rounded-md">
                          #{sub.security_code}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            sub.phase1_passed
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-red-500/20 text-red-300 border border-red-500/30"
                          }`}
                        >
                          1차 필기: {sub.phase1_score}점 (
                          {sub.phase1_passed ? "합격" : "과락"})
                        </span>
                        {sub.is_instant_grade_pledged ? (
                          <span className="text-[11px] px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded flex items-center gap-1">
                            <Lock className="w-3 h-3" /> 조기 채점 서약 제출됨
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
                            일반 제출
                          </span>
                        )}
                      </div>

                      <div className="text-xs">
                        최종 상태:{" "}
                        <strong
                          className={
                            sub.final_passed
                              ? "text-emerald-400"
                              : "text-slate-400"
                          }
                        >
                          {sub.final_passed ? "🎉 최종 합격 완료" : "사정 대기"}
                        </strong>
                      </div>
                    </div>

                    {/* 2차 제출 답안 열람 & PDF 다운로드 */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-slate-400" />
                          2차 답안 제출 내역:
                        </span>

                        {/* PDF / 파일 다운로드 링크 */}
                        {sub.phase2_file_url && (
                          <a
                            href={sub.phase2_file_url}
                            download={`2차답안_#${sub.security_code}.pdf`}
                            className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            제출된 PDF/첨부파일 다운로드
                          </a>
                        )}
                      </div>

                      {sub.phase2_text_answer ? (
                        <div className="p-3 bg-slate-900 rounded-lg text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto border border-slate-800">
                          {sub.phase2_text_answer}
                        </div>
                      ) : null}

                      {!sub.phase2_text_answer && !sub.phase2_file_url && (
                        <div className="text-xs text-slate-500 italic">
                          2차 답안이 아직 제출되지 않았습니다.
                        </div>
                      )}
                    </div>

                    {/* 채점 입력 폼 */}
                    <div className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          2차 서술형 득점 (0~100점)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={currentScore}
                          onChange={(e) =>
                            setGradingState((prev) => ({
                              ...prev,
                              [sub.id]: {
                                ...prev[sub.id],
                                score: Number(e.target.value),
                                feedback: currentFeedback,
                              },
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-slate-400 mb-1">
                          출제위원 심사 코멘트
                        </label>
                        <input
                          type="text"
                          value={currentFeedback}
                          onChange={(e) =>
                            setGradingState((prev) => ({
                              ...prev,
                              [sub.id]: {
                                ...prev[sub.id],
                                score: currentScore,
                                feedback: e.target.value,
                              },
                            }))
                          }
                          placeholder="예: 쟁점 정리가 명확하며 판례 인용이 정확함"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        disabled={isGrading === sub.id}
                        onClick={() => handleSaveGrade(sub.id, false)}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-semibold rounded-lg border border-slate-700"
                      >
                        불합격 판정
                      </button>
                      <button
                        type="button"
                        disabled={isGrading === sub.id}
                        onClick={() => handleSaveGrade(sub.id, true)}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow"
                      >
                        {isGrading === sub.id
                          ? "저장중..."
                          : "채점 저장 & 최종 합격 승인"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Calendar,
  Sparkles,
  Settings,
  XCircle,
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

interface ExamAdminClientProps {
  allExams?: any[];
  initialExam?: any | null;
  initialSubmissions?: any[];
  exam?: any;
  submissions?: any[];
}

export default function ExamAdminClient({
  allExams = [],
  initialExam,
  initialSubmissions = [],
  exam: legacyExam,
  submissions: legacySubmissions,
}: ExamAdminClientProps) {
  const router = useRouter();
  const exam = initialExam !== undefined ? initialExam : legacyExam;
  const submissions = initialSubmissions !== undefined ? initialSubmissions : (legacySubmissions || []);

  const [activeTab, setActiveTab] = useState<
    "errata" | "questions" | "grading"
  >("errata");

  // [신규] 0-1. 신규 시험 회차 개설 모달 상태
  const nextDefaultRound = (allExams[0]?.round_number || 17) + 1;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRound, setNewRound] = useState(nextDefaultRound);
  const [newTitle, setNewTitle] = useState(`2026년도 제${nextDefaultRound}회 도스변호사시험`);
  const [newPhase1Start, setNewPhase1Start] = useState("");
  const [newPhase1End, setNewPhase1End] = useState("");
  const [newPhase2Start, setNewPhase2Start] = useState("");
  const [newPhase2End, setNewPhase2End] = useState("");
  const [newStatus, setNewStatus] = useState("SCHEDULED");
  const [newPhase1Pdf, setNewPhase1Pdf] = useState("");
  const [newPhase2Doc1Pdf, setNewPhase2Doc1Pdf] = useState("");
  const [newPhase2Doc2Pdf, setNewPhase2Doc2Pdf] = useState("");
  const [broadcastNewExam, setBroadcastNewExam] = useState(true);
  const [isCreatingExam, setIsCreatingExam] = useState(false);

  // [신규] 0-2. 시험 상태 및 일정 수정 모달 상태
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editTitle, setEditTitle] = useState(exam?.title || "");
  const [editStatus, setEditStatus] = useState(exam?.status || "SCHEDULED");
  const [editPhase1Start, setEditPhase1Start] = useState(exam?.phase1_start || "");
  const [editPhase1End, setEditPhase1End] = useState(exam?.phase1_end || "");
  const [editPhase2Start, setEditPhase2Start] = useState(exam?.phase2_start || "");
  const [editPhase2End, setEditPhase2End] = useState(exam?.phase2_end || "");
  const [editPhase1Pdf, setEditPhase1Pdf] = useState(exam?.phase1_pdf_url || "");
  const [editPhase2Doc1Pdf, setEditPhase2Doc1Pdf] = useState(exam?.phase2_doc1_pdf_url || "");
  const [editPhase2Doc2Pdf, setEditPhase2Doc2Pdf] = useState(exam?.phase2_doc2_pdf_url || "");
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);

  // 1. 실시간 문제 정정 방송 상태
  const [errataText, setErrataText] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [notices, setNotices] = useState<any[]>(
    exam ? JSON.parse(exam.errata_notices || "[]") : [],
  );
  const [issueCount, setIssueCount] = useState(10);
  const [issuedCodes, setIssuedCodes] = useState<string[]>([]);
  const [isIssuingCodes, setIsIssuingCodes] = useState(false);

  // 2. 1차 CBT 문항 편집기 상태
  const initialQuestions: QuestionData[] = exam
    ? JSON.parse(exam.phase1_questions || "[]")
    : [];
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

  // [신규] 0-1. 신규 시험 회차 개설
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRound || !newTitle.trim() || !newPhase1Start || !newPhase1End || !newPhase2Start || !newPhase2End) {
      alert("회차 번호, 시험 명칭, 1차 및 2차 시험 시작/종료 일시를 모두 입력해 주세요.");
      return;
    }
    setIsCreatingExam(true);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_EXAM",
          roundNumber: newRound,
          title: newTitle,
          phase1Start: newPhase1Start,
          phase1End: newPhase1End,
          phase2Start: newPhase2Start,
          phase2End: newPhase2End,
          status: newStatus,
          phase1PdfUrl: newPhase1Pdf,
          phase2Doc1PdfUrl: newPhase2Doc1Pdf,
          phase2Doc2PdfUrl: newPhase2Doc2Pdf,
          broadcastNotice: broadcastNewExam,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "시험 개설 실패");
      alert(data.message || "새 시험 회차가 성공적으로 개설되었습니다!");
      setShowCreateModal(false);
      router.push(`/exam/admin?examId=${data.examId}`);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsCreatingExam(false);
    }
  };

  // [신규] 0-2. 시험 일정 및 상태 수정
  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exam?.id) return;
    setIsUpdatingSchedule(true);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_EXAM_SCHEDULE",
          examId: exam.id,
          title: editTitle,
          status: editStatus,
          phase1Start: editPhase1Start,
          phase1End: editPhase1End,
          phase2Start: editPhase2Start,
          phase2End: editPhase2End,
          phase1PdfUrl: editPhase1Pdf,
          phase2Doc1PdfUrl: editPhase2Doc1Pdf,
          phase2Doc2PdfUrl: editPhase2Doc2Pdf,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "일정 변경 실패");
      alert("✅ 시험 정보 및 일정이 성공적으로 변경되었습니다!");
      setShowScheduleModal(false);
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  // 최종 합격자 공개 발표
  const handleReleaseResults = async () => {
    if (!confirm(`"${exam.title}" 최종 합격자 명단을 포털과 디스코드에 공식 발표하시겠습니까?\n\n이 작업은 취소할 수 없습니다.`)) return;
    setIsReleasing(true);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RELEASE_RESULTS", examId: exam.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "발표 실패");
      alert(`🎉 ${data.message}\n합격자 명단은 /exam/results 에서 공개됩니다.`);
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsReleasing(false);
    }
  };

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
      {/* 상단 시험 회차 관리 및 상태 컨트롤 바 */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {allExams.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">회차 선택:</span>
              <select
                value={exam?.id || ""}
                onChange={(e) => {
                  router.push(`/exam/admin?examId=${e.target.value}`);
                }}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-indigo-500"
              >
                {allExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    제{ex.round_number}회 ({ex.title})
                  </option>
                ))}
              </select>
            </div>
          )}

          {exam && (
            <>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-extrabold">
                  제{exam.round_number}회
                </span>
                <h2 className="text-base font-extrabold text-white">
                  {exam.title}
                </h2>
              </div>

              {/* 상태 배지 */}
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  exam.status === "SCHEDULED"
                    ? "bg-slate-800 text-slate-300 border-slate-700"
                    : exam.status === "PHASE1"
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse"
                      : exam.status === "PHASE2"
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse"
                        : exam.status === "GRADING"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {exam.status === "SCHEDULED"
                  ? "시험 대기중 (SCHEDULED)"
                  : exam.status === "PHASE1"
                    ? "제1차 CBT 필기 진행중"
                    : exam.status === "PHASE2"
                      ? "제2차 서술형 제출 진행중"
                      : exam.status === "GRADING"
                        ? "2차 채점표 사정 진행중"
                        : "최종 합격자 공고 완료 (FINISHED)"}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {exam && (
            <button
              type="button"
              onClick={() => {
                setEditTitle(exam.title || "");
                setEditStatus(exam.status || "SCHEDULED");
                setEditPhase1Start(exam.phase1_start || "");
                setEditPhase1End(exam.phase1_end || "");
                setEditPhase2Start(exam.phase2_start || "");
                setEditPhase2End(exam.phase2_end || "");
                setEditPhase1Pdf(exam.phase1_pdf_url || "");
                setEditPhase2Doc1Pdf(exam.phase2_doc1_pdf_url || "");
                setEditPhase2Doc2Pdf(exam.phase2_doc2_pdf_url || "");
                setShowScheduleModal(true);
              }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 shadow"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              시험 일정·상태 변경
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            신규 시험(회차) 개설
          </button>
        </div>
      </div>

      {!exam ? (
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 mx-auto bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">등록된 변호사시험 회차가 없습니다.</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            변호사시험관리위원회에서 첫 번째 시험 회차를 개설하여 1차 CBT 필기 문항과 2차 서술형 문제지 일정을 시작하세요.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            제{nextDefaultRound}회 변호사시험 개설하기
          </button>
        </div>
      ) : (
        <>
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

          {/* 최종 합격자 공개 발표 버튼 */}
          {submissions.length > 0 && exam.status !== "FINISHED" && (
            <div className="mt-6 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
              <div>
                <div className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  최종 합격자 공개 발표
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  모든 채점 완료 후 클릭하면 포털 /exam/results 에 합격자 명단이 공개되고 디스코드로 공식 발표됩니다.
                </p>
              </div>
              <button
                type="button"
                disabled={isReleasing}
                onClick={handleReleaseResults}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2 shrink-0"
              >
                <Award className="w-4 h-4" />
                {isReleasing ? "발표중..." : "최종 합격자 명단 공개 발표"}
              </button>
            </div>
          )}
          {exam.status === "FINISHED" && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              합격자 명단이 공개 발표되었습니다. (/exam/results 에서 확인)
            </div>
          )}
          </div>
        )}
      </>
    )}

      {/* ========================================================================= */}
      {/* 모달 1: 신규 시험 회차 개설 모달 */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    신규 변호사시험(회차) 개설
                  </h3>
                  <p className="text-xs text-slate-400">
                    새로운 시험 일정을 공고하고 1차 필기 및 2차 서술형 문제지를 등록합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    시험 회차 번호
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newRound}
                    onChange={(e) => {
                      const r = Number(e.target.value);
                      setNewRound(r);
                      setNewTitle(`2026년도 제${r}회 도스변호사시험`);
                    }}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    시험 명칭 (공식 타이틀)
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* 진행 상태 */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  초기 시험 진행 상태
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="SCHEDULED">시험 대기중 (SCHEDULED) - 접수 및 공고 상태</option>
                  <option value="PHASE1">제1차 CBT 필기 진행중 (PHASE1)</option>
                  <option value="PHASE2">제2차 서술형 제출 진행중 (PHASE2)</option>
                  <option value="GRADING">2차 채점표 사정 진행중 (GRADING)</option>
                  <option value="FINISHED">최종 합격자 공고 완료 (FINISHED)</option>
                </select>
              </div>

              {/* 1차 필기 일정 */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> 제1차 CBT 필기 (10문항) 일정
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      1차 시작 일시
                    </label>
                    <input
                      type="text"
                      placeholder="예: 2026-09-24 20:00:00"
                      value={newPhase1Start}
                      onChange={(e) => setNewPhase1Start(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      1차 마감 일시 (120분)
                    </label>
                    <input
                      type="text"
                      placeholder="예: 2026-09-24 22:00:00"
                      value={newPhase1End}
                      onChange={(e) => setNewPhase1End(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 2차 서술형 일정 */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> 제2차 서술형 (24시간) 일정
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      2차 시작 일시
                    </label>
                    <input
                      type="text"
                      placeholder="예: 2026-09-24 23:00:00"
                      value={newPhase2Start}
                      onChange={(e) => setNewPhase2Start(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      2차 마감 일시 (24시간)
                    </label>
                    <input
                      type="text"
                      placeholder="예: 2026-09-25 23:00:00"
                      value={newPhase2End}
                      onChange={(e) => setNewPhase2End(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 문제지 PDF URL (선택) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400">
                  문제지 PDF URL (선택 사항)
                </label>
                <input
                  type="text"
                  placeholder="1차 필기 문제지 PDF 링크 (선택)"
                  value={newPhase1Pdf}
                  onChange={(e) => setNewPhase1Pdf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
                <input
                  type="text"
                  placeholder="2차 제1문 논술 문제지 PDF 링크 (선택)"
                  value={newPhase2Doc1Pdf}
                  onChange={(e) => setNewPhase2Doc1Pdf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
                <input
                  type="text"
                  placeholder="2차 제2문 실무기록 문제지 PDF 링크 (선택)"
                  value={newPhase2Doc2Pdf}
                  onChange={(e) => setNewPhase2Doc2Pdf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              {/* 디스코드 방송 체크박스 */}
              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={broadcastNewExam}
                  onChange={(e) => setBroadcastNewExam(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-500"
                />
                <span className="text-xs font-bold text-slate-300">
                  📢 개설 즉시 디스코드 시험 채널(EXAM)로 시행 일정 공식 공고 발송
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isCreatingExam}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  {isCreatingExam ? "개설중..." : "신규 시험 개설하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 모달 2: 시험 일정 및 상태 수정 모달 */}
      {/* ========================================================================= */}
      {showScheduleModal && exam && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    제{exam.round_number}회 시험 일정 및 상태 변경
                  </h3>
                  <p className="text-xs text-slate-400">
                    시험 진행 단계와 시작/종료 일시를 변경합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  시험 명칭
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  현재 시험 진행 단계 (Status)
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                >
                  <option value="SCHEDULED">시험 대기중 (SCHEDULED)</option>
                  <option value="PHASE1">제1차 CBT 필기 진행중 (PHASE1)</option>
                  <option value="PHASE2">제2차 서술형 제출 진행중 (PHASE2)</option>
                  <option value="GRADING">2차 채점표 사정 진행중 (GRADING)</option>
                  <option value="FINISHED">최종 합격자 공고 완료 (FINISHED)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    1차 시작 일시
                  </label>
                  <input
                    type="text"
                    value={editPhase1Start}
                    onChange={(e) => setEditPhase1Start(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    1차 마감 일시
                  </label>
                  <input
                    type="text"
                    value={editPhase1End}
                    onChange={(e) => setEditPhase1End(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    2차 시작 일시
                  </label>
                  <input
                    type="text"
                    value={editPhase2Start}
                    onChange={(e) => setEditPhase2Start(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    2차 마감 일시
                  </label>
                  <input
                    type="text"
                    value={editPhase2End}
                    onChange={(e) => setEditPhase2End(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400">
                  문제지 PDF URL
                </label>
                <input
                  type="text"
                  placeholder="1차 필기 PDF URL"
                  value={editPhase1Pdf}
                  onChange={(e) => setEditPhase1Pdf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                />
                <input
                  type="text"
                  placeholder="2차 제1문 논술 PDF URL"
                  value={editPhase2Doc1Pdf}
                  onChange={(e) => setEditPhase2Doc1Pdf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                />
                <input
                  type="text"
                  placeholder="2차 제2문 실무기록 PDF URL"
                  value={editPhase2Doc2Pdf}
                  onChange={(e) => setEditPhase2Doc2Pdf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSchedule}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  {isUpdatingSchedule ? "저장중..." : "변경 사항 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

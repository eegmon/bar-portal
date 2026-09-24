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
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface QuestionData {
  num: number;
  subject: string;
  title: string;
  choices: string[];
  answer: number;
  score: number;
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

function toDateTimeLocal(value: unknown): string {
  return String(value || "")
    .replace(" ", "T")
    .slice(0, 16);
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
  const submissions =
    initialSubmissions !== undefined
      ? initialSubmissions
      : legacySubmissions || [];

  const [activeTab, setActiveTab] = useState<
    "errata" | "questions" | "grading" | "bonus"
  >(() => {
    if (exam?.status === "PHASE2" || exam?.status === "GRADING") {
      return "grading";
    }
    return "questions";
  });

  // [신규] 0-1. 신규 시험 회차 개설 모달 상태
  const nextDefaultRound = (allExams[0]?.round_number || 17) + 1;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRound, setNewRound] = useState(nextDefaultRound);
  const [newTitle, setNewTitle] = useState(
    `2026년도 제${nextDefaultRound}회 도스변호사시험`,
  );
  const [newPhase1Start, setNewPhase1Start] = useState("");
  const [newPhase1End, setNewPhase1End] = useState("");
  const [newPhase2Start, setNewPhase2Start] = useState("");
  const [newPhase2End, setNewPhase2End] = useState("");
  const [newStatus, setNewStatus] = useState("SCHEDULED");
  const [newPhase1Pdf, setNewPhase1Pdf] = useState("");
  const [newPhase2Doc1Pdf, setNewPhase2Doc1Pdf] = useState("");
  const [newPhase2Doc2Pdf, setNewPhase2Doc2Pdf] = useState("");
  const [newPhase1MaxScore, setNewPhase1MaxScore] = useState(100);
  const [newPhase1PassScore, setNewPhase1PassScore] = useState<string>("");
  const [newPhase1Rules, setNewPhase1Rules] = useState("");
  const [newPhase2Question1MaxScore, setNewPhase2Question1MaxScore] =
    useState(50);
  const [newPhase2Question2MaxScore, setNewPhase2Question2MaxScore] =
    useState(50);
  const [newFinalPassingScore, setNewFinalPassingScore] = useState(0);
  const [newPhase1OperationMode, setNewPhase1OperationMode] = useState<
    "TIME" | "MANUAL"
  >("MANUAL");
  const [newPhase2OperationMode, setNewPhase2OperationMode] = useState<
    "TIME" | "MANUAL"
  >("MANUAL");
  const [broadcastNewExam, setBroadcastNewExam] = useState(true);
  const [isCreatingExam, setIsCreatingExam] = useState(false);

  // [신규] 0-2. 시험 상태 및 일정 수정 모달 상태
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editTitle, setEditTitle] = useState(exam?.title || "");
  const [editStatus, setEditStatus] = useState(exam?.status || "SCHEDULED");
  const [editPhase1Start, setEditPhase1Start] = useState(
    toDateTimeLocal(exam?.phase1_start),
  );
  const [editPhase1End, setEditPhase1End] = useState(
    toDateTimeLocal(exam?.phase1_end),
  );
  const [editPhase2Start, setEditPhase2Start] = useState(
    toDateTimeLocal(exam?.phase2_start),
  );
  const [editPhase2End, setEditPhase2End] = useState(
    toDateTimeLocal(exam?.phase2_end),
  );
  const [editPhase1Pdf, setEditPhase1Pdf] = useState(
    exam?.phase1_pdf_url || "",
  );
  const [editPhase2Doc1Pdf, setEditPhase2Doc1Pdf] = useState(
    exam?.phase2_doc1_pdf_url || "",
  );
  const [editPhase2Doc2Pdf, setEditPhase2Doc2Pdf] = useState(
    exam?.phase2_doc2_pdf_url || "",
  );
  const [editPhase1MaxScore, setEditPhase1MaxScore] = useState(
    Number(exam?.phase1_max_score || 100),
  );
  // phase1_pass_score: null이면 빈 문자열(자동 60%), 숫자면 직접 설정값
  const [editPhase1PassScore, setEditPhase1PassScore] = useState<string>(
    exam?.phase1_pass_score != null ? String(exam.phase1_pass_score) : "",
  );
  const [editPhase1Rules, setEditPhase1Rules] = useState<string>(
    exam?.phase1_rules || "",
  );
  const [editPhase2Question1MaxScore, setEditPhase2Question1MaxScore] =
    useState(Number(exam?.phase2_question1_max_score || 50));
  const [editPhase2Question2MaxScore, setEditPhase2Question2MaxScore] =
    useState(Number(exam?.phase2_question2_max_score || 50));
  const [editFinalPassingScore, setEditFinalPassingScore] = useState(
    Number(exam?.final_passing_score || 0),
  );
  const [editPhase1OperationMode, setEditPhase1OperationMode] = useState<
    "TIME" | "MANUAL"
  >(exam?.phase1_operation_mode === "TIME" ? "TIME" : "MANUAL");
  const [editPhase2OperationMode, setEditPhase2OperationMode] = useState<
    "TIME" | "MANUAL"
  >(exam?.phase2_operation_mode === "TIME" ? "TIME" : "MANUAL");
  const [finalPassingScore, setFinalPassingScore] = useState(
    Number(exam?.final_passing_score || 0),
  );
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);

  // [Phase 빠른 전환] 현재 상태에서 다음/이전 단계로 원클릭 전환
  const PHASE_ORDER = ["SCHEDULED", "PHASE1", "PHASE2", "GRADING", "FINISHED"];
  const [isChangingPhase, setIsChangingPhase] = useState(false);

  const handleQuickPhaseChange = async (targetStatus: string) => {
    if (!exam?.id) return;
    const label =
      targetStatus === "SCHEDULED"
        ? "시험 대기중 (SCHEDULED)"
        : targetStatus === "PHASE1"
          ? "제1차 CBT 필기 진행중 (PHASE1)"
          : targetStatus === "PHASE2"
            ? "제2차 서술형 제출 진행중 (PHASE2)"
            : targetStatus === "GRADING"
              ? "2차 채점표 사정 진행중 (GRADING)"
              : "최종 합격자 공고 완료 (FINISHED)";

    if (!confirm(`시험 진행 단계를 [${label}](으)로 변경하시겠습니까?`)) return;

    setIsChangingPhase(true);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_EXAM_SCHEDULE",
          examId: exam.id,
          title: exam.title,
          status: targetStatus,
          phase1Start: toDateTimeLocal(exam.phase1_start),
          phase1End: toDateTimeLocal(exam.phase1_end),
          phase2Start: toDateTimeLocal(exam.phase2_start),
          phase2End: toDateTimeLocal(exam.phase2_end),
          phase1PdfUrl: exam.phase1_pdf_url || "",
          phase2Doc1PdfUrl: exam.phase2_doc1_pdf_url || "",
          phase2Doc2PdfUrl: exam.phase2_doc2_pdf_url || "",
          phase1MaxScore: Number(exam.phase1_max_score || 100),
          phase1PassScore:
            exam.phase1_pass_score != null ? Number(exam.phase1_pass_score) : null,
          phase2Question1MaxScore: Number(
            exam.phase2_question1_max_score || 50,
          ),
          phase2Question2MaxScore: Number(
            exam.phase2_question2_max_score || 50,
          ),
          finalPassingScore: Number(exam.final_passing_score || 0),
          phase1OperationMode:
            exam.phase1_operation_mode === "TIME" ? "TIME" : "MANUAL",
          phase2OperationMode:
            exam.phase2_operation_mode === "TIME" ? "TIME" : "MANUAL",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "단계 변경 실패");
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsChangingPhase(false);
    }
  };

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
  const defaultQuestionScore = Math.max(
    1,
    Math.round(Number(exam?.phase1_max_score || 100) / 10),
  );
  const initialQuestions: QuestionData[] = exam
    ? JSON.parse(exam.phase1_questions || "[]").map((question: QuestionData) => ({
        ...question,
        score: Number(question.score || defaultQuestionScore),
      }))
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
          score: defaultQuestionScore,
          altAnswers: [],
          explanation: "",
        })),
  );
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);

  // 3. 2차 채점 상태
  const [gradingState, setGradingState] = useState<
    Record<
      string,
      { question1Score: number; question2Score: number; feedback: string }
    >
  >({});
  const [isGrading, setIsGrading] = useState<string | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isDeletingExam, setIsDeletingExam] = useState(false);

  // 4. 가산점 승인 관련 상태
  const [bonusSubmissions, setBonusSubmissions] = useState<any[]>([]);
  const [bonusMultiplierEdit, setBonusMultiplierEdit] = useState<string>(
    exam?.bonus_multiplier != null ? String(Number(exam.bonus_multiplier) * 100) : "10"
  );
  const [isLoadingBonus, setIsLoadingBonus] = useState(false);
  const [isSavingBonusMultiplier, setIsSavingBonusMultiplier] = useState(false);
  const [isTogglingBonus, setIsTogglingBonus] = useState<string | null>(null);

  const loadBonusSubmissions = async () => {
    if (!exam?.id) return;
    setIsLoadingBonus(true);
    try {
      const res = await fetch(`/api/exam/admin?examId=${exam.id}`);
      const data = await res.json();
      if (data.success) {
        setBonusSubmissions(data.submissions || []);
        // 배율은 서버값 우선
        if (data.bonusMultiplier != null) {
          setBonusMultiplierEdit(String(Math.round(data.bonusMultiplier * 100)));
        }
      }
    } catch (err: any) {
      alert(`가산점 목록 로드 실패: ${err.message}`);
    } finally {
      setIsLoadingBonus(false);
    }
  };

  const handleSaveBonusMultiplier = async () => {
    if (!exam?.id) return;
    const multiplier = Number(bonusMultiplierEdit) / 100;
    if (isNaN(multiplier) || multiplier < 0 || multiplier > 1) {
      alert("가산점 배율은 0~100% 사이로 입력해 주세요.");
      return;
    }
    setIsSavingBonusMultiplier(true);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_EXAM_SCHEDULE",
          examId: exam.id,
          bonusMultiplier: multiplier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      alert(`✅ 가산점 배율이 ${bonusMultiplierEdit}%로 저장되었습니다.`);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSavingBonusMultiplier(false);
    }
  };

  const handleToggleBonusApproval = async (subId: string, currentApproved: number) => {
    setIsTogglingBonus(subId);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SET_BONUS_APPROVAL",
          submissionId: subId,
          approved: !currentApproved,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "처리 실패");
      alert(data.message);
      setBonusSubmissions((prev) =>
        prev.map((s) => s.id === subId ? { ...s, bonus_approved: currentApproved ? 0 : 1 } : s)
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsTogglingBonus(null);
    }
  };

  const handleDeleteExam = async () => {
    if (!exam?.id) return;
    if (
      !confirm(
        `⚠️ 삭제 확인\n제${exam.round_number}회 시험(${exam.title})을 삭제하시겠습니까?\n\n수험생 제출 기록 전체가 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.`,
      )
    )
      return;
    // 2차 확인
    const input = prompt(
      `삭제를 확인하려면 시험 제목을 정확히 입력하세요:\n"${exam.title}"`,
    );
    if (input?.trim() !== exam.title.trim()) {
      alert("시험 제목이 일치하지 않아 삭제가 취소되었습니다.");
      return;
    }

    setIsDeletingExam(true);
    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_EXAM", examId: exam.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "삭제 실패");
      alert(data.message);
      router.push("/exam/admin");
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsDeletingExam(false);
    }
  };

  // [신규] 0-1. 신규 시험 회차 개설
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newRound ||
      !newTitle.trim() ||
      !newPhase1Start ||
      !newPhase1End ||
      !newPhase2Start ||
      !newPhase2End
    ) {
      alert(
        "회차 번호, 시험 명칭, 1차 및 2차 시험 시작/종료 일시를 모두 입력해 주세요.",
      );
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
          phase1MaxScore: newPhase1MaxScore,
          phase1PassScore: newPhase1PassScore !== "" ? Number(newPhase1PassScore) : null,
          phase1Rules: newPhase1Rules,
          phase2Question1MaxScore: newPhase2Question1MaxScore,
          phase2Question2MaxScore: newPhase2Question2MaxScore,
          finalPassingScore: newFinalPassingScore,
          phase1OperationMode: newPhase1OperationMode,
          phase2OperationMode: newPhase2OperationMode,
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
          phase1MaxScore: editPhase1MaxScore,
          phase1PassScore: editPhase1PassScore !== "" ? Number(editPhase1PassScore) : null,
          phase1Rules: editPhase1Rules,
          phase2Question1MaxScore: editPhase2Question1MaxScore,
          phase2Question2MaxScore: editPhase2Question2MaxScore,
          finalPassingScore: editFinalPassingScore,
          phase1OperationMode: editPhase1OperationMode,
          phase2OperationMode: editPhase2OperationMode,
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
    const invalidQuestion = questions.find(
      (question) =>
        !question.title.trim() ||
        question.choices.length < 2 ||
        question.choices.some((choice) => !choice.trim()) ||
        question.answer < 1 ||
        question.answer > question.choices.length ||
        !Number.isInteger(question.score) ||
        question.score <= 0 ||
        (question.altAnswers || []).some(
          (answer) => answer < 1 || answer > question.choices.length,
        ),
    );
    if (invalidQuestion) {
      alert(
        `제${invalidQuestion.num}문을 확인해 주세요. 문제 지문과 모든 선지를 입력하고 정답 번호를 선지 범위 안에서 지정해야 합니다.`,
      );
      return;
    }

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
  const handleSaveGrade = async (subId: string) => {
    const current = gradingState[subId] || {
      question1Score: 0,
      question2Score: 0,
      feedback: "",
    };
    setIsGrading(subId);

    try {
      const res = await fetch("/api/exam/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GRADE_PHASE2",
          submissionId: subId,
          phase2Question1Score: current.question1Score,
          phase2Question2Score: current.question2Score,
          feedback: current.feedback,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "채점 실패");

      alert(`✅ 수험생 점수가 저장되었습니다. (총점: ${data.totalScore}점)`);
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsGrading(null);
    }
  };

  // 4. 최종 합격자 공고 릴리즈
  const handleReleasePassers = async () => {
    if (!Number.isInteger(finalPassingScore) || finalPassingScore < 0) {
      alert("최종 합격점수는 0 이상의 정수로 입력해 주세요.");
      return;
    }
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
          action: "RELEASE_RESULTS",
          examId: exam.id,
          passingScore: finalPassingScore,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "발표 실패");

      alert(
        `최종 합격선 ${finalPassingScore}점 기준 ${data.count}명의 합격자 명단이 공식 공고되었습니다!`,
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
              <span className="text-xs text-slate-400 font-semibold">
                회차 선택:
              </span>
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
                setEditPhase1Start(toDateTimeLocal(exam.phase1_start));
                setEditPhase1End(toDateTimeLocal(exam.phase1_end));
                setEditPhase2Start(toDateTimeLocal(exam.phase2_start));
                setEditPhase2End(toDateTimeLocal(exam.phase2_end));
                setEditPhase1Pdf(exam.phase1_pdf_url || "");
                setEditPhase2Doc1Pdf(exam.phase2_doc1_pdf_url || "");
                setEditPhase2Doc2Pdf(exam.phase2_doc2_pdf_url || "");
                setEditPhase1MaxScore(Number(exam.phase1_max_score || 100));
                setEditPhase1PassScore(
                  exam.phase1_pass_score != null
                    ? String(exam.phase1_pass_score)
                    : "",
                );
                setEditPhase1Rules(exam.phase1_rules || "");
                setEditPhase2Question1MaxScore(
                  Number(exam.phase2_question1_max_score || 50),
                );
                setEditPhase2Question2MaxScore(
                  Number(exam.phase2_question2_max_score || 50),
                );
                setEditFinalPassingScore(Number(exam.final_passing_score || 0));
                setEditPhase1OperationMode(
                  exam.phase1_operation_mode === "TIME" ? "TIME" : "MANUAL",
                );
                setEditPhase2OperationMode(
                  exam.phase2_operation_mode === "TIME" ? "TIME" : "MANUAL",
                );
                setShowScheduleModal(true);
              }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 shadow"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              시험 일정·상태 변경
            </button>
          )}

          {exam && (
            <button
              type="button"
              onClick={handleDeleteExam}
              disabled={isDeletingExam}
              className="px-3.5 py-2 bg-red-900/40 hover:bg-red-800/60 disabled:bg-slate-800 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl border border-red-700/40 transition-colors flex items-center gap-1.5 shadow"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isDeletingExam ? "삭제중..." : "시험 삭제"}
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

      {/* Phase 빠른 전환 버튼 바 */}
      {exam && (
        <div className="px-5 py-3 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500 font-semibold mr-1 shrink-0">
            진행 단계 빠른 전환:
          </span>
          {PHASE_ORDER.map((phase, idx) => {
            const isCurrent = exam.status === phase;
            const labels: Record<string, string> = {
              SCHEDULED: "대기중",
              PHASE1: "1차 CBT",
              PHASE2: "2차 서술형",
              GRADING: "채점 사정",
              FINISHED: "공고 완료",
            };
            const colors: Record<string, string> = {
              SCHEDULED:
                "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600",
              PHASE1:
                "bg-blue-600/80 border-blue-500/60 text-white hover:bg-blue-500",
              PHASE2:
                "bg-purple-600/80 border-purple-500/60 text-white hover:bg-purple-500",
              GRADING:
                "bg-amber-600/80 border-amber-500/60 text-white hover:bg-amber-500",
              FINISHED:
                "bg-emerald-600/80 border-emerald-500/60 text-white hover:bg-emerald-500",
            };
            const currentColors: Record<string, string> = {
              SCHEDULED: "bg-slate-600 border-slate-400 text-white ring-2 ring-slate-400/50",
              PHASE1: "bg-blue-500 border-blue-300 text-white ring-2 ring-blue-400/50",
              PHASE2: "bg-purple-500 border-purple-300 text-white ring-2 ring-purple-400/50",
              GRADING: "bg-amber-500 border-amber-300 text-slate-950 ring-2 ring-amber-400/50",
              FINISHED: "bg-emerald-500 border-emerald-300 text-white ring-2 ring-emerald-400/50",
            };
            return (
              <div key={phase} className="flex items-center gap-1">
                {idx > 0 && (
                  <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                )}
                <button
                  type="button"
                  disabled={isCurrent || isChangingPhase}
                  onClick={() => handleQuickPhaseChange(phase)}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                    isCurrent
                      ? currentColors[phase]
                      : colors[phase] +
                        " disabled:opacity-40"
                  }`}
                >
                  {isChangingPhase && !isCurrent ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isCurrent ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  ) : null}
                  {labels[phase]}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!exam ? (
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 mx-auto bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">
            등록된 변호사시험 회차가 없습니다.
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            변호사시험관리위원회에서 첫 번째 시험 회차를 개설하여 1차 CBT 필기
            문항과 2차 서술형 문제지 일정을 시작하세요.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />제{nextDefaultRound}회 변호사시험
            개설하기
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
            <button
              type="button"
              onClick={() => { setActiveTab("bonus"); loadBonusSubmissions(); }}
              className={`py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                activeTab === "bonus"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Award className="w-4 h-4" />
              [탭 4] 법학과정 가산점 승인
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: "1차 CBT",
                value: `${questions.length}문`,
                active: activeTab === "questions",
              },
              {
                label: "2차 제출",
                value: `${submissions.length}명`,
                active: activeTab === "grading",
              },
              { label: "시험 상태", value: exam.status, active: true },
            ].map((item) => (
              <div
                key={item.label}
                className={`px-4 py-3 rounded-xl border ${item.active ? "bg-indigo-500/10 border-indigo-500/30" : "bg-slate-900 border-slate-800"}`}
              >
                <div className="text-[11px] text-slate-500">{item.label}</div>
                <div className="mt-1 text-sm font-bold text-white">
                  {item.value}
                </div>
              </div>
            ))}
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
                    발급된 번호만 시험장에 입장할 수 있으며, 응시자 신원과
                    연결하지 않는 익명 수험번호입니다.
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
                    각 문항별로 지문, 선지 개수(2지~8지선다 자유 증감), 선지
                    내용, 정답 번호 및 복수정답을 자유롭게 편집할 수 있습니다.
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
                            handleQuestionChange(
                              qIdx,
                              "subject",
                              e.target.value,
                            )
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
                        <label className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                          배점
                          <input
                            type="number"
                            min={1}
                            value={q.score}
                            onChange={(e) =>
                              handleQuestionChange(qIdx, "score", Number(e.target.value))
                            }
                            className="w-16 bg-slate-900 border border-emerald-500/40 rounded px-2 py-1 text-xs text-white font-mono"
                          />
                          점
                        </label>
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

              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex flex-wrap items-end gap-3">
                <label className="text-xs text-slate-300 font-bold">
                  최종 합격점수
                  <input
                    type="number"
                    min={0}
                    value={finalPassingScore}
                    onChange={(e) =>
                      setFinalPassingScore(Number(e.target.value))
                    }
                    className="block mt-1 w-32 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </label>
                <span className="text-[11px] text-slate-500 pb-2">
                  게시 시 총점이 이 점수 이상인 응시자를 자동으로 합격
                  공고합니다.
                </span>
              </div>

              {submissions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  아직 접수된 수험생 답안이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((sub) => {
                    const currentQuestion1Score =
                      gradingState[sub.id]?.question1Score ??
                      Number(sub.phase2_question1_score || 0);
                    const currentQuestion2Score =
                      gradingState[sub.id]?.question2Score ??
                      Number(sub.phase2_question2_score || 0);
                    const currentFeedback =
                      gradingState[sub.id]?.feedback ??
                      (sub.phase2_feedback || "");

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
                                <Lock className="w-3 h-3" /> 조기 채점 서약
                                제출됨
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
                              {sub.final_passed
                                ? "🎉 최종 합격 완료"
                                : "사정 대기"}
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
                        <div className="pt-2 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                              제1문 점수 (0~
                              {Number(exam?.phase2_question1_max_score || 50)}
                              점)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={Number(
                                exam?.phase2_question1_max_score || 50,
                              )}
                              value={currentQuestion1Score}
                              onChange={(e) =>
                                setGradingState((prev) => ({
                                  ...prev,
                                  [sub.id]: {
                                    ...prev[sub.id],
                                    question1Score: Number(e.target.value),
                                    question2Score: currentQuestion2Score,
                                    feedback: currentFeedback,
                                  },
                                }))
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] text-slate-400 mb-1">
                              제2문 점수 (0~
                              {Number(exam?.phase2_question2_max_score || 50)}
                              점)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={Number(
                                exam?.phase2_question2_max_score || 50,
                              )}
                              value={currentQuestion2Score}
                              onChange={(e) =>
                                setGradingState((prev) => ({
                                  ...prev,
                                  [sub.id]: {
                                    ...prev[sub.id],
                                    question1Score: currentQuestion1Score,
                                    question2Score: Number(e.target.value),
                                    feedback: currentFeedback,
                                  },
                                }))
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                            />
                            <div className="text-[10px] text-emerald-400 mt-1">
                              2차 합계:{" "}
                              {currentQuestion1Score + currentQuestion2Score} /{" "}
                              {Number(exam?.phase2_question1_max_score || 50) +
                                Number(exam?.phase2_question2_max_score || 50)}
                              점
                            </div>
                          </div>

                          <div>
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
                                    question1Score: currentQuestion1Score,
                                    question2Score: currentQuestion2Score,
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
                            onClick={() => handleSaveGrade(sub.id)}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg"
                          >
                            {isGrading === sub.id ? "저장중..." : "점수 저장"}
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
                      모든 채점 완료 후 클릭하면 포털 /exam/results 에 합격자
                      명단이 공개되고 디스코드로 공식 발표됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isReleasing}
                    onClick={handleReleasePassers}
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

          {/* ========================================================================= */}
          {/* 탭 4: 법학과정 가산점 승인 */}
          {/* ========================================================================= */}
          {activeTab === "bonus" && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-400" />
                    법학과정 가산점 승인 관리
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    수험번호를 클레임한 응시자 중 <strong className="text-indigo-300">가산점 자격(bonus_eligible=1)</strong>이 있는 계정을 확인하고 회차별 가산점을 승인합니다.
                    가산점은 <strong className="text-amber-300">GRADE_PHASE2(2차 채점)</strong> 시 자동 반영됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadBonusSubmissions}
                  disabled={isLoadingBonus}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBonus ? "animate-spin" : ""}`} />
                  {isLoadingBonus ? "로딩중..." : "목록 새로고침"}
                </button>
              </div>

              {/* 가산점 배율 설정 */}
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  이 회차 가산점 배율 설정
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={bonusMultiplierEdit}
                      onChange={(e) => setBonusMultiplierEdit(e.target.value)}
                      className="w-16 bg-transparent text-white text-sm font-mono focus:outline-none"
                    />
                    <span className="text-slate-400 text-xs">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveBonusMultiplier}
                    disabled={isSavingBonusMultiplier}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    {isSavingBonusMultiplier ? "저장중..." : "배율 저장"}
                  </button>
                  <span className="text-[11px] text-slate-500">
                    1차 득점 × {bonusMultiplierEdit}% = 가산점 (소수점 반올림)
                  </span>
                </div>
              </div>

              {/* 클레임된 수험번호 목록 */}
              {bonusSubmissions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  {isLoadingBonus
                    ? "불러오는 중..."
                    : "클레임된 수험번호가 없습니다. 목록 새로고침을 눌러주세요."}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">
                    총 {bonusSubmissions.length}명이 수험번호를 클레임했습니다.
                    가산점 자격이 있는 응시자만 승인 버튼이 활성화됩니다.
                  </p>
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                    {bonusSubmissions.map((sub) => {
                      const hasEligibility = Number(sub.bonus_eligible) === 1;
                      const isApproved = Number(sub.bonus_approved) === 1;
                      return (
                        <div key={sub.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs ${hasEligibility ? "bg-slate-900" : "bg-slate-950/60"}`}>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-slate-400">#{sub.security_code}</span>
                            <div>
                              <p className="font-bold text-white">
                                {sub.claimed_name || "이름 없음"}
                                <span className="ml-1.5 text-slate-500 font-normal">({sub.claimed_login_id})</span>
                              </p>
                              <p className="text-slate-500 mt-0.5">
                                1차: {sub.phase1_score ?? "-"}점
                                {hasEligibility && (
                                  <span className="ml-2 text-indigo-300">
                                    → 예상 가산: +{Math.round(Number(sub.phase1_score || 0) * (Number(bonusMultiplierEdit) / 100))}점
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasEligibility ? (
                              <>
                                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${isApproved ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" : "bg-slate-800 text-slate-500 border-slate-700"}`}>
                                  {isApproved ? "✅ 가산점 승인됨" : "⏸ 미승인"}
                                </span>
                                <button
                                  type="button"
                                  disabled={isTogglingBonus === sub.id}
                                  onClick={() => handleToggleBonusApproval(sub.id, sub.bonus_approved)}
                                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${
                                    isApproved
                                      ? "bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-600/40"
                                      : "bg-indigo-600 hover:bg-indigo-500 text-white"
                                  }`}
                                >
                                  {isTogglingBonus === sub.id ? "처리중..." : isApproved ? "승인 취소" : "가산점 승인"}
                                </button>
                              </>
                            ) : (
                              <span className="px-2 py-0.5 rounded border text-[10px] text-slate-600 border-slate-800">
                                가산점 자격 없음
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                    새로운 시험 일정을 공고하고 1차 필기 및 2차 서술형 문제지를
                    등록합니다.
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
                  <option value="SCHEDULED">
                    시험 대기중 (SCHEDULED) - 접수 및 공고 상태
                  </option>
                  <option value="PHASE1">제1차 CBT 필기 진행중 (PHASE1)</option>
                  <option value="PHASE2">
                    제2차 서술형 제출 진행중 (PHASE2)
                  </option>
                  <option value="GRADING">
                    2차 채점표 사정 진행중 (GRADING)
                  </option>
                  <option value="FINISHED">
                    최종 합격자 공고 완료 (FINISHED)
                  </option>
                </select>
              </div>

              <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 space-y-3">
                <div className="text-xs font-bold text-amber-300">
                  점수 체계 설정
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ["1차 만점", newPhase1MaxScore, setNewPhase1MaxScore],
                    [
                      "제1문 만점",
                      newPhase2Question1MaxScore,
                      setNewPhase2Question1MaxScore,
                    ],
                    [
                      "제2문 만점",
                      newPhase2Question2MaxScore,
                      setNewPhase2Question2MaxScore,
                    ],
                    [
                      "기본 합격선",
                      newFinalPassingScore,
                      setNewFinalPassingScore,
                    ],
                  ].map(([label, value, setter]) => (
                    <label
                      key={label as string}
                      className="text-[11px] text-slate-400"
                    >
                      {label as string}
                      <input
                        type="number"
                        min={0}
                        value={value as number}
                        onChange={(e) =>
                          (setter as (value: number) => void)(
                            Number(e.target.value),
                          )
                        }
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500">
                  최종 합격선은 게시 시 다시 입력할 수 있으며, 총점은 1차 +
                  제1문 + 제2문입니다.
                </p>
                {/* 1차 과락 컷 (별도) */}
                <label className="text-[11px] text-slate-400 block">
                  1차 과락 컷 (비워두면 만점의 60% 자동)
                  <input
                    type="number"
                    min={0}
                    value={newPhase1PassScore}
                    onChange={(e) => setNewPhase1PassScore(e.target.value)}
                    placeholder={`자동 (${Math.ceil(newPhase1MaxScore * 0.6)}점)`}
                    className="mt-1 w-full bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
                  />
                </label>
                {/* 시험 규칙 안내 */}
                <label className="text-[11px] text-slate-400 block">
                  시험 규칙 안내 (수험생 입장 화면에 표시됨)
                  <textarea
                    rows={4}
                    value={newPhase1Rules}
                    onChange={(e) => setNewPhase1Rules(e.target.value)}
                    placeholder={`예:\n• 시험 시간: 120분 · 만점 100점 (10문 객관식)\n• 답안 제출은 단 1회만 허용됩니다.\n• 이의제기는 디스코드 채널을 이용해 주십시오.`}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">비워두면 기본 안내 텍스트가 자동 표시됩니다.</p>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-[11px] text-slate-400">
                    1차 운영 방식
                    <select
                      value={newPhase1OperationMode}
                      onChange={(e) =>
                        setNewPhase1OperationMode(
                          e.target.value as "TIME" | "MANUAL",
                        )
                      }
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="TIME">시간 자동 운영</option>
                      <option value="MANUAL">관리자 수동 시작</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-slate-400">
                    2차 운영 방식
                    <select
                      value={newPhase2OperationMode}
                      onChange={(e) =>
                        setNewPhase2OperationMode(
                          e.target.value as "TIME" | "MANUAL",
                        )
                      }
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="TIME">시간 자동 운영</option>
                      <option value="MANUAL">관리자 수동 시작</option>
                    </select>
                  </label>
                </div>
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
                      type="datetime-local"
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
                      type="datetime-local"
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
                      type="datetime-local"
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
                      type="datetime-local"
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
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-[11px] text-slate-400 leading-relaxed">
                  <p>
                    <span className="text-blue-400 font-bold">1차 PDF:</span>{" "}
                    1차 CBT 입장 화면에서 수험생에게 문제지 다운로드 버튼으로 제공됩니다. Google Drive 등 공개 URL을 입력하세요.
                  </p>
                  <p>
                    <span className="text-purple-400 font-bold">2차 제1문 / 제2문 PDF:</span>{" "}
                    2차 서술형 제출실(
                    <span className="font-mono">/exam/session-2</span>)에서
                    수험생에게 문제지 다운로드 버튼으로 제공됩니다. Google
                    Drive 공유 링크 또는 외부 공개 URL을 입력하세요.
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="1차 필기 문제지 PDF 링크 (선택 · 현재 비노출)"
                  value={newPhase1Pdf}
                  onChange={(e) => setNewPhase1Pdf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
                <input
                  type="text"
                  placeholder="2차 제1문 논술 문제지 PDF 링크 → 2차 제출실 다운로드 버튼에 연결됨"
                  value={newPhase2Doc1Pdf}
                  onChange={(e) => setNewPhase2Doc1Pdf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
                <input
                  type="text"
                  placeholder="2차 제2문 실무기록 문제지 PDF 링크 → 2차 제출실 다운로드 버튼에 연결됨"
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
                  📢 개설 즉시 디스코드 시험 채널(EXAM)로 시행 일정 공식 공고
                  발송
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
                  <option value="PHASE2">
                    제2차 서술형 제출 진행중 (PHASE2)
                  </option>
                  <option value="GRADING">
                    2차 채점표 사정 진행중 (GRADING)
                  </option>
                  <option value="FINISHED">
                    최종 합격자 공고 완료 (FINISHED)
                  </option>
                </select>
              </div>

              <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 space-y-3">
                <div className="text-xs font-bold text-amber-300">
                  점수 체계 설정
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ["1차 만점", editPhase1MaxScore, setEditPhase1MaxScore],
                    [
                      "제1문 만점",
                      editPhase2Question1MaxScore,
                      setEditPhase2Question1MaxScore,
                    ],
                    [
                      "제2문 만점",
                      editPhase2Question2MaxScore,
                      setEditPhase2Question2MaxScore,
                    ],
                    ["합격선", editFinalPassingScore, setEditFinalPassingScore],
                  ].map(([label, value, setter]) => (
                    <label
                      key={label as string}
                      className="text-[11px] text-slate-400"
                    >
                      {label as string}
                      <input
                        type="number"
                        min={0}
                        value={value as number}
                        onChange={(e) =>
                          (setter as (value: number) => void)(
                            Number(e.target.value),
                          )
                        }
                        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </label>
                  ))}
                </div>
                {/* 1차 과락 컷 */}
                <label className="text-[11px] text-slate-400 block">
                  1차 과락 컷 (비워두면 만점의 60% 자동)
                  <input
                    type="number"
                    min={0}
                    value={editPhase1PassScore}
                    onChange={(e) => setEditPhase1PassScore(e.target.value)}
                    placeholder={`자동 (${Math.ceil(editPhase1MaxScore * 0.6)}점)`}
                    className="mt-1 w-full bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
                  />
                </label>
                {/* 시험 규칙 안내 */}
                <label className="text-[11px] text-slate-400 block">
                  시험 규칙 안내 (수험생 입장 화면에 표시됨)
                  <textarea
                    rows={4}
                    value={editPhase1Rules}
                    onChange={(e) => setEditPhase1Rules(e.target.value)}
                    placeholder={`예:\n• 시험 시간: 120분 · 만점 100점 (10문 객관식)\n• 답안 제출은 단 1회만 허용됩니다.\n• 이의제기는 디스코드 채널을 이용해 주십시오.`}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">비워두면 기본 안내 텍스트가 자동 표시됩니다.</p>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-[11px] text-slate-400">
                    1차 운영 방식
                    <select
                      value={editPhase1OperationMode}
                      onChange={(e) =>
                        setEditPhase1OperationMode(
                          e.target.value as "TIME" | "MANUAL",
                        )
                      }
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="TIME">시간 자동 운영</option>
                      <option value="MANUAL">관리자 수동 시작</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-slate-400">
                    2차 운영 방식
                    <select
                      value={editPhase2OperationMode}
                      onChange={(e) =>
                        setEditPhase2OperationMode(
                          e.target.value as "TIME" | "MANUAL",
                        )
                      }
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="TIME">시간 자동 운영</option>
                      <option value="MANUAL">관리자 수동 시작</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    1차 시작 일시
                  </label>
                  <input
                    type="datetime-local"
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
                    type="datetime-local"
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
                    type="datetime-local"
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
                    type="datetime-local"
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
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 leading-relaxed space-y-1">
                  <p>
                    <span className="text-blue-400 font-bold">1차:</span> 1차 CBT 입장 화면에서 수험생 다운로드 버튼에 연결됩니다. Google Drive 등 공개 URL을 입력하세요.
                  </p>
                  <p>
                    <span className="text-purple-400 font-bold">2차 제1문 / 제2문:</span> 2차 서술형 제출실에서 수험생 다운로드 버튼에 직접 연결됩니다. Google Drive 등 공개 URL을 입력하세요.
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="1차 필기 PDF URL (현재 비노출)"
                  value={editPhase1Pdf}
                  onChange={(e) => setEditPhase1Pdf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                />
                <input
                  type="text"
                  placeholder="2차 제1문 논술 PDF URL → 2차 제출실 다운로드 버튼"
                  value={editPhase2Doc1Pdf}
                  onChange={(e) => setEditPhase2Doc1Pdf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                />
                <input
                  type="text"
                  placeholder="2차 제2문 실무기록 PDF URL → 2차 제출실 다운로드 버튼"
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

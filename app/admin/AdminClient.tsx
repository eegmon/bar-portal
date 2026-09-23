"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Users,
  Vote,
  Settings,
  BarChart3,
  CheckCircle2,
  XCircle,
  Edit,
  Send,
  Plus,
  Calendar,
  Lock,
  ExternalLink,
  Search,
  Scale,
  Award,
  AlertTriangle,
  AlertOctagon,
  Bell,
  Info,
  Bot,
  FileText,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Link from "next/link";
import { OFFICER_POSITIONS, SessionUser } from "@/lib/types";

interface AdminClientProps {
  currentUser: SessionUser;
  permissions: {
    canSettings: boolean;
    canUsers: boolean;
    canAssembly: boolean;
    canExam: boolean;
    canDiscipline: boolean;
  };
  initialSettings: Record<string, string>;
  initialUsers: any[];
  initialAssemblies: any[];
  initialAgendas: any[];
  initialAttendances: any[];
  initialVotingRights: any[];
  initialAuditLogs: any[];
  stats: {
    totalUsers: number;
    activeLawyers: number;
    pendingUsers: number;
    totalAssemblies: number;
    totalExams: number;
    totalSubmissions: number;
  };
}

export default function AdminClient({
  currentUser,
  permissions,
  initialSettings,
  initialUsers,
  initialAssemblies,
  initialAgendas,
  initialAttendances,
  initialVotingRights,
  initialAuditLogs,
  stats,
}: AdminClientProps) {
  // 사용 가능한 첫 번째 탭 기본 선택
  const defaultTab = permissions.canUsers
    ? "users"
    : permissions.canAssembly
      ? "assembly"
      : permissions.canSettings
        ? "settings"
        : "overview";

  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // 1. 회원 명부 상태
  const [users, setUsers] = useState<any[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // 회원 직책/권한 편집 모달 상태
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editIsTrainee, setEditIsTrainee] = useState(0);
  const [editOfficeName, setEditOfficeName] = useState("");
  const [editPositions, setEditPositions] = useState<string[]>([]);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // 2. 설정 상태
  const [settings, setSettings] =
    useState<Record<string, string>>(initialSettings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  // 팝업 공지 상태
  const [popupEnabled, setPopupEnabled] = useState(initialSettings?.popup_enabled === "true");
  const [popupLevel, setPopupLevel] = useState<"INFO" | "WARNING" | "URGENT">((initialSettings?.popup_level as any) || "INFO");
  const [popupTitle, setPopupTitle] = useState(initialSettings?.popup_title || "");
  const [popupContent, setPopupContent] = useState(initialSettings?.popup_content || "");
  const [popupLink, setPopupLink] = useState(initialSettings?.popup_link || "");
  const [broadcastPopupDiscord, setBroadcastPopupDiscord] = useState(true);
  const [isSavingPopup, setIsSavingPopup] = useState(false);

  // 디스코드 역할 동기화 상태
  const [syncingMemberId, setSyncingMemberId] = useState<string | null>(null);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [batchSyncLog, setBatchSyncLog] = useState<string[] | null>(null);

  // 3. 총회 및 안건 상태
  const [assemblies, setAssemblies] = useState<any[]>(initialAssemblies);
  const [agendas, setAgendas] = useState<any[]>(initialAgendas);
  const [attendances, setAttendances] = useState<any[]>(initialAttendances);
  const [selectedAssemblyId, setSelectedAssemblyId] = useState("");
  const [votingRights, setVotingRights] = useState<any[]>(initialVotingRights);
  const [auditLogs] = useState<any[]>(initialAuditLogs);
  const [rightAssemblyId, setRightAssemblyId] = useState(assemblies[0]?.id || "");
  const [rightUserId, setRightUserId] = useState("");
  const [rightPower, setRightPower] = useState(1);
  const [rightReason, setRightReason] = useState("");

  // 총회 일정 개설 모달 상태
  const [showAssemblyModal, setShowAssemblyModal] = useState(false);
  const [newAssTitle, setNewAssTitle] = useState("");
  const [newAssRound, setNewAssRound] = useState(10);
  const [newAssIsRegular, setNewAssIsRegular] = useState(true);
  const [newAssHeldAt, setNewAssHeldAt] = useState("");
  const [isCreatingAssembly, setIsCreatingAssembly] = useState(false);

  // 안건 상정 모달 상태
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [targetAssemblyId, setTargetAssemblyId] = useState(
    assemblies[0]?.id || "",
  );
  const [newAgTitle, setNewAgTitle] = useState("");
  const [newAgDesc, setNewAgDesc] = useState("");
  const [newAgIsSecret, setNewAgIsSecret] = useState(false);
  const [newAgChoices, setNewAgChoices] = useState("찬성, 반대, 기권");
  const [newAgQuorum, setNewAgQuorum] = useState(0);
  const [newAgDeadline, setNewAgDeadline] = useState("");
  const [newAgMethod, setNewAgMethod] = useState("MAJORITY");
  const [isCreatingAgenda, setIsCreatingAgenda] = useState(false);

  // 총회 의사록 작성/수정 모달 상태 (회칙 제18조)
  const [showMinutesModal, setShowMinutesModal] = useState(false);
  const [selectedAssemblyForMinutes, setSelectedAssemblyForMinutes] =
    useState<any>(null);
  const [minutesText, setMinutesText] = useState("");
  const [broadcastMinutesDiscord, setBroadcastMinutesDiscord] = useState(true);
  const [isSavingMinutes, setIsSavingMinutes] = useState(false);

  // 회원 목록 필터링
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.login_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.discord_id &&
        u.discord_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.office_name &&
        u.office_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchRole = filterRole === "ALL" || u.role === filterRole;
    const matchStatus = filterStatus === "ALL" || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  // 회원 승인 / 반려 처리
  const handleApproveUser = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE_LAWYER", userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "승인 실패");

      alert(data.message || "변호사 등록이 승인되었습니다.");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: "LAWYER", status: "ACTIVE" } : u,
        ),
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleRejectUser = async (userId: string) => {
    if (!confirm("해당 회원의 등록 신청을 반려하시겠습니까?")) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT_USER", userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "반려 실패");

      alert("반려 처리되었습니다.");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: "EXPIRED" } : u)),
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  // 회원 편집 모달 열기
  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditIsTrainee(user.is_trainee || 0);
    setEditOfficeName(user.office_name || "");
    setEditPositions(Array.isArray(user.positions) ? user.positions : []);
  };

  // 직책 토글
  const togglePosition = (posId: string) => {
    setEditPositions((prev) =>
      prev.includes(posId) ? prev.filter((p) => p !== posId) : [...prev, posId],
    );
  };

  // 회원 정보 & 직책 저장
  const handleSaveUser = async () => {
    if (!editingUser) return;
    setIsSavingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_USER",
          userId: editingUser.id,
          role: editRole,
          status: editStatus,
          isTrainee: editIsTrainee,
          officeName: editOfficeName,
          positions: editPositions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");

      alert("회원 정보 및 직책이 성공적으로 갱신되었습니다!");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                role: editRole,
                status: editStatus,
                is_trainee: editIsTrainee,
                office_name: editOfficeName,
                positions: editPositions,
              }
            : u,
        ),
      );
      setEditingUser(null);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSavingUser(false);
    }
  };

  // 팝업 공지 설정 저장
  const handleSavePopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPopup(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SAVE_POPUP",
          popup: {
            enabled: popupEnabled,
            level: popupLevel,
            title: popupTitle,
            content: popupContent,
            link: popupLink,
          },
          broadcastNotice: broadcastPopupDiscord,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "팝업 공지 저장 실패");
      alert("📢 포털 안내사항 팝업 공지 설정이 성공적으로 저장되었습니다!");
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSavingPopup(false);
    }
  };

  // 개별 회원 디스코드 역할 동기화
  const handleSyncMember = async (userId: string, userName: string) => {
    setSyncingMemberId(userId);
    try {
      const res = await fetch("/api/discord/sync-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const result = data.data;
      alert(`✅ [${userName}] 디스코드 동기화 완료!\n직책: ${result.updatedPositions?.join(", ") || "없음"}\n등급: ${result.updatedRole || "-"}`);
      window.location.reload();
    } catch (err: any) {
      alert(`[${userName}] 동기화 실패: ${err.message}`);
    } finally {
      setSyncingMemberId(null);
    }
  };

  // 전체 회원 디스코드 역할 일괄 동기화
  const handleBatchSync = async () => {
    if (!confirm("전체 회원의 디스코드 역할을 사이트에 일괄 동기화합니다.\n회원 수에 따라 수십 초가 소요될 수 있습니다. 진행하시겠습니까?")) return;
    setIsBatchSyncing(true);
    setBatchSyncLog(null);
    try {
      const res = await fetch("/api/discord/sync-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const { total, synced, failed, logs } = data.data;
      setBatchSyncLog(logs);
      alert(`🔄 전체 동기화 완료!\n총 ${total}명 중 성공 ${synced}명, 실패/스킵 ${failed}명`);
    } catch (err: any) {
      alert(`일괄 동기화 실패: ${err.message}`);
    } finally {
      setIsBatchSyncing(false);
    }
  };

  // 설정 저장
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "설정 저장 실패");
      alert(
        "⚙️ 시스템 설정 및 디스코드 연동 정보가 성공적으로 저장되었습니다!",
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 웹훅 테스트 발송
  const handleTestWebhook = async (type: string, webhookUrl?: string) => {
    setTestingWebhook(type);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TEST_WEBHOOK", testType: type, webhookUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "테스트 발송 실패");
      alert(`✅ [${type}] 채널로 테스트 웹훅이 성공적으로 전송되었습니다!`);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setTestingWebhook(null);
    }
  };

  // 신규 총회(정기/임시) 일정 생성
  const handleCreateAssembly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssTitle || !newAssHeldAt) {
      alert("총회 명칭과 개최 일시를 입력해 주세요.");
      return;
    }
    setIsCreatingAssembly(true);
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_ASSEMBLY",
          title: newAssTitle,
          roundNumber: newAssRound,
          isRegular: newAssIsRegular,
          heldAt: newAssHeldAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "총회 일정 등록 실패");

      alert(
        `🏛️ ${newAssIsRegular ? "정기총회" : "임시총회(임시회)"} 일정이 성공적으로 개설되었습니다!`,
      );
      setShowAssemblyModal(false);
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsCreatingAssembly(false);
    }
  };

  // 신규 안건 상정
  const handleCreateAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAssemblyId || !newAgTitle) {
      alert("총회 선택 및 안건명을 입력해 주세요.");
      return;
    }
    setIsCreatingAgenda(true);
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_AGENDA",
          assemblyId: targetAssemblyId,
          title: newAgTitle,
          description: newAgDesc,
          isSecret: newAgIsSecret,
          choices: newAgChoices.split(",").map((choice) => choice.trim()).filter(Boolean),
          quorumNeeded: newAgQuorum,
          votingDeadline: newAgDeadline,
          votingMethod: newAgMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "안건 상정 실패");

      alert("📋 안건이 상정되었습니다.");
      setShowAgendaModal(false);
      window.location.reload();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsCreatingAgenda(false);
    }
  };

  // 안건 표결 개시 선언
  const handleStartVoting = async (agendaId: string) => {
    if (!confirm("의장의 권한으로 본 안건의 표결 개시를 선포하시겠습니까?"))
      return;
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "START_VOTING", agendaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "표결 개시 실패");

      alert("🗳️ 표결 개시가 선포되었으며 디스코드 총회 채널로 공고되었습니다!");
      setAgendas((prev) =>
        prev.map((ag) =>
          ag.id === agendaId ? { ...ag, status: "VOTING" } : ag,
        ),
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  // 안건 표결 종료 선포
  const handleCloseVoting = async (agendaId: string) => {
    if (
      !confirm("본 안건의 표결을 종료하고 집계 결과를 공식 선포하시겠습니까?")
    )
      return;
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLOSE_VOTING", agendaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "표결 종료 실패");

      alert(
        "📊 표결 종료 및 결과 집계가 디스코드 총회 채널로 공식 선포되었습니다!",
      );
      setAgendas((prev) =>
        prev.map((ag) =>
          ag.id === agendaId ? { ...ag, status: "CLOSED" } : ag,
        ),
      );
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleAssemblyStatus = async (assemblyId: string, status: "IN_SESSION" | "CLOSED") => {
    const message = status === "IN_SESSION" ? "총회를 개회하고 의사진행을 시작하시겠습니까?" : "총회를 폐회하시겠습니까?";
    if (!confirm(message)) return;
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_ASSEMBLY_STATUS", assemblyId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "총회 상태 변경 실패");
      setAssemblies((prev) => prev.map((ass) => (ass.id === assemblyId ? { ...ass, status } : ass)));
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleReorderAgendas = async (assemblyId: string, orderedAgendaIds: string[]) => {
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REORDER_AGENDAS", assemblyId, orderedAgendaIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "안건 순서 변경 실패");
      setAgendas((prev) => prev.map((agenda) => {
        const nextOrder = data.orderedAgendaIds.indexOf(agenda.id);
        return nextOrder >= 0 ? { ...agenda, agenda_order: nextOrder } : agenda;
      }));
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleAgendaStatus = async (agendaId: string, status: "ON_HOLD" | "READY") => {
    const message = status === "ON_HOLD" ? "이 안건을 보류하시겠습니까?" : "이 안건을 다시 상정하시겠습니까?";
    if (!confirm(message)) return;
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_AGENDA_STATUS", agendaId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "안건 상태 변경 실패");
      setAgendas((prev) => prev.map((agenda) => (agenda.id === agendaId ? { ...agenda, status } : agenda)));
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleAttendance = async (attendanceId: string, status: "APPROVED" | "REJECTED", attended: boolean) => {
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_ATTENDANCE", attendanceId, status, attended }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "출석 처리 실패");
      setAttendances((prev) => prev.map((item) => item.id === attendanceId ? { ...item, approval_status: status, attended: attended ? 1 : 0 } : item));
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleConfirmResult = async (agendaId: string, action: "CONFIRM_RESULT" | "REOPEN_RESULT") => {
    if (!confirm(action === "CONFIRM_RESULT" ? "표결 결과를 확정하시겠습니까? 확정 후 일반 수정은 제한됩니다." : "확정된 결과를 재개 상태로 되돌리시겠습니까?")) return;
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, agendaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "결과 상태 변경 실패");
      setAgendas((prev) => prev.map((agenda) => agenda.id === agendaId ? { ...agenda, status: data.status } : agenda));
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleExtendDeadline = async (agendaId: string) => {
    const votingDeadline = window.prompt("새 마감 시각을 입력하세요. 예: 2026-10-04T21:30");
    const reason = votingDeadline ? window.prompt("마감 연장 사유를 입력하세요.") : null;
    if (!votingDeadline || !reason?.trim()) return;
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "EXTEND_DEADLINE", agendaId, votingDeadline, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "마감 연장 실패");
      alert(`마감 시간이 ${data.votingDeadline}로 연장되었습니다.`);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleSetVotingRight = async () => {
    if (!rightAssemblyId || !rightUserId || !rightReason.trim()) {
      alert("총회, 회원, 의결권 설정 사유를 입력해 주세요.");
      return;
    }
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_VOTING_RIGHT", assemblyId: rightAssemblyId, userId: rightUserId, votingPower: rightPower, reason: rightReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "의결권 설정 실패");
      const member = users.find((item) => item.id === rightUserId);
      setVotingRights((prev) => [
        ...prev.filter((item) => !(item.assembly_id === rightAssemblyId && item.user_id === rightUserId)),
        { assembly_id: rightAssemblyId, user_id: rightUserId, user_name: member?.name, voting_power: rightPower, reason: rightReason },
      ]);
      setRightReason("");
      alert("해당 총회의 회원별 의결권이 설정되었습니다.");
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleRemoveVotingRight = async (assemblyId: string, userId: string) => {
    if (!confirm("이 총회의 수동 의결권 설정을 삭제하고 기본 1표로 복원하시겠습니까?")) return;
    const res = await fetch("/api/assembly/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REMOVE_VOTING_RIGHT", assemblyId, userId }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "의결권 설정 삭제 실패");
    setVotingRights((prev) => prev.filter((item) => !(item.assembly_id === assemblyId && item.user_id === userId)));
  };

  // 총회 의사록 모달 열기
  const openMinutesModal = (ass: any) => {
    setSelectedAssemblyForMinutes(ass);
    setMinutesText(ass.minutes_text || "");
    setShowMinutesModal(true);
  };

  // 표준 의사록 양식 자동 생성
  const insertMinutesTemplate = () => {
    if (!selectedAssemblyForMinutes) return;
    const isReg = selectedAssemblyForMinutes.is_regular;
    const template = `[도스변호사협회 제${selectedAssemblyForMinutes.round_number}회 ${isReg ? "정기총회" : "임시총회"} 공식 의사록]

1. 일시: ${selectedAssemblyForMinutes.held_at}
2. 장소: 도스변호사협회 온라인 총회 회의실
3. 출석 현황:
   - 총 회원: ${stats.activeLawyers}명
   - 출석 회원: ___명 (위임장 제출에 의한 대리 출석 ___명 포함)
   - 의사정족수: 전체 의결권 3분의 1 이상 출석 충족 (회칙 제15조제1항)

4. 개회 선언:
   - 의장 ${currentUser.name}의 주재 하에 성원 보고 후 개회를 선포함.

5. 부의 안건 심의 및 표결 결과:
   - 제1호 안건: [안건명]
     * 제안 이유 및 주요 내용 심의
     * 표결 결과: 찬성 ___표, 반대 ___표, 기권 ___표 -> [원안 가결 / 부결]

6. 기타 보고 및 토의 사항:
   - 사무국 주요 사법 행정 및 재정 현황 보고

7. 폐회 선언:
   - 의장의 폐회 선언으로 제${selectedAssemblyForMinutes.round_number}회 ${isReg ? "정기총회" : "임시총회"}를 종료함.

--------------------------------------------------
도스변호사협회 회칙 제18조제2항에 의하여 위 의사의 경과 및 결과를 기재하고 서명날인함.
- 총회의장: ${currentUser.name} (서명/인)
- 출석회원 1: __________________ (서명/인)
- 출석회원 2: __________________ (서명/인)`;
    setMinutesText(template);
  };

  // 총회 의사록 저장 및 공표
  const handleSaveMinutes = async () => {
    if (!selectedAssemblyForMinutes) return;
    setIsSavingMinutes(true);
    try {
      const res = await fetch("/api/assembly/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_MINUTES",
          assemblyId: selectedAssemblyForMinutes.id,
          minutesText,
          broadcastDiscord: broadcastMinutesDiscord,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "의사록 저장 실패");

      alert("📜 총회 의사록이 성공적으로 저장 및 공표되었습니다!");
      setAssemblies((prev) =>
        prev.map((a) =>
          a.id === selectedAssemblyForMinutes.id
            ? { ...a, minutes_text: minutesText }
            : a,
        ),
      );
      setShowMinutesModal(false);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSavingMinutes(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="border-b border-slate-800 pb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
            <ShieldCheck className="w-4 h-4" />
            도스변호사협회 사무국 · 사법 행정 통합 관리 패널
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            협회 관리자 패널
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            회원 자격 심사 및 직책 임명, 총회/임시회 의사일정, 디스코드 웹훅 및
            봇 역할을 통합 관장합니다.
          </p>
        </div>

        {/* 현재 로그인 유저의 직책 배지 표시 */}
        <div className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs">
          <span className="text-slate-400 font-semibold">
            {currentUser.name} 님:
          </span>
          {currentUser.positions && currentUser.positions.length > 0 ? (
            currentUser.positions.map((p) => {
              const posObj = OFFICER_POSITIONS[p];
              return (
                <span
                  key={p}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                    posObj
                      ? posObj.color
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {posObj ? posObj.label : p}
                </span>
              );
            })
          ) : (
            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[11px]">
              {currentUser.role}
            </span>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
        {permissions.canUsers && (
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "users"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            회원 명부 & 직책 관리 ({users.length}명)
            {stats.pendingUsers > 0 && (
              <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px] animate-pulse">
                {stats.pendingUsers}
              </span>
            )}
          </button>
        )}

        {permissions.canAssembly && (
          <button
            onClick={() => setActiveTab("assembly")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "assembly"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Vote className="w-4 h-4" />
            정기/임시 총회 일정 & 안건 관리 ({assemblies.length}개)
          </button>
        )}

        {permissions.canSettings && (
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "settings"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Bot className="w-4 h-4" />
            디스코드 웹훅 & 봇 역할 설정
          </button>
        )}

        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === "overview"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          사법 행정 종합 현황
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 탭 1: 회원 명부 & 직책/권한 관리 */}
      {/* ========================================================================= */}
      {activeTab === "users" && permissions.canUsers && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                도스변호사협회 회원 명부 및 자격·직책 관리
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                가입 승인 대기자를 원클릭 승인하고, 이사회/사무국/총회/위원회의
                세부 직책을 부여합니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* 전체 디스코드 일괄 동기화 버튼 */}
              <button
                type="button"
                onClick={handleBatchSync}
                disabled={isBatchSyncing}
                className="px-3 py-2 bg-indigo-900/60 hover:bg-indigo-800/70 text-indigo-300 font-bold text-xs rounded-xl border border-indigo-700/50 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                <ArrowUp className={`w-3.5 h-3.5 ${isBatchSyncing ? "animate-bounce" : ""}`} />
                {isBatchSyncing ? "전체 동기화 중..." : "🔄 전체 디스코드 역할 동기화"}
              </button>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="성명, 아이디, 디스코드, 소속 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
              >
                <option value="ALL">모든 역할</option>
                <option value="LAWYER">변호사 (LAWYER)</option>
                <option value="TRAINEE">견습변호사 (TRAINEE)</option>
                <option value="CITIZEN">일반회원 (CITIZEN)</option>
                <option value="ADMIN">관리자 (ADMIN)</option>
                <option value="PROSECUTOR">검찰총장 (PROSECUTOR)</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
              >
                <option value="ALL">모든 상태</option>
                <option value="PENDING">승인 대기 (PENDING)</option>
                <option value="ACTIVE">정상 (ACTIVE)</option>
                <option value="SUSPENDED">정직/업무정지 (SUSPENDED)</option>
                <option value="EXPIRED">자격상실 (EXPIRED)</option>
                <option value="EXPELLED">제명 (EXPELLED)</option>
              </select>
            </div>
          </div>

          {/* 회원 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-3 px-3">회원 성명 (ID)</th>
                  <th className="py-3 px-3">디스코드</th>
                  <th className="py-3 px-3">역할/소속</th>
                  <th className="py-3 px-3">부여된 직책 (Positions)</th>
                  <th className="py-3 px-3">자격 상태</th>
                  <th className="py-3 px-3 text-right">관리 작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      검색 조건과 일치하는 회원이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isPending = u.status === "PENDING";
                    const uPositions: string[] = Array.isArray(u.positions)
                      ? u.positions
                      : [];

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-950/40 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {u.name}
                            {u.is_trainee ? (
                              <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded">
                                견습
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {u.login_id}
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                          {u.discord_id || "-"}
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === "ADMIN"
                                ? "bg-red-500/20 text-red-300"
                                : u.role === "LAWYER"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : u.role === "PROSECUTOR"
                                    ? "bg-purple-500/20 text-purple-300"
                                    : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {u.role}
                          </span>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {u.office_name || "개인개업"}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {uPositions.length > 0 ? (
                              uPositions.map((p) => {
                                const posObj = OFFICER_POSITIONS[p];
                                return (
                                  <span
                                    key={p}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                      posObj
                                        ? posObj.color
                                        : "bg-slate-800 text-slate-300 border-slate-700"
                                    }`}
                                  >
                                    {posObj ? posObj.label : p}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[11px] text-slate-600">
                                직책 없음
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.status === "ACTIVE"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : u.status === "PENDING"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                                  : u.status === "SUSPENDED"
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : "bg-slate-800 text-slate-500 border border-slate-700"
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending ? (
                              <>
                                <button
                                  onClick={() => handleApproveUser(u.id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> 승인
                                </button>
                                <button
                                  onClick={() => handleRejectUser(u.id)}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-red-400 rounded text-xs font-semibold border border-slate-700"
                                >
                                  반려
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => openEditModal(u)}
                                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded text-xs font-semibold border border-slate-700 flex items-center gap-1"
                                >
                                  <Edit className="w-3.5 h-3.5" /> 직책/권한 설정
                                </button>
                                <button
                                  onClick={() => handleSyncMember(u.id, u.name)}
                                  disabled={syncingMemberId === u.id}
                                  className="px-2.5 py-1 bg-indigo-900/50 hover:bg-indigo-800/60 text-indigo-300 rounded text-xs font-semibold border border-indigo-800/50 flex items-center gap-1 disabled:opacity-50"
                                  title="디스코드 역할을 사이트에 동기화"
                                >
                                  <ArrowDown className={`w-3.5 h-3.5 ${syncingMemberId === u.id ? "animate-bounce" : ""}`} />
                                  {syncingMemberId === u.id ? "동기화중" : "DC동기화"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 일괄 동기화 결과 로그 */}
          {batchSyncLog && batchSyncLog.length > 0 && (
            <div className="p-4 bg-slate-950 border border-indigo-800/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-indigo-300">🔄 전체 동기화 결과 로그</h4>
                <button onClick={() => setBatchSyncLog(null)} className="text-slate-500 hover:text-white text-xs">닫기</button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {batchSyncLog.map((log, i) => (
                  <div key={i} className="text-[11px] font-mono text-slate-300">{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 회원 직책/권한 편집 모달 */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-400" />
                회원 권한 및 세부 직책 설정:{" "}
                <span className="text-amber-400">{editingUser.name}</span>
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    기본 역할 (Role)
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="CITIZEN">
                      일반 시민 / 수험생 (CITIZEN)
                    </option>
                    <option value="TRAINEE">견습변호사 (TRAINEE)</option>
                    <option value="LAWYER">정회원 변호사 (LAWYER)</option>
                    <option value="PROSECUTOR">검찰총장 (PROSECUTOR)</option>
                    <option value="ADMIN">시스템 총괄 관리자 (ADMIN)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    자격 상태 (Status)
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="ACTIVE">정상 (ACTIVE)</option>
                    <option value="PENDING">승인 대기 (PENDING)</option>
                    <option value="SUSPENDED">
                      정직 / 업무정지 (SUSPENDED)
                    </option>
                    <option value="EXPIRED">자격 상실 (EXPIRED)</option>
                    <option value="EXPELLED">제명 (EXPELLED)</option>
                  </select>
                </div>
              </div>



              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    소속 법률사무소/법무법인
                  </label>
                  <input
                    type="text"
                    value={editOfficeName}
                    onChange={(e) => setEditOfficeName(e.target.value)}
                    placeholder="예: 법률사무소 도스"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    견습변호사 여부
                  </label>
                  <select
                    value={editIsTrainee}
                    onChange={(e) => setEditIsTrainee(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value={0}>정규 변호사 (0)</option>
                    <option value={1}>견습 변호사 (1)</option>
                  </select>
                </div>
              </div>

              {/* 세부 직책 다중 지정 (체크박스) */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="block font-bold text-amber-400">
                  🏛️ 협회 임원 및 위원회 세부 직책 부여 (다중 선택 가능):
                </label>
                <p className="text-[11px] text-slate-500">
                  직책을 선택하면 해당 임원의 포털 권한 및 디스코드 역할이
                  자동으로 동기화됩니다.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {Object.values(OFFICER_POSITIONS).map((pos) => {
                    const isChecked = editPositions.includes(pos.id);
                    return (
                      <label
                        key={pos.id}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePosition(pos.id)}
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-xs">
                          <span className="text-[10px] text-slate-500">
                            [{pos.group}]
                          </span>{" "}
                          {pos.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isSavingUser}
                onClick={handleSaveUser}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-colors"
              >
                {isSavingUser ? "저장중..." : "직책 및 정보 변경 저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 탭 2: 정기/임시 총회 일정 & 안건 관리 */}
      {/* ========================================================================= */}
      {activeTab === "assembly" && permissions.canAssembly && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Vote className="w-5 h-5 text-emerald-400" />
                총회 및 임시회 의사일정 / 안건 표결 제어
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                정기회 및 임시회 일정을 개설하고, 안건을 상정하여 실시간 표결을
                개시 및 결과 선포합니다.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAssemblyModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> 신규 총회 일정 개설
              </button>
              <button
                onClick={() => setShowAgendaModal(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> 신규 안건 상정
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="text-xs font-bold text-white">출석·위임장 승인 대기</div>
            {attendances.length === 0 ? (
              <p className="text-xs text-slate-500">접수된 출석 또는 위임 신청이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {attendances.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                    <div>
                      <strong className="text-white">{item.grantor_name || "회원"}</strong>
                      {item.is_proxy ? <span className="text-slate-400"> → 수임인 {item.proxy_name || "미상"}</span> : <span className="text-slate-400"> · 출석 신청</span>}
                      <span className="ml-2 text-slate-500">{item.approval_status === "PENDING" ? "승인 대기" : item.approval_status === "REJECTED" ? "반려" : item.attended ? "출석" : "승인"}</span>
                    </div>
                    <div className="flex gap-2">
                      {item.approval_status !== "APPROVED" && (
                        <button type="button" onClick={() => handleAttendance(item.id, "APPROVED", true)} className="px-2.5 py-1 bg-emerald-600 text-white rounded font-bold">승인·출석</button>
                      )}
                      {item.approval_status !== "REJECTED" && (
                        <button type="button" onClick={() => handleAttendance(item.id, "REJECTED", false)} className="px-2.5 py-1 bg-red-900/60 text-red-300 rounded font-bold">반려</button>
                      )}
                      {item.approval_status === "APPROVED" && !item.attended && (
                        <button type="button" onClick={() => handleAttendance(item.id, "APPROVED", true)} className="px-2.5 py-1 bg-blue-600 text-white rounded font-bold">출석 체크</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-950 border border-amber-500/20 rounded-xl space-y-3">
            <div>
              <div className="text-xs font-bold text-white">총회별 수동 의결권 설정</div>
              <p className="text-[11px] text-slate-500 mt-1">설정하지 않은 회원은 기본 1표입니다. 승인된 위임표는 별도로 추가됩니다.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select value={rightAssemblyId} onChange={(e) => setRightAssemblyId(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white">
                <option value="">총회 선택</option>
                {assemblies.map((assembly) => <option key={assembly.id} value={assembly.id}>{assembly.title}</option>)}
              </select>
              <select value={rightUserId} onChange={(e) => setRightUserId(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white">
                <option value="">회원 선택</option>
                {users.filter((item) => item.role === "LAWYER" && item.status === "ACTIVE").map((item) => <option key={item.id} value={item.id}>{item.name} ({item.login_id})</option>)}
              </select>
              <input type="number" min={0} value={rightPower} onChange={(e) => setRightPower(Number(e.target.value))} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white" placeholder="의결권 수" />
              <input type="text" value={rightReason} onChange={(e) => setRightReason(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white" placeholder="설정 사유" />
            </div>
            <button type="button" onClick={handleSetVotingRight} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold">의결권 저장</button>
            {votingRights.length > 0 && (
              <div className="space-y-1 border-t border-slate-800 pt-2">
                {votingRights.map((right) => (
                  <div key={`${right.assembly_id}-${right.user_id}`} className="flex justify-between items-center text-xs text-slate-300">
                    <span>{assemblies.find((assembly) => assembly.id === right.assembly_id)?.title || right.assembly_id} · {right.user_name || right.user_id}</span>
                    <span className="flex items-center gap-2"><strong className="text-amber-400">{right.voting_power}표</strong><button type="button" onClick={() => handleRemoveVotingRight(right.assembly_id, right.user_id)} className="text-red-400 hover:text-red-300">삭제</button></span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2"><div className="text-xs font-bold text-white">총회 감사로그 전체 이력 ({auditLogs.length}건)</div><a href="/api/assembly/audit?format=csv" className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]">CSV 다운로드</a></div>
            {auditLogs.length === 0 ? <p className="text-xs text-slate-500">기록이 없습니다.</p> : auditLogs.map((log) => (
              <div key={log.id} className="flex justify-between gap-3 text-[11px] text-slate-400 border-b border-slate-800 pb-1">
                <span>{log.action} · {log.actor_id}</span><span>{log.created_at}</span>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-950 border border-emerald-500/20 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-white">관리할 총회 선택</label>
            <select
              value={selectedAssemblyId}
              onChange={(e) => {
                setSelectedAssemblyId(e.target.value);
                setTargetAssemblyId(e.target.value);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">총회를 선택하세요</option>
              {assemblies.map((assembly) => (
                <option key={assembly.id} value={assembly.id}>
                  {assembly.title} · {assembly.held_at} · {assembly.status}
                </option>
              ))}
            </select>
          </div>

          {/* 선택한 총회의 의사일정 */}
          <div className="space-y-6">
            {selectedAssemblyId && assemblies.filter((assembly) => assembly.id === selectedAssemblyId).map((ass) => {
              const assAgendas = agendas
                .filter((ag) => ag.assembly_id === ass.id)
                .sort((a, b) =>
                  Number(a.agenda_order ?? 0) - Number(b.agenda_order ?? 0) ||
                  String(a.created_at).localeCompare(String(b.created_at)),
                );
              const isRegular = Boolean(ass.is_regular);

              return (
                <div
                  key={ass.id}
                  className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          isRegular
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {isRegular ? "정기총회" : "임시총회(임시회)"} · 제
                        {ass.round_number}회
                      </span>
                      <h3 className="text-base font-bold text-white">
                        {ass.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> {ass.held_at}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-[11px] text-slate-300">
                        상태: {ass.status}
                      </span>
                      {ass.status === "SCHEDULED" && (
                        <button
                          onClick={() => handleAssemblyStatus(ass.id, "IN_SESSION")}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                        >
                          총회 개회
                        </button>
                      )}
                      {ass.status === "IN_SESSION" && (
                        <button
                          onClick={() => handleAssemblyStatus(ass.id, "CLOSED")}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold"
                        >
                          총회 폐회
                        </button>
                      )}
                      {ass.minutes_text ? (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[11px] font-bold">
                          ✓ 의사록 등록됨
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-500 rounded text-[11px]">
                          의사록 미작성
                        </span>
                      )}
                      <button
                        onClick={() => openMinutesModal(ass)}
                        className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {ass.minutes_text ? "의사록 수정/열람" : "의사록 작성"}
                      </button>
                    </div>
                  </div>

                  {/* 해당 총회의 안건 목록 */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                      상정된 안건 ({assAgendas.length}건):
                    </div>

                    {assAgendas.length === 0 ? (
                      <div className="p-3 bg-slate-900 rounded-lg text-xs text-slate-500 text-center">
                        아직 상정된 안건이 없습니다. 상단 [신규 안건 상정]
                        버튼을 눌러 안건을 추가하세요.
                      </div>
                    ) : (
                      assAgendas.map((ag, agendaIndex) => (
                        <div
                          key={ag.id}
                          className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                  ag.is_secret
                                    ? "bg-purple-500/20 text-purple-300"
                                    : "bg-blue-500/20 text-blue-300"
                                }`}
                              >
                                {ag.is_secret ? "무기명 비밀투표" : "기명투표"}
                              </span>
                              <span className="font-bold text-white">
                                {ag.title}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {ag.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {ass.status === "IN_SESSION" && !["VOTING", "CLOSED"].includes(ag.status) && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  title="앞으로 이동"
                                  disabled={agendaIndex === 0}
                                  onClick={() => {
                                    const next = [...assAgendas];
                                    [next[agendaIndex - 1], next[agendaIndex]] = [next[agendaIndex], next[agendaIndex - 1]];
                                    void handleReorderAgendas(ass.id, next.map((item) => item.id));
                                  }}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="뒤로 이동"
                                  disabled={agendaIndex === assAgendas.length - 1}
                                  onClick={() => {
                                    const next = [...assAgendas];
                                    [next[agendaIndex], next[agendaIndex + 1]] = [next[agendaIndex + 1], next[agendaIndex]];
                                    void handleReorderAgendas(ass.id, next.map((item) => item.id));
                                  }}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                ag.status === "VOTING"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : ag.status === "ON_HOLD"
                                    ? "bg-slate-800 text-slate-400 border border-slate-700"
                                  : ag.status === "RESULT_CONFIRMED"
                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                  : ag.status === "CLOSED"
                                    ? "bg-slate-800 text-slate-500"
                                    : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {ag.status === "VOTING"
                                ? "표결 진행중"
                                : ag.status === "ON_HOLD"
                                  ? "보류"
                                : ag.status === "RESULT_CONFIRMED"
                                  ? "결과 확정"
                                : ag.status === "CLOSED"
                                  ? "표결 종료"
                                  : "표결 대기"}
                            </span>

                            {ass.status === "IN_SESSION" && ag.status === "READY" && (
                              <button
                                type="button"
                                onClick={() => handleAgendaStatus(ag.id, "ON_HOLD")}
                                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-bold"
                              >
                                안건 보류
                              </button>
                            )}
                            {ass.status === "IN_SESSION" && ag.status === "ON_HOLD" && (
                              <button
                                type="button"
                                onClick={() => handleAgendaStatus(ag.id, "READY")}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold"
                              >
                                재상정
                              </button>
                            )}

                            {ass.status === "IN_SESSION" && ag.status === "READY" && (
                                <button
                                  onClick={() => handleStartVoting(ag.id)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow"
                                >
                                  표결 개시 선언
                                </button>
                            )}

                            {ag.status === "VOTING" && (
                              <>
                                <button
                                  onClick={() => handleExtendDeadline(ag.id)}
                                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold shadow"
                                >
                                  마감 연장
                                </button>
                                <button
                                  onClick={() => handleCloseVoting(ag.id)}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold shadow"
                                >
                                  표결 종료 및 결과 선포
                                </button>
                              </>
                            )}
                            {ag.status === "CLOSED" && (
                              <button
                                onClick={() => handleConfirmResult(ag.id, "CONFIRM_RESULT")}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold shadow"
                              >
                                결과 확정
                              </button>
                            )}
                            {ag.status === "RESULT_CONFIRMED" && (
                              <button
                                onClick={() => handleConfirmResult(ag.id, "REOPEN_RESULT")}
                                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-bold shadow"
                              >
                                결과 재개
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
            {!selectedAssemblyId && (
              <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm text-slate-500">
                총회를 선택하면 해당 총회의 상정 안건과 의사진행 제어가 표시됩니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 신규 총회 일정 개설 모달 */}
      {showAssemblyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAssembly}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                🏛️ 신규 총회/임시회 일정 개설
              </h3>
              <button
                type="button"
                onClick={() => setShowAssemblyModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">총회 구분</label>
                <select
                  value={newAssIsRegular ? "1" : "0"}
                  onChange={(e) => setNewAssIsRegular(e.target.value === "1")}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="1">정기총회 (매월 첫째 주 일요일 소집)</option>
                  <option value="0">임시총회 / 임시회 (긴급 소집)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">총회 명칭</label>
                <input
                  type="text"
                  required
                  value={newAssTitle}
                  onChange={(e) => setNewAssTitle(e.target.value)}
                  placeholder="예: 2026년도 10월 정기총회 또는 제2회 임시총회"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">회차</label>
                  <input
                    type="number"
                    required
                    value={newAssRound}
                    onChange={(e) => setNewAssRound(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">개최 일시</label>
                  <input
                    type="text"
                    required
                    value={newAssHeldAt}
                    onChange={(e) => setNewAssHeldAt(e.target.value)}
                    placeholder="2026-10-04 20:00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAssemblyModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isCreatingAssembly}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow"
              >
                {isCreatingAssembly ? "개설중..." : "총회 소집 공고 및 등록"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 신규 안건 상정 모달 */}
      {showAgendaModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAgenda}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                📋 신규 안건 상정
              </h3>
              <button
                type="button"
                onClick={() => setShowAgendaModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">
                  상정할 총회 선택
                </label>
                <select
                  value={targetAssemblyId}
                  onChange={(e) => setTargetAssemblyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {assemblies.map((ass) => (
                    <option key={ass.id} value={ass.id}>
                      {ass.title} ({ass.held_at})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">안건명</label>
                <input
                  type="text"
                  required
                  value={newAgTitle}
                  onChange={(e) => setNewAgTitle(e.target.value)}
                  placeholder="예: 제3호 안건: 2026년도 하반기 예산안 승인의 건"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">
                  제안 이유 및 설명
                </label>
                <textarea
                  rows={3}
                  value={newAgDesc}
                  onChange={(e) => setNewAgDesc(e.target.value)}
                  placeholder="안건의 주요 골자 및 제안 이유"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">투표 선택지</label>
                <input
                  type="text"
                  value={newAgChoices}
                  onChange={(e) => setNewAgChoices(e.target.value)}
                  placeholder="찬성, 반대, 기권 또는 후보자 1, 후보자 2, 기권"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
                <p className="text-[10px] text-slate-500 mt-1">쉼표로 구분합니다. 2개 이상 입력해야 합니다.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">정족수(0=전체 의결권 1/3)</label>
                  <input
                    type="number"
                    min={0}
                    value={newAgQuorum}
                    onChange={(e) => setNewAgQuorum(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">투표 마감 시각(선택)</label>
                  <input
                    type="datetime-local"
                    value={newAgDeadline}
                    onChange={(e) => setNewAgDeadline(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAgIsSecret}
                    onChange={(e) => setNewAgIsSecret(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-slate-300">
                    무기명 비밀투표로 진행 (협회장 선출 등)
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAgendaModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isCreatingAgenda}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow"
              >
                {isCreatingAgenda ? "상정중..." : "안건 상정하기"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 총회 의사록 작성/수정 모달 (회칙 제18조) */}
      {showMinutesModal && selectedAssemblyForMinutes && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    총회 공식 의사록 작성 / 공표
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedAssemblyForMinutes.title} · 도스변호사협회 회칙
                    제18조
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMinutesModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <div className="text-slate-300">
                <span className="font-semibold text-amber-400">
                  회칙 제18조(총회의사록):
                </span>{" "}
                총회의 의사에 관하여는 의사의 경과 및 결과를 기재하고 공표하여야
                합니다.
              </div>
              <button
                type="button"
                onClick={insertMinutesTemplate}
                className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-semibold text-xs transition-colors shrink-0"
              >
                📋 표준 의사록 양식 불러오기
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                의사록 본문 (의사의 경과, 안건별 표결 결과, 서명날인 등):
              </label>
              <textarea
                rows={14}
                value={minutesText}
                onChange={(e) => setMinutesText(e.target.value)}
                placeholder="총회 의사록 내용을 상세히 작성하십시오..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={broadcastMinutesDiscord}
                  onChange={(e) => setBroadcastMinutesDiscord(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-300 font-semibold">
                  📢 저장 시 디스코드 총회 채널(ASSEMBLY)로 공식 의사록 공표
                  알림 즉시 송출
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowMinutesModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={isSavingMinutes}
                onClick={handleSaveMinutes}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                {isSavingMinutes
                  ? "저장 및 공표중..."
                  : "총회 의사록 저장 및 공표"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 탭 3: 디스코드 웹훅 & 봇 역할 설정 및 팝업 공지 */}
      {/* ========================================================================= */}
      {activeTab === "settings" && permissions.canSettings && (
        <div className="space-y-8">
          {/* 팝업 공지 관리 카드 */}
          <form
            onSubmit={handleSavePopup}
            className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-400" />
                  📢 포털 메인 안내사항 팝업공지(모달) 관리
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  포털 메인 접속 시 모든 사용자에게 모달 팝업으로 중요한 공지를 즉시 고지합니다. (24시간 동안 보지 않기 지원)
                </p>
              </div>

              {/* 활성화 스위치 */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-300">
                  팝업 노출 상태:
                </span>
                <button
                  type="button"
                  onClick={() => setPopupEnabled(!popupEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    popupEnabled ? "bg-emerald-600" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      popupEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span
                  className={`text-xs font-extrabold ${
                    popupEnabled ? "text-emerald-400" : "text-slate-500"
                  }`}
                >
                  {popupEnabled ? "ON (노출중)" : "OFF (비활성)"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 왼쪽: 입력 폼 */}
              <div className="space-y-4">
                {/* 심각도 / 유형 선택 */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">
                    공지 유형 / 심각도 (Severity)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPopupLevel("INFO")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        popupLevel === "INFO"
                          ? "bg-blue-950/60 border-blue-500 text-blue-300 ring-2 ring-blue-500/30"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <Info className="w-4 h-4 text-blue-400" />
                      <span>일반 안내</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPopupLevel("WARNING")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        popupLevel === "WARNING"
                          ? "bg-amber-950/60 border-amber-500 text-amber-300 ring-2 ring-amber-500/30"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>중요 공지</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPopupLevel("URGENT")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        popupLevel === "URGENT"
                          ? "bg-red-950/60 border-red-500 text-red-300 ring-2 ring-red-500/30 animate-pulse"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <AlertOctagon className="w-4 h-4 text-red-400" />
                      <span>긴급 속보</span>
                    </button>
                  </div>
                </div>

                {/* 공지 제목 */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    팝업 제목
                  </label>
                  <input
                    type="text"
                    value={popupTitle}
                    onChange={(e) => setPopupTitle(e.target.value)}
                    placeholder="예: [안내] 제10회 변호사시험 원서접수 기간 공고"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* 공지 본문 */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    팝업 상세 내용
                  </label>
                  <textarea
                    rows={4}
                    value={popupContent}
                    onChange={(e) => setPopupContent(e.target.value)}
                    placeholder="공지할 상세 내용을 입력하세요. 줄바꿈이 지원됩니다."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 resize-none font-sans"
                  />
                </div>

                {/* 바로가기 링크 (선택사항) */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    관련 페이지 바로가기 링크 (선택사항)
                  </label>
                  <input
                    type="text"
                    value={popupLink}
                    onChange={(e) => setPopupLink(e.target.value)}
                    placeholder="예: /exam/apply 또는 https://..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* 오른쪽: 실시간 팝업 미리보기 */}
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-slate-400 mb-2">
                  👁️ 실시간 팝업 렌더링 미리보기
                </label>
                <div className="flex-1 bg-slate-950/80 rounded-2xl border border-slate-800 p-4 flex items-center justify-center">
                  <div
                    className={`w-full max-w-sm rounded-xl p-4 shadow-2xl border ${
                      popupLevel === "URGENT"
                        ? "bg-slate-900 border-red-500/50 shadow-red-950/40"
                        : popupLevel === "WARNING"
                          ? "bg-slate-900 border-amber-500/50 shadow-amber-950/40"
                          : "bg-slate-900 border-blue-500/50 shadow-blue-950/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {popupLevel === "URGENT" ? (
                        <div className="p-1 rounded bg-red-500/20 text-red-400">
                          <AlertOctagon className="w-4 h-4" />
                        </div>
                      ) : popupLevel === "WARNING" ? (
                        <div className="p-1 rounded bg-amber-500/20 text-amber-400">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-1 rounded bg-blue-500/20 text-blue-400">
                          <Info className="w-4 h-4" />
                        </div>
                      )}
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          popupLevel === "URGENT"
                            ? "bg-red-500/20 text-red-300"
                            : popupLevel === "WARNING"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-blue-500/20 text-blue-300"
                        }`}
                      >
                        {popupLevel === "URGENT"
                          ? "긴급 속보"
                          : popupLevel === "WARNING"
                            ? "주요 공지"
                            : "일반 안내"}
                      </span>
                    </div>

                    <h4 className="text-sm font-extrabold text-white mb-2 line-clamp-2">
                      {popupTitle || "공지 제목이 여기에 표시됩니다."}
                    </h4>

                    <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed mb-4 max-h-32 overflow-y-auto">
                      {popupContent || "공지 내용이 여기에 표시됩니다."}
                    </p>

                    {popupLink && (
                      <div className="mb-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:underline">
                          🔗 관련 페이지 바로가기 &rarr;
                        </span>
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled
                          className="rounded border-slate-700 bg-slate-800 text-amber-500"
                        />
                        <span>오늘 하루 보지 않기</span>
                      </label>
                      <button
                        type="button"
                        className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded text-[11px] font-bold"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 하단 저장 액션 바 */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastPopupDiscord}
                  onChange={(e) => setBroadcastPopupDiscord(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
                />
                <span className="text-xs font-bold text-slate-300">
                  📢 저장 시 디스코드 공식 공지 채널(NOTICE)로 즉시 방송 발송
                </span>
              </label>

              <button
                type="submit"
                disabled={isSavingPopup}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                {isSavingPopup ? "저장 및 반영중..." : "팝업 공지 설정 저장 및 즉시 반영"}
              </button>
            </div>
          </form>

          {/* 디스코드 웹훅 및 봇 설정 폼 */}
          <form
            onSubmit={handleSaveSettings}
            className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6"
          >
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-400" />
                디스코드 5대 웹훅 및 봇 역할(Role) 자동지급 설정
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                각 알림 채널별 웹훅 URL과 디스코드 봇 토큰 및 역할 ID를 입력하면
                회원의 자격 변경 시 디스코드 역할이 자동 부여됩니다.
              </p>
            </div>

          {/* 5대 웹훅 설정 */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-amber-400 border-b border-slate-800 pb-2">
              📢 5대 알림 채널 웹훅 URL
            </h3>

            {[
              {
                key: "webhook_notice",
                label: "공지사항 웹훅 (NOTICE)",
                desc: "변호사시험 합격자 공고 등 협회 공식 공고",
              },
              {
                key: "webhook_lawyer_approval",
                label: "정회원 등록 승인 웹훅 (LAWYER_APPROVAL)",
                desc: "신규 변호사 자격 등록 승인 공표 (미설정 시 NOTICE 웹훅으로 발송)",
              },
              {
                key: "webhook_exam",
                label: "변호사시험 웹훅 (EXAM)",
                desc: "문제 정정 긴급 방송",
              },
              {
                key: "webhook_assembly",
                label: "총회/전자투표 웹훅 (ASSEMBLY)",
                desc: "총회 소집, 표결 선포, 위임장 접수, 공식 의사록",
              },
              {
                key: "webhook_discipline",
                label: "징계위원회 웹훅 (DISCIPLINE)",
                desc: "징계 처분 대국민 공시",
              },
              {
                key: "webhook_admin",
                label: "사무국 관리자 웹훅 (ADMIN)",
                desc: "신규 가입 신청, 설정 갱신 로그, 시험 출제 갱신",
              },
            ].map((item) => {
              const testType = item.key.replace("webhook_", "").toUpperCase();
              const isTesting = testingWebhook === testType;
              return (
              <div
                key={item.key}
                className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-white">
                      {item.label}
                    </label>
                    <p className="text-[11px] text-slate-500">{item.desc}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={() => handleTestWebhook(testType, settings[item.key] || "")}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 text-[11px] font-semibold rounded-lg border border-slate-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    {isTesting ? "전송중..." : "테스트 발송"}
                  </button>
                </div>
                <input
                  type="text"
                  value={settings[item.key] || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, [item.key]: e.target.value })
                  }
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              );
            })}
          </div>

          {/* 디스코드 봇 & 역할 자동지급 ID 설정 */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold text-blue-400 border-b border-slate-800 pb-2">
              🤖 디스코드 봇 토큰 및 직책별 역할 ID (자동 지급용)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1 font-semibold">
                  디스코드 봇 토큰 (Bot Token)
                </label>
                <input
                  type="password"
                  value={settings["discord_bot_token"] || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      discord_bot_token: e.target.value,
                    })
                  }
                  placeholder="Bot MTIzNDU2..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1 font-semibold">
                  디스코드 서버 ID (Guild ID)
                </label>
                <input
                  type="text"
                  value={settings["discord_guild_id"] || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      discord_guild_id: e.target.value,
                    })
                  }
                  placeholder="123456789012345678"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {[
                { key: "discord_role_lawyer", label: "⚖️ 정회원 변호사 역할 ID" },
                { key: "discord_role_trainee", label: "📋 견습변호사 역할 ID" },
                { key: "discord_role_group_executive", label: "【 🎓 · 임원 】 헤더 역할 ID" },
                { key: "discord_role_board", label: "🏢 이사회 (그룹) 역할 ID" },
                { key: "discord_role_president", label: "[ ⚖️ ] 회장 역할 ID" },
                { key: "discord_role_vice_president", label: "[ ⚖️ ] 부회장 역할 ID" },
                { key: "discord_role_director", label: "[ 🎓 ] 이사 역할 ID" },
                { key: "discord_role_group_assembly", label: "【 📜 · 총회 】 헤더 역할 ID" },
                { key: "discord_role_speaker", label: "[ 🎭 ] 의장 (총회) 역할 ID" },
                { key: "discord_role_vice_speaker", label: "[ 🎭 ] 부의장 (총회) 역할 ID" },
                { key: "discord_role_group_secretariat", label: "【 📂 · 사무국 】 헤더 역할 ID" },
                { key: "discord_role_secretary_general", label: "[ 🖋️ ] 사무총장 역할 ID" },
                { key: "discord_role_staff", label: "[ 🖋️ ] 직원 (사무국) 역할 ID" },
                { key: "discord_role_discipline_comm", label: "⚖️ 징계위원회 역할 ID" },
                { key: "discord_role_exam_comm", label: "📝 변호사시험관리위원 역할 ID" },
              ].map((r) => (
                <div
                  key={r.key}
                  className="p-3 bg-slate-950 rounded-lg border border-slate-800"
                >
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {r.label}
                  </label>
                  <input
                    type="text"
                    value={settings[r.key] || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, [r.key]: e.target.value })
                    }
                    placeholder="숫자 역할 ID"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {isSavingSettings
                ? "설정 저장중..."
                : "웹훅 및 봇 설정 전체 저장"}
            </button>
          </div>
        </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 탭 4: 사법 행정 종합 현황 */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 통계 카드 그리드 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] text-slate-400">전체 등록 회원</span>
              <div className="text-2xl font-extrabold text-white">
                {stats.totalUsers}명
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] text-slate-400">
                정상 개업 변호사
              </span>
              <div className="text-2xl font-extrabold text-amber-400">
                {stats.activeLawyers}명
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] text-slate-400">가입 승인 대기</span>
              <div className="text-2xl font-extrabold text-red-400">
                {stats.pendingUsers}명
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] text-slate-400">개설된 총회</span>
              <div className="text-2xl font-extrabold text-emerald-400">
                {stats.totalAssemblies}회
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] text-slate-400">
                변호사시험 회차
              </span>
              <div className="text-2xl font-extrabold text-blue-400">
                {stats.totalExams}회
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] text-slate-400">
                누적 시험 응시자
              </span>
              <div className="text-2xl font-extrabold text-purple-400">
                {stats.totalSubmissions}명
              </div>
            </div>
          </div>

          {/* 위원회 바로가기 배너 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <Award className="w-5 h-5" /> 변호사시험관리위원회 관리 패널
              </div>
              <p className="text-xs text-slate-400">
                1차 필기 CBT 10문항 실시간 편집, 긴급 문제 정정 방송 송출, 2차
                서술형 채점표 사정 및 최종 합격자 디스코드 발표를 관리합니다.
              </p>
              <Link
                href="/exam/admin"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors"
              >
                시험관리위원회 패널로 이동{" "}
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" /> 변호사징계위원회 대국민
                공시
              </div>
              <p className="text-xs text-slate-400">
                변호사법 제51조 및 회칙 제36조에 따른 영구제명, 제명, 정직,
                과태료 처분을 관리하고 디스코드에 공식 공시합니다.
              </p>
              <Link
                href="/discipline"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-bold rounded-lg border border-slate-700 transition-colors"
              >
                징계위원회 공시관으로 이동{" "}
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type RoleType = "CITIZEN" | "TRAINEE" | "LAWYER" | "ADMIN" | "PROSECUTOR" | "ASSOCIATE";
export type StatusType = "ACTIVE" | "SUSPENDED" | "EXPIRED" | "EXPELLED" | "PENDING";

export interface OfficerPosition {
  id: string;
  label: string;
  group: "이사회" | "사무국" | "총회" | "위원회";
  color: string;
}

export const OFFICER_POSITIONS: Record<string, OfficerPosition> = {
  // 이사회 & 임원
  PRESIDENT: { id: "PRESIDENT", label: "협회장", group: "이사회", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  VICE_PRESIDENT: { id: "VICE_PRESIDENT", label: "부협회장", group: "이사회", color: "bg-amber-600/20 text-amber-400 border-amber-600/40" },
  DIRECTOR: { id: "DIRECTOR", label: "이사", group: "이사회", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },

  // 사무국
  SECRETARY_GENERAL: { id: "SECRETARY_GENERAL", label: "사무총장", group: "사무국", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  SECRETARIAT_STAFF: { id: "SECRETARIAT_STAFF", label: "사무국직원", group: "사무국", color: "bg-sky-500/20 text-sky-300 border-sky-500/40" },

  // 총회
  ASSEMBLY_SPEAKER: { id: "ASSEMBLY_SPEAKER", label: "총회 의장", group: "총회", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  ASSEMBLY_VICE_SPEAKER: { id: "ASSEMBLY_VICE_SPEAKER", label: "총회 부의장", group: "총회", color: "bg-teal-500/20 text-teal-300 border-teal-500/40" },

  // 위원회
  DISCIPLINE_COMM_MEMBER: { id: "DISCIPLINE_COMM_MEMBER", label: "변호사징계위원회 위원", group: "위원회", color: "bg-red-500/20 text-red-300 border-red-500/40" },
  EXAM_COMM_MEMBER: { id: "EXAM_COMM_MEMBER", label: "변호사시험관리위원회 위원", group: "위원회", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" },
};

export interface SessionUser {
  id: string;
  loginId: string;
  name: string;
  role: RoleType;
  status: StatusType;
  isTrainee: number;
  positions?: string[];
}

/** 관리자 통합 패널 (/admin) 접근 권한 */
export function hasAdminPanelAccess(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const pos = user.positions || [];
  return pos.some((p) =>
    ["PRESIDENT", "VICE_PRESIDENT", "DIRECTOR", "SECRETARY_GENERAL", "SECRETARIAT_STAFF", "ASSEMBLY_SPEAKER", "ASSEMBLY_VICE_SPEAKER"].includes(p)
  );
}

/** 시스템 설정 및 웹훅 관리 권한 */
export function canManageSettings(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const pos = user.positions || [];
  return pos.some((p) => ["PRESIDENT", "SECRETARY_GENERAL"].includes(p));
}

/** 회원 승인 및 명부/직책 관리 권한 */
export function canManageUsers(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const pos = user.positions || [];
  return pos.some((p) => ["PRESIDENT", "SECRETARY_GENERAL", "SECRETARIAT_STAFF"].includes(p));
}

/** 총회/임시회 소집 및 안건/표결 관리 권한 */
export function canManageAssembly(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const pos = user.positions || [];
  return pos.some((p) => ["PRESIDENT", "ASSEMBLY_SPEAKER", "ASSEMBLY_VICE_SPEAKER", "SECRETARY_GENERAL"].includes(p));
}

/** 변호사시험 패널 (/exam/admin), 문항 편집, 채점, 합격 발표 권한 */
export function canManageExam(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const pos = user.positions || [];
  return pos.some((p) => ["PRESIDENT", "EXAM_COMM_MEMBER"].includes(p));
}

/** 징계위원회 심의 및 공시 권한 */
export function canManageDiscipline(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "PROSECUTOR") return true;
  const pos = user.positions || [];
  return pos.some((p) => ["PRESIDENT", "DISCIPLINE_COMM_MEMBER"].includes(p));
}

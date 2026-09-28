import { parseKst, parseDbUtc } from "@/lib/kst";

export type ExamOperationMode = "TIME" | "MANUAL";

export function isExamPhaseOpen(
  exam: Record<string, unknown>,
  phase: "PHASE1" | "PHASE2",
  now = Date.now(),
): boolean {
  const mode = String(
    phase === "PHASE1"
      ? exam.phase1_operation_mode || "MANUAL"
      : exam.phase2_operation_mode || "MANUAL",
  ).trim().toUpperCase();

  if (mode === "MANUAL") {
    const status = String(exam.status || "").trim().toUpperCase();
    return status === phase;
  }

  // 일정은 KST 기준으로 해석 (서버 시간대와 무관)
  const startAt = parseKst(phase === "PHASE1" ? exam.phase1_start : exam.phase2_start);
  const endAt = parseKst(phase === "PHASE1" ? exam.phase1_end : exam.phase2_end);

  return (
    Number.isFinite(startAt) &&
    Number.isFinite(endAt) &&
    now >= startAt &&
    now <= endAt
  );
}

// ── 1차 CBT 제한 시간 ─────────────────────────────────────────────
//  - TIME  : 일정(phase1_start ~ phase1_end, KST)에 맞춰 진행. 종료 시각 = phase1_end
//  - MANUAL: 관리자가 상태를 PHASE1로 바꾼 시각(phase1_started_at)부터 120분
export const PHASE1_DURATION_MS = 120 * 60 * 1000;
export const SUBMIT_GRACE_MS = 90 * 1000; // 종료 직후 자동 제출이 도착할 수 있는 여유

export interface Phase1Window {
  mode: "TIME" | "MANUAL";
  startAt: number | null;
  deadlineAt: number | null; // null = 고정 종료 시각 없음(기존 시험: 입장 시점부터 120분)
}

export function getPhase1Window(exam: Record<string, unknown>): Phase1Window {
  const mode =
    String(exam.phase1_operation_mode || "MANUAL").trim().toUpperCase() === "TIME"
      ? "TIME"
      : "MANUAL";
  if (mode === "TIME") {
    const startAt = parseKst(exam.phase1_start);
    const endAt = parseKst(exam.phase1_end);
    return {
      mode,
      startAt: Number.isFinite(startAt) ? startAt : null,
      deadlineAt: Number.isFinite(endAt) ? endAt : null,
    };
  }
  const started = parseDbUtc(exam.phase1_started_at);
  return {
    mode,
    startAt: Number.isFinite(started) ? started : null,
    deadlineAt: Number.isFinite(started) ? started + PHASE1_DURATION_MS : null,
  };
}

// 입장/문항 열람 가능: 시험이 열려 있고 종료 시각 전
export function isPhase1EntryOpen(exam: Record<string, unknown>, now = Date.now()): boolean {
  if (!isExamPhaseOpen(exam, "PHASE1", now)) return false;
  const w = getPhase1Window(exam);
  return w.deadlineAt === null || now < w.deadlineAt;
}

// 제출/자동저장 가능: 종료 후 SUBMIT_GRACE_MS 까지 허용 (종료 순간 자동 제출 보장)
export function isPhase1SubmitOpen(exam: Record<string, unknown>, now = Date.now()): boolean {
  const w = getPhase1Window(exam);
  if (w.mode === "TIME") {
    return (
      w.startAt !== null &&
      w.deadlineAt !== null &&
      now >= w.startAt &&
      now <= w.deadlineAt + SUBMIT_GRACE_MS
    );
  }
  if (!isExamPhaseOpen(exam, "PHASE1", now)) return false;
  return w.deadlineAt === null || now <= w.deadlineAt + SUBMIT_GRACE_MS;
}

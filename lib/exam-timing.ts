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

  const startAt = new Date(
    String(phase === "PHASE1" ? exam.phase1_start : exam.phase2_start),
  ).getTime();
  const endAt = new Date(
    String(phase === "PHASE1" ? exam.phase1_end : exam.phase2_end),
  ).getTime();

  return (
    Number.isFinite(startAt) &&
    Number.isFinite(endAt) &&
    now >= startAt &&
    now <= endAt
  );
}

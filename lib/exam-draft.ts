import db from "@/lib/db";

// exam_submissions 에 임시저장용 컬럼이 없으면 1회 추가 (기존 DB 자동 마이그레이션)
let ensured: Promise<void> | null = null;

export function ensureDraftColumns(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      for (const col of [
        "phase1_draft TEXT DEFAULT ''",
        "phase1_started_at TEXT DEFAULT ''",
      ]) {
        try {
          await db.execute(`ALTER TABLE exam_submissions ADD COLUMN ${col}`);
        } catch (e: any) {
          if (!/duplicate column/i.test(String(e?.message || e))) {
            ensured = null; // 다음 요청에서 재시도
            throw e;
          }
        }
      }
    })();
  }
  return ensured;
}

// 클라이언트에서 온 답안을 검증/정리 ({문항번호: 선택번호})
export function sanitizeAnswers(input: unknown): Record<number, number> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out: Record<number, number> = {};
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > 200) return null;
  for (const [k, v] of entries) {
    const q = Number(k);
    const c = Number(v);
    if (!Number.isInteger(q) || q < 1 || q > 200) return null;
    if (!Number.isInteger(c) || c < 1 || c > 20) return null;
    out[q] = c;
  }
  return out;
}

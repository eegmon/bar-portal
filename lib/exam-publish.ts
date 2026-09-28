import db from "@/lib/db";

// 1차 CBT 성적 발표 여부 (exams.phase1_published)
//  - 관리자가 "발표"를 누르기 전에는 수험생에게 점수/합격 여부를 노출하지 않는다.
let ensured: Promise<void> | null = null;

export function ensurePublishColumns(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      let added = false;
      try {
        await db.execute(
          "ALTER TABLE exams ADD COLUMN phase1_published INTEGER DEFAULT 0",
        );
        added = true;
      } catch (e: any) {
        if (!/duplicate column/i.test(String(e?.message || e))) {
          ensured = null;
          throw e;
        }
      }
      try {
        await db.execute(
          "ALTER TABLE exams ADD COLUMN phase1_published_at TEXT DEFAULT ''",
        );
      } catch (e: any) {
        if (!/duplicate column/i.test(String(e?.message || e))) {
          ensured = null;
          throw e;
        }
      }
      // 컬럼을 처음 만든 순간, 이미 1차가 끝난 기존 회차는 발표된 것으로 간주(기존 동작 유지)
      if (added) {
        await db.execute(
          "UPDATE exams SET phase1_published = 1 WHERE status IN ('PHASE2','GRADING','FINISHED')",
        );
      }
    })();
  }
  return ensured;
}

export function isPhase1Published(exam: any): boolean {
  return Boolean(Number(exam?.phase1_published ?? 0));
}

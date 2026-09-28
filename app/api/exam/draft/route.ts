import { NextResponse } from "next/server";
import db from "@/lib/db";
import { isPhase1EntryOpen, isPhase1SubmitOpen } from "@/lib/exam-timing";
import { ensureDraftColumns, sanitizeAnswers } from "@/lib/exam-draft";

// 1차 CBT 진행 중 답안 서버 임시저장
//  - action "start": 시험 시작 시각을 서버에 기록(최초 1회) + 저장된 임시답안 반환
//  - action "save" : 임시답안 저장
export async function POST(req: Request) {
  try {
    const { action, examId, securityCode, answers } = await req.json();

    if (!examId || !securityCode || !["start", "save"].includes(action)) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const code = String(securityCode).trim().toUpperCase();

    await ensureDraftColumns();

    const examRes = await db.execute({
      sql: "SELECT * FROM exams WHERE id = ?",
      args: [examId],
    });
    if (examRes.rows.length === 0) {
      return NextResponse.json({ error: "유효하지 않은 시험입니다." }, { status: 404 });
    }
    if (!(action === "start" ? isPhase1EntryOpen : isPhase1SubmitOpen)(examRes.rows[0])) {
      return NextResponse.json(
        { error: "현재 제1차 시험 응시 시간이 아닙니다." },
        { status: 403 },
      );
    }

    const subRes = await db.execute({
      sql: "SELECT * FROM exam_submissions WHERE exam_id = ? AND security_code = ?",
      args: [examId, code],
    });
    if (subRes.rows.length === 0) {
      return NextResponse.json(
        { error: "관리자가 발급한 유효한 수험번호가 아닙니다." },
        { status: 403 },
      );
    }
    const sub = subRes.rows[0];

    if (sub.phase1_answers && sub.phase1_answers !== "[]") {
      return NextResponse.json(
        { error: "이미 제출된 답안지가 존재합니다. (단 1회만 제출 가능)" },
        { status: 409 },
      );
    }

    // 시작 시각 (없으면 지금으로 기록; 동시 요청 시 먼저 기록된 값 유지)
    let startedMs = Date.parse(String(sub.phase1_started_at || ""));
    if (!Number.isFinite(startedMs)) {
      await db.execute({
        sql: `UPDATE exam_submissions SET phase1_started_at = ?
              WHERE id = ? AND (phase1_started_at IS NULL OR phase1_started_at = '')`,
        args: [new Date().toISOString(), sub.id as string],
      });
      const re = await db.execute({
        sql: "SELECT phase1_started_at FROM exam_submissions WHERE id = ?",
        args: [sub.id as string],
      });
      startedMs = Date.parse(String(re.rows[0]?.phase1_started_at || ""));
    }

    if (action === "start") {
      let saved: Record<number, number> = {};
      try {
        saved = JSON.parse(String(sub.phase1_draft || "{}")) || {};
      } catch {}
      return NextResponse.json({
        success: true,
        startedAt: startedMs,
        serverNow: Date.now(),
        answers: saved,
      });
    }

    // action === "save"
    const clean = sanitizeAnswers(answers);
    if (!clean) {
      return NextResponse.json({ error: "답안 형식이 올바르지 않습니다." }, { status: 400 });
    }
    await db.execute({
      sql: "UPDATE exam_submissions SET phase1_draft = ? WHERE id = ?",
      args: [JSON.stringify(clean), sub.id as string],
    });
    return NextResponse.json({ success: true, serverNow: Date.now() });
  } catch (err: any) {
    console.error("임시저장 에러:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

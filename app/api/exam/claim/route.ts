import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// POST — 로그인 유저가 수험번호를 자신의 계정에 연결(클레임)
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { securityCode, examId } = await req.json();
    if (!securityCode || !examId) {
      return NextResponse.json({ error: "수험번호와 시험 ID를 입력해 주세요." }, { status: 400 });
    }

    const code = String(securityCode).trim().toUpperCase();

    // auto-migrate
    for (const sql of [
      "ALTER TABLE exam_submissions ADD COLUMN bonus_approved INTEGER DEFAULT 0",
      "ALTER TABLE exam_submissions ADD COLUMN claimed_user_id TEXT DEFAULT NULL",
    ]) {
      try { await db.execute(sql); } catch { /* 이미 존재 */ }
    }

    // 수험번호 조회
    const subRes = await db.execute({
      sql: "SELECT * FROM exam_submissions WHERE exam_id = ? AND security_code = ?",
      args: [examId, code],
    });
    if (subRes.rows.length === 0) {
      return NextResponse.json({ error: "유효하지 않은 수험번호입니다." }, { status: 404 });
    }
    const sub = subRes.rows[0];

    // 이미 다른 유저가 클레임한 경우
    if (sub.claimed_user_id && sub.claimed_user_id !== user.id) {
      return NextResponse.json({ error: "이미 다른 계정에 등록된 수험번호입니다." }, { status: 409 });
    }

    // 이미 본인이 클레임한 경우
    if (sub.claimed_user_id === user.id) {
      return NextResponse.json({ success: true, alreadyClaimed: true, message: "이미 등록된 수험번호입니다." });
    }

    // 해당 시험에서 이 유저가 이미 다른 수험번호를 클레임했는지 확인
    const dupRes = await db.execute({
      sql: "SELECT id, security_code FROM exam_submissions WHERE exam_id = ? AND claimed_user_id = ?",
      args: [examId, user.id],
    });
    if (dupRes.rows.length > 0) {
      return NextResponse.json({
        error: `이미 이 시험에 수험번호(#${dupRes.rows[0].security_code})를 등록하셨습니다. 한 회차에 하나의 수험번호만 등록 가능합니다.`,
      }, { status: 409 });
    }

    // 클레임 처리
    await db.execute({
      sql: "UPDATE exam_submissions SET claimed_user_id = ? WHERE id = ?",
      args: [user.id, sub.id],
    });

    // 가산점 자격 여부 응답에 포함 (UI 안내용)
    const userRes = await db.execute({
      sql: "SELECT bonus_eligible FROM users WHERE id = ?",
      args: [user.id],
    });
    const bonusEligible = Number(userRes.rows[0]?.bonus_eligible) === 1;

    return NextResponse.json({
      success: true,
      message: `수험번호 #${code}가 계정(${user.name})에 등록되었습니다.`,
      bonusEligible,
    });
  } catch (err: any) {
    console.error("수험번호 클레임 오류:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

// DELETE — 클레임 취소 (시험 진행 중 아닐 때만)
export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get("examId");
    if (!examId) {
      return NextResponse.json({ error: "examId가 필요합니다." }, { status: 400 });
    }

    // 시험 상태 확인 — FINISHED 또는 GRADING 중에는 취소 불가
    const examRes = await db.execute({
      sql: "SELECT status FROM exams WHERE id = ?",
      args: [examId],
    });
    if (examRes.rows.length === 0) {
      return NextResponse.json({ error: "시험을 찾을 수 없습니다." }, { status: 404 });
    }
    const examStatus = examRes.rows[0].status as string;
    if (["FINISHED", "GRADING"].includes(examStatus)) {
      return NextResponse.json({ error: "채점 중이거나 종료된 시험은 수험번호 등록을 취소할 수 없습니다." }, { status: 403 });
    }

    await db.execute({
      sql: "UPDATE exam_submissions SET claimed_user_id = NULL, bonus_approved = 0 WHERE exam_id = ? AND claimed_user_id = ?",
      args: [examId, user.id],
    });

    return NextResponse.json({ success: true, message: "수험번호 등록이 취소되었습니다." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

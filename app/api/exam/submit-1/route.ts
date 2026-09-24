import { NextResponse } from "next/server";
import db from "@/lib/db";
import { sendDiscordWebhook } from "@/lib/discord";
import { isExamPhaseOpen } from "@/lib/exam-timing";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { examId, securityCode, answers } = body;

    if (!examId || !securityCode || !answers) {
      return NextResponse.json(
        { error: "필수 정보가 누락되었습니다." },
        { status: 400 },
      );
    }

    const code = String(securityCode).trim().toUpperCase();

    // 시험 정보 및 정답표 조회
    const examRes = await db.execute({
      sql: "SELECT * FROM exams WHERE id = ?",
      args: [examId],
    });

    if (examRes.rows.length === 0) {
      return NextResponse.json(
        { error: "유효하지 않은 시험입니다." },
        { status: 404 },
      );
    }

    const exam = examRes.rows[0];
    if (!isExamPhaseOpen(exam, "PHASE1")) {
      return NextResponse.json(
        { error: "현재 제1차 시험 응시 시간이 아닙니다." },
        { status: 403 },
      );
    }
    const questions = JSON.parse((exam.phase1_questions as string) || "[]");

    // 중복 제출 여부 확인
    const existingSub = await db.execute({
      sql: "SELECT * FROM exam_submissions WHERE exam_id = ? AND security_code = ?",
      args: [examId, code],
    });

    const phase1MaxScore = Number(exam.phase1_max_score || 100);
    const defaultQuestionScore = Math.max(
      1,
      Math.round(phase1MaxScore / Math.max(questions.length, 1)),
    );
    const questionScores = questions.map((question: any) =>
      Number(question.score || defaultQuestionScore),
    );
    const totalQuestionScore = questionScores.reduce(
      (sum: number, questionScore: number) => sum + questionScore,
      0,
    );
    const phase1PassScore = Math.ceil(totalQuestionScore * 0.6);

    // 자동 채점: 정답 문항의 개별 배점 합산
    let score = 0;
    const gradingDetails = questions.map((q: any, idx: number) => {
      const userChoice = answers[idx + 1];
      const validAnswers = q.altAnswers || [q.answer];
      const isCorrect = validAnswers.includes(userChoice);
      if (isCorrect) score += questionScores[idx] || defaultQuestionScore;
      return {
        num: q.num,
        userChoice,
        isCorrect,
      };
    });

    // 1차 합격 기준 (예: 60점 이상)
    const passed = score >= phase1PassScore ? 1 : 0;

    if (existingSub.rows.length === 0) {
      return NextResponse.json(
        { error: "관리자가 발급한 유효한 수험번호가 아닙니다." },
        { status: 403 },
      );
    }

    const existing = existingSub.rows[0];
    if (existing.phase1_answers && existing.phase1_answers !== "[]") {
      return NextResponse.json(
        { error: "이미 제출된 답안지가 존재합니다. (단 1회만 제출 가능)" },
        { status: 400 },
      );
    }

    if (existingSub.rows.length > 0) {
      await db.execute({
        sql: `UPDATE exam_submissions
              SET phase1_answers = ?, phase1_score = ?, phase1_passed = ?, submitted_at = datetime('now')
              WHERE id = ?`,
        args: [JSON.stringify(answers), score, passed, existing.id],
      });

      await sendDiscordWebhook("EXAM_ADMIN", {
        embeds: [
          {
            title: `📝 제1차 변호사시험 답안 제출 (#${code})`,
            description: `익명 수험번호 #${code} 답안이 접수되었습니다.\n• 득점: **${score}점 / ${totalQuestionScore}점**\n• 1차 통과 여부: **${passed ? "🟢 통과 (합격)" : "🔴 과락 (불합격)"}**`,
            color: passed ? 0x10b981 : 0xef4444,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({
        success: true,
        securityCode: code,
        score,
        passed: Boolean(passed),
        totalQuestions: questions.length,
        gradingDetails,
      });
    }
  } catch (err: any) {
    console.error("1차 시험 채점 에러:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}

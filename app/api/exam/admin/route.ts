import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import db from "@/lib/db";
import { getSessionUser, canManageExam } from "@/lib/auth";
import { sendDiscordWebhook } from "@/lib/discord";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !canManageExam(user)) {
      return NextResponse.json(
        { error: "변호사시험관리위원회 위원 권한이 필요합니다." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { action } = body;

    // 0. 관리자 발급 수험번호 생성
    if (action === "ISSUE_CANDIDATE_CODES") {
      const { examId, count } = body;
      const issueCount = Number(count);
      if (
        !examId ||
        !Number.isInteger(issueCount) ||
        issueCount < 1 ||
        issueCount > 500
      ) {
        return NextResponse.json(
          { error: "시험과 발급 수량(1~500)을 확인해 주세요." },
          { status: 400 },
        );
      }

      const examRes = await db.execute({
        sql: "SELECT id FROM exams WHERE id = ?",
        args: [examId],
      });
      if (examRes.rows.length === 0) {
        return NextResponse.json(
          { error: "시험을 찾을 수 없습니다." },
          { status: 404 },
        );
      }

      const issuedCodes: string[] = [];
      for (let index = 0; index < issueCount; index += 1) {
        const code = `DOS-${randomBytes(5).toString("hex").toUpperCase()}`;
        const submissionId = `sub-${Date.now()}-${index}-${randomBytes(3).toString("hex")}`;
        await db.execute({
          sql: `INSERT INTO exam_submissions
                (id, exam_id, user_id, security_code, phase1_answers, phase2_text_answer, phase2_file_url)
                VALUES (?, ?, ?, ?, '[]', '', '')`,
          args: [submissionId, examId, `anonymous-${code}`, code],
        });
        issuedCodes.push(code);
      }

      return NextResponse.json({
        success: true,
        examId,
        issuedCodes,
        message: `${issuedCodes.length}개의 수험번호가 발급되었습니다.`,
      });
    }

    // 1. CBT 문항 수정 및 정오표 갱신
    if (action === "UPDATE_QUESTIONS") {
      const { examId, questions } = body;
      if (!examId || !Array.isArray(questions)) {
        return NextResponse.json(
          { error: "유효하지 않은 문항 데이터입니다." },
          { status: 400 },
        );
      }

      await db.execute({
        sql: "UPDATE exams SET phase1_questions = ? WHERE id = ?",
        args: [JSON.stringify(questions), examId],
      });

      // 디스코드 관리자/시험 채널 알림
      await sendDiscordWebhook("ADMIN", {
        embeds: [
          {
            title: "📝 [변호사시험] 제1차 CBT 문항 및 정답표 갱신",
            description: `변호사시험관리위원회(**${user.name}** 위원)에서 제1차 필기 문항(총 ${questions.length}문)의 내용 및 정답표를 수정 등록하였습니다.`,
            color: 0x3b82f6,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({
        success: true,
        message: "CBT 1차 문항 및 정오표가 성공적으로 저장되었습니다.",
      });
    }

    // 2. 실시간 문제 정정 방송
    if (action === "BROADCAST_ERRATA") {
      const { examId, noticeText } = body;
      if (!examId || !noticeText) {
        return NextResponse.json(
          { error: "정정 공지 내용이 누락되었습니다." },
          { status: 400 },
        );
      }

      const examRes = await db.execute({
        sql: "SELECT * FROM exams WHERE id = ?",
        args: [examId],
      });
      if (examRes.rows.length === 0) {
        return NextResponse.json(
          { error: "시험을 찾을 수 없습니다." },
          { status: 404 },
        );
      }

      const exam = examRes.rows[0];
      const existingNotices = JSON.parse(
        (exam.errata_notices as string) || "[]",
      );
      const newNotice = {
        id: `errata-${Date.now()}`,
        createdAt: new Date().toISOString(),
        content: noticeText,
      };
      existingNotices.push(newNotice);

      await db.execute({
        sql: "UPDATE exams SET errata_notices = ? WHERE id = ?",
        args: [JSON.stringify(existingNotices), examId],
      });

      // 디스코드 시험 공지 채널로 즉시 발송
      await sendDiscordWebhook("EXAM", {
        content:
          "@everyone **[긴급 정정 공지] 제1차 변호사시험 문제 정정 안내**",
        embeds: [
          {
            title: "⚠️ 변호사시험 제1차 문제 정정 공지",
            description: noticeText,
            color: 0xf59e0b,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({ success: true, notice: newNotice });
    }

    // 3. 2차 채점표 점수 입력 및 합격 판정
    if (action === "GRADE_PHASE2") {
      const { submissionId, phase2Score, feedback, isPass } = body;
      if (!submissionId) {
        return NextResponse.json(
          { error: "제출물 ID가 필요합니다." },
          { status: 400 },
        );
      }

      const p2Score = Number(phase2Score || 0);
      const passed = isPass ? 1 : 0;

      // 기존 1차 점수 조회
      const subRes = await db.execute({
        sql: "SELECT * FROM exam_submissions WHERE id = ?",
        args: [submissionId],
      });
      if (subRes.rows.length === 0) {
        return NextResponse.json(
          { error: "제출 기록을 찾을 수 없습니다." },
          { status: 404 },
        );
      }

      const sub = subRes.rows[0];
      const p1Score = Number(sub.phase1_score || 0);
      const bonus = Number(sub.bonus_score || 0);
      const totalScore = Math.round(p1Score * 0.4 + p2Score * 0.6 + bonus);

      await db.execute({
        sql: `UPDATE exam_submissions 
              SET phase2_score = ?, phase2_feedback = ?, total_score = ?, final_passed = ?
              WHERE id = ?`,
        args: [p2Score, feedback || "", totalScore, passed, submissionId],
      });

      return NextResponse.json({ success: true, totalScore, passed });
    }

    // 4. 최종 합격자 명단 공개 발표 (포털 + 디스코드)
    if (action === "RELEASE_RESULTS") {
      const { examId } = body;
      if (!examId) return NextResponse.json({ error: "examId가 필요합니다." }, { status: 400 });

      const examRes = await db.execute({ sql: "SELECT * FROM exams WHERE id = ?", args: [examId] });
      if (examRes.rows.length === 0) return NextResponse.json({ error: "시험을 찾을 수 없습니다." }, { status: 404 });
      const exam = examRes.rows[0];

      const passersRes = await db.execute({
        sql: "SELECT security_code, total_score FROM exam_submissions WHERE exam_id = ? AND final_passed = 1 ORDER BY total_score DESC",
        args: [examId],
      });

      // 시험 상태를 FINISHED로 변경
      await db.execute({ sql: "UPDATE exams SET status = 'FINISHED' WHERE id = ?", args: [examId] });

      const passerList = passersRes.rows
        .map((r, idx) => `${idx + 1}위: \`#${r.security_code}\` — **${r.total_score}점**`)
        .join("\n");

      await sendDiscordWebhook("NOTICE", {
        content: "@everyone 🎉 **[공식 합격자 발표] 도스변호사시험 최종 합격자 명단**",
        embeds: [{
          title: `🏆 ${exam.title} 최종 합격자 명단 (총 ${passersRes.rows.length}명)`,
          description: passerList || "합격자가 없습니다.",
          color: 0x10B981,
          footer: { text: "도스변호사협회 변호사시험관리위원회 · 합격자 실명은 /exam/my-score 에서 확인" },
          timestamp: new Date().toISOString(),
        }],
      });

      return NextResponse.json({ success: true, count: passersRes.rows.length, message: `합격자 ${passersRes.rows.length}명이 공식 발표되었습니다.` });
    }

    return NextResponse.json(
      { error: "알 수 없는 작업입니다." },
      { status: 400 },
    );
  } catch (err: any) {
    console.error("시험 관리자 API 에러:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}

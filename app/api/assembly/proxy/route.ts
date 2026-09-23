import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sendDiscordWebhook } from "@/lib/discord";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, type, assemblyId, lawyerName, affiliation, reason, proxyLawyerId, signature, evidenceUrl } = body;

    if (!assemblyId || !lawyerName || !signature) {
      return NextResponse.json({ error: "필수 입력 정보가 누락되었습니다." }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "출석 및 위임 신청은 로그인한 회원만 제출할 수 있습니다." }, { status: 401 });
    }
    const userId = sessionUser.id;
    const assemblyRes = await db.execute({ sql: "SELECT status FROM assemblies WHERE id = ?", args: [assemblyId] });
    if (assemblyRes.rows.length === 0) return NextResponse.json({ error: "총회를 찾을 수 없습니다." }, { status: 404 });
    if (assemblyRes.rows[0].status === "IN_SESSION") {
      return NextResponse.json({ error: "총회 개회 후 명부 변경은 의장 허가가 필요합니다." }, { status: 403 });
    }

    if (action === "WITHDRAW_PROXY") {
      const existing = await db.execute({ sql: "SELECT id FROM assembly_attendances WHERE id = ? AND assembly_id = ? AND user_id = ? AND is_proxy = 1", args: [body.attendanceId, assemblyId, userId] });
      if (existing.rows.length === 0) return NextResponse.json({ error: "철회할 위임장을 찾을 수 없습니다." }, { status: 404 });
      await db.execute({ sql: "UPDATE assembly_attendances SET approval_status = 'REJECTED', rejection_reason = '위임인 철회' WHERE id = ?", args: [body.attendanceId] });
      return NextResponse.json({ success: true, message: "위임장이 철회되었습니다." });
    }
    const attId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // 1. 단독 자격 재등록 신청서인 경우
    if (type === "REREGISTER") {
      await db.execute({
          sql: `INSERT OR REPLACE INTO assembly_attendances (id, assembly_id, user_id, attended, is_proxy, proxy_to_user_id, signature, evidence_url)
            VALUES (?, ?, ?, 0, 0, NULL, ?, ?)`,
          args: [attId, assemblyId, userId, signature, evidenceUrl || ""],
      });

      // 변호사 자격 1개월 연장 처리 (변호사법 제6조제4항)
      if (sessionUser) {
        await db.execute({
          sql: "UPDATE users SET last_renewed_at = datetime('now'), status = 'ACTIVE' WHERE id = ?",
          args: [sessionUser.id],
        });
      }

      // 디스코드 총회/사무국 알림
      await sendDiscordWebhook("ASSEMBLY", {
        embeds: [
          {
            title: "📋 [정기총회] 불참 자격 재등록 신청서 접수",
            description: `**${lawyerName}** 변호사님이 정기총회 불참에 따른 자격 재등록 신청서를 제출하였습니다.\n• 소속: ${affiliation || "개인/미기재"}\n• 사유: ${reason || "직무 수행"}\n• 자격 갱신: **✅ 1개월 연장 처리 완료 (변호사법 제6조제4항)**`,
            color: 0xF59E0B,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({
        success: true,
        message: "정기총회 불참 자격 재등록 신청서가 정상 접수되었습니다. (변호사 자격 1개월 연장 완료)",
      });
    }

    // 2. 의결권 위임장인 경우
    if (type === "PROXY" || (!type && proxyLawyerId)) {
      if (!proxyLawyerId) {
        return NextResponse.json({ error: "의결권을 위임받을 수임 변호사를 선택해 주세요." }, { status: 400 });
      }

      // 수임 변호사 이름 조회
      let proxyName = "지정 변호사";
      try {
        const pRes = await db.execute({
          sql: "SELECT name, office_name, role, status FROM users WHERE id = ?",
          args: [proxyLawyerId],
        });
        if (pRes.rows.length === 0 || pRes.rows[0].role !== "LAWYER" || pRes.rows[0].status !== "ACTIVE") {
          return NextResponse.json({ error: "활성 상태의 변호사만 수임인으로 지정할 수 있습니다." }, { status: 400 });
        }
        if (proxyLawyerId === userId) {
          return NextResponse.json({ error: "본인을 수임인으로 지정할 수 없습니다." }, { status: 400 });
        }
        if (pRes.rows.length > 0) {
          proxyName = `${pRes.rows[0].name} (${pRes.rows[0].office_name || "법률사무소"})`;
        }
      } catch (err) {
        console.error("수임인 조회 에러:", err);
      }

      const duplicateRes = await db.execute({
        sql: "SELECT id FROM assembly_attendances WHERE assembly_id = ? AND user_id = ? AND is_proxy = 1 AND approval_status != 'REJECTED'",
        args: [assemblyId, userId],
      });
      if (duplicateRes.rows.length > 0) {
        return NextResponse.json({ error: "해당 총회에 이미 위임장이 제출되어 있습니다." }, { status: 409 });
      }

      await db.execute({
          sql: `INSERT INTO assembly_attendances (id, assembly_id, user_id, attended, is_proxy, proxy_to_user_id, signature, evidence_url, approval_status)
            VALUES (?, ?, ?, 0, 1, ?, ?, ?, 'PENDING')`,
          args: [attId, assemblyId, userId, proxyLawyerId, signature, evidenceUrl || ""],
      });

      // 자격 갱신도 동시 연장
      if (sessionUser) {
        await db.execute({
          sql: "UPDATE users SET last_renewed_at = datetime('now'), status = 'ACTIVE' WHERE id = ?",
          args: [sessionUser.id],
        });
      }

      // 디스코드 총회/사무국 알림
      await sendDiscordWebhook("ASSEMBLY", {
        embeds: [
          {
            title: "🗳️ [정기총회] 의결권 위임장 접수",
            description: `**${lawyerName}** 변호사님이 의결권 위임장을 제출하였습니다.\n• 사유: ${reason || "일정 중복"}\n• 의결권 수임인: **${proxyName}**\n• 자격 갱신: **✅ 1개월 연장 완료 (회칙 제14조)**`,
            color: 0x3B82F6,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({
        success: true,
        message: "의결권 위임장이 정상 접수되었습니다.",
      });
    }

    return NextResponse.json({ error: "유효하지 않은 신청 유형입니다." }, { status: 400 });
  } catch (err: any) {
    console.error("위임장/재등록 접수 에러:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

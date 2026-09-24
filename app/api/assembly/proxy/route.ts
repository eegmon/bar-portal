import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sendDiscordWebhook } from "@/lib/discord";

export async function GET() {
  try {
    const sessionUser = await getSessionUser();

    // 1. 최근 총회 목록 조회
    const assembliesRes = await db.execute({
      sql: "SELECT id, title, round_number, status, held_at, is_regular FROM assemblies ORDER BY round_number DESC LIMIT 5",
      args: [],
    });

    // 2. 활성 변호사 목록
    const lawyersRes = await db.execute({
      sql: "SELECT id, name, office_name FROM users WHERE role = 'LAWYER' AND status = 'ACTIVE' ORDER BY name ASC",
      args: [],
    });

    // 3. 로그인 사용자의 소속 승인 법인 및 의결권 (파트너 또는 대표인 경우)
    let myFirms: any[] = [];
    if (sessionUser) {
      const firmsRes = await db.execute({
        sql: `SELECT f.id, f.name, f.type, f.representative_id, fm.is_partner
              FROM firm_members fm
              JOIN law_firms f ON f.id = fm.firm_id
              WHERE fm.lawyer_id = ? AND f.status = 'APPROVED'`,
        args: [sessionUser.id],
      });
      myFirms = await Promise.all(
        (firmsRes.rows as any[]).map(async (firm) => {
          const countRes = await db.execute({
            sql: `SELECT 
                    COUNT(*) AS total_cnt,
                    SUM(CASE WHEN is_partner = 1 THEN 1 ELSE 0 END) AS partner_cnt
                  FROM firm_members WHERE firm_id = ?`,
            args: [firm.id],
          });
          const memberCount = Number(countRes.rows[0]?.total_cnt ?? 0);
          const partnerCount = Number(countRes.rows[0]?.partner_cnt ?? 0);
          const votingPower = Math.floor(partnerCount / 2);
          return {
            ...firm,
            member_count: memberCount,
            partner_count: partnerCount,
            voting_power: votingPower,
          };
        })
      );
    }

    return NextResponse.json({
      success: true,
      user: sessionUser ? { id: sessionUser.id, name: sessionUser.name, role: sessionUser.role, status: sessionUser.status } : null,
      assemblies: assembliesRes.rows,
      lawyers: lawyersRes.rows,
      myFirms,
    });
  } catch (err: any) {
    console.error("Proxy GET API error:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action,
      type,
      assemblyId,
      firmId,
      lawyerName,
      affiliation,
      reason,
      proxyLawyerId,
      signature,
      evidenceUrl,
    } = body;

    if (!assemblyId || !lawyerName || !signature) {
      return NextResponse.json(
        { error: "필수 입력 정보가 누락되었습니다." },
        { status: 400 },
      );
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "출석 및 위임 신청은 로그인한 회원만 제출할 수 있습니다." },
        { status: 401 },
      );
    }
    if (
      !["LAWYER", "ADMIN"].includes(sessionUser.role) ||
      !["ACTIVE", "SUSPENDED", "EXPIRED"].includes(sessionUser.status)
    ) {
      return NextResponse.json(
        { error: "등록된 변호사만 총회 재등록 또는 위임 신청을 제출할 수 있습니다." },
        { status: 403 },
      );
    }
    const userId = sessionUser.id;
    const assemblyRes = await db.execute({
      sql: "SELECT status FROM assemblies WHERE id = ?",
      args: [assemblyId],
    });
    if (assemblyRes.rows.length === 0)
      return NextResponse.json(
        { error: "총회를 찾을 수 없습니다." },
        { status: 404 },
      );
    if (assemblyRes.rows[0].status === "IN_SESSION") {
      return NextResponse.json(
        { error: "총회 개회 후 명부 변경은 의장 허가가 필요합니다." },
        { status: 403 },
      );
    }

    if (action === "WITHDRAW_PROXY") {
      const existing = await db.execute({
        sql: "SELECT id FROM assembly_attendances WHERE id = ? AND assembly_id = ? AND user_id = ? AND is_proxy = 1",
        args: [body.attendanceId, assemblyId, userId],
      });
      if (existing.rows.length === 0)
        return NextResponse.json(
          { error: "철회할 위임장을 찾을 수 없습니다." },
          { status: 404 },
        );
      await db.execute({
        sql: "UPDATE assembly_attendances SET approval_status = 'REJECTED', rejection_reason = '위임인 철회' WHERE id = ?",
        args: [body.attendanceId],
      });
      return NextResponse.json({
        success: true,
        message: "위임장이 철회되었습니다.",
      });
    }
    const attId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // 1. 단독 자격 재등록 신청서인 경우
    if (type === "REREGISTER") {
      if (sessionUser.status === "ACTIVE") {
        return NextResponse.json(
          { error: "현재 이미 활성 상태인 변호사는 재등록 신청을 할 수 없습니다." },
          { status: 400 },
        );
      }
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

      // 디스코드 사무국 관리자 알림
      await sendDiscordWebhook("ADMIN", {
        embeds: [
          {
            title: "📋 [사무국 알림] 정기총회 불참 자격 재등록 신청서 접수",
            description: `**${lawyerName}** 변호사님이 정기총회 불참에 따른 자격 재등록 신청서를 제출하였습니다.\n• 소속: ${affiliation || "개인/미기재"}\n• 사유: ${reason || "직무 수행"}\n• 자격 갱신: **✅ 1개월 연장 처리 완료 (변호사법 제6조제4항)**`,
            color: 0xf59e0b,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({
        success: true,
        message:
          "정기총회 불참 자격 재등록 신청서가 정상 접수되었습니다. (변호사 자격 1개월 연장 완료)",
      });
    }

    // 2. 법인회원 의결권 위임장인 경우 (회칙 제3항~제5항)
    if (type === "FIRM_PROXY" || firmId) {
      if (!firmId) {
        return NextResponse.json(
          { error: "의결권을 위임할 법무법인을 선택해 주세요." },
          { status: 400 },
        );
      }
      if (!proxyLawyerId) {
        return NextResponse.json(
          { error: "의결권을 수임받을 변호사를 지정해 주세요." },
          { status: 400 },
        );
      }
      if (!evidenceUrl || !evidenceUrl.trim()) {
        return NextResponse.json(
          { error: "회칙 제3항 및 제5항에 의거하여 구성원 회의(만장일치 결의) 증빙 자료(URL 또는 서면 링크)를 필수로 입력해야 합니다." },
          { status: 400 },
        );
      }

      // 법인 유효성 및 권한 확인
      const firmCheck = await db.execute({
        sql: `SELECT f.*, fm.is_partner
              FROM law_firms f
              JOIN firm_members fm ON fm.firm_id = f.id
              WHERE f.id = ? AND fm.lawyer_id = ? AND f.status = 'APPROVED'`,
        args: [firmId, userId],
      });

      if (firmCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "소속된 승인 법무법인을 찾을 수 없습니다." },
          { status: 403 },
        );
      }

      const firm = firmCheck.rows[0];
      if (!firm.is_partner && firm.representative_id !== userId) {
        return NextResponse.json(
          { error: "법인 의결권은 법인의 대표변호사 또는 구성원 변호사만 위임할 수 있습니다." },
          { status: 403 },
        );
      }

      // 구성원 변호사 수 집계 -> 의결권 산정 (2인당 1표, 1인 0표)
      const countRes = await db.execute({
        sql: "SELECT COUNT(*) as partner_cnt FROM firm_members WHERE firm_id = ? AND is_partner = 1",
        args: [firmId],
      });
      const partnerCount = Number(countRes.rows[0]?.partner_cnt || 0);
      const votingPower = Math.floor(partnerCount / 2);

      if (votingPower < 1) {
        return NextResponse.json(
          { error: `해당 법인의 등록 구성원 변호사는 ${partnerCount}명으로, 의결권이 0표이므로 위임할 수 없습니다. (2인당 1표)` },
          { status: 400 },
        );
      }

      // 수임 변호사 검증
      const pRes = await db.execute({
        sql: "SELECT id, name, office_name, role, status FROM users WHERE id = ?",
        args: [proxyLawyerId],
      });
      if (
        pRes.rows.length === 0 ||
        pRes.rows[0].role !== "LAWYER" ||
        pRes.rows[0].status !== "ACTIVE"
      ) {
        return NextResponse.json(
          { error: "활성 상태의 변호사만 수임인으로 지정할 수 있습니다." },
          { status: 400 },
        );
      }
      const proxyName = `${pRes.rows[0].name} (${pRes.rows[0].office_name || "법률사무소"})`;

      // 중복 위임 체크 (동일 총회에 동일 법인 중복 위임 방지)
      const dupRes = await db.execute({
        sql: "SELECT id FROM assembly_attendances WHERE assembly_id = ? AND firm_id = ? AND approval_status != 'REJECTED'",
        args: [assemblyId, firmId],
      });
      if (dupRes.rows.length > 0) {
        return NextResponse.json(
          { error: "해당 법인의 의결권 위임 신고서가 본 총회에 이미 제출되어 있습니다." },
          { status: 409 },
        );
      }

      await db.execute({
        sql: `INSERT INTO assembly_attendances (id, assembly_id, user_id, firm_id, voting_power, attended, is_proxy, proxy_to_user_id, signature, evidence_url, approval_status)
              VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?, 'PENDING')`,
        args: [
          attId,
          assemblyId,
          userId,
          firmId,
          votingPower,
          proxyLawyerId,
          signature,
          evidenceUrl.trim(),
        ],
      });
      await db.execute({
        sql: "UPDATE users SET status = 'ACTIVE', last_renewed_at = datetime('now') WHERE id = ? AND role = 'LAWYER'",
        args: [userId],
      });

      // 디스코드 사무국 관리자 알림
      await sendDiscordWebhook("ADMIN", {
        embeds: [
          {
            title: `🏢 [사무국 알림] 법무법인 총회 의결권 위임 접수 (${firm.name})`,
            description: `**${lawyerName}** 변호사님이 법인회원 **${firm.name}**의 총회 의결권 위임 신고서를 제출하였습니다.\n• 산정 의결권: **${votingPower}표** (구성원 변호사 ${partnerCount}명 기준)\n• 수임 변호사: **${proxyName}**\n• 사유: ${reason || "구성원 회의 결의에 따른 위임"}\n• 증빙 자료: ${evidenceUrl}\n• 회칙 근거: **제14조제3항~제5항 (구성원 회의 만장일치 서면 통지)**\n\n관리자 패널(/admin)에서 증빙 서면 검토 후 승인 바랍니다.`,
            color: 0xf59e0b,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({
        success: true,
        message: `법무법인 ${firm.name}의 의결권(${votingPower}표) 위임 신고서가 정상 접수되었습니다. 관리자 승인 후 반영됩니다.`,
      });
    }

    // 3. 개인회원 의결권 위임장인 경우 (1표)
    if (type === "PROXY" || (!type && proxyLawyerId)) {
      if (!proxyLawyerId) {
        return NextResponse.json(
          { error: "의결권을 위임받을 수임 변호사를 선택해 주세요." },
          { status: 400 },
        );
      }

      // 수임 변호사 이름 조회
      let proxyName = "지정 변호사";
      try {
        const pRes = await db.execute({
          sql: "SELECT name, office_name, role, status FROM users WHERE id = ?",
          args: [proxyLawyerId],
        });
        if (
          pRes.rows.length === 0 ||
          pRes.rows[0].role !== "LAWYER" ||
          pRes.rows[0].status !== "ACTIVE"
        ) {
          return NextResponse.json(
            { error: "활성 상태의 변호사만 수임인으로 지정할 수 있습니다." },
            { status: 400 },
          );
        }
        if (proxyLawyerId === userId) {
          return NextResponse.json(
            { error: "개인 의결권은 본인을 수임인으로 지정할 수 없습니다." },
            { status: 400 },
          );
        }
        if (pRes.rows.length > 0) {
          proxyName = `${pRes.rows[0].name} (${pRes.rows[0].office_name || "법률사무소"})`;
        }
      } catch (err) {
        console.error("수임인 조회 에러:", err);
      }

      const duplicateRes = await db.execute({
        sql: "SELECT id FROM assembly_attendances WHERE assembly_id = ? AND user_id = ? AND is_proxy = 1 AND firm_id IS NULL AND approval_status != 'REJECTED'",
        args: [assemblyId, userId],
      });
      if (duplicateRes.rows.length > 0) {
        return NextResponse.json(
          { error: "해당 총회에 이미 개인 위임장이 제출되어 있습니다." },
          { status: 409 },
        );
      }

      await db.execute({
        sql: `INSERT INTO assembly_attendances (id, assembly_id, user_id, firm_id, voting_power, attended, is_proxy, proxy_to_user_id, signature, evidence_url, approval_status)
            VALUES (?, ?, ?, NULL, 1, 0, 1, ?, ?, ?, 'PENDING')`,
        args: [
          attId,
          assemblyId,
          userId,
          proxyLawyerId,
          signature,
          evidenceUrl || "",
        ],
      });

      // 자격 갱신도 동시 연장
      if (sessionUser) {
        await db.execute({
          sql: "UPDATE users SET last_renewed_at = datetime('now'), status = 'ACTIVE' WHERE id = ?",
          args: [sessionUser.id],
        });
      }

      // 디스코드 사무국 관리자 알림
      await sendDiscordWebhook("ADMIN", {
        embeds: [
          {
            title: "🗳️ [사무국 알림] 정기총회 개인 의결권 위임장 접수",
            description: `**${lawyerName}** 변호사님이 개인 의결권 위임장을 제출하였습니다.\n• 사유: ${reason || "일정 중복"}\n• 의결권 수임인: **${proxyName}**\n• 자격 갱신: **✅ 1개월 연장 완료 (회칙 제14조)**`,
            color: 0x3b82f6,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      return NextResponse.json({
        success: true,
        message: "의결권 위임장이 정상 접수되었습니다.",
      });
    }

    return NextResponse.json(
      { error: "유효하지 않은 신청 유형입니다." },
      { status: 400 },
    );
  } catch (err: any) {
    console.error("위임장/재등록 접수 에러:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 },
    );
  }
}

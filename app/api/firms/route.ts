import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionUser, canManageUsers } from "@/lib/auth";
import { sendDiscordWebhook } from "@/lib/discord";

// GET — 법무법인 목록 조회 (공개)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const statusFilter = searchParams.get("status") || "APPROVED";

    let firms: any[] = [];
    if (q.trim()) {
      const res = await db.execute({
        sql: `SELECT f.*, u.name AS rep_name
              FROM law_firms f
              LEFT JOIN users u ON f.representative_id = u.id
              WHERE (f.name LIKE ? OR f.address LIKE ?)
                AND (? = 'ALL' OR f.status = ?)
              ORDER BY f.created_at DESC`,
        args: [`%${q}%`, `%${q}%`, statusFilter, statusFilter],
      });
      firms = res.rows as any[];
    } else {
      const res = await db.execute({
        sql: `SELECT f.*, u.name AS rep_name
              FROM law_firms f
              LEFT JOIN users u ON f.representative_id = u.id
              WHERE (? = 'ALL' OR f.status = ?)
              ORDER BY f.created_at DESC`,
        args: [statusFilter, statusFilter],
      });
      firms = res.rows as any[];
    }

    // 각 법인의 구성원 수 및 구성원 변호사(파트너) 수 조회하여 의결권 산출 (2명당 1표, 1명 0표)
    const firmsWithMemberCount = await Promise.all(
      firms.map(async (firm) => {
        const countRes = await db.execute({
          sql: `SELECT 
                  COUNT(*) AS total_cnt,
                  SUM(CASE WHEN is_partner = 1 THEN 1 ELSE 0 END) AS partner_cnt
                FROM firm_members WHERE firm_id = ?`,
          args: [firm.id],
        });
        const memberCount = Number(countRes.rows[0]?.total_cnt ?? 0);
        const partnerCount = Number(countRes.rows[0]?.partner_cnt ?? 0);
        // 등록된 구성원 변호사 2명당 1표, 1명은 0표
        const votingPower = Math.floor(partnerCount / 2);

        return {
          ...firm,
          member_count: memberCount,
          partner_count: partnerCount,
          voting_power: votingPower,
        };
      })
    );

    return NextResponse.json({ success: true, firms: firmsWithMemberCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

// POST — 법인 등록 신청 / 관리자 승인·반려 / 구성원 추가·제거
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // ── 1. 법인 등록 신청 ──────────────────────────────────────
    if (action === "CREATE_FIRM") {
      const { name, type, address, contact, isNotary } = body;
      if (!name || !type) {
        return NextResponse.json({ error: "법인명과 종류는 필수입니다." }, { status: 400 });
      }

      const firmId = `firm-${Date.now()}`;
      await db.execute({
        sql: `INSERT INTO law_firms (id, name, type, representative_id, is_notary, status, address, contact)
              VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
        args: [firmId, name, type, user.id, isNotary ? 1 : 0, address || "", contact || ""],
      });

      // 신청자를 구성원으로 자동 등록 (파트너)
      await db.execute({
        sql: `INSERT INTO firm_members (firm_id, lawyer_id, is_partner) VALUES (?, ?, 1)`,
        args: [firmId, user.id],
      });

      await sendDiscordWebhook("ADMIN", {
        embeds: [{
          title: `🏢 법무법인 등록 신청: ${name}`,
          description: `• 종류: **${type}**\n• 신청인: **${user.name}** (${user.loginId})\n• 주소: ${address || "미기재"}\n• 공증인가: ${isNotary ? "예" : "아니오"}\n\n관리자 패널(/admin)에서 승인 또는 반려해 주세요.`,
          color: 0xF59E0B,
          timestamp: new Date().toISOString(),
        }],
      });

      return NextResponse.json({ success: true, firmId, message: "법인 등록 신청이 접수되었습니다. 관리자 승인 후 활성화됩니다." });
    }

    // ── 2. 관리자 승인 ──────────────────────────────────────────
    if (action === "APPROVE_FIRM") {
      if (!canManageUsers(user)) {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
      const { firmId } = body;
      const firmRes = await db.execute({ sql: "SELECT * FROM law_firms WHERE id = ?", args: [firmId] });
      const firm = firmRes.rows[0];
      if (!firm) return NextResponse.json({ error: "법인을 찾을 수 없습니다." }, { status: 404 });

      await db.execute({ sql: "UPDATE law_firms SET status = 'APPROVED' WHERE id = ?", args: [firmId] });

      await sendDiscordWebhook("ADMIN", {
        embeds: [{
          title: `✅ 법무법인 등록 승인: ${firm.name}`,
          description: `**${user.name}** 관리자가 법무법인 등록을 승인하였습니다.`,
          color: 0x10B981,
          timestamp: new Date().toISOString(),
        }],
      });

      return NextResponse.json({ success: true, message: "법인이 승인되었습니다." });
    }

    // ── 3. 관리자 반려 ──────────────────────────────────────────
    if (action === "REJECT_FIRM") {
      if (!canManageUsers(user)) {
        return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
      }
      const { firmId } = body;
      await db.execute({ sql: "UPDATE law_firms SET status = 'CANCELLED' WHERE id = ?", args: [firmId] });
      return NextResponse.json({ success: true, message: "법인 신청이 반려되었습니다." });
    }

    // ── 4. 구성원 추가 ──────────────────────────────────────────
    if (action === "ADD_MEMBER") {
      const { firmId, lawyerLoginId, isPartner } = body;

      const firmRes = await db.execute({ sql: "SELECT * FROM law_firms WHERE id = ?", args: [firmId] });
      const firm = firmRes.rows[0];
      if (!firm) return NextResponse.json({ error: "법인을 찾을 수 없습니다." }, { status: 404 });

      // 본인 법인이거나 관리자만 구성원 추가 가능
      if (firm.representative_id !== user.id && !canManageUsers(user)) {
        return NextResponse.json({ error: "법인 대표변호사 또는 관리자만 구성원을 추가할 수 있습니다." }, { status: 403 });
      }

      const lawyerRes = await db.execute({
        sql: "SELECT id, name FROM users WHERE login_id = ? AND role IN ('LAWYER', 'TRAINEE')",
        args: [lawyerLoginId],
      });
      if (lawyerRes.rows.length === 0) {
        return NextResponse.json({ error: "해당 아이디의 변호사를 찾을 수 없습니다." }, { status: 404 });
      }
      const lawyer = lawyerRes.rows[0];

      await db.execute({
        sql: `INSERT OR IGNORE INTO firm_members (firm_id, lawyer_id, is_partner) VALUES (?, ?, ?)`,
        args: [firmId, lawyer.id, isPartner ? 1 : 0],
      });

      return NextResponse.json({ success: true, message: `${lawyer.name} 변호사가 구성원으로 추가되었습니다.` });
    }

    // ── 5. 구성원 제거 ──────────────────────────────────────────
    if (action === "REMOVE_MEMBER") {
      const { firmId, lawyerId } = body;

      const firmRes = await db.execute({ sql: "SELECT * FROM law_firms WHERE id = ?", args: [firmId] });
      const firm = firmRes.rows[0];
      if (!firm) return NextResponse.json({ error: "법인을 찾을 수 없습니다." }, { status: 404 });

      if (firm.representative_id !== user.id && !canManageUsers(user)) {
        return NextResponse.json({ error: "법인 대표변호사 또는 관리자만 구성원을 제거할 수 있습니다." }, { status: 403 });
      }
      if (firm.representative_id === lawyerId) {
        return NextResponse.json({ error: "대표변호사는 제거할 수 없습니다." }, { status: 400 });
      }

      await db.execute({
        sql: "DELETE FROM firm_members WHERE firm_id = ? AND lawyer_id = ?",
        args: [firmId, lawyerId],
      });

      return NextResponse.json({ success: true, message: "구성원이 제거되었습니다." });
    }

    return NextResponse.json({ error: "유효하지 않은 명령입니다." }, { status: 400 });
  } catch (err: any) {
    console.error("법무법인 API 오류:", err);
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

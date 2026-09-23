import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import FirmsClient from "./FirmsClient";
import { Building } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FirmsPage() {
  const user = await getSessionUser();

  let firms: any[] = [];
  let pendingFirms: any[] = [];
  let myFirm: any = null;
  let myFirmMembers: any[] = [];

  try {
    // 승인된 법인 목록
    const res = await db.execute({
      sql: `SELECT f.*, u.name AS rep_name
            FROM law_firms f
            LEFT JOIN users u ON f.representative_id = u.id
            WHERE f.status = 'APPROVED'
            ORDER BY f.created_at DESC`,
      args: [],
    });
    firms = res.rows as any[];

    // 구성원 수, 파트너 수, 의결권 집계 (2인당 1표, 1인 0표)
    firms = await Promise.all(
      firms.map(async (firm) => {
        const cnt = await db.execute({
          sql: `SELECT 
                  COUNT(*) AS cnt,
                  SUM(CASE WHEN is_partner = 1 THEN 1 ELSE 0 END) AS partner_cnt
                FROM firm_members WHERE firm_id = ?`,
          args: [firm.id],
        });
        const memberCount = Number(cnt.rows[0]?.cnt ?? 0);
        const partnerCount = Number(cnt.rows[0]?.partner_cnt ?? 0);
        const votingPower = Math.floor(partnerCount / 2);
        return {
          ...firm,
          member_count: memberCount,
          partner_count: partnerCount,
          voting_power: votingPower,
        };
      })
    );

    // 관리자용 승인 대기 법인
    if (user && (user.role === "ADMIN" || (user.positions ?? []).some((p) => ["PRESIDENT","SECRETARY_GENERAL","SECRETARIAT_STAFF"].includes(p)))) {
      const pRes = await db.execute({
        sql: `SELECT f.*, u.name AS rep_name
              FROM law_firms f
              LEFT JOIN users u ON f.representative_id = u.id
              WHERE f.status = 'PENDING'
              ORDER BY f.created_at DESC`,
        args: [],
      });
      pendingFirms = pRes.rows as any[];
    }

    // 내가 소속된 법인
    if (user) {
      const myRes = await db.execute({
        sql: `SELECT f.*, u.name AS rep_name
              FROM law_firms f
              LEFT JOIN users u ON f.representative_id = u.id
              LEFT JOIN firm_members fm ON fm.firm_id = f.id
              WHERE fm.lawyer_id = ?
              LIMIT 1`,
        args: [user.id],
      });
      if (myRes.rows.length > 0) {
        myFirm = myRes.rows[0];
        const countRes = await db.execute({
          sql: `SELECT 
                  COUNT(*) AS cnt,
                  SUM(CASE WHEN is_partner = 1 THEN 1 ELSE 0 END) AS partner_cnt
                FROM firm_members WHERE firm_id = ?`,
          args: [myFirm.id],
        });
        const memberCount = Number(countRes.rows[0]?.cnt ?? 0);
        const partnerCount = Number(countRes.rows[0]?.partner_cnt ?? 0);
        const votingPower = Math.floor(partnerCount / 2);
        myFirm = {
          ...myFirm,
          member_count: memberCount,
          partner_count: partnerCount,
          voting_power: votingPower,
        };

        const membersRes = await db.execute({
          sql: `SELECT u.id, u.name, u.login_id, u.is_trainee, fm.is_partner
                FROM firm_members fm
                JOIN users u ON u.id = fm.lawyer_id
                WHERE fm.firm_id = ?`,
          args: [myFirm.id],
        });
        myFirmMembers = membersRes.rows as any[];
      }
    }
  } catch (err) {
    console.error("Firms fetch error:", err);
  }

  const isAdmin = user && (user.role === "ADMIN" || (user.positions ?? []).some((p) => ["PRESIDENT","SECRETARY_GENERAL","SECRETARIAT_STAFF"].includes(p)));
  const isLawyer = user && (user.role === "LAWYER" || user.role === "TRAINEE");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
          <Building className="w-4 h-4" />
          변호사법 제23조~제40조 · 법무법인 및 합동법률사무소
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">법무법인 · 법률사무소 등록 현황</h1>
        <p className="text-slate-400 text-sm mt-1">
          도스변호사협회에 등록된 법무법인, 합동법률사무소, 공증인가 법인 현황을 열람하고 신규 등록을 신청합니다.
        </p>
      </div>

      <FirmsClient
        initialFirms={firms}
        pendingFirms={pendingFirms}
        myFirm={myFirm}
        myFirmMembers={myFirmMembers}
        currentUser={user}
        isAdmin={!!isAdmin}
        isLawyer={!!isLawyer}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import FirmDetailClient from "./FirmDetailClient";
import Link from "next/link";
import { Building, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface FirmDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function FirmDetailPage({ params }: FirmDetailPageProps) {
  const { id } = await params;
  const user = await getSessionUser();

  const firmRes = await db.execute({
    sql: `SELECT f.*, u.name AS rep_name, u.login_id AS rep_login_id
          FROM law_firms f
          LEFT JOIN users u ON f.representative_id = u.id
          WHERE f.id = ?`,
    args: [id],
  });

  if (firmRes.rows.length === 0) {
    notFound();
  }

  const rawFirm = firmRes.rows[0] as any;

  // 구성원 목록 및 파트너 수 집계
  const membersRes = await db.execute({
    sql: `SELECT u.id, u.name, u.login_id, u.is_trainee, u.specialties, u.bio, fm.is_partner, fm.joined_at
          FROM firm_members fm
          JOIN users u ON u.id = fm.lawyer_id
          WHERE fm.firm_id = ?
          ORDER BY fm.is_partner DESC, u.name ASC`,
    args: [id],
  });

  const members = membersRes.rows as any[];
  const partnerCount = members.filter((m) => m.is_partner === 1).length;
  const votingPower = Math.floor(partnerCount / 2);

  const firm = {
    ...rawFirm,
    member_count: members.length,
    partner_count: partnerCount,
    voting_power: votingPower,
  };

  const isAdmin = user && (user.role === "ADMIN" || (user.positions ?? []).some((p) => ["PRESIDENT", "SECRETARY_GENERAL", "SECRETARIAT_STAFF"].includes(p)));
  const isRepresentative = user && user.id === firm.representative_id;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/firms"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 법무법인 목록으로 돌아가기
        </Link>
      </div>

      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
          <Building className="w-4 h-4" />
          변호사법 제23조~제40조 · 법무법인 상세정보
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">{firm.name}</h1>
        <p className="text-slate-400 text-sm mt-1">
          도스변호사협회에 정식 등록된 법무법인/법률사무소의 구성원 및 의결권 현황입니다.
        </p>
      </div>

      <FirmDetailClient
        firm={firm}
        initialMembers={members}
        currentUser={user}
        isAdmin={!!isAdmin}
        isRepresentative={!!isRepresentative}
      />
    </div>
  );
}

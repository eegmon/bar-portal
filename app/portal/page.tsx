import { redirect } from "next/navigation";
import { Scale } from "lucide-react";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import PortalClient from "./PortalClient";

export const dynamic = "force-dynamic";

export default async function LawyerPortalPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  // 변호사 상세 정보 조회
  let lawyerProfile: any = null;
  try {
    const res = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [user.id],
    });
    if (res.rows.length > 0) {
      lawyerProfile = res.rows[0];
    }
  } catch (err) {
    console.error("Portal fetch error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* 헤더 */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
          <Scale className="w-4 h-4" />
          도스변호사협회 회원 전용 행정관
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">변호사 마이페이지</h1>
        <p className="text-slate-400 text-sm mt-1">
          변호사 자격 유지 및 월별 재등록, 법률사무소 관리, 수임 사건 담당변호사 지정서를 관리합니다.
        </p>
      </div>

      <PortalClient lawyerProfile={lawyerProfile} />
    </div>
  );
}

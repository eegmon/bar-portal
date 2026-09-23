import { ShieldAlert } from "lucide-react";
import db from "@/lib/db";
import { getSessionUser, canManageDiscipline } from "@/lib/auth";
import DisciplineClient from "./DisciplineClient";

export const dynamic = "force-dynamic";

export default async function DisciplinePage() {
  const user = await getSessionUser();
  const canManage = user ? canManageDiscipline(user) : false;

  let disciplines: any[] = [];
  let lawyerList: any[] = [];

  try {
    const res = await db.execute(`
      SELECT d.*, u.name as lawyer_name, u.office_name 
      FROM disciplines d
      LEFT JOIN users u ON d.lawyer_id = u.id
      ORDER BY d.ruled_at DESC
    `);
    disciplines = res.rows;

    // 변호사 목록 조회 (징계 등록 시 선택용)
    const lawRes = await db.execute(`
      SELECT id, name, office_name 
      FROM users 
      WHERE role IN ('LAWYER', 'TRAINEE') 
      ORDER BY name ASC
    `);
    lawyerList = lawRes.rows;
  } catch (err) {
    console.error("Discipline fetch error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* 헤더 */}
      <div className="border-b border-slate-800 pb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-red-400 text-xs font-semibold mb-1">
            <ShieldAlert className="w-4 h-4" />
            변호사법 제5장 및 도스변호사협회 회칙 제36조 · 징계 투명 공시
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">변호사 징계처분 공시관</h1>
          <p className="text-slate-400 text-sm mt-1">
            변호사징계위원회의 징계처분(영구제명, 제명, 정직, 과태료, 견책) 사실을 투명하게 공시합니다.
          </p>
        </div>

        {canManage && (
          <div className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            징계위원회 심의/공시 권한 활성화됨
          </div>
        )}
      </div>

      <DisciplineClient
        currentUser={user}
        canManage={canManage}
        initialDisciplines={disciplines}
        lawyerList={lawyerList}
      />
    </div>
  );
}

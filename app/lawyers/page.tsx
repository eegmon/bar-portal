import { Scale, Search, MapPin } from "lucide-react";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LawyersSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q || "";

  let lawyers: any[] = [];
  try {
    if (query.trim()) {
      const res = await db.execute({
        sql: `SELECT * FROM users 
              WHERE role IN ('LAWYER', 'TRAINEE') 
                AND (name LIKE ? OR office_name LIKE ? OR specialties LIKE ? OR contact LIKE ?)
              ORDER BY created_at DESC`,
        args: [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`],
      });
      lawyers = res.rows;
    } else {
      const res = await db.execute(
        "SELECT * FROM users WHERE role IN ('LAWYER', 'TRAINEE') ORDER BY created_at DESC"
      );
      lawyers = res.rows;
    }
  } catch (err) {
    console.error("Lawyer search error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* 헤더 */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
          <Scale className="w-4 h-4" />
          변호사법 제6조 · 도스변호사협회 공인 변호사 명부
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">공인 변호사 명부 검색</h1>
        <p className="text-slate-400 text-sm mt-1">
          도스온라인에 정식 등록된 개업 변호사 및 견습변호사의 정보를 열람합니다.
          법무법인 검색은 <a href="/firms" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">법무법인 페이지</a>에서 확인하세요.
        </p>
      </div>

      {/* 검색 바 */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <form action="/lawyers" method="GET" className="flex items-center gap-2">
          <div className="pl-2 text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="변호사 성명, 법률사무소명, 전문분야(형사, 민사 등) 검색"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none px-2"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
          >
            검색
          </button>
        </form>
      </div>

      {/* 변호사 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lawyers.map((lawyer) => {
          const specialties: string[] = JSON.parse(lawyer.specialties || "[]");
          return (
            <div
              key={lawyer.id}
              className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-4 hover:border-slate-700 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold text-lg">
                    {lawyer.name[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                      {lawyer.name}
                      <span
                        className={`text-[10px] font-normal px-2 py-0.5 rounded border ${
                          lawyer.is_trainee
                            ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                            : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        }`}
                      >
                        {lawyer.is_trainee ? "견습변호사" : "정회원 변호사"}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">{lawyer.office_name || "개인 법률사무소"}</p>
                  </div>
                </div>

                <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold rounded">
                  정상 개업
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                {lawyer.self_introduction || "의뢰인의 기본적 인권 옹호와 신뢰를 최우선으로 하는 변호사입니다."}
              </p>

              {/* 전문분야 태그 */}
              {specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {specialties.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-slate-950 text-slate-300 border border-slate-800 rounded text-[11px]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {lawyer.office_address || "도스시"}
                </span>
                <span className={`font-semibold ${lawyer.is_available ? "text-emerald-400" : "text-slate-500"}`}>
                  {lawyer.is_available ? "✅ 상담 의뢰 가능" : "🔒 상담 중단"}
                </span>
              </div>

              {lawyer.contact && (
                <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-300 flex items-center gap-1.5">
                  <span className="text-slate-500">📞</span>
                  <span className="font-mono">{lawyer.contact}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import db from "@/lib/db";
import { Scale, Trophy, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExamResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string }>;
}) {
  const { examId } = await searchParams;

  let exams: any[] = [];
  let selectedExam: any = null;
  let passers: any[] = [];

  try {
    const examRes = await db.execute(
      "SELECT id, title, round_number, status FROM exams ORDER BY round_number DESC"
    );
    exams = examRes.rows as any[];

    const targetId = examId || exams.find((e) => e.status === "FINISHED")?.id || exams[0]?.id;
    if (targetId) {
      const eRes = await db.execute({ sql: "SELECT * FROM exams WHERE id = ?", args: [targetId] });
      selectedExam = eRes.rows[0] ?? null;

      if (selectedExam?.status === "FINISHED") {
        const pRes = await db.execute({
          sql: `SELECT security_code, total_score, phase1_score, phase2_score, rank
                FROM exam_submissions
                WHERE exam_id = ? AND final_passed = 1
                ORDER BY total_score DESC`,
          args: [targetId],
        });
        passers = pRes.rows as any[];
        // 순위 부여
        passers = passers.map((p, i) => ({ ...p, rank: i + 1 }));
      }
    }
  } catch (err) {
    console.error("Results fetch error:", err);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* 헤더 */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
          <Trophy className="w-4 h-4" />
          변호사시험관리위원회 공식 합격자 발표
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">변호사시험 합격자 명단</h1>
        <p className="text-slate-400 text-sm mt-1">
          합격자는 익명 보안코드로 공시되며, 본인 실명 및 세부 점수는{" "}
          <a href="/exam/my-score" className="text-amber-400 underline">내 성적 조회</a>에서 확인 가능합니다.
        </p>
      </div>

      {/* 회차 선택 */}
      <form method="GET" className="flex items-center gap-3">
        <select
          name="examId"
          defaultValue={selectedExam?.id || ""}
          className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
        >
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} {e.status !== "FINISHED" ? "(미발표)" : ""}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-colors"
        >
          조회
        </button>
      </form>

      {/* 합격자 명단 */}
      {selectedExam ? (
        selectedExam.status !== "FINISHED" ? (
          <div className="p-14 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3">
            <Lock className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-semibold">아직 합격자 명단이 발표되지 않은 시험입니다.</p>
            <p className="text-slate-500 text-xs">시험관리위원회의 채점 및 검토 완료 후 공식 발표됩니다.</p>
          </div>
        ) : (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedExam.title}</h2>
                <p className="text-xs text-slate-400 mt-0.5">총 합격자: {passers.length}명</p>
              </div>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold">
                🎉 합격자 발표 완료
              </span>
            </div>

            {passers.length === 0 ? (
              <div className="py-10 text-center text-slate-500">합격자가 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400">
                      <th className="py-3 px-4 text-left">순위</th>
                      <th className="py-3 px-4 text-left">수험번호 (익명)</th>
                      <th className="py-3 px-4 text-right">1차 점수</th>
                      <th className="py-3 px-4 text-right">2차 점수</th>
                      <th className="py-3 px-4 text-right font-bold">총점</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passers.map((p) => (
                      <tr
                        key={p.security_code}
                        className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${
                          p.rank <= 3 ? "bg-amber-500/5" : ""
                        }`}
                      >
                        <td className="py-3 px-4">
                          {p.rank === 1 ? (
                            <span className="text-amber-400 font-bold text-base">🥇 1위</span>
                          ) : p.rank === 2 ? (
                            <span className="text-slate-300 font-bold">🥈 2위</span>
                          ) : p.rank === 3 ? (
                            <span className="text-amber-700 font-bold">🥉 3위</span>
                          ) : (
                            <span className="text-slate-400">{p.rank}위</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <code className="text-amber-300 font-mono text-xs bg-amber-500/5 px-2 py-1 rounded">
                            #{p.security_code}
                          </code>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">{p.phase1_score ?? "-"}점</td>
                        <td className="py-3 px-4 text-right text-slate-300">{p.phase2_score ?? "-"}점</td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-white text-base">{p.total_score}점</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>* 합격자 실명 및 세부 성적은 본인만 /exam/my-score 에서 확인할 수 있습니다.</span>
              <span className="font-semibold text-slate-400">도스변호사협회 변호사시험관리위원회</span>
            </div>
          </div>
        )
      ) : (
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400">
          등록된 시험이 없습니다.
        </div>
      )}
    </div>
  );
}

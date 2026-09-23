import Link from "next/link";
import { FileText, Clock, AlertCircle, CheckCircle, ShieldAlert, Award, ArrowRight } from "lucide-react";
import db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ExamHubPage() {
  const user = await getSessionUser();

  // 최신 시험 조회
  let exam: any = null;
  let userSubmission: any = null;

  try {
    const examRes = await db.execute("SELECT * FROM exams ORDER BY round_number DESC LIMIT 1");
    if (examRes.rows.length > 0) {
      exam = examRes.rows[0];
    }

    if (user && exam) {
      const subRes = await db.execute({
        sql: "SELECT * FROM exam_submissions WHERE exam_id = ? AND user_id = ?",
        args: [exam.id, user.id],
      });
      if (subRes.rows.length > 0) {
        userSubmission = subRes.rows[0];
      }
    }
  } catch (err) {
    console.error("Exam hub fetch error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* 헤더 */}
      <div className="border-b border-slate-800 pb-6 mb-8">
        <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold mb-1">
          <FileText className="w-4 h-4" />
          변호사법 제6장 · 도스변호사협회 변호사시험관리위원회
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">변호사시험 센터 (CBT)</h1>
        <p className="text-slate-400 text-sm mt-1">
          매월 1회 정기 시행되는 도스온라인 변호사시험의 원서 접수, 1차 CBT 객관식 응시, 2차 서술형 답안 제출 및 성적을 조회합니다.
        </p>
      </div>

      {exam ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 좌측 2열: 현재 진행 중인 시험 안내 & 응시 박스 */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between gap-4 mb-4">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-semibold">
                  제{exam.round_number}회 정기시험 진행중
                </span>
                <span className="text-xs text-slate-400">
                  응시 상태:{" "}
                  <strong className="text-white">
                    {userSubmission
                      ? userSubmission.phase1_passed
                        ? "1차 합격 / 2차 진행"
                        : "1차 응시완료"
                      : "미응시"}
                  </strong>
                </span>
              </div>

              <h2 className="text-2xl font-bold text-white mb-3">{exam.title}</h2>

              {/* 일정 타임라인 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Clock className="w-4 h-4" />
                    제1차 시험 (객관식 CBT 10문)
                  </div>
                  <p className="text-xs text-slate-300">
                    <strong>시험 시간:</strong> 120분 (2시간 제한)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    과목: 공법, 민사법, 형사법, 소송법, 법조윤리
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/exam/cbt-1"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-all shadow-md"
                    >
                      1차 CBT 시험장 입장 <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <FileText className="w-4 h-4" />
                    제2차 시험 (24시간 논술/실무형)
                  </div>
                  <p className="text-xs text-slate-300">
                    <strong>제출 기간:</strong> 24시간 자율 응시
                  </p>
                  <p className="text-[11px] text-slate-400">
                    제1문(논술형) + 제2문(실무기록형 서류)
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/exam/session-2"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-lg border border-slate-700 transition-all"
                    >
                      2차 과제 제출실 입장 <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* 응시 주의사항 */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 leading-relaxed space-y-1">
                  <p className="font-semibold text-amber-300">시험 응시 유의사항</p>
                  <p>• 1차 CBT는 단 1회만 제출 가능하며, 제출 후 답안 수정이 불가합니다.</p>
                  <p>• 2차 시험은 조기 채점 서약 제출 시 즉시 채점이 시작되나 철회가 불가합니다.</p>
                  <p>• 응시 중 문제 질의 및 이의제기는 디스코드 [⚠️┃이의제기] 채널에서 진행됩니다.</p>
                </div>
              </div>
            </div>

            {/* 빠른 링크 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/exam/my-score"
                className="p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-400">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                      본인 성적 및 석차 조회
                    </div>
                    <div className="text-[11px] text-slate-400">합격 공고일로부터 2개월간 열람 가능</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/exam/admin"
                className="p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                      시험관리위원회 패널
                    </div>
                    <div className="text-[11px] text-slate-400">출제, 실시간 정정 방송, 2차 채점표 입력</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* 우측 1열: 변호사시험 법령 및 가산점 안내 */}
          <div className="space-y-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                변호사시험 법정 기준
              </h3>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="pb-2 border-b border-slate-800">
                  <div className="font-semibold text-slate-200">시험 과목 (변호사법 제71조)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    공법, 민사법, 형사법, 소송법, 법조윤리
                  </div>
                </div>

                <div className="pb-2 border-b border-slate-800">
                  <div className="font-semibold text-slate-200">가산점 제도 (변호사법 제72조제2항)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    도스대학교 등 법학과정 수료 인증자에게 필기시험 총점의 10% 범위 내 가산점 부여
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-200">응시 결격사유 (변호사법 제69조)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    인게임 밴 처분을 받은 자 또는 변호사 결격사유 해당자는 응시 불가
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400">
          현재 예정된 변호사시험 일정이 없습니다.
        </div>
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import db from "@/lib/db";
import Link from "next/link";
import { getSessionUser, canManageExam } from "@/lib/auth";
import ExamAdminClient from "./ExamAdminClient";

export const dynamic = "force-dynamic";

export default async function ExamAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ examId?: string }>;
}) {
  const user = await getSessionUser();

  if (!user || !canManageExam(user)) {
    redirect("/exam");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const selectedExamId = resolvedParams.examId;

  let allExams: any[] = [];
  let currentExam: any = null;
  let submissions: any[] = [];

  try {
    const examsRes = await db.execute("SELECT * FROM exams ORDER BY round_number DESC");
    allExams = examsRes.rows;

    if (allExams.length > 0) {
      if (selectedExamId) {
        currentExam = allExams.find((e) => e.id === selectedExamId) || allExams[0];
      } else {
        currentExam = allExams[0];
      }

      if (currentExam) {
        const subRes = await db.execute({
          sql: "SELECT * FROM exam_submissions WHERE exam_id = ? ORDER BY submitted_at DESC",
          args: [currentExam.id],
        });
        submissions = subRes.rows;
      }
    }
  } catch (err) {
    console.error("Exam admin fetch error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* 헤더 */}
      <div className="border-b border-slate-800 pb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold mb-1">
            <ShieldAlert className="w-4 h-4" />
            변호사법 제74조 · 도스변호사협회 변호사시험관리위원회
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">변호사시험관리위원회 관리 패널</h1>
          <p className="text-slate-400 text-sm mt-1">
            신규 시험 회차 개설, 1차 CBT 문항 실시간 편집, 실시간 문제 정정 긴급 방송, 2차 서술형 채점표 사정 및 최종 합격자 공고를 관장합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded-lg border border-slate-700"
          >
            협회 관리자 패널
          </Link>
          <Link
            href="/exam"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow"
          >
            수험생 시험장 홈
          </Link>
        </div>
      </div>

      <ExamAdminClient
        allExams={allExams}
        initialExam={currentExam}
        initialSubmissions={submissions}
      />
    </div>
  );
}

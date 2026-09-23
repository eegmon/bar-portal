import Link from "next/link";
import {
  Scale,
  FileText,
  Vote,
  ShieldCheck,
  Search,
  ArrowRight,
  Sparkles,
  Award,
  Users,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // DB에서 최신 활성 변호사 수, 진행 중인 시험, 징계 공시 통계 조회
  let lawyerCount = 0;
  let recentDisciplinesCount = 0;
  try {
    const lawyersRes = await db.execute("SELECT COUNT(*) as count FROM users WHERE role IN ('LAWYER', 'TRAINEE') AND status = 'ACTIVE'");
    lawyerCount = Number(lawyersRes.rows[0]?.count || 0);

    const disciplineRes = await db.execute("SELECT COUNT(*) as count FROM disciplines WHERE is_published = 1");
    recentDisciplinesCount = Number(disciplineRes.rows[0]?.count || 0);
  } catch (e) {
    console.error("Home stats query error:", e);
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* 1. 히어로 섹션 (법령 슬로건 & 주요 검색 바) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border-b border-slate-800 py-16 lg:py-24">
        {/* 장식용 배경 그리드 및 글로우 */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            변호사법 제1조 · 기본적 인권 옹호와 사회정의 실현
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            신뢰와 공공성의 중심, <br />
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
              도스변호사협회
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed">
            도스온라인의 공인 변호사·법무법인 정보 조회, 월간 변호사시험 CBT 응시,
            총회 전자투표 및 의결권 위임 서비스를 원스톱으로 제공합니다.
          </p>

          {/* 메인 빠른 검색 바 */}
          <div className="max-w-2xl mx-auto">
            <form
              action="/lawyers"
              method="GET"
              className="p-1.5 bg-slate-900/90 border border-slate-700 rounded-xl shadow-2xl flex items-center gap-2 backdrop-blur-md focus-within:border-amber-500/60 transition-all"
            >
              <div className="pl-3 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                name="q"
                placeholder="변호사 성명, 법무법인명, 전문분야(형사, 행정 등)를 검색하세요"
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none px-2"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-md"
              >
                검색
              </button>
            </form>
          </div>

          {/* 핵심 지표 카운터 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 border-t border-slate-800/60 text-left">
            <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                등록 변호사 수
              </div>
              <div className="text-xl font-bold text-white">{lawyerCount}명</div>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                <Award className="w-3.5 h-3.5 text-blue-400" />
                변호사시험 주기
              </div>
              <div className="text-xl font-bold text-white">매월 1회 정기</div>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                정기총회
              </div>
              <div className="text-xl font-bold text-white">매월 1주 일요일</div>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-lg">
              <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                투명한 징계 공시
              </div>
              <div className="text-xl font-bold text-white">{recentDisciplinesCount}건 공시중</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 4대 주요 사법 서비스 바로가기 카드 */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-white tracking-tight">주요 사법 행정 서비스</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">도스온라인 시민과 회원을 위한 공공 서비스 센터</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 카드 1: 변호사 검색 */}
          <Link
            href="/lawyers"
            className="group p-6 bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl transition-all duration-200 hover:-translate-y-1 shadow-lg hover:shadow-amber-500/5 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                공인 변호사·법무법인
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                공인된 개업 변호사, 견습변호사, 법무법인 및 공증인가 법률사무소를 투명하게 검색하고 프로필을 확인합니다.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-1 text-xs font-semibold text-amber-500">
              명부 열람하기 <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 카드 2: 변호사시험 센터 */}
          <Link
            href="/exam"
            className="group p-6 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl transition-all duration-200 hover:-translate-y-1 shadow-lg hover:shadow-blue-500/5 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                변호사시험 센터 (CBT)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                1차 120분 객관식 CBT 시험 및 2차 24시간 논술/실무형 과제 제출, 조기 채점 서약, 가산점 및 성적을 조회합니다.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-1 text-xs font-semibold text-blue-400">
              시험 센터 입장 <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 카드 3: 총회 & 전자투표 */}
          <Link
            href="/assembly"
            className="group p-6 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition-all duration-200 hover:-translate-y-1 shadow-lg hover:shadow-emerald-500/5 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Vote className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                총회 & 전자투표
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                정기총회 출석 연동 자격 갱신, 불참자 의결권 위임장 제출, 안건별 표 분배 및 무기명 비밀 전자투표를 지원합니다.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-1 text-xs font-semibold text-emerald-400">
              총회 참여하기 <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 카드 4: 징계 공시 */}
          <Link
            href="/discipline"
            className="group p-6 bg-slate-900 border border-slate-800 hover:border-red-500/50 rounded-xl transition-all duration-200 hover:-translate-y-1 shadow-lg hover:shadow-red-500/5 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                징계처분 & 공시
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                변호사법 제60조에 따른 징계처분(영구제명, 제명, 정직 등) 및 검찰총장 업무정지명령 사실을 투명하게 공시합니다.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-1 text-xs font-semibold text-red-400">
              공시 내역 열람 <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* 3. 법조 윤리 및 권리 보호 안내 배너 */}
      <section className="bg-slate-900/60 border-t border-b border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-amber-600/30 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-2 text-amber-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                변호사법 제9조 · 변호방해 금지
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                "누구든지 변호사로서의 직무수행을 한다는 이유로 불이익한 처우를 하여서는 아니 된다."
              </h3>
              <p className="text-xs text-slate-400">
                도스변호사협회는 소속 변호사의 독립적인 변론권 보장과 시민의 정당한 재판청구권 수호를 위해 최선을 다합니다.
              </p>
            </div>
            <Link
              href="/portal"
              className="whitespace-nowrap px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all hover:scale-105"
            >
              변호사 회원 행정관 바로가기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

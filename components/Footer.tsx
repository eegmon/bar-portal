import Link from "next/link";
import { Scale, BookOpen, ShieldAlert, MessageSquare } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 text-xs mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* 협회 소개 */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <Scale className="w-5 h-5 text-amber-500" />
              도스변호사협회 (DOS BAR ASSOCIATION)
            </div>
            <p className="text-slate-400 leading-relaxed max-w-md text-xs">
              도스변호사협회는 「변호사법」에 의하여 설립된 법인으로서 기본적 인권의 옹호와 사회정의 실현, 법률문화의 창달 및 변호사의 지도·감독을 관장합니다.
            </p>
            <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-2">
              <span>근거법령: 변호사법 (법률 제18호)</span>
              <span>•</span>
              <span>도스변호사협회 회칙 (회칙 제4호)</span>
            </div>
          </div>

          {/* 주요 링크 */}
          <div>
            <h4 className="font-semibold text-slate-200 mb-3 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-amber-500" />
              사법 행정 서비스
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/lawyers" className="hover:text-amber-400 transition-colors">
                  공인 변호사·법무법인 검색
                </Link>
              </li>
              <li>
                <Link href="/exam" className="hover:text-amber-400 transition-colors">
                  월간 변호사시험 시행계획
                </Link>
              </li>
              <li>
                <Link href="/assembly" className="hover:text-amber-400 transition-colors">
                  정기총회 및 의결권 위임
                </Link>
              </li>
              <li>
                <Link href="/discipline" className="hover:text-amber-400 transition-colors">
                  변호사 징계처분 및 업무정지 공시
                </Link>
              </li>
            </ul>
          </div>

          {/* RP 커뮤니티 연동 */}
          <div>
            <h4 className="font-semibold text-slate-200 mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              도스온라인 커뮤니티
            </h4>
            <p className="text-[11px] text-slate-400 mb-3">
              실시간 질의응답 및 총회 음성 참여는 도스온라인 공식 디스코드에서 진행됩니다.
            </p>
            <div className="flex flex-col gap-2">
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-slate-300 font-medium">디스코드 실시간 연동</span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <p>© 2026 DOS BAR ASSOCIATION. All rights reserved. (도스온라인 RP)</p>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              검찰총장 감독기관 연계 시스템
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

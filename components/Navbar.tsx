"use client";

import Link from "next/link";
import { Scale, User, FileText, Vote, ShieldCheck, LogIn, LogOut, Settings } from "lucide-react";
import { OFFICER_POSITIONS, SessionUser, hasAdminPanelAccess } from "@/lib/types";

interface NavbarProps {
  user?: SessionUser | null;
}

export default function Navbar({ user }: NavbarProps) {
  const canAdmin = user ? hasAdminPanelAccess(user) : false;

  // 주요 직책 라벨
  const primaryPositionLabel =
    user?.positions && user.positions.length > 0
      ? OFFICER_POSITIONS[user.positions[0]]?.label || user.positions[0]
      : null;

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-amber-600/30 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 & 기관명 */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg shadow-inner group-hover:scale-105 transition-transform">
              <Scale className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight flex items-center gap-1.5 text-amber-400">
                도스변호사협회
                <span className="text-[10px] font-normal px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                  공식 포털
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5">DOS BAR ASSOCIATION</p>
            </div>
          </Link>

          {/* 메인 네비게이션 */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-300">
            <Link
              href="/lawyers"
              className="px-3 py-2 rounded-md hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Scale className="w-4 h-4 text-amber-500" />
              변호사 명부
            </Link>
            <Link
              href="/firms"
              className="px-3 py-2 rounded-md hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Scale className="w-4 h-4 text-amber-400" />
              법무법인
            </Link>
            <Link
              href="/exam"
              className="px-3 py-2 rounded-md hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              변호사시험
            </Link>
            <Link
              href="/assembly"
              className="px-3 py-2 rounded-md hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Vote className="w-4 h-4 text-emerald-400" />
              총회 & 투표
            </Link>
            <Link
              href="/discipline"
              className="px-3 py-2 rounded-md hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-red-400" />
              징계·공시
            </Link>
            <Link
              href="/rules"
              className="px-3 py-2 rounded-md hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-purple-400" />
              회칙·규정집
            </Link>

            {/* 관리 권한 보유 시 관리자 패널 링크 노출 */}
            {canAdmin && (
              <Link
                href="/admin"
                className="px-3 py-2 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 font-bold transition-all flex items-center gap-1.5 ml-1"
              >
                <Settings className="w-4 h-4 text-amber-400" />
                관리자 패널
              </Link>
            )}
          </nav>

          {/* 로그인 / 회원 전용 마이페이지 */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/portal"
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold text-white">{user.name}</span>
                  {primaryPositionLabel ? (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-bold">
                      {primaryPositionLabel}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">
                      {user.isTrainee ? "견습변호사" : user.role === "ADMIN" ? "관리자" : user.role === "LAWYER" ? "변호사" : "회원"}
                    </span>
                  )}
                </Link>

                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="로그아웃"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg shadow-sm transition-all hover:shadow-amber-500/20"
              >
                <LogIn className="w-3.5 h-3.5" />
                로그인 / 포털 접속
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

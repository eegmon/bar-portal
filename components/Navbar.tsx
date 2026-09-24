"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Scale,
  User,
  FileText,
  Vote,
  ShieldCheck,
  LogIn,
  LogOut,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  Building,
} from "lucide-react";
import { OFFICER_POSITIONS, SessionUser, hasAdminPanelAccess } from "@/lib/types";

interface NavbarProps {
  user?: SessionUser | null;
}

export default function Navbar({ user }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [mounted, setMounted] = useState(false);

  const canAdmin = user ? hasAdminPanelAccess(user) : false;

  // 테마 초기화 (localStorage 및 OS 설정 확인)
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("bar_theme");
    const isSystemLight = !savedTheme && window.matchMedia("(prefers-color-scheme: light)").matches;
    if (savedTheme === "light" || isSystemLight) {
      setIsLight(true);
      document.documentElement.classList.add("light");
    } else {
      setIsLight(false);
      document.documentElement.classList.remove("light");
    }
  }, []);

  const toggleTheme = () => {
    const next = !isLight;
    setIsLight(next);
    if (next) {
      document.documentElement.classList.add("light");
      localStorage.setItem("bar_theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      localStorage.setItem("bar_theme", "dark");
    }
  };

  // 주요 직책 라벨
  const primaryPositionLabel =
    user?.positions && user.positions.length > 0
      ? OFFICER_POSITIONS[user.positions[0]]?.label || user.positions[0]
      : null;

  const navLinks = [
    { href: "/lawyers", label: "변호사 명부", icon: <Scale className="w-4 h-4 text-amber-500" /> },
    { href: "/firms", label: "법무법인", icon: <Building className="w-4 h-4 text-amber-400" /> },
    { href: "/exam", label: "변호사시험", icon: <FileText className="w-4 h-4 text-blue-400" /> },
    { href: "/assembly", label: "총회 & 투표", icon: <Vote className="w-4 h-4 text-emerald-400" /> },
    { href: "/discipline", label: "징계·공시", icon: <ShieldCheck className="w-4 h-4 text-red-400" /> },
    { href: "/rules", label: "회칙·규정집", icon: <FileText className="w-4 h-4 text-purple-400" /> },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-amber-600/30 text-white shadow-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 & 기관명 */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg shadow-inner group-hover:scale-105 transition-transform">
              <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-bold text-base sm:text-lg tracking-tight flex items-center gap-1.5 text-amber-400">
                도스변호사협회
                <span className="text-[10px] font-normal px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded hidden xs:inline-block">
                  공식 포털
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 -mt-0.5">DOS BAR ASSOCIATION</p>
            </div>
          </Link>

          {/* 데스크톱 메인 네비게이션 */}
          <nav className="hidden lg:flex items-center gap-1 text-xs xl:text-sm font-medium text-slate-300">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-2.5 xl:px-3 py-2 rounded-md hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}

            {/* 관리 권한 보유 시 관리자 패널 링크 노출 */}
            {canAdmin && (
              <Link
                href="/admin"
                className="px-2.5 xl:px-3 py-2 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 font-bold transition-all flex items-center gap-1.5 ml-1"
              >
                <Settings className="w-4 h-4 text-amber-400" />
                관리자 패널
              </Link>
            )}
          </nav>

          {/* 우측 유저 액션 & 테마 토글 */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 테마 전환 버튼 (라이트/다크) */}
            {mounted && (
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors flex items-center justify-center"
                title={isLight ? "다크 모드로 전환" : "라이트 모드로 전환"}
                aria-label="테마 전환"
              >
                {isLight ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
              </button>
            )}

            {/* 로그인 상태 */}
            {user ? (
              <div className="hidden sm:flex items-center gap-2">
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
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg shadow-sm transition-all hover:shadow-amber-500/20"
              >
                <LogIn className="w-3.5 h-3.5" />
                로그인 / 포털
              </Link>
            )}

            {/* 모바일 햄버거 메뉴 버튼 */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 focus:outline-none"
              aria-label="모바일 메뉴 열기"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 드롭다운 메뉴 (반응형) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-slate-900/98 backdrop-blur-md px-4 pt-3 pb-5 space-y-3 shadow-2xl animate-in slide-in-from-top-2 duration-150">
          {/* 모바일 유저 요약 */}
          {user ? (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-xs">
                  {user.name[0]}
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    {user.name}
                    {primaryPositionLabel && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                        {primaryPositionLabel}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">{user.loginId}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/portal"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-2.5 py-1 bg-slate-800 text-amber-300 text-xs font-semibold rounded-lg border border-slate-700"
                >
                  마이페이지
                </Link>
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow"
              >
                <LogIn className="w-3.5 h-3.5" />
                로그인
              </Link>
              <Link
                href="/register"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center border border-slate-700"
              >
                회원가입
              </Link>
            </div>
          )}

          {/* 모바일 링크 목록 */}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>

          {/* 관리자 패널 버튼 (권한자용) */}
          {canAdmin && (
            <Link
              href="/admin"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              협회 관리자 패널 바로가기
            </Link>
          )}

          {/* 모바일 테마 전환 버튼 */}
          {mounted && (
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {isLight ? (
                <>
                  <Moon className="w-4 h-4 text-indigo-400" />
                  다크 모드로 전환
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  라이트 모드로 전환
                </>
              )}
            </button>
          )}
        </div>
      )}
    </header>
  );
}

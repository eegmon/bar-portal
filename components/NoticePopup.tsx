"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  X,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export interface PopupData {
  enabled: boolean;
  title: string;
  content: string;
  link?: string;
  level?: "INFO" | "WARNING" | "URGENT";
  updatedAt?: string;
}

interface NoticePopupProps {
  popupData: PopupData | null;
}

export default function NoticePopup({ popupData }: NoticePopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowToday, setDontShowToday] = useState(false);

  useEffect(() => {
    if (!popupData || !popupData.enabled || !popupData.title.trim()) {
      return;
    }

    try {
      const dismissedUntil = localStorage.getItem("bar_notice_dismissed_until");
      const dismissedUpdatedAt = localStorage.getItem("bar_notice_dismissed_version");

      const now = Date.now();
      const currentVersion = popupData.updatedAt || "v1";

      // 만약 공지 내용이 새로 갱신되었거나, 24시간이 경과한 경우 팝업 노출
      if (dismissedUpdatedAt !== currentVersion || !dismissedUntil || Number(dismissedUntil) < now) {
        setIsOpen(true);
      }
    } catch {
      setIsOpen(true);
    }
  }, [popupData]);

  if (!isOpen || !popupData || !popupData.enabled) {
    return null;
  }

  const handleClose = () => {
    if (dontShowToday) {
      const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
      try {
        localStorage.setItem("bar_notice_dismissed_until", String(tomorrow));
        localStorage.setItem(
          "bar_notice_dismissed_version",
          popupData.updatedAt || "v1"
        );
      } catch (e) {
        console.error("localStorage error:", e);
      }
    }
    setIsOpen(false);
  };

  const level = popupData.level || "INFO";

  const levelConfig = {
    INFO: {
      badge: "협회 공식 공지",
      badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      icon: <Info className="w-5 h-5 text-blue-400" />,
      headerGradient: "from-blue-500/10 via-slate-900 to-slate-900",
      accentBorder: "border-blue-500/30",
      buttonBg: "bg-blue-600 hover:bg-blue-500 text-white",
    },
    WARNING: {
      badge: "중요 안내사항",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      headerGradient: "from-amber-500/10 via-slate-900 to-slate-900",
      accentBorder: "border-amber-500/30",
      buttonBg: "bg-amber-500 hover:bg-amber-400 text-slate-950",
    },
    URGENT: {
      badge: "🚨 긴급 공지",
      badgeColor: "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse",
      icon: <AlertOctagon className="w-5 h-5 text-red-400" />,
      headerGradient: "from-red-500/15 via-slate-900 to-slate-900",
      accentBorder: "border-red-500/40",
      buttonBg: "bg-red-600 hover:bg-red-500 text-white",
    },
  }[level];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-lg bg-slate-900 border ${levelConfig.accentBorder} rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]`}
      >
        {/* 상단 헤더 배너 */}
        <div
          className={`p-6 bg-gradient-to-b ${levelConfig.headerGradient} border-b border-slate-800/80 flex items-start justify-between gap-4`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-inner shrink-0">
              {levelConfig.icon}
            </div>
            <div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${levelConfig.badgeColor}`}
              >
                {levelConfig.badge}
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-white mt-1 leading-snug">
                {popupData.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0"
            aria-label="공지 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 내용 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
          <div className="whitespace-pre-wrap bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 font-sans">
            {popupData.content}
          </div>

          {popupData.link && (
            <Link
              href={popupData.link}
              onClick={handleClose}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${levelConfig.buttonBg}`}
            >
              <span>관련 페이지 바로가기</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* 하단 제어 바 (오늘 하루 보지 않기 & 닫기) */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowToday}
              onChange={(e) => setDontShowToday(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-950"
            />
            <span className="hover:text-slate-200">오늘 하루 보지 않기</span>
          </label>

          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

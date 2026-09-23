import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import NoticePopup, { PopupData } from "@/components/NoticePopup";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "도스변호사협회 | 공식 웹 포털 (DOS BAR ASSOCIATION)",
  description: "기본적 인권의 옹호와 사회정의 실현 - 도스변호사협회 통합 사법 포털",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();

  // 팝업 공지 설정 조회
  let popupData: PopupData | null = null;
  try {
    const res = await db.execute("SELECT key, value FROM settings WHERE key LIKE 'popup_%'");
    const popupMap: Record<string, string> = {};
    for (const row of res.rows) {
      popupMap[row.key as string] = row.value as string;
    }

    if (popupMap["popup_enabled"] === "true" && popupMap["popup_title"]) {
      popupData = {
        enabled: true,
        title: popupMap["popup_title"] || "",
        content: popupMap["popup_content"] || "",
        link: popupMap["popup_link"] || "",
        level: (popupMap["popup_level"] || "INFO") as any,
        updatedAt: popupMap["popup_updated_at"] || "",
      };
    }
  } catch (err) {
    console.error("Popup settings fetch error in RootLayout:", err);
  }

  return (
    <html lang="ko" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950 font-sans`}
      >
        <Navbar user={user} />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
        <NoticePopup popupData={popupData} />
      </body>
    </html>
  );
}

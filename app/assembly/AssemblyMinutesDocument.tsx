"use client";

import React, { useState, useMemo } from "react";
import {
  Copy,
  Check,
  Printer,
  Maximize2,
  FileText,
  Settings2,
  RotateCcw,
  X,
  FileCheck2,
  ScrollText,
} from "lucide-react";

interface ChoiceGroup {
  choice: string;
  totalVotes: number;
  voters: { userId: string; name: string; votesCount: number }[];
}

interface AgendaItem {
  id: string;
  title: string;
  description?: string;
  agenda_order?: number;
  status: string;
  result_status?: string | null;
  result_method?: string | null;
  voting_method?: string;
  plurality_winner?: string | null;
  named_choice_groups?: ChoiceGroup[];
  unrecorded_voters?: string[];
  named_voters?: string[];
}

interface AssemblyData {
  id: string;
  title: string;
  round_number?: number;
  is_regular?: number;
  held_at?: string;
  minutes_text?: string;
  status?: string;
}

interface Props {
  assembly: AssemblyData;
  agendas: AgendaItem[];
}

function formatKoreanDate(heldAtStr?: string): string {
  if (!heldAtStr) return "2026년 3월 1일(토) 오후 20시";
  try {
    const d = new Date(heldAtStr);
    if (isNaN(d.getTime())) return heldAtStr;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = dayNames[d.getDay()];
    const hours = d.getHours();
    return `${year}년 ${month}월 ${day}일(${dayName}) 오후 ${hours}시`;
  } catch {
    return heldAtStr;
  }
}

function parseMeetingTimes(minutesText?: string, heldAtStr?: string) {
  const text = minutesText || "";
  const openMatch = text.match(/(\d{1,2}시(?:\s*\d{1,2}분)?)\s*개회/);
  const closeMatch = text.match(/(\d{1,2}시(?:\s*\d{1,2}분)?)\s*폐회/);

  let openTime = openMatch ? openMatch[1].trim() : "";
  let closeTime = closeMatch ? closeMatch[1].trim() : "";

  if (!openTime && heldAtStr) {
    try {
      const d = new Date(heldAtStr);
      if (!isNaN(d.getTime())) {
        openTime = `${d.getHours()}시${d.getMinutes() > 0 ? `${d.getMinutes()}분` : "00분"}`;
      }
    } catch {}
  }
  if (!openTime) openTime = "20시32분";
  if (!closeTime) closeTime = "23시39분";

  return { openTime, closeTime };
}

function computeDefaultResult(agenda: AgendaItem): string {
  if (agenda.plurality_winner) {
    return agenda.plurality_winner;
  }
  if (agenda.result_status === "PASS") {
    return "원안가결";
  }
  if (agenda.result_status === "REJECT") {
    return "원안부결";
  }
  if (agenda.status === "VOTING") {
    return "표결 진행중";
  }
  if (agenda.status === "SCHEDULED") {
    return "상정 대기";
  }
  if (agenda.status === "CLOSED" || agenda.status === "RESULT_CONFIRMED") {
    return "원안가결";
  }
  return "의사일정 조정";
}

export default function AssemblyMinutesDocument({
  assembly,
  agendas,
}: Props) {
  const defaultTimes = useMemo(
    () => parseMeetingTimes(assembly.minutes_text, assembly.held_at),
    [assembly.minutes_text, assembly.held_at],
  );

  const roundNum = assembly.round_number || 1;
  const isRegular = assembly.is_regular !== 0;

  const [viewMode, setViewMode] = useState<"TEMPLATE" | "RAW">("TEMPLATE");
  const [includeAppendix, setIncludeAppendix] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 편집 가능한 템플릿 필드들
  const [headerLeft, setHeaderLeft] = useState(`제${roundNum}기 총회`);
  const [headerTitle, setHeaderTitle] = useState("총 회 의 사 록");
  const [headerRightNum, setHeaderRightNum] = useState(`제${roundNum}차`);
  const [headerRightType, setHeaderRightType] = useState(
    isRegular ? "(정기회)" : "(임시회)",
  );
  const [orgName, setOrgName] = useState("도스변호사협회");
  const [meetingDate, setMeetingDate] = useState(
    formatKoreanDate(assembly.held_at),
  );
  const [openTime, setOpenTime] = useState(defaultTimes.openTime);
  const [closeTime, setCloseTime] = useState(defaultTimes.closeTime);

  // 안건별 의결결과 문구 오버라이드
  const [customResults, setCustomResults] = useState<Record<string, string>>(
    {},
  );

  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const getResultLabel = (ag: AgendaItem) => {
    if (customResults[ag.id] !== undefined) {
      return customResults[ag.id];
    }
    return computeDefaultResult(ag);
  };

  const handleResultChange = (agendaId: string, val: string) => {
    setCustomResults((prev) => ({ ...prev, [agendaId]: val }));
  };

  const handleResetDefaults = () => {
    setHeaderLeft(`제${roundNum}기 총회`);
    setHeaderTitle("총 회 의 사 록");
    setHeaderRightNum(`제${roundNum}차`);
    setHeaderRightType(isRegular ? "(정기회)" : "(임시회)");
    setOrgName("도스변호사협회");
    setMeetingDate(formatKoreanDate(assembly.held_at));
    setOpenTime(defaultTimes.openTime);
    setCloseTime(defaultTimes.closeTime);
    setCustomResults({});
    setIsEditing(false);
  };

  // ─── 네이버 카페용 HTML 및 텍스트 생성 ─────────────────────────────────────
  const generateNaverCafeHtml = () => {
    const purposeListHtml = agendas
      .map(
        (ag, idx) =>
          `<div style="margin: 2px 0; font-size: 13px; line-height: 1.7;">${idx + 1}. ${ag.title}</div>`,
      )
      .join("");

    const resultRowsHtml = agendas
      .map((ag, idx) => {
        const res = getResultLabel(ag);
        return `<tr>
          <td style="padding: 3px 0; text-align: left; vertical-align: top; font-size: 13px; line-height: 1.6; color: #111;">
            ${idx + 1}. ${ag.title}
          </td>
          <td style="padding: 3px 0; text-align: right; vertical-align: top; font-size: 13px; font-weight: bold; line-height: 1.6; color: #111; white-space: nowrap; padding-left: 16px;">
            ${res}
          </td>
        </tr>`;
      })
      .join("");

    let appendixHtml = "";
    if (includeAppendix) {
      const appendixItems = agendas
        .filter(
          (ag) =>
            (ag.named_choice_groups && ag.named_choice_groups.length > 0) ||
            (ag.named_voters && ag.named_voters.length > 0),
        )
        .map((ag) => {
          const choiceRows = (ag.named_choice_groups || [])
            .map((g) => {
              const votersText = g.voters
                .map((v) =>
                  v.votesCount > 1 ? `${v.name} (${v.votesCount}표)` : v.name,
                )
                .join(", ");
              return `<div style="margin: 3px 0 3px 12px; font-size: 12px; line-height: 1.6;">
                • <b>[${g.choice} ${g.totalVotes}표]</b> ${votersText}
              </div>`;
            })
            .join("");

          const unrecordedRows =
            ag.unrecorded_voters && ag.unrecorded_voters.length > 0
              ? `<div style="margin: 3px 0 3px 12px; font-size: 12px; line-height: 1.6; color: #666;">
                  • <b>[선택 미기록 ${ag.unrecorded_voters.length}명]</b> ${ag.unrecorded_voters.join(", ")}
                </div>`
              : "";

          return `<div style="margin: 10px 0;">
            <div style="font-weight: bold; font-size: 13px; color: #000; margin-bottom: 2px;">■ ${ag.title}</div>
            ${choiceRows}
            ${unrecordedRows}
          </div>`;
        })
        .join("");

      if (appendixItems) {
        appendixHtml = `
          <div style="margin-top: 36px; padding-top: 24px; border-top: 2px dashed #999;">
            <div style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 4px;">[별 지]</div>
            <div style="text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 4px; margin-bottom: 4px;">기 명 표 결 결 과 명 부</div>
            <div style="text-align: center; font-size: 13px; font-weight: bold; color: #555; margin-bottom: 16px;">${orgName}</div>
            <div style="border-bottom: 1px solid #000; margin-bottom: 12px;"></div>
            ${appendixItems}
            <div style="border-bottom: 2px solid #000; margin-top: 14px;"></div>
          </div>
        `;
      }
    }

    return `
      <div style="max-width: 680px; margin: 0 auto; padding: 24px 20px; background-color: #ffffff; color: #000000; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
        <!-- 상단 헤더 -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
          <tr>
            <td style="width: 25%; text-align: left; vertical-align: top; font-size: 14px; font-weight: bold;">
              ${headerLeft}
            </td>
            <td style="width: 50%; text-align: center; vertical-align: middle; font-size: 25px; font-weight: bold; letter-spacing: 8px;">
              ${headerTitle}
            </td>
            <td style="width: 25%; text-align: right; vertical-align: top; font-size: 13px; font-weight: bold; line-height: 1.4;">
              ${headerRightNum}<br>
              ${headerRightType}<br><br>
              <span style="font-size: 14px; font-weight: bold;">${orgName}</span>
            </td>
          </tr>
        </table>

        <!-- 헤더 구분선 (굵은 실선) -->
        <div style="border-bottom: 2px solid #000000; margin: 8px 0 10px 0;"></div>

        <!-- 일시 -->
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 8px;">
          ${meetingDate}
        </div>
        <div style="border-bottom: 1px solid #000000; margin-bottom: 14px;"></div>

        <!-- 목적사항 -->
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">목적사항</div>
        <div style="margin-bottom: 14px; padding-left: 2px;">
          ${purposeListHtml}
        </div>
        <div style="border-bottom: 1px solid #000000; margin-bottom: 14px;"></div>

        <!-- 의결결과 -->
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">의결결과</div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
          ${resultRowsHtml}
        </table>

        <!-- 의결결과 하단 굵은 구분선 -->
        <div style="border-bottom: 2px solid #000000; margin-bottom: 14px;"></div>

        <!-- 하단 개회/폐회 및 안내 -->
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.6;">
          <tr>
            <td></td>
            <td style="text-align: right; padding-bottom: 8px; font-size: 12px;">
              (${openTime} 개회)
            </td>
          </tr>
          <tr>
            <td style="text-align: left; vertical-align: bottom; color: #222;">
              의장의 허가를 얻어 의결결과 이외에 기재할 사항을 생략함.<br>
              자세한 의사진행내역을 원하는 자는 총회 의장에게 문의바람.
            </td>
            <td style="text-align: right; vertical-align: bottom; font-size: 12px;">
              (${closeTime} 폐회)
            </td>
          </tr>
        </table>

        <!-- 별지 (기명투표 상세 명부) -->
        ${appendixHtml}
      </div>
    `.trim();
  };

  const generateNaverCafePlainText = () => {
    const dividerThick = "━".repeat(48);
    const dividerThin = "─".repeat(48);

    const purposeList = agendas
      .map((ag, idx) => `${idx + 1}. ${ag.title}`)
      .join("\n");

    const resultList = agendas
      .map((ag, idx) => {
        const res = getResultLabel(ag);
        const title = `${idx + 1}. ${ag.title}`;
        return `${title.padEnd(36, " ")} ${res}`;
      })
      .join("\n");

    let text = `${headerLeft}                  ${headerTitle}                  ${headerRightNum}
                                                            ${headerRightType}

                                                          ${orgName}
${dividerThick}
${meetingDate}
${dividerThin}
목적사항

${purposeList}
${dividerThin}
의결결과

${resultList}
${dividerThick}
                                                    (${openTime} 개회)
의장의 허가를 얻어 의결결과 이외에 기재할 사항을 생략함.
자세한 의사진행내역을 원하는 자는 총회 의장에게 문의바람.
                                                    (${closeTime} 폐회)
`;

    if (includeAppendix) {
      const appendixItems = agendas
        .filter(
          (ag) =>
            (ag.named_choice_groups && ag.named_choice_groups.length > 0) ||
            (ag.named_voters && ag.named_voters.length > 0),
        )
        .map((ag) => {
          const choiceLines = (ag.named_choice_groups || [])
            .map((g) => {
              const voters = g.voters
                .map((v) =>
                  v.votesCount > 1 ? `${v.name} (${v.votesCount}표)` : v.name,
                )
                .join(", ");
              return `  • [${g.choice} ${g.totalVotes}표] ${voters}`;
            })
            .join("\n");

          return `■ ${ag.title}\n${choiceLines}`;
        })
        .join("\n\n");

      if (appendixItems) {
        text += `\n\n\n[별 지]\n기 명 표 결 결 과 명 부\n${orgName}\n${dividerThin}\n${appendixItems}\n${dividerThick}\n`;
      }
    }

    return text;
  };

  const handleCopyForNaverCafe = async () => {
    const html = generateNaverCafeHtml();
    const plain = generateNaverCafePlainText();

    try {
      if (typeof window !== "undefined" && navigator.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([html], { type: "text/html" });
        const textBlob = new Blob([plain], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "text/plain": textBlob,
          }),
        ]);
        setCopyStatus("NAVER_SUCCESS");
        setTimeout(() => setCopyStatus(null), 4000);
        return;
      }
    } catch (err) {
      console.warn("ClipboardItem write failed, fallback to plain text:", err);
    }

    try {
      await navigator.clipboard.writeText(plain);
      setCopyStatus("PLAIN_SUCCESS");
      setTimeout(() => setCopyStatus(null), 4000);
    } catch {
      alert("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
  };

  const handleCopyPlainText = async () => {
    const plain = generateNaverCafePlainText();
    try {
      await navigator.clipboard.writeText(plain);
      setCopyStatus("PLAIN_SUCCESS");
      setTimeout(() => setCopyStatus(null), 3000);
    } catch {
      alert("클립보드 복사에 실패했습니다.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ─── 공통 A4 문서 렌더러 ───────────────────────────────────────────────────
  const renderDocumentPaper = (isPrintOrModal: boolean) => {
    return (
      <div
        id="assembly-minutes-printable-area"
        className={`bg-white text-black font-sans select-text shadow-2xl border border-neutral-300 max-w-3xl mx-auto ${
          isPrintOrModal ? "p-10 sm:p-14" : "p-6 sm:p-10 rounded-xl"
        }`}
        style={{ color: "#000000" }}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between pb-2">
          {/* 좌측 */}
          <div className="w-1/4">
            {isEditing ? (
              <input
                type="text"
                value={headerLeft}
                onChange={(e) => setHeaderLeft(e.target.value)}
                className="w-full text-xs font-bold border border-slate-300 rounded px-1 py-0.5"
              />
            ) : (
              <span className="text-xs sm:text-sm font-bold text-black">
                {headerLeft}
              </span>
            )}
          </div>

          {/* 중앙 타이틀 */}
          <div className="w-2/4 text-center">
            {isEditing ? (
              <input
                type="text"
                value={headerTitle}
                onChange={(e) => setHeaderTitle(e.target.value)}
                className="w-full text-center text-lg font-bold border border-slate-300 rounded px-1 py-0.5"
              />
            ) : (
              <h2 className="text-xl sm:text-2xl font-bold tracking-[0.25em] sm:tracking-[0.35em] text-black">
                {headerTitle}
              </h2>
            )}
          </div>

          {/* 우측 차수 및 협회명 */}
          <div className="w-1/4 text-right space-y-1">
            {isEditing ? (
              <div className="space-y-1 text-right">
                <input
                  type="text"
                  value={headerRightNum}
                  onChange={(e) => setHeaderRightNum(e.target.value)}
                  className="w-24 text-right text-xs font-bold border border-slate-300 rounded px-1 py-0.5"
                />
                <input
                  type="text"
                  value={headerRightType}
                  onChange={(e) => setHeaderRightType(e.target.value)}
                  className="w-24 text-right text-xs font-bold border border-slate-300 rounded px-1 py-0.5"
                />
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-28 text-right text-xs font-bold border border-slate-300 rounded px-1 py-0.5"
                />
              </div>
            ) : (
              <>
                <div className="text-xs sm:text-xs font-bold text-black leading-tight">
                  <div>{headerRightNum}</div>
                  <div>{headerRightType}</div>
                </div>
                <div className="pt-2 text-xs sm:text-sm font-bold text-black">
                  {orgName}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 상단 굵은 구분선 */}
        <div className="border-b-2 border-black my-2" />

        {/* 일시 */}
        <div className="py-1">
          {isEditing ? (
            <input
              type="text"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full text-xs font-bold border border-slate-300 rounded px-1.5 py-0.5"
            />
          ) : (
            <div className="text-xs sm:text-sm font-bold text-black">
              {meetingDate}
            </div>
          )}
        </div>

        {/* 일시 하단 구분선 */}
        <div className="border-b border-black mb-3 mt-1" />

        {/* 목적사항 */}
        <div className="space-y-2 py-1">
          <h4 className="text-xs sm:text-sm font-bold text-black">목적사항</h4>
          <div className="space-y-1 pl-1 text-[11px] sm:text-xs text-black leading-relaxed">
            {agendas.map((ag, idx) => (
              <div key={ag.id} className="flex items-start gap-1">
                <span className="font-medium shrink-0">{idx + 1}.</span>
                <span>{ag.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 목적사항 하단 구분선 */}
        <div className="border-b border-black my-3" />

        {/* 의결결과 */}
        <div className="space-y-2 py-1">
          <h4 className="text-xs sm:text-sm font-bold text-black">의결결과</h4>
          <div className="space-y-1.5 pl-1 text-[11px] sm:text-xs text-black">
            {agendas.map((ag, idx) => {
              const res = getResultLabel(ag);
              return (
                <div
                  key={ag.id}
                  className="flex items-start justify-between gap-4 py-0.5"
                >
                  <div className="flex items-start gap-1 leading-relaxed">
                    <span className="font-medium shrink-0">{idx + 1}.</span>
                    <span>{ag.title}</span>
                  </div>

                  <div className="shrink-0 text-right">
                    {isEditing ? (
                      <input
                        type="text"
                        value={res}
                        onChange={(e) =>
                          handleResultChange(ag.id, e.target.value)
                        }
                        className="w-28 text-right text-xs font-bold border border-blue-400 bg-blue-50/50 rounded px-1.5 py-0.5"
                        placeholder="결과 문구"
                      />
                    ) : (
                      <span className="font-bold text-black">{res}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 의결결과 하단 굵은 구분선 */}
        <div className="border-b-2 border-black my-3" />

        {/* 하단 개회/폐회 및 안내 */}
        <div className="space-y-3 pt-1 text-[11px] sm:text-xs text-black">
          {/* 개회 시간 */}
          <div className="text-right">
            {isEditing ? (
              <span className="inline-flex items-center gap-1">
                (
                <input
                  type="text"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="w-20 text-center text-xs font-semibold border border-slate-300 rounded px-1"
                />
                개회)
              </span>
            ) : (
              <span>({openTime} 개회)</span>
            )}
          </div>

          <div className="flex items-end justify-between gap-4 leading-relaxed">
            <div>
              <p>의장의 허가를 얻어 의결결과 이외에 기재할 사항을 생략함.</p>
              <p>자세한 의사진행내역을 원하는 자는 총회 의장에게 문의바람.</p>
            </div>

            <div className="shrink-0 text-right font-medium">
              {isEditing ? (
                <span className="inline-flex items-center gap-1">
                  (
                  <input
                    type="text"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                    className="w-20 text-center text-xs font-semibold border border-slate-300 rounded px-1"
                  />
                  폐회)
                </span>
              ) : (
                <span>({closeTime} 폐회)</span>
              )}
            </div>
          </div>
        </div>

        {/* 별지: 기명표결 상세 명단 */}
        {includeAppendix && (
          <div className="mt-8 pt-6 border-t-2 border-dashed border-neutral-400 space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs font-bold text-neutral-600">[별 지]</span>
              <h3 className="text-base sm:text-lg font-bold tracking-[0.2em] text-black">
                기 명 표 결 결 과 명 부
              </h3>
              <p className="text-xs font-medium text-neutral-500">{orgName}</p>
            </div>

            <div className="border-b border-black" />

            <div className="space-y-4 text-xs">
              {agendas
                .filter(
                  (ag) =>
                    (ag.named_choice_groups &&
                      ag.named_choice_groups.length > 0) ||
                    (ag.named_voters && ag.named_voters.length > 0),
                )
                .map((ag) => (
                  <div key={ag.id} className="space-y-1.5">
                    <p className="font-bold text-black">■ {ag.title}</p>
                    <div className="space-y-1 pl-3 text-neutral-800 leading-relaxed">
                      {(ag.named_choice_groups || []).map((g) => (
                        <div key={g.choice}>
                          • <span className="font-bold">[{g.choice} {g.totalVotes}표]</span>{" "}
                          {g.voters
                            .map((v) =>
                              v.votesCount > 1
                                ? `${v.name} (${v.votesCount}표)`
                                : v.name,
                            )
                            .join(", ")}
                        </div>
                      ))}

                      {ag.unrecorded_voters &&
                        ag.unrecorded_voters.length > 0 && (
                          <div className="text-neutral-500">
                            • <span className="font-bold">[선택 미기록 {ag.unrecorded_voters.length}명]</span>{" "}
                            {ag.unrecorded_voters.join(", ")}
                          </div>
                        )}
                    </div>
                  </div>
                ))}
            </div>

            <div className="border-b-2 border-black pt-2" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 액션 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl">
        {/* 좌측 뷰 토글 */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode("TEMPLATE")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === "TEMPLATE"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            공식 의사록 서식
          </button>
          <button
            onClick={() => setViewMode("RAW")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === "RAW"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            시스템 전산 원문
          </button>
        </div>

        {/* 우측 유틸리티 버튼들 */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === "TEMPLATE" && (
            <>
              {/* 별지 포함 체크박스 */}
              <label className="flex items-center gap-1.5 text-xs text-slate-300 select-none cursor-pointer pr-1">
                <input
                  type="checkbox"
                  checked={includeAppendix}
                  onChange={(e) => setIncludeAppendix(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0 w-3.5 h-3.5"
                />
                별지(기명명부) 포함
              </label>

              {/* 편집 모드 토글 */}
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isEditing
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
                title="결과 문구 및 일시 직접 편집"
              >
                <Settings2 className="w-3.5 h-3.5" />
                {isEditing ? "편집 완료" : "문구 편집"}
              </button>

              {isEditing && (
                <button
                  onClick={handleResetDefaults}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700"
                  title="기본값으로 되돌리기"
                >
                  <RotateCcw className="w-3 h-3" />
                  초기화
                </button>
              )}

              {/* 크게 보기 (모달) */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                title="전체화면 모달 열기"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                크게 보기
              </button>

              {/* 인쇄 / PDF 저장 */}
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                title="A4 인쇄 또는 PDF로 저장"
              >
                <Printer className="w-3.5 h-3.5" />
                인쇄 / PDF
              </button>
            </>
          )}

          {/* ★ 핵심: 네이버 카페용 원클릭 복사 버튼 */}
          <button
            onClick={handleCopyForNaverCafe}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950 transition-all active:scale-95"
            title="네이버 카페 스마트에디터에 서식 그대로 붙여넣을 수 있는 복사"
          >
            {copyStatus === "NAVER_SUCCESS" ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            네이버 카페용 복사
          </button>
        </div>
      </div>

      {/* 복사 성공 알림 배너 */}
      {copyStatus && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {copyStatus === "NAVER_SUCCESS"
                ? "네이버 카페용 서식이 클립보드에 복사되었습니다! 네이버 카페 글쓰기(스마트에디터)에서 Ctrl+V(붙여넣기)하시면 양식 그대로 작성됩니다."
                : "의사록 텍스트가 클립보드에 복사되었습니다."}
            </span>
          </div>
          <button
            onClick={() => setCopyStatus(null)}
            className="text-emerald-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 본문 영역 */}
      {viewMode === "TEMPLATE" ? (
        <div className="p-4 sm:p-6 bg-slate-950/60 rounded-2xl border border-slate-800/80 overflow-x-auto">
          {renderDocumentPaper(false)}
        </div>
      ) : (
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
          {assembly.minutes_text || "등록된 전산 의사록 원문이 없습니다."}
        </div>
      )}

      {/* 전체화면 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <FileCheck2 className="w-4 h-4 text-blue-400" />
                총회 공식 의사록 서식 뷰어
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyForNaverCafe}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                  네이버 카페 복사
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  인쇄 / PDF
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 모달 바디 */}
            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-950/90 flex-1">
              {renderDocumentPaper(true)}
            </div>
          </div>
        </div>
      )}

      {/* 인쇄 전용 CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #assembly-minutes-printable-area,
          #assembly-minutes-printable-area * {
            visibility: visible !important;
          }
          #assembly-minutes-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}

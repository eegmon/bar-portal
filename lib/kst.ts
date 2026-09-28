// 시간 처리 규칙: 이 사이트의 모든 "시각"은 한국 표준시(KST, UTC+9) 기준이다.
//  - 관리자가 입력한 일정(offset 없는 "2026-09-28T14:00")은 KST로 해석한다.
//    (서버가 UTC로 돌아가는 Vercel 등에서도 9시간 어긋나지 않도록)
//  - SQLite datetime('now') 로 저장된 값은 UTC이므로 KST로 변환해서 보여준다.

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

// 일정 문자열(KST 기준) -> epoch ms
export function parseKst(value: unknown): number {
  let s = String(value ?? "").trim();
  if (!s) return NaN;
  if (HAS_OFFSET.test(s) && s.includes("T")) return Date.parse(s);
  s = s.replace(" ", "T");
  if (!s.includes("T")) s += "T00:00:00";
  if (/T\d{2}:\d{2}$/.test(s)) s += ":00";
  return Date.parse(`${s}+09:00`);
}

// DB(datetime('now'), UTC) 문자열 -> epoch ms
export function parseDbUtc(value: unknown): number {
  const s = String(value ?? "").trim();
  if (!s) return NaN;
  if (HAS_OFFSET.test(s) && s.includes("T")) return Date.parse(s);
  return Date.parse(`${s.replace(" ", "T")}Z`);
}

// epoch ms/Date -> "YYYY-MM-DD HH:mm" (KST, 24시간제)
export function formatKst(input: number | Date, withSeconds = false): string {
  const d = typeof input === "number" ? new Date(input) : input;
  if (!Number.isFinite(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const base = `${p("year")}-${p("month")}-${p("day")} ${p("hour")}:${p("minute")}`;
  return withSeconds ? `${base}:${p("second")}` : base;
}

export const formatKstNow = () => formatKst(new Date());
export const formatDbUtcAsKst = (v: unknown) => {
  const t = parseDbUtc(v);
  return Number.isFinite(t) ? formatKst(t) : "";
};

import { randomBytes } from "crypto";
import db from "@/lib/db";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

const TYPE_BY_MIME = new Map([
  ["application/pdf", ".pdf"],
  ["application/msword", ".doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".docx",
  ],
  ["application/x-hwp", ".hwp"],
  ["application/haansofthwp", ".hwp"],
  ["application/vnd.hancom.hwp", ".hwp"],
]);
const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".hwp": "application/x-hwp",
};

// 확장자 우선 판정 (브라우저가 HWP를 octet-stream 으로 보내는 경우 대응)
export function resolveFileType(file: File): { ext: string; mime: string } | null {
  const m = /\.[a-z0-9]+$/i.exec(file.name || "");
  const byName = m ? m[0].toLowerCase() : "";
  if (MIME_BY_EXT[byName]) return { ext: byName, mime: MIME_BY_EXT[byName] };
  const byMime = TYPE_BY_MIME.get(file.type);
  if (byMime) return { ext: byMime, mime: MIME_BY_EXT[byMime] };
  return null;
}

let ensured: Promise<void> | null = null;
export function ensureFilesTable(): Promise<void> {
  if (!ensured) {
    ensured = db
      .execute(
        `CREATE TABLE IF NOT EXISTS exam_files (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,            -- 'answer' 수험생 답안 | 'problem' 문제지
          exam_id TEXT DEFAULT '',
          security_code TEXT DEFAULT '',
          filename TEXT NOT NULL,
          mime TEXT NOT NULL,
          size INTEGER NOT NULL,
          data BLOB NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )`,
      )
      .then(() => undefined)
      .catch((e) => {
        ensured = null;
        throw e;
      });
  }
  return ensured;
}

export async function saveExamFile(opts: {
  kind: "answer" | "problem";
  examId?: string;
  securityCode?: string;
  file: File;
  mime: string;
}): Promise<string> {
  await ensureFilesTable();
  const id = randomBytes(16).toString("hex");
  await db.execute({
    sql: `INSERT INTO exam_files (id, kind, exam_id, security_code, filename, mime, size, data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      opts.kind,
      opts.examId || "",
      opts.securityCode || "",
      opts.file.name || "file",
      opts.mime,
      opts.file.size,
      new Uint8Array(await opts.file.arrayBuffer()),
    ],
  });
  return id;
}

export const fileUrlOf = (id: string) => `/api/exam/files/${id}`;

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:bar_portal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function seedAssembly() {
  // 1. 2026년 9월 정기총회 등록
  await db.execute({
    sql: `INSERT OR REPLACE INTO assemblies (id, title, round_number, is_regular, held_at, status)
          VALUES ('assembly-2026-09', '2026년도 9월 정기총회', 9, 1, '2026-10-04 20:00:00', 'IN_SESSION')`,
  });

  // 2. 안건 등록 (1호: 회칙 개정안 - 기명, 2호: 협회장 선출 - 무기명 비밀투표)
  await db.execute({
    sql: `INSERT OR REPLACE INTO agendas (id, assembly_id, title, description, is_secret, status)
          VALUES ('agenda-1', 'assembly-2026-09', '제1호 안건: 도스변호사협회 회칙 일부개정안 심의의 건', '사무국 직제 개편 및 전자총회 의결권 위임 규정 정비', 0, 'VOTING')`,
  });

  await db.execute({
    sql: `INSERT OR REPLACE INTO agendas (id, assembly_id, title, description, is_secret, status)
          VALUES ('agenda-2', 'assembly-2026-09', '제2호 안건: 제15대 도스변호사협회 협회장 선출의 건', '회원의 직접·무기명 비밀투표에 의한 협회장 선출', 1, 'VOTING')`,
  });

  console.log("✓ 9월 정기총회 및 안건 샘플 데이터 등록 완료");
}

seedAssembly().catch(console.error);

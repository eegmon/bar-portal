import bcrypt from "bcryptjs";
import { createClient } from "@libsql/client";

const loginId = process.env.INITIAL_ADMIN_LOGIN?.trim();
const password = process.env.INITIAL_ADMIN_PASSWORD;
const name = process.env.INITIAL_ADMIN_NAME?.trim();

if (!loginId || !password || !name) {
  console.error("INITIAL_ADMIN_LOGIN, INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_NAME 환경변수가 모두 필요합니다.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("INITIAL_ADMIN_PASSWORD는 12자 이상이어야 합니다.");
  process.exit(1);
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:bar_portal.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 이미 존재하는지 확인 (재배포 시 중복 오류 방지)
const existing = await db.execute({
  sql: "SELECT id FROM users WHERE login_id = ?",
  args: [loginId],
});

if (existing.rows.length > 0) {
  console.log(`관리자 계정 [${loginId}]이 이미 존재합니다. 건너뜁니다.`);
  process.exit(0);
}

const passwordHash = await bcrypt.hash(password, 12);
const userId = `admin-${Date.now()}`;

await db.execute({
  sql: `INSERT INTO users (id, login_id, password, name, role, status, office_name, positions)
        VALUES (?, ?, ?, ?, 'ADMIN', 'ACTIVE', '도스변호사협회 사무국', '[]')`,
  args: [userId, loginId, passwordHash, name],
});
console.log(`✅ 초기 관리자 계정이 생성되었습니다: ${loginId} (이름: ${name})`);

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:bar_portal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

if (process.env.NODE_ENV === "production") {
  if (!url.startsWith("libsql://") && !url.startsWith("https://")) {
    throw new Error("운영 데이터베이스는 TLS 원격 연결을 사용해야 합니다.");
  }
  if (!authToken) {
    throw new Error(
      "운영 데이터베이스 연결에는 TURSO_AUTH_TOKEN이 필요합니다.",
    );
  }
}

export const db = createClient({
  url,
  authToken,
});

export default db;

const DEVELOPMENT_SECRET = "dos-bar-association-super-secret-key-2026";

export function getSecuritySecret() {
  const secret = process.env.JWT_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    (!secret || Buffer.byteLength(secret, "utf8") < 32)
  ) {
    throw new Error(
      "운영 환경에는 32바이트 이상의 JWT_SECRET 설정이 필요합니다.",
    );
  }
  return secret || DEVELOPMENT_SECRET;
}

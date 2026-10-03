import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getSecuritySecret } from "./security-secret";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encryptionKey() {
  return createHash("sha256").update(getSecuritySecret()).digest();
}

export function generateTotpSecret() {
  const bytes = randomBytes(20);
  let bits = 0;
  let value = 0;
  let secret = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      secret += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) secret += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return secret;
}

function decodeBase32(value: string) {
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];

  for (const character of value.toUpperCase().replace(/=+$/, "")) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("유효하지 않은 TOTP 비밀키입니다.");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secret: string, timeMs = Date.now()) {
  const counter = Math.floor(timeMs / 30_000);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counterBytes)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotpCode(
  secret: string,
  code: string,
  timeMs = Date.now(),
) {
  if (!/^\d{6}$/.test(code)) return false;
  const supplied = Buffer.from(code);
  for (const offset of [-30_000, 0, 30_000]) {
    const expected = Buffer.from(generateTotpCode(secret, timeMs + offset));
    if (timingSafeEqual(supplied, expected)) return true;
  }
  return false;
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptTotpSecret(value: string) {
  const [iv, authTag, encrypted] = value
    .split(".")
    .map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

export function createRecoveryCodes(count = 10) {
  const codes = Array.from({ length: count }, () =>
    randomBytes(12)
      .toString("hex")
      .toUpperCase()
      .match(/.{1,5}/g)!
      .join("-"),
  );
  const hashes = codes.map((code) =>
    createHash("sha256").update(code.replace(/-/g, "")).digest("hex"),
  );
  return { codes, hashes };
}

export function consumeRecoveryCode(codesJson: string, code: string) {
  let hashes: string[];
  try {
    hashes = JSON.parse(codesJson);
  } catch {
    return null;
  }
  if (!Array.isArray(hashes)) return null;

  const candidate = createHash("sha256")
    .update(code.replace(/[-\s]/g, "").toUpperCase())
    .digest();
  const remaining = hashes.filter((hash) => {
    if (typeof hash !== "string" || !/^[a-f\d]{64}$/i.test(hash)) return false;
    return !timingSafeEqual(Buffer.from(hash, "hex"), candidate);
  });
  return remaining.length === hashes.length ? null : JSON.stringify(remaining);
}

export function createTotpUri(secret: string, accountName: string) {
  const label = encodeURIComponent(`Dos Bar Association:${accountName}`);
  const issuer = encodeURIComponent("Dos Bar Association");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

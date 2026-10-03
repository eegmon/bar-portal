import { describe, expect, it } from "vitest";
import {
  consumeRecoveryCode,
  createRecoveryCodes,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from "./totp";

describe("account security TOTP helpers", () => {
  it("matches the RFC 6238 SHA-1 test vector", () => {
    expect(generateTotpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe(
      "287082",
    );
  });

  it("accepts the current time window and rejects malformed codes", () => {
    const secret = generateTotpSecret();
    const code = generateTotpCode(secret, 1_710_000_000_000);

    expect(verifyTotpCode(secret, code, 1_710_000_000_000)).toBe(true);
    expect(verifyTotpCode(secret, "abc123", 1_710_000_000_000)).toBe(false);
    expect(verifyTotpCode(secret, "000000", 1_710_000_000_000)).toBe(false);
  });

  it("encrypts secrets and consumes each recovery code once", () => {
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    const { codes, hashes } = createRecoveryCodes(2);
    const remaining = consumeRecoveryCode(JSON.stringify(hashes), codes[0]);

    expect(encrypted).not.toContain(secret);
    expect(decryptTotpSecret(encrypted)).toBe(secret);
    expect(remaining).not.toBeNull();
    expect(JSON.parse(remaining!)).toHaveLength(1);
    expect(consumeRecoveryCode(remaining!, codes[0])).toBeNull();
  });
});

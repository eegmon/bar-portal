import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password helpers", () => {
  it("hashes passwords and verifies only matching values", async () => {
    const passwordHash = await hashPassword("test-password-123");

    expect(passwordHash).not.toBe("test-password-123");
    expect(await verifyPassword("test-password-123", passwordHash)).toBe(true);
    expect(await verifyPassword("incorrect-password", passwordHash)).toBe(
      false,
    );
  });
});

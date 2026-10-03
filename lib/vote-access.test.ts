import { describe, expect, it, vi } from "vitest";
import { signVoteAccessToken, verifyVoteAccessToken } from "./vote-access";

describe("vote access tokens", () => {
  it("requires an assembly-scoped token", () => {
    const token = signVoteAccessToken({
      userId: "user-1",
      assemblyId: "assembly-1",
    });
    expect(verifyVoteAccessToken(token)?.assemblyId).toBe("assembly-1");

    const unscopedToken = signVoteAccessToken({
      userId: "user-1",
      assemblyId: "",
    });
    expect(verifyVoteAccessToken(unscopedToken)).toBeNull();
  });

  it("rejects production token signing without JWT_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "");

    try {
      expect(() =>
        signVoteAccessToken({ userId: "user-1", assemblyId: "assembly-1" }),
      ).toThrow("JWT_SECRET");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

import { describe, expect, it } from "vitest";
import { normalizeDiscordUserReference } from "./discord";

describe("discord user reference normalization", () => {
  it("returns numeric snowflake ids unchanged", () => {
    expect(normalizeDiscordUserReference("123456789012345678")).toBe(
      "123456789012345678",
    );
  });

  it("extracts ids from mention markup", () => {
    expect(normalizeDiscordUserReference("<@123456789012345678>")).toBe(
      "123456789012345678",
    );
    expect(normalizeDiscordUserReference("<@!123456789012345678>")).toBe(
      "123456789012345678",
    );
  });

  it("keeps username and nickname strings for guild member search", () => {
    expect(normalizeDiscordUserReference("admin#1234")).toBe("admin#1234");
    expect(normalizeDiscordUserReference("  kim  ")).toBe("kim");
  });
});

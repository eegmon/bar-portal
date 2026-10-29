import { describe, expect, it } from "vitest";
import {
  normalizeDiscordBotToken,
  normalizeDiscordUserReference,
} from "./discord";

describe("discord bot token normalization", () => {
  it("accepts raw tokens and Authorization-style tokens", () => {
    expect(normalizeDiscordBotToken("  token-value  ")).toBe("token-value");
    expect(normalizeDiscordBotToken("Bot token-value")).toBe("token-value");
    expect(normalizeDiscordBotToken("bot token-value")).toBe("token-value");
  });
});

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

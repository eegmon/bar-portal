import { describe, expect, it } from "vitest";
import { parseUserPositions } from "./user-positions";

describe("parseUserPositions", () => {
  it("parses stored position arrays", () => {
    expect(parseUserPositions('["PRESIDENT","DIRECTOR"]')).toEqual([
      "PRESIDENT",
      "DIRECTOR",
    ]);
  });

  it("returns an empty array for missing, malformed, or non-array data", () => {
    expect(parseUserPositions(null)).toEqual([]);
    expect(parseUserPositions("")).toEqual([]);
    expect(parseUserPositions("not-json")).toEqual([]);
    expect(parseUserPositions('{"position":"PRESIDENT"}')).toEqual([]);
  });
});

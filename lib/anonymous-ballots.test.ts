import { describe, expect, it } from "vitest";
import { splitVotesIntoAnonymousBallots } from "./anonymous-ballots";

describe("anonymous ballot rows", () => {
  it("stores each voting right as a separate one-vote row", () => {
    expect(splitVotesIntoAnonymousBallots("찬성", 3)).toEqual([
      { choice: "찬성", votesCount: 1 },
      { choice: "찬성", votesCount: 1 },
      { choice: "찬성", votesCount: 1 },
    ]);
  });

  it("rejects invalid vote counts", () => {
    expect(() => splitVotesIntoAnonymousBallots("찬성", 1.5)).toThrow(
      RangeError,
    );
    expect(() => splitVotesIntoAnonymousBallots("찬성", -1)).toThrow(
      RangeError,
    );
  });
});

import { describe, expect, it } from "vitest";
import { countPluralityVotes } from "./plurality-vote";

describe("plurality vote counting", () => {
  it("selects the unique highest tally regardless of row order", () => {
    expect(
      countPluralityVotes([
        { choice: "A", total: 4 },
        { choice: "B", total: 9 },
        { choice: "C", total: 2 },
      ]),
    ).toEqual({ winner: "B", tiedChoices: [], votes: 9 });
  });

  it("does not select a winner when the top tally is tied", () => {
    expect(
      countPluralityVotes([
        { choice: "A", total: 9 },
        { choice: "B", total: 9 },
        { choice: "C", total: 2 },
      ]),
    ).toEqual({ winner: null, tiedChoices: ["A", "B"], votes: 9 });
  });

  it("returns no winner when there are no votes", () => {
    expect(countPluralityVotes([])).toEqual({
      winner: null,
      tiedChoices: [],
      votes: 0,
    });
  });
});

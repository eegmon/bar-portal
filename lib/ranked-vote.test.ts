import { describe, expect, it } from "vitest";
import {
  countRankedVotes,
  parseRankedBallots,
  RANKED_BALLOT_PREFIX,
} from "./ranked-vote";

describe("ranked vote counting", () => {
  const choices = ["A", "B", "C"];

  it("parses the stored ranking prefix and applies weighted IRV transfers", () => {
    const ballots = parseRankedBallots(
      [
        { choice: `${RANKED_BALLOT_PREFIX}["A","B","C"]`, votes_count: 2 },
        { choice: `${RANKED_BALLOT_PREFIX}["B","C","A"]`, votes_count: 1 },
        { choice: `${RANKED_BALLOT_PREFIX}["C","B","A"]`, votes_count: 2 },
      ],
      choices,
    );

    const outcome = countRankedVotes(ballots, choices);

    expect(outcome.winner).toBe("C");
    expect(outcome.rounds).toEqual([
      {
        round: 1,
        tally: [
          { choice: "A", total: 2 },
          { choice: "C", total: 2 },
          { choice: "B", total: 1 },
        ],
        eliminatedChoice: "B",
      },
      {
        round: 2,
        tally: [
          { choice: "C", total: 3 },
          { choice: "A", total: 2 },
        ],
        winner: "C",
      },
    ]);
  });

  it("ignores malformed and incomplete stored ballots", () => {
    const ballots = parseRankedBallots(
      [
        { choice: '__RANKING:["A","B","C"]', votes_count: 1 },
        { choice: `${RANKED_BALLOT_PREFIX}["A","A","C"]`, votes_count: 1 },
        { choice: `${RANKED_BALLOT_PREFIX}["A","B","C"]`, votes_count: 0 },
      ],
      choices,
    );

    expect(ballots).toEqual([]);
    expect(countRankedVotes(ballots, choices)).toEqual({
      rounds: [],
      winner: null,
    });
  });

  it("uses configured choice order for tied elimination", () => {
    const ballots = [
      { ranking: ["A", "B", "C"], votesCount: 1 },
      { ranking: ["B", "C", "A"], votesCount: 1 },
      { ranking: ["C", "B", "A"], votesCount: 1 },
    ];

    const outcome = countRankedVotes(ballots, choices);

    expect(outcome.rounds[0]).toMatchObject({ eliminatedChoice: "A" });
    expect(outcome.winner).toBe("B");
  });
});

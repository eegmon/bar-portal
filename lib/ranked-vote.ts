export const RANKED_BALLOT_PREFIX = "__RANKING__:";

export interface RankedBallot {
  ranking: string[];
  votesCount: number;
}

export interface RankedVoteCount {
  choice: string;
  total: number;
}

export interface RankedVoteRound {
  round: number;
  tally: RankedVoteCount[];
  eliminatedChoice?: string;
  winner?: string;
}

export interface RankedVoteOutcome {
  rounds: RankedVoteRound[];
  winner: string | null;
}

export function parseRankedBallots(
  rows: readonly unknown[],
  choices: readonly string[],
): RankedBallot[] {
  const choiceSet = new Set(choices);
  if (choiceSet.size < 2) return [];

  return rows.flatMap((rawRow) => {
    if (!rawRow || typeof rawRow !== "object") return [];
    const row = rawRow as { choice?: unknown; votes_count?: unknown };
    const storedChoice = String(row.choice ?? "");
    if (!storedChoice.startsWith(RANKED_BALLOT_PREFIX)) return [];

    const votesCount = Number(row.votes_count);
    if (!Number.isInteger(votesCount) || votesCount <= 0) return [];

    try {
      const ranking: unknown = JSON.parse(
        storedChoice.slice(RANKED_BALLOT_PREFIX.length),
      );
      if (
        !Array.isArray(ranking) ||
        ranking.length !== choiceSet.size ||
        ranking.some(
          (choice) => typeof choice !== "string" || !choiceSet.has(choice),
        ) ||
        new Set(ranking).size !== choiceSet.size
      ) {
        return [];
      }

      return [{ ranking, votesCount }];
    } catch {
      return [];
    }
  });
}

export function countRankedVotes(
  ballots: readonly RankedBallot[],
  choices: readonly string[],
): RankedVoteOutcome {
  let remaining = [...new Set(choices)];
  const rounds: RankedVoteRound[] = [];

  for (let roundNumber = 1; remaining.length > 0; roundNumber += 1) {
    const counts = new Map(remaining.map((choice) => [choice, 0]));

    for (const ballot of ballots) {
      const choice = ballot.ranking.find((candidate) => counts.has(candidate));
      if (choice)
        counts.set(choice, (counts.get(choice) ?? 0) + ballot.votesCount);
    }

    const tally = remaining
      .map((choice) => ({ choice, total: counts.get(choice) ?? 0 }))
      .sort((left, right) => right.total - left.total);
    const totalVotes = tally.reduce((sum, item) => sum + item.total, 0);
    if (totalVotes === 0) break;

    const majorityWinner = tally.find((item) => item.total > totalVotes / 2);
    if (majorityWinner || remaining.length === 1) {
      const winner = majorityWinner?.choice ?? remaining[0];
      rounds.push({ round: roundNumber, tally, winner });
      return { rounds, winner };
    }

    const lowestCount = Math.min(...tally.map((item) => item.total));
    const eliminatedChoice = remaining.find(
      (choice) => counts.get(choice) === lowestCount,
    );
    if (!eliminatedChoice) break;

    rounds.push({ round: roundNumber, tally, eliminatedChoice });
    remaining = remaining.filter((choice) => choice !== eliminatedChoice);
  }

  return { rounds, winner: null };
}

export interface PluralityTally {
  choice: string;
  total: number;
}

export interface PluralityOutcome {
  winner: string | null;
  tiedChoices: string[];
  votes: number;
}

export function countPluralityVotes(
  tally: readonly PluralityTally[],
): PluralityOutcome {
  const votes = Math.max(
    ...tally.map((item) => (Number.isFinite(item.total) ? item.total : 0)),
    0,
  );
  if (votes === 0) return { winner: null, tiedChoices: [], votes: 0 };

  const leaders = tally.filter((item) => item.total === votes);
  return {
    winner: leaders.length === 1 ? leaders[0].choice : null,
    tiedChoices: leaders.length > 1 ? leaders.map((item) => item.choice) : [],
    votes,
  };
}

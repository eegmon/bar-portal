export interface AnonymousBallotUnit {
  choice: string;
  votesCount: 1;
}

export function splitVotesIntoAnonymousBallots(
  choice: string,
  votesCount: number,
): AnonymousBallotUnit[] {
  if (!Number.isSafeInteger(votesCount) || votesCount < 0) {
    throw new RangeError("votesCount must be a non-negative safe integer");
  }

  return Array.from({ length: votesCount }, () => ({
    choice,
    votesCount: 1 as const,
  }));
}

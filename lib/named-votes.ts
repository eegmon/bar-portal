export interface RawBallotRow {
  agenda_id: string;
  choice: string;
  votes_count: number;
  user_id: string;
  user_name: string;
}

export interface RawVoterLogRow {
  agenda_id: string;
  user_id: string;
  user_name: string;
}

export interface VoterDetail {
  userId: string;
  name: string;
  votesCount: number;
}

export interface ChoiceGroup {
  choice: string;
  totalVotes: number;
  voters: VoterDetail[];
}

export interface ProcessedNamedAgendaVotes {
  choiceGroups: ChoiceGroup[];
  unrecordedVoters: string[];
  allVoters: string[];
}

export function formatChoiceLabel(rawChoice: string): string {
  if (rawChoice.startsWith("__RANKING__:")) {
    try {
      const parsed = JSON.parse(rawChoice.slice("__RANKING__:".length));
      if (Array.isArray(parsed)) {
        return parsed.join(" > ");
      }
    } catch {
      // fallback
    }
  }
  return rawChoice;
}

export function getChoicePriority(choice: string): number {
  const norm = choice.trim();
  if (["찬성", "FOR", "YES", "가", "승인"].includes(norm)) return 1;
  if (["반대", "AGAINST", "NO", "부"].includes(norm)) return 2;
  if (["기권", "ABSTAIN"].includes(norm)) return 3;
  return 10;
}

/**
 * 기명 투표 데이터(ballot_box 및 voter_logs)를 선택지별 그룹으로 집계
 */
export function processNamedVotesForAgenda(
  ballots: RawBallotRow[],
  voterLogs: RawVoterLogRow[],
): ProcessedNamedAgendaVotes {
  // 1. 선택지별 집계 (choice -> userId -> VoterDetail)
  const choiceMap = new Map<string, Map<string, VoterDetail>>();

  for (const b of ballots) {
    const choice = formatChoiceLabel(b.choice || "미지정");
    const userId = String(b.user_id || "");
    const name = String(b.user_name || "알 수 없음");
    const count = Number(b.votes_count || 1);

    if (!choiceMap.has(choice)) {
      choiceMap.set(choice, new Map());
    }
    const votersInChoice = choiceMap.get(choice)!;
    const existing = votersInChoice.get(userId);
    if (existing) {
      existing.votesCount += count;
    } else {
      votersInChoice.set(userId, {
        userId,
        name,
        votesCount: count,
      });
    }
  }

  // 2. ChoiceGroup 배열 구성
  const choiceGroups: ChoiceGroup[] = [];
  const recordedUserIds = new Set<string>();

  for (const [choice, votersMap] of choiceMap.entries()) {
    const voters = Array.from(votersMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ko"),
    );
    const totalVotes = voters.reduce((sum, v) => sum + v.votesCount, 0);

    for (const v of voters) {
      recordedUserIds.add(v.userId);
    }

    choiceGroups.push({
      choice,
      totalVotes,
      voters,
    });
  }

  // 선택지 정렬: 우선순위(찬성->반대->기권) -> 표 수 내림차순 -> 이름순
  choiceGroups.sort((a, b) => {
    const pA = getChoicePriority(a.choice);
    const pB = getChoicePriority(b.choice);
    if (pA !== pB) return pA - pB;
    if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
    return a.choice.localeCompare(b.choice, "ko");
  });

  // 3. voter_logs에 있으나 ballot_box에 user_id가 없는 레거시/미기록 투표자
  const unrecordedSet = new Set<string>();
  const allVoterNames = new Set<string>();

  for (const log of voterLogs) {
    const name = String(log.user_name || "알 수 없음");
    allVoterNames.add(name);
    if (!recordedUserIds.has(String(log.user_id))) {
      unrecordedSet.add(name);
    }
  }

  // ballot_box에만 있는 경우도 allVoterNames에 추가
  for (const group of choiceGroups) {
    for (const v of group.voters) {
      allVoterNames.add(v.name);
    }
  }

  const unrecordedVoters = Array.from(unrecordedSet).sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
  const allVoters = Array.from(allVoterNames).sort((a, b) =>
    a.localeCompare(b, "ko"),
  );

  return {
    choiceGroups,
    unrecordedVoters,
    allVoters,
  };
}

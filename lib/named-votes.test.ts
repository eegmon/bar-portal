import { describe, expect, it } from "vitest";
import {
  formatChoiceLabel,
  getChoicePriority,
  processNamedVotesForAgenda,
} from "./named-votes";

describe("named-votes helper", () => {
  it("formats ranking choice label correctly", () => {
    expect(formatChoiceLabel('__RANKING__:["홍길동","이순신","강감찬"]')).toBe(
      "홍길동 > 이순신 > 강감찬",
    );
    expect(formatChoiceLabel("찬성")).toBe("찬성");
  });

  it("prioritizes 찬성, 반대, 기권 in order", () => {
    expect(getChoicePriority("찬성")).toBe(1);
    expect(getChoicePriority("반대")).toBe(2);
    expect(getChoicePriority("기권")).toBe(3);
    expect(getChoicePriority("후보자 A")).toBe(10);
  });

  it("aggregates ballots by choice and voters with voting power", () => {
    const ballots = [
      {
        agenda_id: "ag-1",
        choice: "찬성",
        votes_count: 1,
        user_id: "u1",
        user_name: "AndyLab",
      },
      {
        agenda_id: "ag-1",
        choice: "찬성",
        votes_count: 2,
        user_id: "u2",
        user_name: "eegmon",
      },
      {
        agenda_id: "ag-1",
        choice: "반대",
        votes_count: 1,
        user_id: "u3",
        user_name: "joyala",
      },
    ];

    const voterLogs = [
      { agenda_id: "ag-1", user_id: "u1", user_name: "AndyLab" },
      { agenda_id: "ag-1", user_id: "u2", user_name: "eegmon" },
      { agenda_id: "ag-1", user_id: "u3", user_name: "joyala" },
    ];

    const result = processNamedVotesForAgenda(ballots, voterLogs);

    expect(result.choiceGroups).toHaveLength(2);
    expect(result.choiceGroups[0].choice).toBe("찬성");
    expect(result.choiceGroups[0].totalVotes).toBe(3);
    expect(result.choiceGroups[0].voters).toEqual([
      { userId: "u1", name: "AndyLab", votesCount: 1 },
      { userId: "u2", name: "eegmon", votesCount: 2 },
    ]);
    expect(result.choiceGroups[1].choice).toBe("반대");
    expect(result.choiceGroups[1].totalVotes).toBe(1);
    expect(result.choiceGroups[1].voters).toEqual([
      { userId: "u3", name: "joyala", votesCount: 1 },
    ]);
    expect(result.unrecordedVoters).toHaveLength(0);
    expect(result.allVoters).toEqual(["AndyLab", "eegmon", "joyala"]);
  });

  it("handles legacy/unrecorded voters present only in voter_logs", () => {
    const ballots = [
      {
        agenda_id: "ag-1",
        choice: "찬성",
        votes_count: 1,
        user_id: "u1",
        user_name: "AndyLab",
      },
    ];

    const voterLogs = [
      { agenda_id: "ag-1", user_id: "u1", user_name: "AndyLab" },
      { agenda_id: "ag-1", user_id: "u2", user_name: "LicaChan" },
    ];

    const result = processNamedVotesForAgenda(ballots, voterLogs);

    expect(result.choiceGroups).toHaveLength(1);
    expect(result.choiceGroups[0].voters[0].name).toBe("AndyLab");
    expect(result.unrecordedVoters).toEqual(["LicaChan"]);
    expect(result.allVoters).toEqual(["AndyLab", "LicaChan"]);
  });
});

import { describe, expect, it } from "vitest";

import type { PlayerResult } from "../src/domain/gameRules";
import {
  aggregateRoomResults,
  validateRoomResultSubmission,
} from "../src/domain/roomResults";

function player(
  playerId: string,
  rosterOrder: number,
  score: number,
  capturedMenuIds: readonly string[] = [],
): PlayerResult {
  return {
    playerId,
    displayName: `플레이어 ${playerId}`,
    rosterOrder,
    score,
    capturedMenuIds,
  };
}

describe("aggregateRoomResults", () => {
  it("returns competition ranks, sole winner and last place, and two capture slots", () => {
    const summary = aggregateRoomResults([
      player("middle", 1, 82, ["ramyeon"]),
      player("last", 2, 60),
      player("winner", 0, 95, ["pizza", "pasta"]),
    ]);

    expect(
      summary.standings.map(
        ({ rank, playerId, capturedMenuSlots }) => ({
          rank,
          playerId,
          capturedMenuSlots,
        }),
      ),
    ).toEqual([
      {
        rank: 1,
        playerId: "winner",
        capturedMenuSlots: ["pizza", "pasta"],
      },
      {
        rank: 2,
        playerId: "middle",
        capturedMenuSlots: ["ramyeon", null],
      },
      {
        rank: 3,
        playerId: "last",
        capturedMenuSlots: [null, null],
      },
    ]);
    expect(summary.winners.map(({ playerId }) => playerId)).toEqual([
      "winner",
    ]);
    expect(
      summary.lastPlaces.map(({ playerId }) => playerId),
    ).toEqual(["last"]);
    expect(summary.winners[0]?.capturedMenuIds).toEqual([
      "pizza",
      "pasta",
    ]);
  });

  it("keeps a shared first-place rank and uses roster order only for display order", () => {
    const summary = aggregateRoomResults([
      player("later", 3, 90.003),
      player("earlier", 1, 90.004),
      player("last", 2, 40),
    ]);

    expect(
      summary.standings.map(
        ({ rank, playerId, score, isScoreTied, scoreTieSize }) => ({
          rank,
          playerId,
          score,
          isScoreTied,
          scoreTieSize,
        }),
      ),
    ).toEqual([
      {
        rank: 1,
        playerId: "earlier",
        score: 90,
        isScoreTied: true,
        scoreTieSize: 2,
      },
      {
        rank: 1,
        playerId: "later",
        score: 90,
        isScoreTied: true,
        scoreTieSize: 2,
      },
      {
        rank: 3,
        playerId: "last",
        score: 40,
        isScoreTied: false,
        scoreTieSize: 1,
      },
    ]);
    expect(summary.winners.map(({ playerId }) => playerId)).toEqual([
      "earlier",
      "later",
    ]);
    expect(
      summary.lastPlaces.map(({ playerId }) => playerId),
    ).toEqual(["last"]);
  });

  it("keeps an uncaptured sole winner's recommendation list empty instead of auto-filling it", () => {
    const summary = aggregateRoomResults([
      player("winner", 0, 100),
      player("other", 1, 70, ["pizza"]),
    ]);

    expect(summary.winners[0]?.capturedMenuSlots).toEqual([
      null,
      null,
    ]);
    expect(summary.winners[0]?.capturedMenuIds).toEqual([]);
  });

  it("returns every player tied at the lowest score as a joint last place", () => {
    const summary = aggregateRoomResults([
      player("winner", 0, 95),
      player("later-last", 2, 40),
      player("earlier-last", 1, 40),
    ]);

    expect(
      summary.standings.map(({ playerId, rank }) => ({
        playerId,
        rank,
      })),
    ).toEqual([
      { playerId: "winner", rank: 1 },
      { playerId: "earlier-last", rank: 2 },
      { playerId: "later-last", rank: 2 },
    ]);
    expect(
      summary.lastPlaces.map(({ playerId }) => playerId),
    ).toEqual(["earlier-last", "later-last"]);
  });

  it("returns no overlap when nobody captured a menu", () => {
    const summary = aggregateRoomResults([
      player("one", 0, 90),
      player("two", 1, 80),
      player("three", 2, 70),
    ]);

    expect(summary.mostOverlappedMenus).toEqual([]);
    expect(
      summary.standings.map((standing) =>
        standing.capturedMenuSlots.every((slot) => slot === null),
      ),
    ).toEqual([true, true, true]);
  });

  it("does not call a menu captured by only one player an overlap", () => {
    const summary = aggregateRoomResults([
      player("one", 0, 90, ["pizza"]),
      player("two", 1, 80, ["ramyeon"]),
    ]);

    expect(summary.mostOverlappedMenus).toEqual([]);
  });

  it("returns every menu tied for the highest multi-player capture count", () => {
    const summary = aggregateRoomResults([
      player("one", 0, 90, ["pizza", "ramyeon"]),
      player("two", 1, 80, ["pizza", "ramyeon"]),
      player("three", 2, 70, ["sushi"]),
      player("four", 3, 60, ["sushi"]),
    ]);

    expect(summary.mostOverlappedMenus).toEqual([
      {
        menuId: "pizza",
        captureCount: 2,
        playerIds: ["one", "two"],
      },
      {
        menuId: "ramyeon",
        captureCount: 2,
        playerIds: ["one", "two"],
      },
      {
        menuId: "sushi",
        captureCount: 2,
        playerIds: ["three", "four"],
      },
    ]);
  });

  it("does not mutate inputs and freezes the complete aggregate", () => {
    const captures = ["pizza"] as const;
    const input = [
      player("one", 0, 90, captures),
      player("two", 1, 80, ["pizza"]),
    ] as const;

    const summary = aggregateRoomResults(input);

    expect(input[0].capturedMenuIds).toBe(captures);
    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(summary.standings)).toBe(true);
    expect(Object.isFrozen(summary.standings[0])).toBe(true);
    expect(
      Object.isFrozen(summary.standings[0]?.capturedMenuSlots),
    ).toBe(true);
    expect(Object.isFrozen(summary.mostOverlappedMenus[0])).toBe(
      true,
    );
    expect(
      Object.isFrozen(summary.mostOverlappedMenus[0]?.playerIds),
    ).toBe(true);
  });

  it("rejects empty, duplicate-roster, oversized, and over-captured results", () => {
    expect(() => aggregateRoomResults([])).toThrow(
      /At least one player result/,
    );

    expect(() =>
      aggregateRoomResults([
        player("one", 0, 90),
        player("two", 0, 80),
      ]),
    ).toThrow(/Duplicate roster order/);

    expect(() =>
      aggregateRoomResults(
        Array.from({ length: 9 }, (_, index) =>
          player(`player-${index}`, index, 80),
        ),
      ),
    ).toThrow(/At most 8/);

    expect(() =>
      aggregateRoomResults([
        player("one", 0, 90, ["a", "b", "c"]),
      ]),
    ).toThrow(/more than 2/);
  });
});

describe("validateRoomResultSubmission", () => {
  it("normalizes ids and score, preserves empty captures, and freezes the payload", () => {
    const submission = validateRoomResultSubmission({
      playerId: "  player-one  ",
      score: 91.236,
      capturedMenuIds: [],
      completedAt: 1_700_000_000_000,
    });

    expect(submission).toEqual({
      playerId: "player-one",
      score: 91.24,
      capturedMenuIds: [],
      completedAt: 1_700_000_000_000,
    });
    expect(Object.isFrozen(submission)).toBe(true);
    expect(Object.isFrozen(submission.capturedMenuIds)).toBe(true);
  });

  it("normalizes and accepts up to two unique captured menu ids", () => {
    const submission = validateRoomResultSubmission({
      playerId: "player",
      score: 100,
      capturedMenuIds: [" pizza ", "ramyeon"],
      completedAt: 0,
    });

    expect(submission.capturedMenuIds).toEqual(["pizza", "ramyeon"]);
  });

  it.each([
    {
      label: "empty player id",
      input: {
        playerId: " ",
        score: 50,
        capturedMenuIds: [],
        completedAt: 0,
      },
    },
    {
      label: "invalid score",
      input: {
        playerId: "player",
        score: Number.NaN,
        capturedMenuIds: [],
        completedAt: 0,
      },
    },
    {
      label: "invalid captures",
      input: {
        playerId: "player",
        score: 50,
        capturedMenuIds: ["pizza", " pizza "],
        completedAt: 0,
      },
    },
    {
      label: "invalid completion time",
      input: {
        playerId: "player",
        score: 50,
        capturedMenuIds: [],
        completedAt: 1.5,
      },
    },
  ])("rejects $label", ({ input }) => {
    expect(() => validateRoomResultSubmission(input)).toThrow();
  });
});

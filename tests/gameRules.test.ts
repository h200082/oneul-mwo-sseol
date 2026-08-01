import { describe, expect, it } from "vitest";

import {
  calculatePlayerScore,
  canCapture,
  createWeightedMenuDeck,
  getRoundFallDurationMs,
  rankPlayerResults,
  type PlayerResult,
  type RandomSource,
  type RoundAction,
  type RoundResult,
  type WeightedMenu,
} from "../src/domain/gameRules";

describe("getRoundFallDurationMs", () => {
  it("uses a learn, core, and final-sprint pace across 20 rounds", () => {
    expect([0, 4].map(getRoundFallDurationMs)).toEqual([2_600, 2_600]);
    expect([5, 14].map(getRoundFallDurationMs)).toEqual([2_200, 2_200]);
    expect([15, 19].map(getRoundFallDurationMs)).toEqual([1_800, 1_800]);
  });

  it("rejects round indexes outside the fixed deck", () => {
    for (const roundIndex of [-1, 20, 1.5, Number.NaN]) {
      expect(() => getRoundFallDurationMs(roundIndex)).toThrow(RangeError);
    }
  });
});

function makeMenuPool(count = 50): WeightedMenu[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `menu-${String(index + 1).padStart(2, "0")}`,
    weight: (index % 7) + 1,
  }));
}

function seededRng(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function makeRounds(
  actions: readonly RoundAction[],
): RoundResult[] {
  return actions.map((action, roundIndex) => ({
    roundIndex,
    menuId: `menu-${roundIndex + 1}`,
    action,
  }));
}

describe("createWeightedMenuDeck", () => {
  it("draws 20 unique menus from a 50-menu pool without mutating the pool", () => {
    const pool = makeMenuPool();
    const originalIds = pool.map((menu) => menu.id);

    const deck = createWeightedMenuDeck(pool, { rng: seededRng(42) });

    expect(deck).toHaveLength(20);
    expect(new Set(deck.map((menu) => menu.id)).size).toBe(20);
    expect(pool.map((menu) => menu.id)).toEqual(originalIds);
  });

  it("produces the same weighted deck when given the same RNG sequence", () => {
    const pool = makeMenuPool();

    const first = createWeightedMenuDeck(pool, {
      rng: seededRng(2_026_0727),
    });
    const second = createWeightedMenuDeck(pool, {
      rng: seededRng(2_026_0727),
    });

    expect(first.map((menu) => menu.id)).toEqual(
      second.map((menu) => menu.id),
    );
  });

  it("uses weights when resolving a deterministic roulette-wheel draw", () => {
    const pool = [
      { id: "light-a", weight: 1 },
      { id: "heavy", weight: 8 },
      { id: "light-b", weight: 1 },
    ];

    const deck = createWeightedMenuDeck(pool, {
      size: 1,
      rng: () => 0.5,
    });

    expect(deck[0]?.id).toBe("heavy");
  });

  it("rejects duplicate ids, invalid weights, and out-of-range RNG values", () => {
    expect(() =>
      createWeightedMenuDeck(
        [
          { id: "same", weight: 1 },
          { id: "same", weight: 2 },
        ],
        { size: 1 },
      ),
    ).toThrow(/Duplicate menu id/);

    expect(() =>
      createWeightedMenuDeck([{ id: "menu", weight: 0 }], { size: 1 }),
    ).toThrow(/greater than 0/);

    expect(() =>
      createWeightedMenuDeck([{ id: "menu", weight: 1 }], {
        size: 1,
        rng: () => 1,
      }),
    ).toThrow(/\[0, 1\)/);
  });
});

describe("calculatePlayerScore", () => {
  it("allows both captures to remain unused and divides by 20", () => {
    const rounds = makeRounds(
      Array.from({ length: 20 }, () => ({
        type: "slice" as const,
        accuracy: 80,
      })),
    );

    const summary = calculatePlayerScore(rounds);

    expect(summary).toEqual({
      score: 80,
      accuracyTotal: 1_600,
      denominator: 20,
      captureCount: 0,
      capturedMenuIds: [],
      sliceCount: 20,
      missCount: 0,
      totalRoundCount: 20,
    });
    expect(canCapture(rounds)).toBe(true);
  });

  it("excludes one capture, keeps a miss as zero, and divides by 19", () => {
    const rounds = makeRounds([
      { type: "capture" },
      { type: "miss" },
      ...Array.from({ length: 18 }, () => ({
        type: "slice" as const,
        accuracy: 100,
      })),
    ]);

    const summary = calculatePlayerScore(rounds);

    expect(summary.score).toBe(94.74);
    expect(summary.accuracyTotal).toBe(1_800);
    expect(summary.denominator).toBe(19);
    expect(summary.captureCount).toBe(1);
    expect(summary.capturedMenuIds).toEqual(["menu-1"]);
    expect(summary.missCount).toBe(1);
  });

  it("excludes two captures and divides the remaining score by 18", () => {
    const rounds = makeRounds([
      { type: "capture" },
      { type: "capture" },
      { type: "miss" },
      ...Array.from({ length: 17 }, () => ({
        type: "slice" as const,
        accuracy: 90,
      })),
    ]);

    const summary = calculatePlayerScore(rounds);

    expect(summary.score).toBe(85);
    expect(summary.accuracyTotal).toBe(1_530);
    expect(summary.denominator).toBe(18);
    expect(summary.captureCount).toBe(2);
    expect(summary.capturedMenuIds).toEqual(["menu-1", "menu-2"]);
    expect(canCapture(rounds)).toBe(false);
  });

  it("counts every miss as zero without removing it from the denominator", () => {
    const summary = calculatePlayerScore(
      makeRounds(Array.from({ length: 20 }, () => ({ type: "miss" }))),
    );

    expect(summary.score).toBe(0);
    expect(summary.denominator).toBe(20);
    expect(summary.missCount).toBe(20);
  });

  it("rejects more than two captures", () => {
    const rounds = makeRounds([
      { type: "capture" },
      { type: "capture" },
      { type: "capture" },
      ...Array.from({ length: 17 }, () => ({ type: "miss" as const })),
    ]);

    expect(() => calculatePlayerScore(rounds)).toThrow(/at most 2/);
  });

  it("rejects incomplete, duplicate, or invalid round data", () => {
    expect(() =>
      calculatePlayerScore(makeRounds([{ type: "miss" }])),
    ).toThrow(/exactly 20 rounds/);

    const duplicateIndex = makeRounds(
      Array.from({ length: 20 }, () => ({ type: "miss" as const })),
    );
    duplicateIndex[1] = { ...duplicateIndex[1]!, roundIndex: 0 };
    expect(() => calculatePlayerScore(duplicateIndex)).toThrow(
      /Duplicate round index/,
    );

    const invalidAccuracy = makeRounds([
      { type: "slice", accuracy: 101 },
      ...Array.from({ length: 19 }, () => ({ type: "miss" as const })),
    ]);
    expect(() => calculatePlayerScore(invalidAccuracy)).toThrow(
      /from 0 through 100/,
    );
  });
});

describe("rankPlayerResults", () => {
  const results: PlayerResult[] = [
    {
      playerId: "player-d",
      displayName: "다",
      rosterOrder: 3,
      score: 80,
      capturedMenuIds: [],
    },
    {
      playerId: "player-c",
      displayName: "라",
      rosterOrder: 2,
      score: 90.004,
      capturedMenuIds: ["menu-3"],
    },
    {
      playerId: "player-a",
      displayName: "가",
      rosterOrder: 0,
      score: 95,
      capturedMenuIds: ["menu-1", "menu-2"],
    },
    {
      playerId: "player-b",
      displayName: "나",
      rosterOrder: 1,
      score: 90.003,
      capturedMenuIds: [],
    },
  ];

  it("sorts descending and assigns shared competition ranks", () => {
    const ranked = rankPlayerResults(results);

    expect(ranked.map(({ playerId, score, rank }) => ({
      playerId,
      score,
      rank,
    }))).toEqual([
      { playerId: "player-a", score: 95, rank: 1 },
      { playerId: "player-b", score: 90, rank: 2 },
      { playerId: "player-c", score: 90, rank: 2 },
      { playerId: "player-d", score: 80, rank: 4 },
    ]);
    expect(ranked[1]).toMatchObject({ isTied: true, tieSize: 2 });
    expect(ranked[2]).toMatchObject({ isTied: true, tieSize: 2 });
    expect(ranked[0]).toMatchObject({ isTied: false, tieSize: 1 });
  });

  it("uses roster order only for deterministic display order inside a tie", () => {
    const ranked = rankPlayerResults([
      { ...results[1]!, rosterOrder: 7 },
      { ...results[3]!, rosterOrder: 2 },
    ]);

    expect(ranked.map((result) => result.playerId)).toEqual([
      "player-b",
      "player-c",
    ]);
    expect(ranked.map((result) => result.rank)).toEqual([1, 1]);
  });

  it("does not mutate the source result array", () => {
    const sourceOrder = results.map((result) => result.playerId);

    rankPlayerResults(results);

    expect(results.map((result) => result.playerId)).toEqual(sourceOrder);
  });

  it("rejects duplicate players and invalid result scores", () => {
    expect(() =>
      rankPlayerResults([results[0]!, { ...results[0]! }]),
    ).toThrow(/Duplicate player id/);

    expect(() =>
      rankPlayerResults([{ ...results[0]!, score: Number.NaN }]),
    ).toThrow(/finite score/);
  });
});

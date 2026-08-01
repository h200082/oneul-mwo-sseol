export const MENU_POOL_TARGET_SIZE = 50;
export const DEFAULT_DECK_SIZE = 20;
export const MAX_CAPTURES = 2;
export const MAX_PLAYERS = 8;
export const SCORE_DECIMAL_PLACES = 2;

const ROUND_FALL_DURATION_MS = [2_600, 2_200, 1_800] as const;

/**
 * Returns the fall duration for one round in the fixed 20-menu game.
 *
 * Rounds 1-5 teach the gesture, rounds 6-15 form the core pace, and rounds
 * 16-20 create the final sprint. Keeping this rule pure also guarantees that
 * every client in a multiplayer room experiences the same pacing.
 */
export function getRoundFallDurationMs(roundIndex: number): number {
  if (
    !Number.isInteger(roundIndex) ||
    roundIndex < 0 ||
    roundIndex >= DEFAULT_DECK_SIZE
  ) {
    throw new RangeError(
      `Round index must be an integer from 0 through ${DEFAULT_DECK_SIZE - 1}; received ${roundIndex}.`,
    );
  }

  if (roundIndex < 5) {
    return ROUND_FALL_DURATION_MS[0];
  }
  if (roundIndex < 15) {
    return ROUND_FALL_DURATION_MS[1];
  }
  return ROUND_FALL_DURATION_MS[2];
}

export type RandomSource = () => number;

export interface WeightedMenu {
  id: string;
  weight: number;
}

export interface DeckOptions {
  size?: number;
  rng?: RandomSource;
}

export interface SliceAction {
  type: "slice";
  /**
   * The area-split accuracy as a score from 0 through 100.
   * 100 means a perfect half split.
   */
  accuracy: number;
}

export interface CaptureAction {
  type: "capture";
}

export interface MissAction {
  type: "miss";
}

export type RoundAction = SliceAction | CaptureAction | MissAction;

export interface RoundResult {
  /** Zero-based index in the shared room deck. */
  roundIndex: number;
  menuId: string;
  action: RoundAction;
}

export interface ScoreOptions {
  expectedRoundCount?: number;
}

export interface PlayerScoreSummary {
  score: number;
  accuracyTotal: number;
  denominator: number;
  captureCount: number;
  capturedMenuIds: string[];
  sliceCount: number;
  missCount: number;
  totalRoundCount: number;
}

export interface PlayerResult {
  playerId: string;
  displayName: string;
  /**
   * Stable zero-based position in the room roster.
   * It is used only to produce a deterministic display order inside a tie.
   */
  rosterOrder: number;
  score: number;
  capturedMenuIds: readonly string[];
}

export interface RankedPlayerResult extends PlayerResult {
  rank: number;
  isTied: boolean;
  tieSize: number;
}

/**
 * Selects a weighted deck without replacement.
 *
 * The returned entries are the original menu objects, while the returned array
 * and all sampling state are new. Inject `rng` for deterministic room and test
 * behavior. An RNG value must be in the half-open interval [0, 1).
 */
export function createWeightedMenuDeck<T extends WeightedMenu>(
  pool: readonly T[],
  options: DeckOptions = {},
): T[] {
  const size = options.size ?? DEFAULT_DECK_SIZE;
  const rng = options.rng ?? Math.random;

  assertPositiveInteger(size, "deck size");

  if (pool.length < size) {
    throw new RangeError(
      `Menu pool must contain at least ${size} entries; received ${pool.length}.`,
    );
  }

  const seenIds = new Set<string>();
  for (const menu of pool) {
    if (menu.id.trim().length === 0) {
      throw new TypeError("Every menu must have a non-empty id.");
    }
    if (seenIds.has(menu.id)) {
      throw new Error(`Duplicate menu id: ${menu.id}`);
    }
    seenIds.add(menu.id);

    if (!Number.isFinite(menu.weight) || menu.weight <= 0) {
      throw new RangeError(
        `Menu "${menu.id}" must have a finite weight greater than 0.`,
      );
    }
  }

  const remaining = [...pool];
  const deck: T[] = [];

  while (deck.length < size) {
    const totalWeight = remaining.reduce(
      (sum, menu) => sum + menu.weight,
      0,
    );
    if (!Number.isFinite(totalWeight)) {
      throw new RangeError("The sum of menu weights must be finite.");
    }

    const randomValue = rng();
    if (
      !Number.isFinite(randomValue) ||
      randomValue < 0 ||
      randomValue >= 1
    ) {
      throw new RangeError(
        `Random source must return a finite value in [0, 1); received ${randomValue}.`,
      );
    }

    const target = randomValue * totalWeight;
    let cumulativeWeight = 0;
    let selectedIndex = remaining.length - 1;

    for (let index = 0; index < remaining.length; index += 1) {
      cumulativeWeight += remaining[index]!.weight;
      if (target < cumulativeWeight) {
        selectedIndex = index;
        break;
      }
    }

    const [selected] = remaining.splice(selectedIndex, 1);
    deck.push(selected!);
  }

  return deck;
}

/**
 * Returns whether one more capture can be accepted for the current run.
 * This function intentionally does not require a player to use all captures.
 */
export function canCapture(rounds: readonly RoundResult[]): boolean {
  return (
    rounds.reduce(
      (count, round) => count + (round.action.type === "capture" ? 1 : 0),
      0,
    ) < MAX_CAPTURES
  );
}

/**
 * Calculates the final average from non-captured rounds.
 *
 * With the default 20-round game, the denominator is therefore 20, 19, or 18.
 * A miss contributes zero but remains in that denominator. A capture contributes
 * neither accuracy nor a denominator entry.
 */
export function calculatePlayerScore(
  rounds: readonly RoundResult[],
  options: ScoreOptions = {},
): PlayerScoreSummary {
  const expectedRoundCount =
    options.expectedRoundCount ?? DEFAULT_DECK_SIZE;
  assertPositiveInteger(expectedRoundCount, "expected round count");

  if (rounds.length !== expectedRoundCount) {
    throw new Error(
      `A final score requires exactly ${expectedRoundCount} rounds; received ${rounds.length}.`,
    );
  }

  const seenRoundIndexes = new Set<number>();
  const seenMenuIds = new Set<string>();
  const capturedMenuIds: string[] = [];
  let accuracyTotal = 0;
  let sliceCount = 0;
  let missCount = 0;

  for (const round of rounds) {
    validateRoundIdentity(
      round,
      expectedRoundCount,
      seenRoundIndexes,
      seenMenuIds,
    );

    switch (round.action.type) {
      case "slice": {
        const { accuracy } = round.action;
        if (
          !Number.isFinite(accuracy) ||
          accuracy < 0 ||
          accuracy > 100
        ) {
          throw new RangeError(
            `Slice accuracy must be a finite number from 0 through 100; received ${accuracy}.`,
          );
        }
        accuracyTotal += accuracy;
        sliceCount += 1;
        break;
      }
      case "capture":
        capturedMenuIds.push(round.menuId);
        if (capturedMenuIds.length > MAX_CAPTURES) {
          throw new Error(
            `A player may capture at most ${MAX_CAPTURES} menus.`,
          );
        }
        break;
      case "miss":
        missCount += 1;
        break;
      default:
        assertNever(round.action);
    }
  }

  const denominator = expectedRoundCount - capturedMenuIds.length;
  if (denominator <= 0) {
    throw new Error("A score must contain at least one non-captured round.");
  }

  return {
    score: roundScore(accuracyTotal / denominator),
    accuracyTotal: roundScore(accuracyTotal),
    denominator,
    captureCount: capturedMenuIds.length,
    capturedMenuIds,
    sliceCount,
    missCount,
    totalRoundCount: expectedRoundCount,
  };
}

/**
 * Sorts results by score and assigns standard competition ranks.
 *
 * Ties are based on the same two-decimal score shown to players. Tied entries
 * keep the same rank, so scores [100, 90, 90, 80] yield ranks [1, 2, 2, 4].
 * Roster order and then player id only stabilize display order; they never break
 * a gameplay tie.
 */
export function rankPlayerResults(
  results: readonly PlayerResult[],
): RankedPlayerResult[] {
  if (results.length > MAX_PLAYERS) {
    throw new RangeError(
      `At most ${MAX_PLAYERS} player results can be ranked.`,
    );
  }

  const seenPlayerIds = new Set<string>();
  const normalized = results.map((result) => {
    validatePlayerResult(result, seenPlayerIds);
    return {
      ...result,
      score: roundScore(result.score),
      capturedMenuIds: [...result.capturedMenuIds],
    };
  });

  normalized.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    if (left.rosterOrder !== right.rosterOrder) {
      return left.rosterOrder - right.rosterOrder;
    }
    return compareText(left.playerId, right.playerId);
  });

  const tieSizes = new Map<number, number>();
  for (const result of normalized) {
    tieSizes.set(result.score, (tieSizes.get(result.score) ?? 0) + 1);
  }

  let previousScore: number | undefined;
  let currentRank = 0;

  return normalized.map((result, index) => {
    if (previousScore === undefined || previousScore !== result.score) {
      currentRank = index + 1;
      previousScore = result.score;
    }
    const tieSize = tieSizes.get(result.score) ?? 1;

    return {
      ...result,
      rank: currentRank,
      tieSize,
      isTied: tieSize > 1,
    };
  });
}

function validateRoundIdentity(
  round: RoundResult,
  expectedRoundCount: number,
  seenRoundIndexes: Set<number>,
  seenMenuIds: Set<string>,
): void {
  if (
    !Number.isInteger(round.roundIndex) ||
    round.roundIndex < 0 ||
    round.roundIndex >= expectedRoundCount
  ) {
    throw new RangeError(
      `Round index must be an integer from 0 through ${expectedRoundCount - 1}; received ${round.roundIndex}.`,
    );
  }
  if (seenRoundIndexes.has(round.roundIndex)) {
    throw new Error(`Duplicate round index: ${round.roundIndex}`);
  }
  seenRoundIndexes.add(round.roundIndex);

  if (round.menuId.trim().length === 0) {
    throw new TypeError("Every round must have a non-empty menu id.");
  }
  if (seenMenuIds.has(round.menuId)) {
    throw new Error(`Duplicate round menu id: ${round.menuId}`);
  }
  seenMenuIds.add(round.menuId);
}

function validatePlayerResult(
  result: PlayerResult,
  seenPlayerIds: Set<string>,
): void {
  if (result.playerId.trim().length === 0) {
    throw new TypeError("Every player result must have a non-empty player id.");
  }
  if (seenPlayerIds.has(result.playerId)) {
    throw new Error(`Duplicate player id: ${result.playerId}`);
  }
  seenPlayerIds.add(result.playerId);

  if (result.displayName.trim().length === 0) {
    throw new TypeError(
      `Player "${result.playerId}" must have a non-empty display name.`,
    );
  }
  if (!Number.isInteger(result.rosterOrder) || result.rosterOrder < 0) {
    throw new RangeError(
      `Player "${result.playerId}" must have a non-negative integer roster order.`,
    );
  }
  if (
    !Number.isFinite(result.score) ||
    result.score < 0 ||
    result.score > 100
  ) {
    throw new RangeError(
      `Player "${result.playerId}" must have a finite score from 0 through 100.`,
    );
  }
  if (result.capturedMenuIds.length > MAX_CAPTURES) {
    throw new Error(
      `Player "${result.playerId}" has more than ${MAX_CAPTURES} captured menus.`,
    );
  }

  const capturedIds = new Set<string>();
  for (const menuId of result.capturedMenuIds) {
    if (menuId.trim().length === 0) {
      throw new TypeError("Captured menu ids must be non-empty.");
    }
    if (capturedIds.has(menuId)) {
      throw new Error(
        `Player "${result.playerId}" has duplicate captured menu id: ${menuId}`,
      );
    }
    capturedIds.add(menuId);
  }
}

function roundScore(value: number): number {
  const factor = 10 ** SCORE_DECIMAL_PLACES;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported round action: ${JSON.stringify(value)}`);
}

import {
  MAX_CAPTURES,
  MAX_PLAYERS,
  SCORE_DECIMAL_PLACES,
  rankPlayerResults,
  type PlayerResult,
} from "./gameRules";

export type CapturedMenuSlots = readonly [
  string | null,
  string | null,
];

/**
 * One row in the shared result screen.
 *
 * `rank` uses standard competition ranking. Scores that are equal after the
 * game's two-decimal normalization share a rank, while immutable room roster
 * order determines only their display order inside that tie.
 */
export interface RoomResultStanding {
  readonly rank: number;
  readonly playerId: string;
  readonly displayName: string;
  readonly rosterOrder: number;
  readonly score: number;
  readonly capturedMenuIds: readonly string[];
  readonly capturedMenuSlots: CapturedMenuSlots;
  readonly isScoreTied: boolean;
  readonly scoreTieSize: number;
}

/**
 * A menu captured by the highest number of distinct players.
 *
 * Menus captured by only one player are not overlaps and are omitted. When
 * several menus share the highest capture count, every one is returned.
 */
export interface MostOverlappedMenu {
  readonly menuId: string;
  readonly captureCount: number;
  readonly playerIds: readonly string[];
}

export interface RoomResultSubmission {
  readonly playerId: string;
  readonly score: number;
  readonly capturedMenuIds: readonly string[];
  readonly completedAt: number;
}

export interface RoomResultsSummary {
  readonly standings: readonly RoomResultStanding[];
  readonly winners: readonly RoomResultStanding[];
  readonly lastPlaces: readonly RoomResultStanding[];
  readonly mostOverlappedMenus: readonly MostOverlappedMenu[];
}

interface MutableMenuCapture {
  readonly menuId: string;
  readonly firstSeenOrder: number;
  readonly playerIds: string[];
}

/**
 * Normalizes and freezes the minimum result payload shared by a room gateway.
 */
export function validateRoomResultSubmission(
  submission: RoomResultSubmission,
): Readonly<RoomResultSubmission> {
  const playerId = submission.playerId.trim();
  if (playerId.length === 0) {
    throw new TypeError(
      "A room result submission must have a non-empty player id.",
    );
  }

  if (
    !Number.isFinite(submission.score) ||
    submission.score < 0 ||
    submission.score > 100
  ) {
    throw new RangeError(
      "A room result score must be a finite number from 0 through 100.",
    );
  }

  if (submission.capturedMenuIds.length > MAX_CAPTURES) {
    throw new RangeError(
      `A room result may contain at most ${MAX_CAPTURES} captured menus.`,
    );
  }

  const seenMenuIds = new Set<string>();
  const capturedMenuIds = submission.capturedMenuIds.map((value) => {
    const menuId = value.trim();
    if (menuId.length === 0) {
      throw new TypeError("Captured menu ids must be non-empty.");
    }
    if (seenMenuIds.has(menuId)) {
      throw new Error(`Duplicate captured menu id: ${menuId}`);
    }
    seenMenuIds.add(menuId);
    return menuId;
  });

  if (
    !Number.isFinite(submission.completedAt) ||
    !Number.isInteger(submission.completedAt) ||
    submission.completedAt < 0
  ) {
    throw new RangeError(
      "A room result completion time must be a non-negative finite integer.",
    );
  }

  const factor = 10 ** SCORE_DECIMAL_PLACES;
  const score =
    Math.round((submission.score + Number.EPSILON) * factor) / factor;

  return Object.freeze({
    playerId,
    score,
    capturedMenuIds: Object.freeze(capturedMenuIds),
    completedAt: submission.completedAt,
  });
}

/**
 * Builds all data needed by the shared multiplayer result screen.
 *
 * The function never mutates its inputs. Its return value, nested arrays, and
 * nested records are frozen so adapters can safely share one aggregate across
 * subscribers.
 */
export function aggregateRoomResults(
  playerResults: readonly PlayerResult[],
): Readonly<RoomResultsSummary> {
  if (playerResults.length === 0) {
    throw new RangeError("At least one player result is required.");
  }
  if (playerResults.length > MAX_PLAYERS) {
    throw new RangeError(
      `At most ${MAX_PLAYERS} player results can be aggregated.`,
    );
  }

  assertUniqueRosterOrders(playerResults);

  const ranked = rankPlayerResults(playerResults);
  const standings = Object.freeze(
    ranked.map((result) => {
      const capturedMenuIds = Object.freeze([
        ...result.capturedMenuIds,
      ]);
      const capturedMenuSlots = freezeCaptureSlots(capturedMenuIds);

      return Object.freeze({
        rank: result.rank,
        playerId: result.playerId,
        displayName: result.displayName,
        rosterOrder: result.rosterOrder,
        score: result.score,
        capturedMenuIds,
        capturedMenuSlots,
        isScoreTied: result.isTied,
        scoreTieSize: result.tieSize,
      });
    }),
  );

  const highestScore = standings[0]!.score;
  const lowestScore = standings[standings.length - 1]!.score;
  const winners = Object.freeze(
    standings.filter((standing) => standing.score === highestScore),
  );
  const lastPlaces = Object.freeze(
    standings.filter((standing) => standing.score === lowestScore),
  );
  const mostOverlappedMenus =
    aggregateMostOverlappedMenus(standings);

  return Object.freeze({
    standings,
    winners,
    lastPlaces,
    mostOverlappedMenus,
  });
}

function aggregateMostOverlappedMenus(
  standings: readonly RoomResultStanding[],
): readonly MostOverlappedMenu[] {
  const capturesByMenu = new Map<string, MutableMenuCapture>();
  const rosterOrder = [...standings].sort(compareByRosterOrder);
  let firstSeenOrder = 0;

  for (const player of rosterOrder) {
    for (const menuId of player.capturedMenuIds) {
      const existing = capturesByMenu.get(menuId);
      if (existing) {
        existing.playerIds.push(player.playerId);
      } else {
        capturesByMenu.set(menuId, {
          menuId,
          firstSeenOrder,
          playerIds: [player.playerId],
        });
        firstSeenOrder += 1;
      }
    }
  }

  let highestOverlapCount = 1;
  for (const capture of capturesByMenu.values()) {
    highestOverlapCount = Math.max(
      highestOverlapCount,
      capture.playerIds.length,
    );
  }

  if (highestOverlapCount < 2) {
    return Object.freeze([]);
  }

  return Object.freeze(
    [...capturesByMenu.values()]
      .filter(
        (capture) =>
          capture.playerIds.length === highestOverlapCount,
      )
      .sort(
        (left, right) =>
          left.firstSeenOrder - right.firstSeenOrder ||
          compareText(left.menuId, right.menuId),
      )
      .map((capture) =>
        Object.freeze({
          menuId: capture.menuId,
          captureCount: capture.playerIds.length,
          playerIds: Object.freeze([...capture.playerIds]),
        }),
      ),
  );
}

function freezeCaptureSlots(
  capturedMenuIds: readonly string[],
): CapturedMenuSlots {
  return Object.freeze([
    capturedMenuIds[0] ?? null,
    capturedMenuIds[1] ?? null,
  ]);
}

function assertUniqueRosterOrders(
  playerResults: readonly PlayerResult[],
): void {
  const seenRosterOrders = new Set<number>();

  for (const result of playerResults) {
    if (seenRosterOrders.has(result.rosterOrder)) {
      throw new Error(
        `Duplicate roster order: ${result.rosterOrder}`,
      );
    }
    seenRosterOrders.add(result.rosterOrder);
  }
}

function compareByRosterOrder(
  left: RoomResultStanding,
  right: RoomResultStanding,
): number {
  return (
    left.rosterOrder - right.rosterOrder ||
    compareText(left.playerId, right.playerId)
  );
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

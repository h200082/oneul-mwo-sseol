import type {
  MealTime,
  RoomDeckSeed,
} from '../domain/room'
import type { PlayerScoreSummary } from '../domain/gameRules'
import type { RoomGameProgressIdentity } from './gameProgress'

export interface GameLaunchOptions {
  readonly mode: 'solo' | 'room'
  readonly mealTime: MealTime
  readonly deckSeed: RoomDeckSeed
  readonly roomCode?: string
  /** Present only for a resumable multiplayer run. */
  readonly progressIdentity?: Readonly<RoomGameProgressIdentity>
}

/**
 * Serializable result produced once for a launched game session.
 *
 * `score` is the final average of all non-captured rounds. Captures are copied
 * into a new array so callers can safely persist the payload after the scene
 * has been destroyed.
 */
export interface PlayerGameResult {
  readonly mode: GameLaunchOptions['mode']
  readonly mealTime: MealTime
  readonly deckSeed: RoomDeckSeed
  readonly roomCode?: string
  readonly score: number
  readonly capturedMenuIds: readonly string[]
  /** Unix timestamp in milliseconds. */
  readonly completedAt: number
}

export type PlayerGameResultHandler = (
  result: Readonly<PlayerGameResult>,
) => void

type GameScoreResult = Pick<
  PlayerScoreSummary,
  'score' | 'capturedMenuIds'
>

export function createPlayerGameResult(
  options: GameLaunchOptions,
  summary: GameScoreResult,
  completedAt: number,
): Readonly<PlayerGameResult> {
  const baseResult = {
    mode: options.mode,
    mealTime: options.mealTime,
    deckSeed: options.deckSeed,
    score: summary.score,
    capturedMenuIds: Object.freeze([...summary.capturedMenuIds]),
    completedAt,
  }

  return Object.freeze(
    options.roomCode === undefined
      ? baseResult
      : { ...baseResult, roomCode: options.roomCode },
  )
}

/**
 * Creates a one-shot reporter for one completed run. A Phaser scene creates a
 * fresh reporter for each retry, allowing the new run to publish one result
 * while duplicate completion signals from the same run remain ignored. The
 * flag is set before user code so a throwing handler cannot be retried.
 */
export function createPlayerGameResultReporter(
  options: GameLaunchOptions,
  handler?: PlayerGameResultHandler,
  now: () => number = Date.now,
): (summary: GameScoreResult) => void {
  let hasReported = false

  return (summary) => {
    if (hasReported || !handler) {
      return
    }

    hasReported = true
    handler(createPlayerGameResult(options, summary, now()))
  }
}

export const DEFAULT_GAME_LAUNCH_OPTIONS: GameLaunchOptions =
  Object.freeze({
    mode: 'solo',
    mealTime: 'lunch',
    deckSeed: 'prototype-lunch-v1',
  })

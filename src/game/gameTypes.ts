import type {
  MealTime,
  RoomDeckSeed,
} from '../domain/room'
import type { PlayerScoreSummary } from '../domain/gameRules'
import type { RoomGameProgressIdentity } from './gameProgress'
import type { SliceToolId } from './sliceTools'

export const TUTORIAL_COMPLETE_EVENT = 'tutorial-complete' as const

export interface GameLaunchOptions {
  readonly mode: 'solo' | 'room'
  /** Omitted for a normal scoring game. Tutorial runs only two practice foods. */
  readonly launchMode?: 'game' | 'tutorial'
  readonly mealTime: MealTime
  readonly deckSeed: RoomDeckSeed
  /** Cosmetic slice trail selected on this device. */
  readonly sliceTool?: SliceToolId
  /** Best score stored on this device before this solo run starts. */
  readonly previousPersonalBestScore?: number
  readonly roomCode?: string
  /** Present only for a resumable multiplayer run. */
  readonly progressIdentity?: Readonly<RoomGameProgressIdentity>
}

export interface PersonalBestPresentation {
  readonly bestScore: number
  readonly status: 'first' | 'new' | 'existing'
}

export function resolvePersonalBestPresentation(
  currentScore: number,
  previousPersonalBestScore?: number,
): Readonly<PersonalBestPresentation> {
  const hasPreviousPersonalBest =
    previousPersonalBestScore !== undefined &&
    Number.isFinite(previousPersonalBestScore) &&
    previousPersonalBestScore >= 0 &&
    previousPersonalBestScore <= 100

  if (!hasPreviousPersonalBest) {
    return Object.freeze({
      bestScore: currentScore,
      status: 'first' as const,
    })
  }

  const previousScore = previousPersonalBestScore
  const isNewPersonalBest = currentScore > previousScore
  return Object.freeze({
    bestScore: isNewPersonalBest ? currentScore : previousScore,
    status: isNewPersonalBest ? ('new' as const) : ('existing' as const),
  })
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
    if (
      options.launchMode === 'tutorial' ||
      hasReported ||
      !handler
    ) {
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

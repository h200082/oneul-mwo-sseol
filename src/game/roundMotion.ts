import { DEFAULT_DECK_SIZE } from '../domain/gameRules'
import type { GameLaunchOptions } from './gameTypes'

export type RoundRotationDirection = -1 | 1

export interface RoundMotion {
  readonly turns: 0 | 0.5 | 0.75 | 1
  readonly direction: RoundRotationDirection
  readonly targetAngleDegrees: number
}

export interface RoundHorizontalMotion {
  readonly amplitude: 0 | 32 | 46
  readonly cycles: 0 | 1 | 1.5
  readonly direction: RoundRotationDirection
}

export type RoundMotionSeed = GameLaunchOptions['deckSeed']

/** Returns the fixed rotation difficulty for one zero-based round. */
export function getRoundRotationTurns(
  roundIndex: number,
): RoundMotion['turns'] {
  assertRoundIndex(roundIndex)

  if (roundIndex < 5) return 0
  if (roundIndex < 10) return 0.5
  if (roundIndex < 15) return 0.75
  return 1
}

/**
 * Picks a stable clockwise/counter-clockwise direction from only the shared
 * deck seed and round index. It never reads from or advances the deck RNG.
 */
export function getRoundRotationDirection(
  deckSeed: RoundMotionSeed,
  roundIndex: number,
): RoundRotationDirection {
  return getSeededDirection(deckSeed, roundIndex, 0x9e37_79b1)
}

/** Returns the deterministic side-to-side motion for the final two rounds. */
export function getRoundHorizontalMotion(
  deckSeed: RoundMotionSeed,
  roundIndex: number,
): Readonly<RoundHorizontalMotion> {
  assertRoundIndex(roundIndex)
  const direction = getSeededDirection(
    deckSeed,
    roundIndex,
    0x7f4a_7c15,
  )

  if (roundIndex === 18) {
    return { amplitude: 32, cycles: 1, direction }
  }
  if (roundIndex === 19) {
    return { amplitude: 46, cycles: 1.5, direction }
  }
  return { amplitude: 0, cycles: 0, direction }
}

function getSeededDirection(
  deckSeed: RoundMotionSeed,
  roundIndex: number,
  roundSalt: number,
): RoundRotationDirection {
  assertRoundIndex(roundIndex)
  const seedHash = hashSeed(deckSeed)
  let value = seedHash ^ Math.imul(roundIndex + 1, roundSalt)
  value ^= value >>> 16
  value = Math.imul(value, 0x85eb_ca6b)
  value ^= value >>> 13
  value = Math.imul(value, 0xc2b2_ae35)
  value ^= value >>> 16
  return (value >>> 0) % 2 === 0 ? -1 : 1
}

/** Returns all deterministic rotation values needed to animate one round. */
export function getRoundRotationMotion(
  deckSeed: RoundMotionSeed,
  roundIndex: number,
): Readonly<RoundMotion> {
  const turns = getRoundRotationTurns(roundIndex)
  const direction = getRoundRotationDirection(deckSeed, roundIndex)
  return {
    turns,
    direction,
    targetAngleDegrees: turns === 0 ? 0 : turns * 360 * direction,
  }
}

/** Backward-compatible concise alias for callers that already use it. */
export const getRoundMotion = getRoundRotationMotion

function hashSeed(deckSeed: RoundMotionSeed): number {
  if (typeof deckSeed === 'number') {
    if (!Number.isFinite(deckSeed)) {
      throw new RangeError('A numeric round-motion seed must be finite.')
    }
    return Math.trunc(deckSeed) >>> 0
  }

  if (typeof deckSeed !== 'string') {
    throw new TypeError(
      'A round-motion seed must be a finite number or a non-empty string.',
    )
  }

  const normalized = deckSeed.normalize('NFKC').trim()
  if (normalized.length === 0) {
    throw new TypeError('A string round-motion seed must not be empty.')
  }

  let hash = 0x811c_9dc5
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 0x0100_0193)
  }
  return hash >>> 0
}

function assertRoundIndex(roundIndex: number): void {
  if (
    !Number.isInteger(roundIndex) ||
    roundIndex < 0 ||
    roundIndex >= DEFAULT_DECK_SIZE
  ) {
    throw new RangeError(
      `Round index must be an integer from 0 through ${DEFAULT_DECK_SIZE - 1}; received ${roundIndex}.`,
    )
  }
}

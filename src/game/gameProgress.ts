import type { RoundAction, RoundResult } from '../domain/gameRules'
import {
  DEFAULT_DECK_SIZE,
  MAX_CAPTURES,
} from '../domain/gameRules'
import type { RoomDeckSeed } from '../domain/room'

const STORAGE_PREFIX = 'oneul-mwo-sseol-room-progress:'
const PROGRESS_VERSION = 1
const MAX_SERIALIZED_PROGRESS_LENGTH = 32_768

export interface RoomGameProgressIdentity {
  readonly playerId: string
  readonly roomCode: string
  readonly gameStartId: string
}

interface StoredRoomGameProgressV1 {
  readonly version: typeof PROGRESS_VERSION
  readonly playerId: string
  readonly roomCode: string
  readonly gameStartId: string
  readonly savedAt: number
  readonly rounds: readonly RoundResult[]
}

/**
 * Builds an identity that cannot collide when a room code or deck seed is
 * reused. JSON preserves the distinction between numeric and string seeds.
 */
export function createRoomGameProgressIdentity(
  playerId: string,
  roomCode: string,
  startAt: number,
  deckSeed: RoomDeckSeed,
): Readonly<RoomGameProgressIdentity> {
  assertNonEmptyString(playerId, 'player id')
  assertNonEmptyString(roomCode, 'room code')
  if (!Number.isSafeInteger(startAt) || startAt < 0) {
    throw new RangeError('Room start time must be a non-negative safe integer.')
  }
  if (
    (typeof deckSeed !== 'string' && typeof deckSeed !== 'number') ||
    (typeof deckSeed === 'string' && deckSeed.length === 0) ||
    (typeof deckSeed === 'number' && !Number.isFinite(deckSeed))
  ) {
    throw new TypeError('Room deck seed must be a non-empty string or finite number.')
  }

  return Object.freeze({
    playerId,
    roomCode,
    gameStartId: JSON.stringify([startAt, deckSeed]),
  })
}

/**
 * Versioned, defensive persistence for completed multiplayer rounds.
 *
 * Invalid or unsupported records are removed and treated as an empty run, so
 * unavailable/private storage and user-edited data can never prevent play.
 */
export class RoomGameProgressStore {
  constructor(
    private readonly storage: Storage,
    private readonly now: () => number = Date.now,
  ) {}

  load(
    identity: Readonly<RoomGameProgressIdentity>,
    deckMenuIds: readonly string[],
  ): readonly RoundResult[] {
    const key = progressStorageKey(identity)
    let raw: string | null
    try {
      raw = this.storage.getItem(key)
    } catch {
      return []
    }

    if (raw === null) {
      return []
    }

    if (raw.length > MAX_SERIALIZED_PROGRESS_LENGTH) {
      this.removeKey(key)
      return []
    }

    try {
      const parsed: unknown = JSON.parse(raw)
      const rounds = parseStoredProgress(parsed, identity, deckMenuIds)
      if (!rounds) {
        this.removeKey(key)
        return []
      }
      return rounds
    } catch {
      this.removeKey(key)
      return []
    }
  }

  save(
    identity: Readonly<RoomGameProgressIdentity>,
    rounds: readonly RoundResult[],
    deckMenuIds: readonly string[],
  ): boolean {
    const normalizedRounds = parseRoundSequence(rounds, deckMenuIds)
    if (!normalizedRounds) {
      return false
    }

    const savedAt = this.now()
    if (!Number.isSafeInteger(savedAt) || savedAt < 0) {
      return false
    }

    const record: StoredRoomGameProgressV1 = {
      version: PROGRESS_VERSION,
      playerId: identity.playerId,
      roomCode: identity.roomCode,
      gameStartId: identity.gameStartId,
      savedAt,
      rounds: normalizedRounds,
    }

    try {
      this.storage.setItem(progressStorageKey(identity), JSON.stringify(record))
      return true
    } catch {
      return false
    }
  }

  clear(identity: Readonly<RoomGameProgressIdentity>): void {
    this.removeKey(progressStorageKey(identity))
  }

  clearForPlayer(playerId: string): void {
    this.clearForPlayerExcept(playerId, null)
  }

  clearForPlayerExcept(
    playerId: string,
    keptIdentity: Readonly<RoomGameProgressIdentity> | null,
  ): void {
    const playerPrefix = `${STORAGE_PREFIX}${encodeURIComponent(playerId)}:`
    const keptKey = keptIdentity ? progressStorageKey(keptIdentity) : null
    const keys: string[] = []

    try {
      for (let index = 0; index < this.storage.length; index += 1) {
        const key = this.storage.key(index)
        if (key?.startsWith(playerPrefix) && key !== keptKey) {
          keys.push(key)
        }
      }
    } catch {
      return
    }

    for (const key of keys) {
      this.removeKey(key)
    }
  }

  private removeKey(key: string): void {
    try {
      this.storage.removeItem(key)
    } catch {
      // Storage can be unavailable in private/restricted browser contexts.
    }
  }
}

function progressStorageKey(
  identity: Readonly<RoomGameProgressIdentity>,
): string {
  return (
    `${STORAGE_PREFIX}${encodeURIComponent(identity.playerId)}:` +
    `${encodeURIComponent(identity.roomCode)}:` +
    encodeURIComponent(identity.gameStartId)
  )
}

function parseStoredProgress(
  value: unknown,
  identity: Readonly<RoomGameProgressIdentity>,
  deckMenuIds: readonly string[],
): readonly RoundResult[] | null {
  if (!isRecord(value)) {
    return null
  }
  if (
    value.version !== PROGRESS_VERSION ||
    value.playerId !== identity.playerId ||
    value.roomCode !== identity.roomCode ||
    value.gameStartId !== identity.gameStartId ||
    !Number.isSafeInteger(value.savedAt) ||
    (value.savedAt as number) < 0
  ) {
    return null
  }

  return parseRoundSequence(value.rounds, deckMenuIds)
}

function parseRoundSequence(
  value: unknown,
  deckMenuIds: readonly string[],
): readonly RoundResult[] | null {
  if (
    !Array.isArray(value) ||
    deckMenuIds.length !== DEFAULT_DECK_SIZE ||
    value.length > deckMenuIds.length
  ) {
    return null
  }

  const rounds: RoundResult[] = []
  let captureCount = 0

  for (let index = 0; index < value.length; index += 1) {
    const candidate: unknown = value[index]
    if (!isRecord(candidate)) {
      return null
    }
    const expectedMenuId = deckMenuIds[index]
    if (
      candidate.roundIndex !== index ||
      typeof candidate.menuId !== 'string' ||
      candidate.menuId !== expectedMenuId
    ) {
      return null
    }

    const action = parseRoundAction(candidate.action)
    if (!action) {
      return null
    }
    if (action.type === 'capture') {
      captureCount += 1
      if (captureCount > MAX_CAPTURES) {
        return null
      }
    }

    rounds.push({ roundIndex: index, menuId: candidate.menuId, action })
  }

  return rounds
}

function parseRoundAction(value: unknown): RoundAction | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null
  }
  if (value.type === 'capture') {
    return { type: 'capture' }
  }
  if (value.type === 'miss') {
    return { type: 'miss' }
  }
  if (
    value.type === 'slice' &&
    typeof value.accuracy === 'number' &&
    Number.isFinite(value.accuracy) &&
    value.accuracy >= 0 &&
    value.accuracy <= 100
  ) {
    return { type: 'slice', accuracy: value.accuracy }
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`)
  }
}

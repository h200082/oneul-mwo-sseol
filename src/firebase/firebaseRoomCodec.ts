import {
  MAX_ROOM_PLAYERS,
  ROOM_CODE_ALPHABET,
  createRoom,
  joinRoom,
  startRoom,
  type Room,
  type RoomDeckSeed,
  type RoomRandomSource,
} from '../domain/room'
import { normalizeRoomCode } from '../rooms/roomInvite'

export const FIRESTORE_ROOM_SCHEMA_VERSION = 1

export interface FirestorePlayerValue {
  readonly nickname: string
}

export interface FirestoreStartValue {
  readonly deckSeed: RoomDeckSeed
  readonly contentVersion: string
  readonly startAt: number
  readonly rosterIds: readonly string[]
}

export interface FirestoreRoomValue {
  readonly schemaVersion: typeof FIRESTORE_ROOM_SCHEMA_VERSION
  readonly code: string
  readonly mealTime: 'lunch' | 'dinner'
  readonly status: 'waiting' | 'started'
  readonly hostPlayerId: string
  readonly memberIds: readonly string[]
  readonly players: Readonly<Record<string, FirestorePlayerValue>>
  readonly start: FirestoreStartValue | null
}

export function encodeFirestoreRoom(room: Room): FirestoreRoomValue {
  const memberIds = room.players.map((player) => player.playerId)
  const players = Object.fromEntries(
    room.players.map((player) => [
      player.playerId,
      Object.freeze({ nickname: player.nickname }),
    ]),
  )

  return Object.freeze({
    schemaVersion: FIRESTORE_ROOM_SCHEMA_VERSION,
    code: room.code,
    mealTime: room.mealTime,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    memberIds: Object.freeze(memberIds),
    players: Object.freeze(players),
    start:
      room.status === 'started'
        ? Object.freeze({
            deckSeed: room.start.deckSeed,
            contentVersion: room.start.contentVersion,
            startAt: room.start.startAt,
            rosterIds: Object.freeze(
              room.start.roster.map((player) => player.playerId),
            ),
          })
        : null,
  })
}

export function decodeFirestoreRoom(
  value: unknown,
  expectedCode: string,
): Room {
  const stored = readRoomValue(value)
  const code = normalizeRoomCode(stored.code)
  if (code !== normalizeRoomCode(expectedCode)) {
    throw new Error('Firestore room code does not match its document id.')
  }

  validateMemberIds(stored.memberIds)
  validatePlayers(stored.players, stored.memberIds)
  if (stored.hostPlayerId !== stored.memberIds[0]) {
    throw new Error('Firestore room host must be first in memberIds.')
  }

  const hostId = stored.memberIds[0]!
  const host = stored.players[hostId]!
  let room: Room = createRoom({
    mealTime: stored.mealTime,
    playerId: hostId,
    nickname: host.nickname,
    rng: createCodeRandomSource(code),
  })

  for (const playerId of stored.memberIds.slice(1)) {
    const player = stored.players[playerId]!
    room = joinRoom(room, {
      playerId,
      nickname: player.nickname,
    })
  }

  if (stored.status === 'waiting') {
    if (stored.start !== null) {
      throw new Error('A waiting Firestore room cannot contain start data.')
    }
    return room
  }

  const start = readStartValue(stored.start)
  if (
    start.rosterIds.length !== stored.memberIds.length ||
    start.rosterIds.some(
      (playerId, index) => playerId !== stored.memberIds[index],
    )
  ) {
    throw new Error('Firestore start roster does not match memberIds.')
  }

  return startRoom(room, {
    requesterPlayerId: stored.hostPlayerId,
    deckSeed: start.deckSeed,
    contentVersion: start.contentVersion,
    startAt: start.startAt,
  })
}

function readRoomValue(value: unknown): FirestoreRoomValue {
  if (!isRecord(value)) {
    throw new Error('Firestore room data must be an object.')
  }

  const {
    schemaVersion,
    code,
    mealTime,
    status,
    hostPlayerId,
    memberIds,
    players,
    start,
  } = value

  if (
    schemaVersion !== FIRESTORE_ROOM_SCHEMA_VERSION ||
    typeof code !== 'string' ||
    (mealTime !== 'lunch' && mealTime !== 'dinner') ||
    (status !== 'waiting' && status !== 'started') ||
    typeof hostPlayerId !== 'string' ||
    !Array.isArray(memberIds) ||
    !isRecord(players)
  ) {
    throw new Error('Firestore room data has an invalid shape.')
  }

  return {
    schemaVersion,
    code,
    mealTime,
    status,
    hostPlayerId,
    memberIds: memberIds.map((memberId) => {
      if (typeof memberId !== 'string') {
        throw new Error('Firestore member ids must be strings.')
      }
      return memberId
    }),
    players: Object.fromEntries(
      Object.entries(players).map(([playerId, player]) => [
        playerId,
        readPlayerValue(player),
      ]),
    ),
    start: start === null ? null : readStartValue(start),
  }
}

function readPlayerValue(value: unknown): FirestorePlayerValue {
  if (!isRecord(value) || typeof value.nickname !== 'string') {
    throw new Error('Firestore player data has an invalid shape.')
  }
  return { nickname: value.nickname }
}

function readStartValue(value: unknown): FirestoreStartValue {
  if (!isRecord(value)) {
    throw new Error('A started Firestore room requires start data.')
  }

  const { deckSeed, contentVersion, startAt, rosterIds } = value
  if (
    (typeof deckSeed !== 'string' && typeof deckSeed !== 'number') ||
    typeof contentVersion !== 'string' ||
    typeof startAt !== 'number' ||
    !Array.isArray(rosterIds) ||
    rosterIds.some((playerId) => typeof playerId !== 'string')
  ) {
    throw new Error('Firestore start data has an invalid shape.')
  }

  return {
    deckSeed,
    contentVersion,
    startAt,
    rosterIds: rosterIds as string[],
  }
}

function validateMemberIds(memberIds: readonly string[]): void {
  if (
    memberIds.length === 0 ||
    memberIds.length > MAX_ROOM_PLAYERS ||
    new Set(memberIds).size !== memberIds.length ||
    memberIds.some((playerId) => playerId.trim().length === 0)
  ) {
    throw new Error('Firestore memberIds are invalid.')
  }
}

function validatePlayers(
  players: Readonly<Record<string, FirestorePlayerValue>>,
  memberIds: readonly string[],
): void {
  const playerIds = Object.keys(players)
  if (
    playerIds.length !== memberIds.length ||
    memberIds.some((playerId) => !(playerId in players)) ||
    playerIds.some((playerId) => !memberIds.includes(playerId))
  ) {
    throw new Error('Firestore players must match memberIds.')
  }
}

function createCodeRandomSource(code: string): RoomRandomSource {
  let index = 0

  return () => {
    const character = code[index]
    if (!character) {
      throw new Error('Room-code reconstruction exhausted its input.')
    }
    index += 1

    const alphabetIndex = ROOM_CODE_ALPHABET.indexOf(character)
    if (alphabetIndex < 0) {
      throw new Error('Firestore room code contains an invalid character.')
    }
    return (alphabetIndex + 0.5) / ROOM_CODE_ALPHABET.length
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

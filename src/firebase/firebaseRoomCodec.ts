import {
  MAX_ROOM_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_RESULT_WINDOW_MS,
  acknowledgeRoomReady,
  createRoom,
  finalizeRoomStart,
  joinRoom,
  prepareRoomStart,
  startRoom,
  type Room,
  type RoomDeckSeed,
  type PreparingRoom,
  type StartedRoom,
  type RoomRandomSource,
} from '../domain/room'
import { normalizeRoomCode } from '../rooms/roomInvite'

export const FIRESTORE_ROOM_LATEST_SCHEMA_VERSION = 3
export const FIRESTORE_ROOM_WRITE_SCHEMA_VERSION: 1 | 2 | 3 = 3

export interface FirestorePlayerValue {
  readonly nickname: string
}

export interface FirestoreStartValue {
  readonly startId: string
  readonly deckSeed: RoomDeckSeed
  readonly contentVersion: string
  readonly startAt: number | null
  readonly resultDeadlineAt: number | null
  readonly rosterIds: readonly string[]
  readonly readyPlayerIds: readonly string[]
}

export interface FirestoreRoomValue {
  readonly schemaVersion: 1 | 2 | typeof FIRESTORE_ROOM_LATEST_SCHEMA_VERSION
  readonly code: string
  readonly mealTime: 'lunch' | 'dinner'
  readonly status: 'waiting' | 'preparing' | 'started'
  readonly hostPlayerId: string
  readonly memberIds: readonly string[]
  readonly players: Readonly<Record<string, FirestorePlayerValue>>
  readonly start: FirestoreStartValue | null
}

export function encodeFirestoreRoom(room: Room): FirestoreRoomValue {
  const schemaVersion = FIRESTORE_ROOM_WRITE_SCHEMA_VERSION
  const memberIds = room.players.map((player) => player.playerId)
  const players = Object.fromEntries(
    room.players.map((player) => [
      player.playerId,
      Object.freeze({ nickname: player.nickname }),
    ]),
  )

  return Object.freeze({
    schemaVersion,
    code: room.code,
    mealTime: room.mealTime,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    memberIds: Object.freeze(memberIds),
    players: Object.freeze(players),
    start:
      room.status !== 'waiting'
        ? encodeFirestoreStart(room, schemaVersion)
        : null,
  })
}

function encodeFirestoreStart(
  room: PreparingRoom | StartedRoom,
  _schemaVersion: 1 | 2 | 3,
): Readonly<FirestoreStartValue> {
  const shared = {
    startId: room.start.startId,
    deckSeed: room.start.deckSeed,
    contentVersion: room.start.contentVersion,
    startAt: room.status === 'started' ? room.start.startAt : null,
    resultDeadlineAt:
      room.status === 'started'
        ? room.start.resultDeadlineAt
        : null,
    rosterIds: Object.freeze(
      room.start.roster.map((player) => player.playerId),
    ),
    readyPlayerIds: Object.freeze([...room.start.readyPlayerIds]),
  }
  return Object.freeze(shared)
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

  const start = stored.start
  if (start === null) {
    throw new Error('A started Firestore room requires start data.')
  }
  if (
    start.rosterIds.length !== stored.memberIds.length ||
    start.rosterIds.some(
      (playerId, index) => playerId !== stored.memberIds[index],
    )
  ) {
    throw new Error('Firestore start roster does not match memberIds.')
  }

  if (stored.schemaVersion < 3) {
    if (stored.status !== 'started' || start.startAt === null) {
      throw new Error('Legacy Firestore rooms cannot be preparing.')
    }
    const legacyStarted = startRoom(room, {
      requesterPlayerId: stored.hostPlayerId,
      deckSeed: start.deckSeed,
      contentVersion: start.contentVersion,
      startAt: start.startAt,
    })
    if (
      legacyStarted.start.resultDeadlineAt !==
      start.resultDeadlineAt
    ) {
      throw new Error(
        'Firestore result deadline does not match the shared rule.',
      )
    }
    return legacyStarted
  }

  let prepared: PreparingRoom | StartedRoom = prepareRoomStart(room, {
    requesterPlayerId: stored.hostPlayerId,
    startId: start.startId,
    deckSeed: start.deckSeed,
    contentVersion: start.contentVersion,
  })
  for (const playerId of start.readyPlayerIds) {
    prepared = acknowledgeRoomReady(prepared, {
      playerId,
      startId: start.startId,
    })
  }

  if (stored.status === 'preparing') {
    if (start.startAt !== null || start.resultDeadlineAt !== null) {
      throw new Error(
        'A preparing Firestore room cannot contain finalized timestamps.',
      )
    }
    return prepared
  }
  if (start.startAt === null || start.resultDeadlineAt === null) {
    throw new Error('A started Firestore room requires finalized timestamps.')
  }
  const startedRoom = finalizeRoomStart(prepared, {
    requesterPlayerId: stored.hostPlayerId,
    startId: start.startId,
    startAt: start.startAt,
  })
  if (startedRoom.start.resultDeadlineAt !== start.resultDeadlineAt) {
    throw new Error(
      'Firestore result deadline does not match the shared rule.',
    )
  }
  return startedRoom
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
    (schemaVersion !== 1 &&
      schemaVersion !== 2 &&
      schemaVersion !== FIRESTORE_ROOM_LATEST_SCHEMA_VERSION) ||
    typeof code !== 'string' ||
    (mealTime !== 'lunch' && mealTime !== 'dinner') ||
    (status !== 'waiting' &&
      status !== 'preparing' &&
      status !== 'started') ||
    typeof hostPlayerId !== 'string' ||
    !Array.isArray(memberIds) ||
    !isRecord(players)
  ) {
    throw new Error('Firestore room data has an invalid shape.')
  }
  if (status === 'preparing' && schemaVersion !== 3) {
    throw new Error('Only Firestore schema v3 supports preparing rooms.')
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
    start:
      start === null ? null : readStartValue(start, schemaVersion),
  }
}

function readPlayerValue(value: unknown): FirestorePlayerValue {
  if (!isRecord(value) || typeof value.nickname !== 'string') {
    throw new Error('Firestore player data has an invalid shape.')
  }
  return { nickname: value.nickname }
}

function readStartValue(
  value: unknown,
  schemaVersion: 1 | 2 | 3,
): FirestoreStartValue {
  if (!isRecord(value)) {
    throw new Error('A started Firestore room requires start data.')
  }

  const {
    startId,
    deckSeed,
    contentVersion,
    startAt,
    resultDeadlineAt,
    rosterIds,
    readyPlayerIds,
  } = value
  const validShared =
    (typeof deckSeed !== 'string' && typeof deckSeed !== 'number') ||
    typeof contentVersion !== 'string' ||
    !Array.isArray(rosterIds) ||
    rosterIds.some((playerId) => typeof playerId !== 'string')
  if (validShared) {
    throw new Error('Firestore start data has an invalid shape.')
  }

  if (schemaVersion < 3) {
    if (
      typeof startAt !== 'number' ||
      (resultDeadlineAt !== undefined &&
        typeof resultDeadlineAt !== 'number') ||
      (schemaVersion === 2 && resultDeadlineAt === undefined)
    ) {
      throw new Error('Legacy Firestore start data has an invalid shape.')
    }
    return {
      startId: 'legacy-start',
      deckSeed,
      contentVersion,
      startAt,
      resultDeadlineAt:
        resultDeadlineAt ?? startAt + ROOM_RESULT_WINDOW_MS,
      rosterIds: rosterIds as string[],
      readyPlayerIds: rosterIds as string[],
    }
  }

  if (
    typeof startId !== 'string' ||
    (startAt !== null && typeof startAt !== 'number') ||
    (resultDeadlineAt !== null &&
      typeof resultDeadlineAt !== 'number') ||
    !Array.isArray(readyPlayerIds) ||
    readyPlayerIds.some((playerId) => typeof playerId !== 'string') ||
    new Set(readyPlayerIds).size !== readyPlayerIds.length ||
    readyPlayerIds.some((playerId) => !rosterIds.includes(playerId))
  ) {
    throw new Error('Firestore ready handshake data has an invalid shape.')
  }

  return {
    startId,
    deckSeed,
    contentVersion,
    startAt,
    resultDeadlineAt,
    rosterIds: rosterIds as string[],
    readyPlayerIds: readyPlayerIds as string[],
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

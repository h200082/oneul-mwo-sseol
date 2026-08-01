import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type Firestore,
  type QuerySnapshot,
} from 'firebase/firestore'

import {
  createRoom as createDomainRoom,
  joinRoom as joinDomainRoom,
  leaveRoom as leaveDomainRoom,
  startRoom as startDomainRoom,
  type CreateRoomOptions,
  type Room,
  type RoomRandomSource,
  type StartedRoom,
  type StartRoomOptions,
  type WaitingRoom,
} from '../domain/room'
import {
  validateRoomResultSubmission,
  type RoomResultSubmission,
} from '../domain/roomResults'
import {
  type RoomGateway,
  type RoomErrorListener,
  type RoomListener,
  type RoomResultsErrorListener,
  type RoomResultsListener,
  type RoomUnsubscribe,
} from '../rooms/RoomGateway'
import { normalizeRoomCode } from '../rooms/roomInvite'
import {
  decodeFirestoreRoom,
  encodeFirestoreRoom,
} from './firebaseRoomCodec'

const DEFAULT_CODE_ATTEMPTS = 16

export type FirebaseRoomGatewayErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_CODE_COLLISION'
  | 'PLAYER_IDENTITY_MISMATCH'
  | 'CORRUPT_ROOM_DATA'
  | 'ROOM_NOT_STARTED'
  | 'PLAYER_NOT_IN_ROOM'
  | 'RESULT_ALREADY_SUBMITTED'
  | 'CORRUPT_RESULT_DATA'

export class FirebaseRoomGatewayError extends Error {
  constructor(
    readonly code: FirebaseRoomGatewayErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'FirebaseRoomGatewayError'
  }
}

export interface FirebaseRoomGatewayOptions {
  readonly rng?: RoomRandomSource
  readonly maxCodeAttempts?: number
}

class RoomCodeCollisionError extends Error {}

/**
 * Cross-device RoomGateway backed by Anonymous Auth and Cloud Firestore.
 *
 * Every room mutation uses a transaction. The authenticated uid is also the
 * domain player id so Security Rules can enforce self-join, self-leave, host
 * start, and one immutable result document per participant.
 */
export class FirebaseRoomGateway implements RoomGateway {
  private readonly rng: RoomRandomSource
  private readonly maxCodeAttempts: number
  private readonly activeUnsubscribers = new Set<RoomUnsubscribe>()

  constructor(
    private readonly db: Firestore,
    private readonly authenticatedPlayerId: string,
    options: FirebaseRoomGatewayOptions = {},
  ) {
    this.rng = options.rng ?? Math.random
    this.maxCodeAttempts =
      options.maxCodeAttempts ?? DEFAULT_CODE_ATTEMPTS

    if (
      !Number.isInteger(this.maxCodeAttempts) ||
      this.maxCodeAttempts <= 0
    ) {
      throw new RangeError('maxCodeAttempts must be a positive integer.')
    }
  }

  async create(options: CreateRoomOptions): Promise<WaitingRoom> {
    this.assertPlayerIdentity(options.playerId)
    const rng = options.rng ?? this.rng

    for (
      let attempt = 0;
      attempt < this.maxCodeAttempts;
      attempt += 1
    ) {
      const room = createDomainRoom({ ...options, rng })
      const roomRef = this.roomRef(room.code)

      try {
        await runTransaction(this.db, async (transaction) => {
          const snapshot = await transaction.get(roomRef)
          if (snapshot.exists()) {
            throw new RoomCodeCollisionError()
          }

          transaction.set(roomRef, {
            ...encodeRoomForFirestore(room),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        })
        return room
      } catch (error) {
        if (error instanceof RoomCodeCollisionError) {
          continue
        }
        throw error
      }
    }

    throw new FirebaseRoomGatewayError(
      'ROOM_CODE_COLLISION',
      `고유한 방 코드를 ${this.maxCodeAttempts}회 안에 만들지 못했습니다.`,
    )
  }

  async join(
    roomCode: string,
    player: {
      readonly playerId: string
      readonly nickname: string
    },
  ): Promise<WaitingRoom> {
    this.assertPlayerIdentity(player.playerId)
    return this.updateWaitingRoom(roomCode, (room) =>
      joinDomainRoom(room, player),
    )
  }

  async get(roomCode: string): Promise<Room | null> {
    const code = normalizeRoomCode(roomCode)
    const snapshot = await getDoc(this.roomRef(code))
    return snapshot.exists()
      ? decodeRoomSnapshot(snapshot.data(), code)
      : null
  }

  async leave(
    roomCode: string,
    playerId: string,
  ): Promise<WaitingRoom | null> {
    this.assertPlayerIdentity(playerId)
    const code = normalizeRoomCode(roomCode)
    const roomRef = this.roomRef(code)

    return runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(roomRef)
      const room = requireRoomSnapshot(snapshot.data(), snapshot.exists(), code)
      const updated = leaveDomainRoom(room, playerId)

      if (!updated) {
        transaction.delete(roomRef)
        return null
      }

      transaction.set(roomRef, {
        ...encodeRoomForFirestore(updated),
        createdAt: readCreatedAt(snapshot.data()),
        updatedAt: serverTimestamp(),
      })
      return updated
    })
  }

  async subscribe(
    roomCode: string,
    listener: RoomListener,
    onError?: RoomErrorListener,
  ): Promise<RoomUnsubscribe> {
    const code = normalizeRoomCode(roomCode)
    return this.trackUnsubscriber(
      onSnapshot(
        this.roomRef(code),
        (snapshot) => {
          try {
            if (!snapshot.exists()) {
              listener(null)
              return
            }
            listener(decodeRoomSnapshot(snapshot.data(), code))
          } catch (error) {
            onError?.(error)
          }
        },
        (error) => onError?.(error),
      ),
    )
  }

  async start(
    roomCode: string,
    options: StartRoomOptions,
  ): Promise<StartedRoom> {
    this.assertPlayerIdentity(options.requesterPlayerId)
    const code = normalizeRoomCode(roomCode)
    const roomRef = this.roomRef(code)

    return runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(roomRef)
      const room = requireRoomSnapshot(snapshot.data(), snapshot.exists(), code)
      const updated = startDomainRoom(room, options)

      transaction.set(roomRef, {
        ...encodeRoomForFirestore(updated),
        createdAt: readCreatedAt(snapshot.data()),
        updatedAt: serverTimestamp(),
      })
      return updated
    })
  }

  async submitResult(
    roomCode: string,
    submission: RoomResultSubmission,
  ): Promise<readonly RoomResultSubmission[]> {
    const normalized = validateRoomResultSubmission(submission)
    this.assertPlayerIdentity(normalized.playerId)
    const code = normalizeRoomCode(roomCode)
    const roomRef = this.roomRef(code)
    const resultRef = doc(
      this.db,
      'rooms',
      code,
      'results',
      this.authenticatedPlayerId,
    )

    await runTransaction(this.db, async (transaction) => {
      const roomSnapshot = await transaction.get(roomRef)
      const resultSnapshot = await transaction.get(resultRef)
      const room = requireRoomSnapshot(
        roomSnapshot.data(),
        roomSnapshot.exists(),
        code,
      )

      if (room.status !== 'started') {
        throw new FirebaseRoomGatewayError(
          'ROOM_NOT_STARTED',
          '시작된 방에서만 결과를 제출할 수 있습니다.',
        )
      }
      if (
        !room.start.roster.some(
          (player) => player.playerId === normalized.playerId,
        )
      ) {
        throw new FirebaseRoomGatewayError(
          'PLAYER_NOT_IN_ROOM',
          '잠긴 참가 명단에 없는 플레이어입니다.',
        )
      }

      if (resultSnapshot.exists()) {
        const existing = decodeResultDocument(resultSnapshot.data())
        if (sameResult(existing, normalized)) {
          return
        }
        throw new FirebaseRoomGatewayError(
          'RESULT_ALREADY_SUBMITTED',
          '이미 확정된 결과는 변경할 수 없습니다.',
        )
      }

      transaction.set(resultRef, {
        playerId: normalized.playerId,
        score: normalized.score,
        capturedMenuIds: [...normalized.capturedMenuIds],
        completedAt: serverTimestamp(),
      })
    })

    return this.readResults(code)
  }

  async subscribeResults(
    roomCode: string,
    listener: RoomResultsListener,
    onError?: RoomResultsErrorListener,
  ): Promise<RoomUnsubscribe> {
    const code = normalizeRoomCode(roomCode)
    const resultsRef = collection(this.db, 'rooms', code, 'results')

    return this.trackUnsubscriber(
      onSnapshot(
        resultsRef,
        (snapshot) => listener(decodeResultSnapshot(snapshot)),
        (error) => onError?.(error),
      ),
    )
  }

  dispose(): void {
    for (const unsubscribe of [...this.activeUnsubscribers]) {
      unsubscribe()
    }
    this.activeUnsubscribers.clear()
  }

  private async updateWaitingRoom(
    roomCode: string,
    update: (room: Room) => WaitingRoom,
  ): Promise<WaitingRoom> {
    const code = normalizeRoomCode(roomCode)
    const roomRef = this.roomRef(code)

    return runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(roomRef)
      const room = requireRoomSnapshot(snapshot.data(), snapshot.exists(), code)
      const updated = update(room)

      transaction.set(roomRef, {
        ...encodeRoomForFirestore(updated),
        createdAt: readCreatedAt(snapshot.data()),
        updatedAt: serverTimestamp(),
      })
      return updated
    })
  }

  private async readResults(
    roomCode: string,
  ): Promise<readonly RoomResultSubmission[]> {
    const snapshot = await getDocs(
      collection(this.db, 'rooms', roomCode, 'results'),
    )
    return decodeResultSnapshot(snapshot)
  }

  private roomRef(roomCode: string) {
    return doc(this.db, 'rooms', roomCode)
  }

  private assertPlayerIdentity(playerId: string): void {
    if (playerId.trim() !== this.authenticatedPlayerId) {
      throw new FirebaseRoomGatewayError(
        'PLAYER_IDENTITY_MISMATCH',
        '현재 Firebase 사용자와 플레이어 ID가 일치하지 않습니다.',
      )
    }
  }

  private trackUnsubscriber(
    unsubscribe: RoomUnsubscribe,
  ): RoomUnsubscribe {
    let active = true
    const tracked = () => {
      if (!active) {
        return
      }
      active = false
      this.activeUnsubscribers.delete(tracked)
      unsubscribe()
    }
    this.activeUnsubscribers.add(tracked)
    return tracked
  }
}

function encodeRoomForFirestore(room: Room): Record<string, unknown> {
  const encoded = encodeFirestoreRoom(room)
  return {
    ...encoded,
    memberIds: [...encoded.memberIds],
    players: Object.fromEntries(
      Object.entries(encoded.players).map(([playerId, player]) => [
        playerId,
        { ...player },
      ]),
    ),
    start:
      encoded.start === null
        ? null
        : {
            ...encoded.start,
            startAt: Timestamp.fromMillis(encoded.start.startAt),
            rosterIds: [...encoded.start.rosterIds],
          },
  }
}

function decodeRoomSnapshot(data: DocumentData, roomCode: string): Room {
  try {
    return decodeFirestoreRoom(
      {
        ...data,
        start:
          isRecord(data.start) && data.start.startAt instanceof Timestamp
            ? {
                ...data.start,
                startAt: data.start.startAt.toMillis(),
              }
            : data.start,
      },
      roomCode,
    )
  } catch (error) {
    throw new FirebaseRoomGatewayError(
      'CORRUPT_ROOM_DATA',
      `방 "${roomCode}"의 Firestore 데이터가 올바르지 않습니다.`,
      { cause: error },
    )
  }
}

function requireRoomSnapshot(
  data: DocumentData | undefined,
  exists: boolean,
  roomCode: string,
): Room {
  if (!exists || !data) {
    throw new FirebaseRoomGatewayError(
      'ROOM_NOT_FOUND',
      `방 "${roomCode}"을(를) 찾을 수 없습니다.`,
    )
  }
  return decodeRoomSnapshot(data, roomCode)
}

function readCreatedAt(data: DocumentData | undefined): Timestamp {
  if (!(data?.createdAt instanceof Timestamp)) {
    throw new FirebaseRoomGatewayError(
      'CORRUPT_ROOM_DATA',
      '방 생성 시각이 올바르지 않습니다.',
    )
  }
  return data.createdAt
}

function decodeResultSnapshot(
  snapshot: QuerySnapshot<DocumentData, DocumentData>,
): readonly RoomResultSubmission[] {
  return Object.freeze(
    snapshot.docs
      .map((result) => decodeResultDocument(result.data()))
      .sort((left, right) =>
        left.playerId.localeCompare(right.playerId),
      ),
  )
}

function decodeResultDocument(data: DocumentData): RoomResultSubmission {
  try {
    if (!(data.completedAt instanceof Timestamp)) {
      throw new Error('Result completion time must be a timestamp.')
    }
    if (
      typeof data.playerId !== 'string' ||
      typeof data.score !== 'number' ||
      !Array.isArray(data.capturedMenuIds) ||
      data.capturedMenuIds.some((menuId) => typeof menuId !== 'string')
    ) {
      throw new Error('Result data has an invalid shape.')
    }

    return validateRoomResultSubmission({
      playerId: data.playerId,
      score: data.score,
      capturedMenuIds: data.capturedMenuIds as string[],
      completedAt: data.completedAt.toMillis(),
    })
  } catch (error) {
    if (error instanceof FirebaseRoomGatewayError) {
      throw error
    }
    throw new FirebaseRoomGatewayError(
      'CORRUPT_RESULT_DATA',
      'Firestore 결과 데이터가 올바르지 않습니다.',
      { cause: error },
    )
  }
}

function sameResult(
  left: RoomResultSubmission,
  right: RoomResultSubmission,
): boolean {
  return (
    left.playerId === right.playerId &&
    left.score === right.score &&
    left.capturedMenuIds.length === right.capturedMenuIds.length &&
    left.capturedMenuIds.every(
      (menuId, index) => menuId === right.capturedMenuIds[index],
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

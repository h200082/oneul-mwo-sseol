import { describe, expect, it } from 'vitest'

import {
  ROOM_RESULT_WINDOW_MS,
  createRoom,
  joinRoom,
  startRoom,
} from '../src/domain/room'
import {
  FIRESTORE_ROOM_LATEST_SCHEMA_VERSION,
  FIRESTORE_ROOM_WRITE_SCHEMA_VERSION,
  decodeFirestoreRoom,
  encodeFirestoreRoom,
} from '../src/firebase/firebaseRoomCodec'

function startedRoom() {
  const waiting = joinRoom(
    createRoom({
      mealTime: 'lunch',
      playerId: 'host',
      nickname: '방장',
      rng: () => 0,
    }),
    { playerId: 'guest', nickname: '참가자' },
  )
  return startRoom(waiting, {
    requesterPlayerId: 'host',
    deckSeed: 'codec-seed',
    contentVersion: 'menus-v1',
    startAt: 50_000,
  })
}

describe('Firestore result deadline codec', () => {
  it('writes transition schema v1 and derives its deadline on read', () => {
    const room = startedRoom()
    const encoded = encodeFirestoreRoom(room)

    expect(FIRESTORE_ROOM_LATEST_SCHEMA_VERSION).toBe(2)
    expect(FIRESTORE_ROOM_WRITE_SCHEMA_VERSION).toBe(1)
    expect(encoded.schemaVersion).toBe(1)
    expect(encoded.start?.resultDeadlineAt).toBeUndefined()
    expect(decodeFirestoreRoom(encoded, room.code)).toEqual(room)
  })

  it('reads schema v2 with an explicit exact deadline', () => {
    const room = startedRoom()
    const encoded = encodeFirestoreRoom(room)
    const explicitDeadline = 50_000 + ROOM_RESULT_WINDOW_MS
    const current = {
      ...encoded,
      schemaVersion: 2 as const,
      start: {
        ...encoded.start!,
        resultDeadlineAt: explicitDeadline,
      },
    }

    expect(decodeFirestoreRoom(current, room.code)).toEqual(room)
  })

  it('rejects a missing or tampered schema v2 deadline', () => {
    const room = startedRoom()
    const encoded = encodeFirestoreRoom(room)
    const missingDeadline = {
      ...encoded,
      schemaVersion: 2 as const,
    }

    expect(() =>
      decodeFirestoreRoom(missingDeadline, room.code),
    ).toThrow(/invalid shape/i)
    expect(() =>
      decodeFirestoreRoom(
        {
          ...encoded,
          schemaVersion: 2,
          start: {
            ...encoded.start!,
            resultDeadlineAt:
              50_000 + ROOM_RESULT_WINDOW_MS + 1,
          },
        },
        room.code,
      ),
    ).toThrow(/does not match/i)
  })
})

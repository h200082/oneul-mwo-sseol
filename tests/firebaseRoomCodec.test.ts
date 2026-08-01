import { describe, expect, it } from 'vitest'

import {
  createRoom,
  joinRoom,
  startRoom,
} from '../src/domain/room'
import {
  decodeFirestoreRoom,
  encodeFirestoreRoom,
} from '../src/firebase/firebaseRoomCodec'

function createTwoPlayerRoom() {
  const room = createRoom({
    mealTime: 'dinner',
    playerId: 'host-uid',
    nickname: '방장',
    rng: () => 0,
  })
  return joinRoom(room, {
    playerId: 'member-uid',
    nickname: '참가자',
  })
}

describe('Firebase room codec', () => {
  it('round-trips a waiting room through memberIds and a player map', () => {
    const room = createTwoPlayerRoom()
    const stored = encodeFirestoreRoom(room)

    expect(stored.memberIds).toEqual(['host-uid', 'member-uid'])
    expect(stored.players).toEqual({
      'host-uid': { nickname: '방장' },
      'member-uid': { nickname: '참가자' },
    })
    expect(decodeFirestoreRoom(stored, room.code)).toEqual(room)
  })

  it('round-trips the locked start roster and shared deck seed', () => {
    const waiting = createTwoPlayerRoom()
    const room = startRoom(waiting, {
      requesterPlayerId: 'host-uid',
      deckSeed: 'shared-seed',
      contentVersion: 'menus-v1',
      startAt: 42_000,
    })

    const restored = decodeFirestoreRoom(
      encodeFirestoreRoom(room),
      room.code,
    )

    expect(restored).toEqual(room)
    expect(restored.status).toBe('started')
    if (restored.status === 'started') {
      expect(restored.start.roster).toEqual(room.start.roster)
    }
  })

  it('rejects a player map that does not match memberIds', () => {
    const stored = encodeFirestoreRoom(createTwoPlayerRoom())

    expect(() =>
      decodeFirestoreRoom(
        {
          ...stored,
          players: {
            'host-uid': { nickname: '방장' },
          },
        },
        stored.code,
      ),
    ).toThrow(/players must match memberIds/)
  })

  it('rejects a mismatched document id and start roster', () => {
    const waiting = createTwoPlayerRoom()
    const started = startRoom(waiting, {
      requesterPlayerId: 'host-uid',
      deckSeed: 'seed',
      contentVersion: 'menus-v1',
      startAt: 1,
    })
    const stored = encodeFirestoreRoom(started)

    expect(() =>
      decodeFirestoreRoom(stored, 'ZZZZZZZZ'),
    ).toThrow(/document id/)
    expect(() =>
      decodeFirestoreRoom(
        {
          ...stored,
          start: {
            ...stored.start,
            rosterIds: ['member-uid', 'host-uid'],
          },
        },
        stored.code,
      ),
    ).toThrow(/start roster/)
  })
})

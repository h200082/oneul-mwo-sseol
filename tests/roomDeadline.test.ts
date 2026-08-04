import { describe, expect, it } from 'vitest'

import {
  ROOM_RESULT_WINDOW_MS,
  createRoom,
  joinRoom,
  startRoom,
} from '../src/domain/room'

function waitingRoom() {
  return joinRoom(
    createRoom({
      mealTime: 'lunch',
      playerId: 'host',
      nickname: '방장',
      rng: () => 0,
    }),
    { playerId: 'guest', nickname: '참가자' },
  )
}

describe('room result deadline', () => {
  it('derives and freezes one shared 180-second result deadline', () => {
    const room = startRoom(waitingRoom(), {
      requesterPlayerId: 'host',
      deckSeed: 'shared-seed',
      contentVersion: 'menus-v1',
      startAt: 1_000,
    })

    expect(room.start.resultDeadlineAt).toBe(
      1_000 + ROOM_RESULT_WINDOW_MS,
    )
    expect(Object.isFrozen(room.start)).toBe(true)
  })

  it('rejects a start timestamp whose derived deadline is unsafe', () => {
    expect(() =>
      startRoom(waitingRoom(), {
        requesterPlayerId: 'host',
        deckSeed: 'shared-seed',
        contentVersion: 'menus-v1',
        startAt: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow(/derived result deadline/i)
  })
})

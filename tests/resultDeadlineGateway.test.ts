import { describe, expect, it } from 'vitest'

import {
  ROOM_RESULT_SYNC_GRACE_MS,
  ROOM_RESULT_WINDOW_MS,
} from '../src/domain/room'
import { LocalRoomGateway } from '../src/rooms/LocalRoomGateway'
import type { RoomNotificationChannel } from '../src/rooms/RoomGateway'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const notifications: RoomNotificationChannel = {
  publish: () => undefined,
  subscribe: () => () => undefined,
}

describe('LocalRoomGateway result deadline', () => {
  it('accepts the boundary, rejects a new late result, and keeps retries idempotent', async () => {
    let now = 1_000
    const gateway = new LocalRoomGateway({
      storage: new MemoryStorage(),
      notifications,
      rng: () => 0,
      now: () => now,
    })
    const waiting = await gateway.create({
      mealTime: 'dinner',
      playerId: 'host',
      nickname: '방장',
    })
    await gateway.join(waiting.code, {
      playerId: 'guest',
      nickname: '참가자',
    })
    const started = await gateway.start(waiting.code, {
      requesterPlayerId: 'host',
      deckSeed: 'deadline-seed',
      contentVersion: 'menus-v1',
      startAt: now,
    })
    const deadline = now + ROOM_RESULT_WINDOW_MS
    expect(started.start.resultDeadlineAt).toBe(deadline)

    now = deadline
    const hostResult = {
      playerId: 'host',
      score: 0,
      capturedMenuIds: [] as const,
      completedAt: deadline,
    }
    await expect(gateway.submitResult(waiting.code, hostResult)).resolves.toHaveLength(1)

    now = deadline + 1
    await expect(
      gateway.readAuthoritativeResultState(waiting.code),
    ).resolves.toMatchObject({ finalization: 'open' })
    await expect(
      gateway.submitResult(waiting.code, hostResult),
    ).resolves.toHaveLength(1)
    await expect(
      gateway.submitResult(waiting.code, {
        playerId: 'guest',
        score: 100,
        capturedMenuIds: ['pizza'],
        completedAt: deadline,
      }),
    ).rejects.toMatchObject({ code: 'RESULT_DEADLINE_PASSED' })

    now = deadline + ROOM_RESULT_SYNC_GRACE_MS
    await expect(
      gateway.readAuthoritativeResultState(waiting.code),
    ).resolves.toMatchObject({
      finalization: 'closed',
      results: [hostResult],
    })
  })
})

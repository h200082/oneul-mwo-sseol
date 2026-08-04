import { describe, expect, it } from 'vitest'

import type { RoundResult } from '../src/domain/gameRules'
import {
  createRoomGameProgressIdentity,
  RoomGameProgressStore,
} from '../src/game/gameProgress'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const deck = Array.from({ length: 20 }, (_, index) => `menu-${index}`)

function progressRounds(): RoundResult[] {
  return [
    {
      roundIndex: 0,
      menuId: deck[0]!,
      action: { type: 'slice', accuracy: 91.25 },
    },
    {
      roundIndex: 1,
      menuId: deck[1]!,
      action: { type: 'capture' },
    },
    {
      roundIndex: 2,
      menuId: deck[2]!,
      action: { type: 'miss' },
    },
  ]
}

describe('RoomGameProgressStore', () => {
  it('round-trips completed scoring and capture state for one exact game start', () => {
    const storage = new MemoryStorage()
    const store = new RoomGameProgressStore(storage, () => 1_754_000_000_000)
    const identity = createRoomGameProgressIdentity(
      'player-a',
      'ABCDEFGH',
      1_754_000_000_000,
      'room-seed',
    )
    const rounds = progressRounds()

    expect(store.save(identity, rounds, deck)).toBe(true)
    ;(rounds[0]!.action as { type: 'slice'; accuracy: number }).accuracy = 1

    expect(store.load(identity, deck)).toEqual(progressRounds())
  })

  it('rejects malformed, unsupported-version, and wrong-deck records', () => {
    const storage = new MemoryStorage()
    const store = new RoomGameProgressStore(storage, () => 123)
    const identity = createRoomGameProgressIdentity(
      'player-a',
      'ABCDEFGH',
      100,
      200,
    )

    expect(store.save(identity, progressRounds(), deck)).toBe(true)
    const key = storage.key(0)
    expect(key).not.toBeNull()
    if (!key) {
      return
    }

    storage.setItem(key, '{not-json')
    expect(store.load(identity, deck)).toEqual([])
    expect(storage.getItem(key)).toBeNull()

    expect(store.save(identity, progressRounds(), deck)).toBe(true)
    const versioned = JSON.parse(storage.getItem(key)!) as Record<string, unknown>
    versioned.version = 99
    storage.setItem(key, JSON.stringify(versioned))
    expect(store.load(identity, deck)).toEqual([])

    expect(store.save(identity, progressRounds(), deck)).toBe(true)
    const changedDeck = [...deck]
    changedDeck[1] = 'other-menu'
    expect(store.load(identity, changedDeck)).toEqual([])
    expect(storage.getItem(key)).toBeNull()
  })

  it('does not save invalid partial runs or more than two captures', () => {
    const storage = new MemoryStorage()
    const store = new RoomGameProgressStore(storage)
    const identity = createRoomGameProgressIdentity(
      'player-a',
      'ABCDEFGH',
      100,
      'seed',
    )
    const threeCaptures = [0, 1, 2].map((roundIndex) => ({
      roundIndex,
      menuId: deck[roundIndex]!,
      action: { type: 'capture' as const },
    }))

    expect(
      store.save(identity, [
        { ...progressRounds()[0]!, menuId: 'wrong-menu' },
      ], deck),
    ).toBe(false)
    expect(store.save(identity, threeCaptures, deck)).toBe(false)
    expect(storage.length).toBe(0)
  })

  it('clears stale starts only for the selected player', () => {
    const storage = new MemoryStorage()
    const store = new RoomGameProgressStore(storage, () => 123)
    const oldGame = createRoomGameProgressIdentity('player-a', 'ABCDEFGH', 1, 'seed')
    const keptGame = createRoomGameProgressIdentity('player-a', 'ABCDEFGH', 2, 'seed')
    const otherPlayer = createRoomGameProgressIdentity('player-b', 'ABCDEFGH', 1, 'seed')

    expect(store.save(oldGame, progressRounds(), deck)).toBe(true)
    expect(store.save(keptGame, progressRounds(), deck)).toBe(true)
    expect(store.save(otherPlayer, progressRounds(), deck)).toBe(true)

    store.clearForPlayerExcept('player-a', keptGame)

    expect(store.load(oldGame, deck)).toEqual([])
    expect(store.load(keptGame, deck)).toEqual(progressRounds())
    expect(store.load(otherPlayer, deck)).toEqual(progressRounds())
  })

  it('falls back without throwing when browser storage is unavailable', () => {
    const unavailableStorage = {
      get length(): number {
        throw new Error('blocked')
      },
      clear(): void {
        throw new Error('blocked')
      },
      getItem(): string | null {
        throw new Error('blocked')
      },
      key(): string | null {
        throw new Error('blocked')
      },
      removeItem(): void {
        throw new Error('blocked')
      },
      setItem(): void {
        throw new Error('blocked')
      },
    } satisfies Storage
    const store = new RoomGameProgressStore(unavailableStorage)
    const identity = createRoomGameProgressIdentity(
      'player-a',
      'ABCDEFGH',
      100,
      'seed',
    )

    expect(store.load(identity, deck)).toEqual([])
    expect(store.save(identity, progressRounds(), deck)).toBe(false)
    expect(() => store.clearForPlayer('player-a')).not.toThrow()
  })
})

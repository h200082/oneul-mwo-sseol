import { describe, expect, it } from 'vitest'

import {
  PersonalBestStore,
  type PersonalBestIdentity,
} from '../src/game/personalBestStore'

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

const SOLO_LUNCH: PersonalBestIdentity = {
  mode: 'solo',
  mealTime: 'lunch',
  contentVersion: 'menus-v1',
}

describe('PersonalBestStore', () => {
  it('records the first score and replaces it only with a higher score', () => {
    const store = new PersonalBestStore(new MemoryStorage())

    const first = store.record(SOLO_LUNCH, 72.5, 100, 'seed-a')
    const lower = store.record(SOLO_LUNCH, 60, 200, 'seed-b')
    const higher = store.record(SOLO_LUNCH, 88, 300, 'seed-c')

    expect(first).toMatchObject({ previousScore: null, isNewBest: true })
    expect(lower).toMatchObject({ previousScore: 72.5, isNewBest: false })
    expect(higher).toMatchObject({ previousScore: 72.5, isNewBest: true })
    expect(store.read(SOLO_LUNCH)).toMatchObject({
      score: 88,
      achievedAt: 300,
      deckSeed: 'seed-c',
    })
  })

  it('keeps mode, meal time, and content version records independent', () => {
    const store = new PersonalBestStore(new MemoryStorage())
    store.record(SOLO_LUNCH, 70, 100, 1)
    store.record({ ...SOLO_LUNCH, mode: 'room' }, 80, 200, 2)
    store.record({ ...SOLO_LUNCH, mealTime: 'dinner' }, 90, 300, 3)
    store.record({ ...SOLO_LUNCH, contentVersion: 'menus-v2' }, 95, 400, 4)

    expect(store.read(SOLO_LUNCH)?.score).toBe(70)
    expect(store.read({ ...SOLO_LUNCH, mode: 'room' })?.score).toBe(80)
    expect(store.read({ ...SOLO_LUNCH, mealTime: 'dinner' })?.score).toBe(90)
    expect(
      store.read({ ...SOLO_LUNCH, contentVersion: 'menus-v2' })?.score,
    ).toBe(95)
  })

  it('ignores corrupt storage and returns frozen snapshots', () => {
    const storage = new MemoryStorage()
    storage.setItem('oneul-mwo-sseol-personal-bests-v1', '{broken')
    const store = new PersonalBestStore(storage)

    expect(store.read(SOLO_LUNCH)).toBeNull()
    const update = store.record(SOLO_LUNCH, 77, 100, 'seed')
    expect(Object.isFrozen(update)).toBe(true)
    expect(Object.isFrozen(update.record)).toBe(true)
  })

  it('rejects invalid scores and timestamps', () => {
    const store = new PersonalBestStore(new MemoryStorage())
    expect(() => store.record(SOLO_LUNCH, 101, 100, 'seed')).toThrow(
      /between 0 and 100/,
    )
    expect(() => store.record(SOLO_LUNCH, 90, -1, 'seed')).toThrow(
      /non-negative/,
    )
  })
})

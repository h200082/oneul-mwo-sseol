import { describe, expect, it, vi } from 'vitest'

import {
  NARRATION_ENABLED_STORAGE_KEY,
  StoredNarrationPreference,
} from '../src/feedback/narrationPreference'

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

describe('StoredNarrationPreference', () => {
  it('defaults to requested and effective ON', () => {
    const preference = new StoredNarrationPreference(
      new MemoryStorage(),
      () => true,
    )

    expect(preference.getState()).toEqual({
      requestedEnabled: true,
      effectiveEnabled: true,
    })
  })

  it('persists the device request and restores it in a new instance', () => {
    const storage = new MemoryStorage()
    const first = new StoredNarrationPreference(storage, () => true)

    first.setEnabled(false)

    expect(storage.getItem(NARRATION_ENABLED_STORAGE_KEY)).toBe('0')
    expect(
      new StoredNarrationPreference(storage, () => true).requestedEnabled,
    ).toBe(false)
  })

  it('keeps the request while master sound suppresses effective playback', () => {
    let soundEnabled = true
    const preference = new StoredNarrationPreference(
      new MemoryStorage(),
      () => soundEnabled,
    )

    soundEnabled = false
    expect(preference.getState()).toEqual({
      requestedEnabled: true,
      effectiveEnabled: false,
    })

    soundEnabled = true
    expect(preference.getState()).toEqual({
      requestedEnabled: true,
      effectiveEnabled: true,
    })
  })

  it('falls back to in-memory state when storage reads fail', () => {
    const brokenStorage = new MemoryStorage()
    vi.spyOn(brokenStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    const preference = new StoredNarrationPreference(
      brokenStorage,
      () => true,
    )
    preference.setEnabled(false)

    expect(preference.requestedEnabled).toBe(false)
    expect(preference.effectiveEnabled).toBe(false)
  })

  it('keeps later changes in memory when storage writes fail', () => {
    const brokenStorage = new MemoryStorage()
    const write = vi.spyOn(brokenStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const preference = new StoredNarrationPreference(
      brokenStorage,
      () => true,
    )

    preference.setEnabled(false)
    preference.setEnabled(true)

    expect(write).toHaveBeenCalledOnce()
    expect(preference.requestedEnabled).toBe(true)
    expect(preference.effectiveEnabled).toBe(true)
  })

  it('emits immediately, then only on request changes, and unsubscribes', () => {
    const preference = new StoredNarrationPreference(
      new MemoryStorage(),
      () => true,
    )
    const listener = vi.fn()
    const unsubscribe = preference.subscribe(listener)

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenLastCalledWith({
      requestedEnabled: true,
      effectiveEnabled: true,
    })

    preference.setEnabled(true)
    expect(listener).toHaveBeenCalledOnce()

    expect(preference.toggle()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    preference.setEnabled(true)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

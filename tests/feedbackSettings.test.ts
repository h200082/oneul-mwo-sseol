import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FEEDBACK_SETTINGS,
  FEEDBACK_SETTINGS_STORAGE_KEY,
  loadFeedbackSettings,
  saveFeedbackSettings,
} from '../src/feedback/feedbackSettings'

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

describe('feedback settings', () => {
  it('uses enabled defaults when storage is absent or empty', () => {
    expect(loadFeedbackSettings(null)).toEqual(DEFAULT_FEEDBACK_SETTINGS)
    expect(loadFeedbackSettings(new MemoryStorage())).toEqual(
      DEFAULT_FEEDBACK_SETTINGS,
    )
  })

  it('round-trips separate sound and haptics preferences', () => {
    const storage = new MemoryStorage()
    saveFeedbackSettings(storage, {
      soundEnabled: false,
      hapticsEnabled: true,
    })

    expect(loadFeedbackSettings(storage)).toEqual({
      soundEnabled: false,
      hapticsEnabled: true,
    })
  })

  it.each([
    '{broken',
    'null',
    '{}',
    '{"soundEnabled":true}',
    '{"soundEnabled":"yes","hapticsEnabled":true}',
  ])('recovers from malformed or stale value %s', (raw) => {
    const storage = new MemoryStorage()
    storage.setItem(FEEDBACK_SETTINGS_STORAGE_KEY, raw)
    expect(loadFeedbackSettings(storage)).toEqual(
      DEFAULT_FEEDBACK_SETTINGS,
    )
  })

  it('does not throw when browser storage is blocked', () => {
    const blockedStorage = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
    }

    expect(loadFeedbackSettings(blockedStorage)).toEqual(
      DEFAULT_FEEDBACK_SETTINGS,
    )
    expect(() =>
      saveFeedbackSettings(blockedStorage, {
        soundEnabled: false,
        hapticsEnabled: false,
      }),
    ).not.toThrow()
  })
})

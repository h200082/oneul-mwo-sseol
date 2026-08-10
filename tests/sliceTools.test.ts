import { describe, expect, it } from 'vitest'

import {
  CLASSIC_SLICE_TOOL_ID,
  DEFAULT_SLICE_TOOL_ID,
  RAINBOW_SLICE_TOOL_ID,
  RAINBOW_TRAIL_COLORS,
  SELECTED_SLICE_TOOL_STORAGE_KEY,
  getRainbowTrailColor,
  loadSelectedSliceTool,
  saveSelectedSliceTool,
} from '../src/game/sliceTools'

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

describe('slice tool preference', () => {
  it('defaults to the classic knife for absent or unknown values', () => {
    const storage = new MemoryStorage()

    expect(loadSelectedSliceTool(null)).toBe(DEFAULT_SLICE_TOOL_ID)
    expect(loadSelectedSliceTool(storage)).toBe(CLASSIC_SLICE_TOOL_ID)

    storage.setItem(SELECTED_SLICE_TOOL_STORAGE_KEY, 'future-knife')
    expect(loadSelectedSliceTool(storage)).toBe(CLASSIC_SLICE_TOOL_ID)
  })

  it('persists and restores either selectable knife', () => {
    const storage = new MemoryStorage()

    saveSelectedSliceTool(storage, RAINBOW_SLICE_TOOL_ID)
    expect(loadSelectedSliceTool(storage)).toBe(RAINBOW_SLICE_TOOL_ID)

    saveSelectedSliceTool(storage, CLASSIC_SLICE_TOOL_ID)
    expect(loadSelectedSliceTool(storage)).toBe(CLASSIC_SLICE_TOOL_ID)
  })

  it('does not block selection when browser storage is restricted', () => {
    const blockedStorage = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
    }

    expect(loadSelectedSliceTool(blockedStorage)).toBe(
      CLASSIC_SLICE_TOOL_ID,
    )
    expect(() =>
      saveSelectedSliceTool(blockedStorage, RAINBOW_SLICE_TOOL_ID),
    ).not.toThrow()
  })
})

describe('rainbow trail palette', () => {
  it('cycles deterministically through all seven colors', () => {
    expect(
      RAINBOW_TRAIL_COLORS.map((_, index) =>
        getRainbowTrailColor(index),
      ),
    ).toEqual(RAINBOW_TRAIL_COLORS)
    expect(getRainbowTrailColor(RAINBOW_TRAIL_COLORS.length)).toBe(
      RAINBOW_TRAIL_COLORS[0],
    )
    expect(getRainbowTrailColor(-1)).toBe(RAINBOW_TRAIL_COLORS[0])
    expect(getRainbowTrailColor(Number.NaN)).toBe(
      RAINBOW_TRAIL_COLORS[0],
    )
  })
})

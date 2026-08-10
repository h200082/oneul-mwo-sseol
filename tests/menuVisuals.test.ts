import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { MENU_CATALOG } from '../src/data/menus'
import {
  MENU_VISUALS,
  calculateContainedSize,
  getMenuVisual,
  preloadMenuVisuals,
} from '../src/data/menuVisuals'

describe('MENU_VISUALS', () => {
  it('maps every catalog menu to one unique Phaser texture and WebP', () => {
    const catalogIds = MENU_CATALOG.map((menu) => menu.id)
    const visualIds = MENU_VISUALS.map((visual) => visual.menuId)

    expect(MENU_VISUALS).toHaveLength(50)
    expect(new Set(visualIds)).toEqual(new Set(catalogIds))
    expect(new Set(visualIds).size).toBe(MENU_VISUALS.length)
    expect(new Set(MENU_VISUALS.map((visual) => visual.textureKey)).size).toBe(
      MENU_VISUALS.length,
    )
    expect(
      new Set(MENU_VISUALS.map((visual) => visual.assetFilename)).size,
    ).toBe(MENU_VISUALS.length)

    for (const visual of MENU_VISUALS) {
      expect(visual.textureKey).toBe(`food:${visual.menuId}`)
      expect(visual.imageUrl).toMatch(/\.webp(?:\?.*)?$/)
      expect(visual.assetFilename).toMatch(/\.webp$/)
      expect(getMenuVisual(visual.menuId)).toBe(visual)
    }
    expect(getMenuVisual('menu-without-art')).toBeUndefined()
  })

  it('applies bounded gameplay alignment only to the four measured outliers', () => {
    const alignedVisuals = Object.fromEntries(
      MENU_VISUALS.filter((visual) => visual.gameplayOffset).map((visual) => [
        visual.menuId,
        visual.gameplayOffset,
      ]),
    )

    expect(alignedVisuals).toEqual({
      gamjatang: { x: -7, y: -13 },
      pasta: { x: -4, y: -25 },
      bossam: { x: 15, y: -6 },
      tteokbokki: { x: -5, y: -14 },
    })
    for (const offset of Object.values(alignedVisuals)) {
      expect(Number.isFinite(offset?.x)).toBe(true)
      expect(Number.isFinite(offset?.y)).toBe(true)
      expect(Math.abs(offset?.x ?? 0)).toBeLessThanOrEqual(32)
      expect(Math.abs(offset?.y ?? 0)).toBeLessThanOrEqual(32)
    }
  })

  it('stores fifty aspect-preserving alpha WebPs inside the mobile budget', () => {
    const assets = MENU_VISUALS.map((visual) => {
      const fileUrl = new URL(
        `../src/assets/food/${visual.assetFilename}`,
        import.meta.url,
      )
      return { visual, asset: readFileSync(fileURLToPath(fileUrl)) }
    })

    for (const { visual, asset } of assets) {
      expect(asset.length).toBeGreaterThan(1_000)
      expect(asset.length).toBeLessThanOrEqual(120_000)
      expect(asset.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(asset.subarray(8, 12).toString('ascii')).toBe('WEBP')
      expect(asset.subarray(12, 16).toString('ascii')).toBe('VP8X')
      expect(asset[20]! & 0x10).toBe(0x10)
      expect(asset.includes(Buffer.from('ALPH'))).toBe(true)

      const width = readUint24Le(asset, 24) + 1
      const height = readUint24Le(asset, 27) + 1
      expect(width).toBe(visual.sourceWidth)
      expect(height).toBe(visual.sourceHeight)
      expect(Math.max(width, height)).toBe(512)
    }

    const sizes = assets.map(({ asset }) => asset.length).sort((a, b) => b - a)
    expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThanOrEqual(
      3_500_000,
    )
    expect(sizes.slice(0, 20).reduce((total, size) => total + size, 0)).toBeLessThanOrEqual(
      1_500_000,
    )
    expect(
      MENU_VISUALS.filter(
        (visual) => visual.sourceWidth !== visual.sourceHeight,
      ).length,
    ).toBeGreaterThanOrEqual(40)
  })

  it('does not require the browser Image API in the unit-test runtime', async () => {
    await expect(preloadMenuVisuals()).resolves.toBeUndefined()
  })
})

describe('calculateContainedSize', () => {
  it.each([
    {
      source: [1_000, 500],
      maximum: [120, 100],
      expected: { width: 120, height: 60 },
    },
    {
      source: [500, 1_000],
      maximum: [120, 100],
      expected: { width: 50, height: 100 },
    },
    {
      source: [512, 512],
      maximum: [120, 100],
      expected: { width: 100, height: 100 },
    },
  ])('contains $source inside $maximum without stretching', ({
    source,
    maximum,
    expected,
  }) => {
    expect(
      calculateContainedSize(
        source[0]!,
        source[1]!,
        maximum[0]!,
        maximum[1]!,
      ),
    ).toEqual(expected)
  })

  it('rejects zero or non-finite dimensions', () => {
    expect(() => calculateContainedSize(0, 512, 120, 100)).toThrow(RangeError)
    expect(() => calculateContainedSize(512, 512, Infinity, 100)).toThrow(
      RangeError,
    )
  })
})

function readUint24Le(buffer: Buffer, offset: number): number {
  return (
    buffer[offset]! |
    (buffer[offset + 1]! << 8) |
    (buffer[offset + 2]! << 16)
  )
}

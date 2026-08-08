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

const ASSET_DESCRIPTORS = [
  { filename: 'ramyeon-v2.webp', width: 512, height: 512 },
  { filename: 'kimchi-jjigae.webp', width: 512, height: 512 },
  { filename: 'sushi.webp', width: 512, height: 512 },
  { filename: 'fried-chicken-v2.webp', width: 512, height: 512 },
  { filename: 'pizza.webp', width: 512, height: 512 },
  { filename: 'galbitang-v2.webp', width: 438, height: 512 },
  { filename: 'omurice-v2.webp', width: 512, height: 332 },
  { filename: 'gimbap-v2.webp', width: 512, height: 341 },
  { filename: 'sandwich-v2.webp', width: 512, height: 330 },
  { filename: 'tteokbokki-v2.webp', width: 394, height: 512 },
  { filename: 'home-style-baekban-v2.webp', width: 512, height: 175 },
] as const

describe('MENU_VISUALS', () => {
  it('maps eleven existing menus to unique Phaser textures', () => {
    const catalogIds = new Set(MENU_CATALOG.map((menu) => menu.id))

    expect(MENU_VISUALS).toHaveLength(11)
    expect(new Set(MENU_VISUALS.map((visual) => visual.menuId)).size).toBe(11)
    expect(new Set(MENU_VISUALS.map((visual) => visual.textureKey)).size).toBe(11)

    for (const visual of MENU_VISUALS) {
      expect(catalogIds.has(visual.menuId)).toBe(true)
      expect(visual.textureKey).toBe(`food:${visual.menuId}`)
      expect(visual.imageUrl).toMatch(/\.webp(?:\?.*)?$/)
      expect(getMenuVisual(visual.menuId)).toBe(visual)
    }
    expect(getMenuVisual('menu-without-art')).toBeUndefined()
  })

  it('stores eleven aspect-preserving alpha WebPs inside the mobile loading budget', () => {
    const assets = ASSET_DESCRIPTORS.map((descriptor) => {
      const fileUrl = new URL(
        `../src/assets/food/${descriptor.filename}`,
        import.meta.url,
      )
      return { descriptor, asset: readFileSync(fileURLToPath(fileUrl)) }
    })

    for (const { descriptor, asset } of assets) {
      expect(asset.length).toBeGreaterThan(1_000)
      expect(asset.length).toBeLessThan(120_000)
      expect(asset.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(asset.subarray(8, 12).toString('ascii')).toBe('WEBP')
      expect(asset.subarray(12, 16).toString('ascii')).toBe('VP8X')
      expect(asset[20]! & 0x10).toBe(0x10)
      expect(asset.includes(Buffer.from('ALPH'))).toBe(true)
      expect(readUint24Le(asset, 24) + 1).toBe(descriptor.width)
      expect(readUint24Le(asset, 27) + 1).toBe(descriptor.height)
      expect(Math.max(descriptor.width, descriptor.height)).toBe(512)
    }

    for (const descriptor of ASSET_DESCRIPTORS.slice(5)) {
      expect(descriptor.width).not.toBe(descriptor.height)
    }

    expect(
      assets.reduce((total, { asset }) => total + asset.length, 0),
    ).toBeLessThan(750_000)
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

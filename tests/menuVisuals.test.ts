import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { MENU_CATALOG } from '../src/data/menus'
import {
  MENU_VISUALS,
  getMenuVisual,
  preloadMenuVisuals,
} from '../src/data/menuVisuals'

const ASSET_FILENAMES = [
  'ramyeon.webp',
  'kimchi-jjigae.webp',
  'sushi.webp',
  'fried-chicken.webp',
  'pizza.webp',
] as const

describe('MENU_VISUALS', () => {
  it('maps five existing menus to unique Phaser textures', () => {
    const catalogIds = new Set(MENU_CATALOG.map((menu) => menu.id))

    expect(MENU_VISUALS).toHaveLength(5)
    expect(new Set(MENU_VISUALS.map((visual) => visual.menuId)).size).toBe(5)
    expect(new Set(MENU_VISUALS.map((visual) => visual.textureKey)).size).toBe(5)

    for (const visual of MENU_VISUALS) {
      expect(catalogIds.has(visual.menuId)).toBe(true)
      expect(visual.textureKey).toBe(`food:${visual.menuId}`)
      expect(visual.imageUrl).toMatch(/\.webp(?:\?.*)?$/)
      expect(getMenuVisual(visual.menuId)).toBe(visual)
    }
    expect(getMenuVisual('menu-without-art')).toBeUndefined()
  })

  it('stores five 512px alpha WebPs inside the mobile loading budget', () => {
    const assets = ASSET_FILENAMES.map((filename) => {
      const fileUrl = new URL(`../src/assets/food/${filename}`, import.meta.url)
      return readFileSync(fileURLToPath(fileUrl))
    })

    for (const asset of assets) {
      expect(asset.length).toBeGreaterThan(1_000)
      expect(asset.length).toBeLessThan(120_000)
      expect(asset.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(asset.subarray(8, 12).toString('ascii')).toBe('WEBP')
      expect(asset.subarray(12, 16).toString('ascii')).toBe('VP8X')
      expect(asset[20]! & 0x10).toBe(0x10)
      expect(asset.includes(Buffer.from('ALPH'))).toBe(true)
      expect(readUint24Le(asset, 24) + 1).toBe(512)
      expect(readUint24Le(asset, 27) + 1).toBe(512)
    }
    expect(
      assets.reduce((total, asset) => total + asset.length, 0),
    ).toBeLessThan(
      250_000,
    )
  })

  it('does not require the browser Image API in the unit-test runtime', async () => {
    await expect(preloadMenuVisuals()).resolves.toBeUndefined()
  })
})

function readUint24Le(buffer: Buffer, offset: number): number {
  return (
    buffer[offset]! |
    (buffer[offset + 1]! << 8) |
    (buffer[offset + 2]! << 16)
  )
}

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { MENU_CATALOG } from '../../src/data/menus'
import { getGameDeckMenuIds } from '../../src/game/gameDeck'

const LOGICAL_WIDTH = 390
const LOGICAL_HEIGHT = 844
const QA_OUTPUT_DIRECTORY = path.resolve('.codex/food-game-screens')
const EXPECTED_GAMEPLAY_CENTERS: Readonly<Record<string, { x: number; y: number }>> = {
  gamjatang: { x: -7, y: -20 },
  pasta: { x: -4, y: -32 },
  bossam: { x: 15, y: -13 },
  tteokbokki: { x: -5, y: -21 },
}

interface FoodQaDebugState {
  readonly deckSeed: number | string
  readonly deckMenuIds: readonly string[]
  readonly introVisible: boolean
  readonly activeToken: {
    readonly x: number
    readonly y: number
    readonly menuId: string
    readonly captureCenter: { readonly x: number; readonly y: number }
    readonly judgement:
      | {
          readonly kind: 'alpha-mask'
          readonly radius: number
          readonly width: number
          readonly height: number
          readonly opaquePixelCount: number
          readonly alphaThreshold: number
          readonly centerX: number
          readonly centerY: number
        }
      | {
          readonly kind: 'circle-fallback'
          readonly radius: number
        }
    readonly visual: {
      readonly hasVisual: boolean
      readonly shadowKind: 'alpha-shadow' | 'none' | 'shape-fallback'
      readonly width: number
      readonly height: number
    }
  } | null
}

interface FoodQaWindow extends Window {
  __NHN_APP__?: {
    getDebugState: () => {
      startSoloGameForTest: (deckSeed: number | string) => void
    }
  }
  __NHN_GAME__?: {
    scene: {
      getScene: (key: string) => {
        getDebugState: () => FoodQaDebugState
      }
    }
  }
}

interface FoodQaReportItem {
  readonly menuId: string
  readonly nameKo: string
  readonly seed: number
  readonly renderWidth: number
  readonly renderHeight: number
  readonly opaquePixelCount: number
  readonly centerX: number
  readonly centerY: number
  readonly shadowKind: 'alpha-shadow'
  readonly screenshot: string
}

interface TokenVisualStructure {
  readonly ellipseCount: number
  readonly foodTextureImageCount: number
}

test.describe('food library visual QA', () => {
  test.skip(
    process.env.FOOD_LIBRARY_QA !== '1',
    'Run explicitly with FOOD_LIBRARY_QA=1 for the fifty-menu visual audit.',
  )

  test('renders every catalog menu as the first playable alpha silhouette', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'One viewport is sufficient for the exhaustive asset registration audit.',
    )

    const seeds = findFirstMenuSeeds()
    expect(seeds.size).toBe(MENU_CATALOG.length)
    await mkdir(QA_OUTPUT_DIRECTORY, { recursive: true })
    await page.goto('/')
    await page.waitForFunction(() => Boolean((window as FoodQaWindow).__NHN_APP__))

    const report: FoodQaReportItem[] = []
    for (const [index, menu] of MENU_CATALOG.entries()) {
      const seed = seeds.get(menu.id)
      expect(seed, `missing seed for ${menu.id}`).toBeDefined()
      if (seed === undefined) continue

      await startSeededGame(page, seed, menu.id)
      const state = await readDebugState(page)
      const token = state.activeToken
      expect(token, `missing active token for ${menu.id}`).not.toBeNull()
      if (!token) continue

      expect(state.deckMenuIds).toHaveLength(20)
      expect(state.deckMenuIds[0]).toBe(menu.id)
      expect(token.menuId).toBe(menu.id)
      expect(token.visual.hasVisual).toBe(true)
      expect(token.visual.shadowKind).toBe('alpha-shadow')
      if (token.visual.shadowKind !== 'alpha-shadow') continue
      expect(token.visual.width).toBeGreaterThan(0)
      expect(token.visual.width).toBeLessThanOrEqual(128)
      expect(token.visual.height).toBeGreaterThan(0)
      expect(token.visual.height).toBeLessThanOrEqual(112)
      expect(token.judgement.kind).toBe('alpha-mask')
      if (token.judgement.kind !== 'alpha-mask') continue
      expect(token.judgement.opaquePixelCount).toBeGreaterThan(0)
      expect(token.judgement.alphaThreshold).toBe(32)
      const expectedCenter = EXPECTED_GAMEPLAY_CENTERS[menu.id] ?? { x: 0, y: -7 }
      expect(token.judgement.centerX).toBe(expectedCenter.x)
      expect(token.judgement.centerY).toBe(expectedCenter.y)
      expect(token.captureCenter).toEqual({
        x: expectedCenter.x,
        y: expectedCenter.y + 7,
      })

      const visualStructure = await readTokenVisualStructure(page, menu.id)
      expect(visualStructure.ellipseCount).toBe(0)
      expect(visualStructure.foodTextureImageCount).toBe(3)

      const screenshotName = `${String(index + 1).padStart(2, '0')}-${menu.id}.png`
      await captureTokenScreenshot(page, token.x, token.y, screenshotName)
      report.push({
        menuId: menu.id,
        nameKo: menu.nameKo,
        seed,
        renderWidth: token.visual.width,
        renderHeight: token.visual.height,
        opaquePixelCount: token.judgement.opaquePixelCount,
        centerX: token.judgement.centerX,
        centerY: token.judgement.centerY,
        shadowKind: token.visual.shadowKind,
        screenshot: screenshotName,
      })
    }

    expect(report).toHaveLength(50)
    await writeFile(
      path.join(QA_OUTPUT_DIRECTORY, 'qa-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    )
  })
})

function findFirstMenuSeeds(): ReadonlyMap<string, number> {
  const pending = new Set(MENU_CATALOG.map((menu) => menu.id))
  const seeds = new Map<string, number>()
  for (let seed = 0; seed < 10_000 && pending.size > 0; seed += 1) {
    const firstMenuId = getGameDeckMenuIds({
      mealTime: 'lunch',
      deckSeed: seed,
    })[0]
    if (firstMenuId && pending.delete(firstMenuId)) {
      seeds.set(firstMenuId, seed)
    }
  }
  return seeds
}

async function startSeededGame(
  page: Page,
  seed: number,
  expectedMenuId: string,
): Promise<void> {
  await page.evaluate((deckSeed) => {
    const app = (window as FoodQaWindow).__NHN_APP__
    if (!app) throw new Error('App debug hook is unavailable.')
    app.getDebugState().startSoloGameForTest(deckSeed)
  }, seed)

  const canvas = page.locator('#game-root canvas')
  await expect(canvas).toBeVisible()
  await page.waitForFunction(
    ({ deckSeed, menuId }) => {
      const scene = (window as FoodQaWindow).__NHN_GAME__?.scene.getScene('prototype')
      if (!scene) return false
      const state = scene.getDebugState()
      return (
        state.deckSeed === deckSeed &&
        !state.introVisible &&
        state.activeToken?.menuId === menuId
      )
    },
    { deckSeed: seed, menuId: expectedMenuId },
  )
}

async function readDebugState(page: Page): Promise<FoodQaDebugState> {
  return page.evaluate(() => {
    const scene = (window as FoodQaWindow).__NHN_GAME__?.scene.getScene('prototype')
    if (!scene) throw new Error('Prototype scene is unavailable.')
    return scene.getDebugState()
  })
}

async function readTokenVisualStructure(
  page: Page,
  menuId: string,
): Promise<TokenVisualStructure> {
  return page.evaluate((expectedMenuId) => {
    const scene = (window as FoodQaWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    ) as
      | ({
          activeToken?: {
            container?: {
              list?: ReadonlyArray<{
                readonly type?: string
                readonly texture?: { readonly key?: string }
              }>
            }
          }
        } & { getDebugState: () => FoodQaDebugState })
      | undefined
    const children = scene?.activeToken?.container?.list
    if (!children) throw new Error('Active token container is unavailable.')

    type VisualNode = {
      readonly type?: string
      readonly texture?: { readonly key?: string }
      readonly list?: ReadonlyArray<VisualNode>
    }
    const flattenVisualTree = (
      nodes: ReadonlyArray<VisualNode>,
    ): VisualNode[] =>
      nodes.flatMap((node) => [
        node,
        ...(node.list ? flattenVisualTree(node.list) : []),
      ])
    const visualTree = flattenVisualTree(children as ReadonlyArray<VisualNode>)
    const textureKey = `food:${expectedMenuId}`
    return {
      ellipseCount: visualTree.filter((child) => child.type === 'Ellipse').length,
      foodTextureImageCount: visualTree.filter(
        (child) => child.type === 'Image' && child.texture?.key === textureKey,
      ).length,
    }
  }, menuId)
}

async function captureTokenScreenshot(
  page: Page,
  tokenX: number,
  tokenY: number,
  screenshotName: string,
): Promise<void> {
  const box = await page.locator('#game-root canvas').boundingBox()
  if (!box) throw new Error('Game canvas bounds are unavailable.')

  const scaleX = box.width / LOGICAL_WIDTH
  const scaleY = box.height / LOGICAL_HEIGHT
  const width = Math.min(box.width, 176 * scaleX)
  const height = Math.min(box.height, 176 * scaleY)
  const centerX = box.x + tokenX * scaleX
  const centerY = box.y + tokenY * scaleY
  const x = Math.max(box.x, Math.min(centerX - width / 2, box.x + box.width - width))
  const y = Math.max(box.y, Math.min(centerY - height / 2, box.y + box.height - height))

  await page.screenshot({
    path: path.join(QA_OUTPUT_DIRECTORY, screenshotName),
    clip: { x, y, width, height },
  })
}

import { expect, test, type Locator, type Page } from '@playwright/test'

import { enterMainMenu } from './appEntry'

const LOGICAL_WIDTH = 390
const LOGICAL_HEIGHT = 844

interface DebugScene {
  add: {
    text: (
      x: number,
      y: number,
      text: string,
    ) => {
      destroy: () => void
      style: { resolution: number }
    }
  }
  children: {
    list: Array<{
      name?: string
      text?: string
      style?: { resolution: number }
    }>
  }
  cameras: {
    main: {
      zoomX: number
      zoomY: number
      worldView: {
        x: number
        y: number
        width: number
        height: number
      }
    }
  }
  input: {
    once: (
      event: 'pointerdown',
      listener: (pointer: {
        positionToCamera: (camera: DebugScene['cameras']['main']) => {
          x: number
          y: number
        }
      }) => void,
    ) => void
  }
  getDebugState: () => {
    introVisible: boolean
    practiceStage: 'slice' | 'capture' | 'complete'
    tutorialComplete: boolean
    activeToken: unknown | null
  }
  skipPracticeForTest: () => void
}

interface DebugGame {
  canvas: HTMLCanvasElement
  scale: {
    width: number
    height: number
  }
  scene: {
    getScene: (key: string) => DebugScene
  }
}

interface DebugWindow extends Window {
  __NHN_GAME__?: DebugGame
  __NHN_POINTER_WORLD__?: { x: number; y: number }
}

test('320×568 compact 게임은 전체 폭과 높이를 쓰면서 논리 화면을 자르지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    'compact 실기기 크기는 모바일 Chromium에서 검증합니다.',
  )

  await page.setViewportSize({ width: 320, height: 568 })
  await startSoloGameplay(page)

  const canvas = page.locator('#game-root canvas')
  const bounds = await requiredBox(canvas)
  expect(bounds.x).toBeCloseTo(0, 0)
  expect(bounds.y).toBeCloseTo(0, 0)
  expect(bounds.width).toBeCloseTo(320, 0)
  expect(bounds.height).toBeCloseTo(568, 0)

  const metrics = await readGameLayout(page)
  const expectedRenderScale = Math.min(metrics.devicePixelRatio, 2)
  const expectedZoom = Math.min(
    metrics.backingWidth / LOGICAL_WIDTH,
    metrics.backingHeight / LOGICAL_HEIGHT,
  )
  expect(metrics.backingWidth / bounds.width).toBeCloseTo(
    expectedRenderScale,
    2,
  )
  expect(metrics.backingHeight / bounds.height).toBeCloseTo(
    expectedRenderScale,
    2,
  )
  expect(metrics.scaleWidth).toBe(metrics.backingWidth)
  expect(metrics.scaleHeight).toBe(metrics.backingHeight)
  expect(metrics.zoomX).toBeCloseTo(expectedZoom, 4)
  expect(metrics.zoomY).toBeCloseTo(metrics.zoomX, 6)
  expect(metrics.worldX).toBeLessThanOrEqual(0)
  expect(metrics.worldY).toBeLessThanOrEqual(0)
  expect(metrics.worldX + metrics.worldWidth).toBeGreaterThanOrEqual(
    LOGICAL_WIDTH,
  )
  expect(metrics.worldY + metrics.worldHeight).toBeGreaterThanOrEqual(
    LOGICAL_HEIGHT,
  )
  expect(await readDynamicTextResolution(page)).toBe(expectedRenderScale)

  await expectLogicalPointer(page, 48, 420, true)

  await page.screenshot({
    path: 'tmp/compact-gameplay-320x568.png',
  })

  await showSoloResultsForTest(page)
  await page.screenshot({
    path: 'tmp/compact-solo-results-320x568.png',
  })

  await clickLogicalPoint(page, LOGICAL_WIDTH / 2, 658)
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(canvas).toHaveCount(0)
})

test('320×568 별도 튜토리얼은 전체 폭 진입 버튼과 완료 화면의 홈 입력을 보장한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    'compact 튜토리얼은 모바일 Chromium에서 검증합니다.',
  )

  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/')
  await enterMainMenu(page)

  const tutorialStart = page.getByTestId('tutorial-start')
  const primaryActions = page.locator('.primary-actions')
  await expect(tutorialStart).toBeVisible()
  await expect(tutorialStart).toHaveText('튜토리얼 하기')
  const [tutorialStartBounds, primaryActionsBounds] = await Promise.all([
    requiredBox(tutorialStart),
    requiredBox(primaryActions),
  ])
  expect(tutorialStartBounds.height).toBeGreaterThanOrEqual(44)
  expect(tutorialStartBounds.x).toBeCloseTo(primaryActionsBounds.x, 0)
  expect(tutorialStartBounds.width).toBeCloseTo(primaryActionsBounds.width, 0)

  await tutorialStart.tap()
  const canvas = page.locator('#game-root canvas')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await page.waitForFunction(() => {
    const scene = (window as DebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) {
      return false
    }
    const state = scene.getDebugState()
    return state.introVisible || state.practiceStage === 'slice'
  })

  const canvasBounds = await requiredBox(canvas)
  expect(canvasBounds.x).toBeCloseTo(0, 0)
  expect(canvasBounds.y).toBeCloseTo(0, 0)
  expect(canvasBounds.width).toBeCloseTo(320, 0)
  expect(canvasBounds.height).toBeCloseTo(568, 0)

  const metrics = await readGameLayout(page)
  const expectedRenderScale = Math.min(metrics.devicePixelRatio, 2)
  expect(metrics.backingWidth / canvasBounds.width).toBeCloseTo(
    expectedRenderScale,
    2,
  )
  expect(metrics.backingHeight / canvasBounds.height).toBeCloseTo(
    expectedRenderScale,
    2,
  )
  expect(metrics.zoomX).toBeCloseTo(metrics.zoomY, 6)
  expect(metrics.worldX).toBeLessThanOrEqual(0)
  expect(metrics.worldY).toBeLessThanOrEqual(0)
  expect(metrics.worldX + metrics.worldWidth).toBeGreaterThanOrEqual(
    LOGICAL_WIDTH,
  )
  expect(metrics.worldY + metrics.worldHeight).toBeGreaterThanOrEqual(
    LOGICAL_HEIGHT,
  )
  expect(await readDynamicTextResolution(page)).toBe(expectedRenderScale)

  await page.evaluate(() => {
    const scene = (window as DebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) {
      throw new Error('Prototype scene is unavailable.')
    }
    scene.skipPracticeForTest()
  })
  await expect
    .poll(async () => {
      return page.evaluate(
        () =>
          (window as DebugWindow).__NHN_GAME__?.scene
            .getScene('prototype')
            .getDebugState().tutorialComplete ?? false,
      )
    })
    .toBe(true)

  const completionUi = await page.evaluate(() => {
    const scene = (window as DebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) {
      throw new Error('Prototype scene is unavailable.')
    }
    return {
      names: scene.children.list.map((child) => child.name),
      texts: scene.children.list
        .map((child) => child.text)
        .filter((text): text is string => typeof text === 'string'),
    }
  })
  expect(completionUi.names).toContain('tutorial-retry')
  expect(completionUi.names).toContain('tutorial-home')
  expect(completionUi.texts).toContain('연습 완료!')
  expect(completionUi.texts).toContain('다시 연습')
  expect(completionUi.texts).toContain('홈으로')

  await page.screenshot({
    path: 'tmp/compact-tutorial-complete-320x568.png',
  })

  await clickLogicalPoint(page, LOGICAL_WIDTH / 2, 594)
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(canvas).toHaveCount(0)
})

test('390×844 이상 화면은 기존 FIT 비율과 결과 버튼 입력을 유지한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    '기존 FIT 회귀는 데스크톱 Chromium에서 한 번 검증합니다.',
  )

  await page.setViewportSize({ width: 390, height: 844 })
  await startSoloGameplay(page)

  const canvas = page.locator('#game-root canvas')
  const bounds = await requiredBox(canvas)
  expect(bounds.width).toBeCloseTo(390, 0)
  expect(bounds.height).toBeCloseTo(844, 0)

  const metrics = await readGameLayout(page)
  expect(metrics.backingWidth).toBe(LOGICAL_WIDTH)
  expect(metrics.backingHeight).toBe(LOGICAL_HEIGHT)
  expect(metrics.zoomX).toBeCloseTo(1, 4)
  expect(metrics.zoomY).toBeCloseTo(1, 4)

  await showSoloResultsForTest(page)
  await clickLogicalPoint(page, LOGICAL_WIDTH / 2, 658)
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(canvas).toHaveCount(0)
})

test('Pixel 7 uses capped high-DPI backing with aligned world input', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    'The Pixel 7 DPR contract is verified in mobile Chromium.',
  )

  await startSoloGameplay(page)

  const canvas = page.locator('#game-root canvas')
  const bounds = await requiredBox(canvas)
  const metrics = await readGameLayout(page)
  const expectedRenderScale = Math.min(metrics.devicePixelRatio, 2)

  expect(metrics.backingWidth).toBe(
    Math.round(LOGICAL_WIDTH * expectedRenderScale),
  )
  expect(metrics.backingHeight).toBe(
    Math.round(LOGICAL_HEIGHT * expectedRenderScale),
  )
  expect(metrics.backingWidth / bounds.width).toBeCloseTo(
    expectedRenderScale,
    1,
  )
  expect(metrics.backingHeight / bounds.height).toBeCloseTo(
    expectedRenderScale,
    1,
  )
  expect(metrics.zoomX).toBeCloseTo(expectedRenderScale, 4)
  expect(metrics.zoomY).toBeCloseTo(metrics.zoomX, 6)
  expect(metrics.worldX).toBeCloseTo(0, 3)
  expect(metrics.worldY).toBeCloseTo(0, 3)
  expect(metrics.worldWidth).toBeCloseTo(LOGICAL_WIDTH, 3)
  expect(metrics.worldHeight).toBeCloseTo(LOGICAL_HEIGHT, 3)
  expect(await readDynamicTextResolution(page)).toBe(expectedRenderScale)

  await expectLogicalPointer(page, 342, 420, true)
})

async function startSoloGameplay(page: Page): Promise<void> {
  await page.goto('/')
  await enterMainMenu(page)
  await page.getByTestId('solo-start').click()
  await expect(page.locator('#game-root canvas')).toBeVisible({
    timeout: 15_000,
  })
  await page.waitForFunction(() => {
    const scene = (window as DebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) {
      return false
    }
    const state = scene.getDebugState()
    return state.introVisible || state.activeToken !== null
  })
  await page.evaluate(() => {
    const scene = (window as DebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) {
      throw new Error('Prototype scene is unavailable.')
    }
    scene.skipPracticeForTest()
  })
  await page.waitForFunction(() => {
    const state = (window as DebugWindow).__NHN_GAME__?.scene
      .getScene('prototype')
      .getDebugState()
    return state?.practiceStage === 'complete' && state.activeToken !== null
  })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

async function readGameLayout(page: Page): Promise<{
  devicePixelRatio: number
  backingWidth: number
  backingHeight: number
  scaleWidth: number
  scaleHeight: number
  zoomX: number
  zoomY: number
  worldX: number
  worldY: number
  worldWidth: number
  worldHeight: number
}> {
  return page.evaluate(() => {
    const game = (window as DebugWindow).__NHN_GAME__
    if (!game) {
      throw new Error('Debug game is unavailable.')
    }
    const camera = game.scene.getScene('prototype').cameras.main
    return {
      devicePixelRatio: window.devicePixelRatio,
      backingWidth: game.canvas.width,
      backingHeight: game.canvas.height,
      scaleWidth: game.scale.width,
      scaleHeight: game.scale.height,
      zoomX: camera.zoomX,
      zoomY: camera.zoomY,
      worldX: camera.worldView.x,
      worldY: camera.worldView.y,
      worldWidth: camera.worldView.width,
      worldHeight: camera.worldView.height,
    }
  })
}

async function showSoloResultsForTest(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scene = (window as DebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    ) as DebugScene & {
      activeToken?: {
        tween?: { stop: () => void }
        rotationTween?: { stop: () => void }
        container?: { destroy: () => void }
      } | null
      deck: Array<{ id: string }>
      rounds: Array<{
        roundIndex: number
        menuId: string
        action: { type: 'slice'; accuracy: number }
      }>
      showResults: () => void
    }
    if (!scene) {
      throw new Error('Prototype scene is unavailable.')
    }
    scene.activeToken?.tween?.stop()
    scene.activeToken?.rotationTween?.stop()
    scene.activeToken?.container?.destroy()
    scene.activeToken = null
    scene.rounds = scene.deck.map((menu, roundIndex) => ({
      roundIndex,
      menuId: menu.id,
      action: { type: 'slice', accuracy: 88 },
    }))
    scene.showResults()
  })
  await page.waitForTimeout(250)
}

async function clickLogicalPoint(
  page: Page,
  logicalX: number,
  logicalY: number,
): Promise<void> {
  await activateLogicalPoint(page, logicalX, logicalY, false)
}

async function expectLogicalPointer(
  page: Page,
  logicalX: number,
  logicalY: number,
  useTap: boolean,
): Promise<void> {
  await page.evaluate(() => {
    const debugWindow = window as DebugWindow
    const scene = debugWindow.__NHN_GAME__?.scene.getScene('prototype')
    if (!scene) {
      throw new Error('Prototype scene is unavailable.')
    }
    delete debugWindow.__NHN_POINTER_WORLD__
    scene.input.once('pointerdown', (pointer) => {
      const worldPoint = pointer.positionToCamera(scene.cameras.main)
      debugWindow.__NHN_POINTER_WORLD__ = {
        x: worldPoint.x,
        y: worldPoint.y,
      }
    })
  })

  await activateLogicalPoint(page, logicalX, logicalY, useTap)
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as DebugWindow).__NHN_POINTER_WORLD__ ?? null,
      ),
    )
    .not.toBeNull()

  const worldPoint = await page.evaluate(
    () => (window as DebugWindow).__NHN_POINTER_WORLD__,
  )
  expect(worldPoint).toBeDefined()
  expect(Math.abs(worldPoint!.x - logicalX)).toBeLessThan(2)
  expect(Math.abs(worldPoint!.y - logicalY)).toBeLessThan(2)
}

async function activateLogicalPoint(
  page: Page,
  logicalX: number,
  logicalY: number,
  useTap: boolean,
): Promise<void> {
  const canvas = page.locator('#game-root canvas')
  const bounds = await requiredBox(canvas)
  const metrics = await readGameLayout(page)
  const position = {
    x: ((logicalX - metrics.worldX) / metrics.worldWidth) * bounds.width,
    y: ((logicalY - metrics.worldY) / metrics.worldHeight) * bounds.height,
  }

  if (useTap) {
    await canvas.tap({ position })
  } else {
    await canvas.click({ position })
  }
}

async function readDynamicTextResolution(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scene = (window as DebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) {
      throw new Error('Prototype scene is unavailable.')
    }

    const probe = scene.add.text(-1_000, -1_000, 'DPR probe')
    try {
      return probe.style.resolution
    } finally {
      probe.destroy()
    }
  })
}

async function requiredBox(
  locator: Locator,
): Promise<NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>> {
  const bounds = await locator.boundingBox()
  expect(bounds).not.toBeNull()
  return bounds!
}

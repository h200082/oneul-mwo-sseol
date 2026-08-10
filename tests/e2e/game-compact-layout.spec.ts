import { expect, test, type Locator, type Page } from '@playwright/test'

import { enterMainMenu } from './appEntry'

const LOGICAL_WIDTH = 390
const LOGICAL_HEIGHT = 844

interface DebugScene {
  children: {
    list: Array<{
      name?: string
      text?: string
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
  expect(metrics.backingWidth).toBe(320)
  expect(metrics.backingHeight).toBe(568)
  expect(metrics.scaleWidth).toBe(320)
  expect(metrics.scaleHeight).toBe(568)
  expect(metrics.zoomX).toBeCloseTo(320 / LOGICAL_WIDTH, 4)
  expect(metrics.zoomY).toBeCloseTo(568 / LOGICAL_HEIGHT, 4)
  expect(metrics.worldX).toBeCloseTo(0, 3)
  expect(metrics.worldY).toBeCloseTo(0, 3)
  expect(metrics.worldWidth).toBeCloseTo(LOGICAL_WIDTH, 3)
  expect(metrics.worldHeight).toBeCloseTo(LOGICAL_HEIGHT, 3)

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
  expect(metrics.backingWidth).toBe(320)
  expect(metrics.backingHeight).toBe(568)
  expect(metrics.worldWidth).toBeCloseTo(LOGICAL_WIDTH, 3)
  expect(metrics.worldHeight).toBeCloseTo(LOGICAL_HEIGHT, 3)

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
  const canvas = page.locator('#game-root canvas')
  const bounds = await requiredBox(canvas)
  await canvas.click({
    position: {
      x: (logicalX / LOGICAL_WIDTH) * bounds.width,
      y: (logicalY / LOGICAL_HEIGHT) * bounds.height,
    },
  })
}

async function requiredBox(
  locator: Locator,
): Promise<NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>> {
  const bounds = await locator.boundingBox()
  expect(bounds).not.toBeNull()
  return bounds!
}

import { expect, test, type Page } from '@playwright/test'

import { getRoundHorizontalMotion } from '../../src/game/roundMotion'

interface HorizontalDebugState {
  readonly enabled: boolean
  readonly direction: -1 | 0 | 1
  readonly requestedAmplitude: number
  readonly amplitude: number
  readonly cycles: number
  readonly baseX: number
  readonly currentOffset: number
}

interface HorizontalSceneDebugState {
  readonly activeToken: {
    readonly menuId: string
    readonly x: number
    readonly y: number
    readonly currentCaptureCenter: { readonly x: number; readonly y: number }
    readonly horizontal: HorizontalDebugState
    readonly visual: {
      readonly horizontalSafetyRadius: number
    }
  } | null
  readonly completedRounds: number
  readonly captureCount: number
  readonly lastAction: 'slice' | 'capture' | 'miss' | null
  readonly inputMode: 'idle' | 'hold' | 'slice'
  readonly deckSeed: number | string
  readonly introVisible: boolean
}

interface HorizontalTestWindow extends Window {
  __NHN_APP__?: {
    getDebugState: () => {
      startSoloGameForTest: (deckSeed: number | string) => void
    }
  }
  __NHN_GAME__?: {
    scene: {
      getScene: (key: string) => {
        getDebugState: () => HorizontalSceneDebugState
      }
    }
  }
}

interface HorizontalVisualStructure {
  readonly outerX: number
  readonly artworkLocalX: number
  readonly artworkWorldX: number
  readonly labelLocalX: number
  readonly labelWorldX: number
  readonly artworkIsTopLevel: boolean
  readonly labelIsTopLevel: boolean
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('moves only the final two foods and carries upright label and artwork together', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const deckSeed = 'horizontal-e2e-seed-v1'
  await startSeededGame(page, deckSeed)
  await advanceToRound(page, 17)

  const beforeFinalTwo = await readDebugState(page)
  expect(beforeFinalTwo.activeToken?.horizontal).toMatchObject({
    enabled: false,
    direction: 0,
    requestedAmplitude: 0,
    amplitude: 0,
    cycles: 0,
    currentOffset: 0,
  })

  await forceMissAndWaitForRound(page, 17)
  const nineteenthRound = await assertMovingRound(page, {
    deckSeed,
    roundIndex: 18,
    requestedAmplitude: 32,
    cycles: 1,
  })

  await startSeededGame(page, deckSeed)
  await advanceToRound(page, 18)
  const replay = await readDebugState(page)
  expect(replay.activeToken?.horizontal).toMatchObject({
    direction: nineteenthRound.direction,
    requestedAmplitude: nineteenthRound.requestedAmplitude,
    amplitude: nineteenthRound.amplitude,
    cycles: nineteenthRound.cycles,
    baseX: nineteenthRound.baseX,
  })

  await forceMissAndWaitForRound(page, 18)
  const twentiethRound = await assertMovingRound(page, {
    deckSeed,
    roundIndex: 19,
    requestedAmplitude: 46,
    cycles: 1.5,
  })

  expect(nineteenthRound.direction).toBe(
    getRoundHorizontalMotion(deckSeed, 18).direction,
  )
  expect(twentiethRound.direction).toBe(
    getRoundHorizontalMotion(deckSeed, 19).direction,
  )

  await captureMovingToken(page)
})

async function assertMovingRound(
  page: Page,
  expected: {
    readonly deckSeed: number | string
    readonly roundIndex: 18 | 19
    readonly requestedAmplitude: 32 | 46
    readonly cycles: 1 | 1.5
  },
): Promise<HorizontalDebugState> {
  const initial = await readDebugState(page)
  const token = initial.activeToken
  expect(initial.completedRounds).toBe(expected.roundIndex)
  expect(token).not.toBeNull()
  if (!token) throw new Error('Expected an active final-two token.')

  expect(token.horizontal).toMatchObject({
    enabled: true,
    requestedAmplitude: expected.requestedAmplitude,
    amplitude: expected.requestedAmplitude,
    cycles: expected.cycles,
  })
  expect([-1, 1]).toContain(token.horizontal.direction)
  expect(token.horizontal.direction).toBe(
    getRoundHorizontalMotion(expected.deckSeed, expected.roundIndex).direction,
  )
  expect(token.x).toBeCloseTo(
    token.horizontal.baseX + token.horizontal.currentOffset,
    4,
  )
  expect(
    token.horizontal.baseX -
      token.horizontal.amplitude -
      token.visual.horizontalSafetyRadius,
  ).toBeGreaterThanOrEqual(18)
  expect(
    token.horizontal.baseX +
      token.horizontal.amplitude +
      token.visual.horizontalSafetyRadius,
  ).toBeLessThanOrEqual(372)

  const initialStructure = await readVisualStructure(page)
  expect(initialStructure).toMatchObject({
    artworkIsTopLevel: true,
    labelIsTopLevel: true,
  })

  await page.waitForTimeout(220)

  const moving = await readDebugState(page)
  const movingToken = moving.activeToken
  expect(movingToken?.menuId).toBe(token.menuId)
  if (!movingToken) throw new Error('The final-two token disappeared early.')

  expect(
    Math.abs(
      movingToken.horizontal.currentOffset - token.horizontal.currentOffset,
    ),
  ).toBeGreaterThan(3)
  expect(Math.abs(movingToken.x - token.x)).toBeGreaterThan(3)
  expect(movingToken.x).toBeCloseTo(
    movingToken.horizontal.baseX + movingToken.horizontal.currentOffset,
    4,
  )

  const movingStructure = await readVisualStructure(page)
  const outerDelta = movingStructure.outerX - initialStructure.outerX
  expect(Math.abs(outerDelta)).toBeGreaterThan(3)
  expect(movingStructure.artworkLocalX).toBeCloseTo(
    initialStructure.artworkLocalX,
    5,
  )
  expect(movingStructure.labelLocalX).toBeCloseTo(
    initialStructure.labelLocalX,
    5,
  )
  expect(
    movingStructure.artworkWorldX - initialStructure.artworkWorldX,
  ).toBeCloseTo(outerDelta, 4)
  expect(
    movingStructure.labelWorldX - initialStructure.labelWorldX,
  ).toBeCloseTo(outerDelta, 4)

  return movingToken.horizontal
}

async function captureMovingToken(page: Page): Promise<void> {
  const token = (await readDebugState(page)).activeToken
  if (!token) throw new Error('Expected a moving token to capture.')

  const capturePoint = await toPagePoint(page, {
    x: token.x + token.currentCaptureCenter.x,
    y: token.y + token.currentCaptureCenter.y,
  })
  const hasTouch = await page.evaluate(() => navigator.maxTouchPoints > 0)

  if (hasTouch) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { ...capturePoint, id: 1, radiusX: 1, radiusY: 1, force: 1 },
      ],
    })
    await expect
      .poll(async () => (await readDebugState(page)).inputMode)
      .toBe('hold')
    await expect
      .poll(async () => (await readDebugState(page)).completedRounds, {
        timeout: 1_000,
      })
      .toBe(20)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  } else {
    await page.mouse.move(capturePoint.x, capturePoint.y)
    await page.mouse.down()
    await expect
      .poll(async () => (await readDebugState(page)).inputMode)
      .toBe('hold')
    await expect
      .poll(async () => (await readDebugState(page)).completedRounds, {
        timeout: 1_000,
      })
      .toBe(20)
    await page.mouse.up()
  }

  const completed = await readDebugState(page)
  expect(completed.captureCount).toBe(1)
  expect(completed.lastAction).toBe('capture')
}

async function toPagePoint(
  page: Page,
  logicalPoint: { readonly x: number; readonly y: number },
): Promise<{ readonly x: number; readonly y: number }> {
  const box = await page.locator('#game-root canvas').boundingBox()
  if (!box) throw new Error('Game canvas bounds are unavailable.')
  return {
    x: box.x + logicalPoint.x * (box.width / 390),
    y: box.y + logicalPoint.y * (box.height / 844),
  }
}

async function startSeededGame(
  page: Page,
  deckSeed: number | string,
): Promise<void> {
  await page.waitForFunction(() =>
    Boolean((window as HorizontalTestWindow).__NHN_APP__),
  )
  await page.evaluate((seed) => {
    const app = (window as HorizontalTestWindow).__NHN_APP__
    if (!app) throw new Error('App debug hook is unavailable.')
    app.getDebugState().startSoloGameForTest(seed)
  }, deckSeed)

  const canvas = page.locator('#game-root canvas')
  await expect(canvas).toBeVisible()
  await waitForRound(page, 0)
}

async function advanceToRound(
  page: Page,
  targetRoundIndex: number,
): Promise<void> {
  const state = await readDebugState(page)
  for (
    let roundIndex = state.completedRounds;
    roundIndex < targetRoundIndex;
    roundIndex += 1
  ) {
    await forceMissAndWaitForRound(page, roundIndex)
  }
}

async function forceMissAndWaitForRound(
  page: Page,
  currentRoundIndex: number,
): Promise<void> {
  await page.evaluate((expectedRoundIndex) => {
    const scene = (window as HorizontalTestWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    ) as
      | {
          getDebugState: () => HorizontalSceneDebugState
          resolveRound: (action: { readonly type: 'miss' }) => void
        }
      | undefined
    if (!scene) throw new Error('Prototype scene is unavailable.')
    const state = scene.getDebugState()
    if (state.completedRounds !== expectedRoundIndex || !state.activeToken) {
      throw new Error('Cannot force a miss outside the expected active round.')
    }
    scene.resolveRound({ type: 'miss' })
  }, currentRoundIndex)

  await waitForRound(page, currentRoundIndex + 1)
}

async function waitForRound(page: Page, roundIndex: number): Promise<void> {
  await page.waitForFunction((expectedRoundIndex) => {
    const scene = (window as HorizontalTestWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) return false
    const state = scene.getDebugState()
    return (
      state.completedRounds === expectedRoundIndex &&
      state.activeToken !== null
    )
  }, roundIndex)
}

async function readDebugState(page: Page): Promise<HorizontalSceneDebugState> {
  return page.evaluate(() => {
    const scene = (window as HorizontalTestWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) throw new Error('Prototype scene is unavailable.')
    return scene.getDebugState()
  })
}

async function readVisualStructure(
  page: Page,
): Promise<HorizontalVisualStructure> {
  return page.evaluate(() => {
    interface RuntimeNode {
      readonly type?: string
      readonly x?: number
      readonly list?: readonly RuntimeNode[]
      readonly parentContainer?: RuntimeNode | null
    }
    const scene = (window as HorizontalTestWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    ) as
      | {
          activeToken?: {
            readonly container?: RuntimeNode
            readonly rotatingArtwork?: RuntimeNode
          }
        }
      | undefined
    const token = scene?.activeToken
    const outer = token?.container
    const artwork = token?.rotatingArtwork
    if (!outer?.list || !artwork) {
      throw new Error('Nested token artwork is unavailable.')
    }

    const label = outer.list.find((node) => node.type === 'Text')
    if (!label) throw new Error('The token label is unavailable.')
    const outerX = outer.x ?? 0
    const artworkLocalX = artwork.x ?? 0
    const labelLocalX = label.x ?? 0
    return {
      outerX,
      artworkLocalX,
      artworkWorldX: outerX + artworkLocalX,
      labelLocalX,
      labelWorldX: outerX + labelLocalX,
      artworkIsTopLevel: artwork.parentContainer === outer,
      labelIsTopLevel: label.parentContainer === outer,
    }
  })
}

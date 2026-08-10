import { expect, test, type Page } from '@playwright/test'

import { enterMainMenu } from './appEntry'

interface PrototypeDebugState {
  readonly activeToken: {
    readonly x: number
    readonly y: number
    readonly menuId: string
    readonly fallDurationMs: number
    readonly currentCaptureCenter: { readonly x: number; readonly y: number }
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
      readonly width: number
      readonly height: number
    }
  } | null
  readonly captureEffectY: number | null
  readonly completedRounds: number
  readonly captureCount: number
  readonly filledCaptureSlotCount: number
  readonly pathPointCount: number
  readonly localPathPointCount: number
  readonly lastSliceAngleDegrees: number | null
  readonly lastSliceSource: 'strict' | 'extended' | null
  readonly lastSliceFxTier:
    | 'needs-practice'
    | 'good'
    | 'great'
    | 'perfect'
    | null
  readonly lastSliceFxProfile: {
    readonly hitStopMs: number
    readonly shakeDurationMs: number
    readonly shakeIntensity: number
    readonly particleCount: number
  } | null
  readonly inputMode: 'idle' | 'hold' | 'slice'
  readonly activeSlicePieceCount: number
  readonly cleanedSlicePieceCount: number
  readonly activeSliceFxObjectCount: number
  readonly cleanedSliceFxObjectCount: number
  readonly reducedMotion: boolean
  readonly lastAction: 'slice' | 'capture' | 'miss' | null
  readonly feedback: string
  readonly introVisible: boolean
  readonly practiceStage: 'slice' | 'capture' | 'complete'
  readonly tutorialComplete: boolean
  readonly completedPracticeActions: readonly ('slice' | 'capture')[]
  readonly currentSliceStreak: number
  readonly lastAnnouncedSliceStreak: number | null
  readonly activeSliceStreakBanner: number | null
  readonly personalBestPresentation: {
    readonly bestScore: number
    readonly status: 'first' | 'new' | 'existing'
  } | null
  readonly deckMenuIds: readonly string[]
  readonly sensoryFeedback: {
    readonly musicRequested: boolean
    readonly musicIntensity:
      | 'opening'
      | 'rotation'
      | 'final-five'
      | 'final-two'
      | null
    readonly narrationPlaying: boolean
  }
}

interface PrototypeDebugWindow extends Window {
  __NHN_APP__?: {
    getDebugState: () => {
      startSoloGameForTest: (deckSeed: number | string) => void
    }
  }
  __NHN_GAME__?: {
    scene: {
      getScene: (key: string) => {
        children: {
          list: Array<{
            name?: string
            text?: string
            texture?: { key: string }
            displayWidth?: number
            displayHeight?: number
          }>
        }
        getDebugState: () => PrototypeDebugState
        skipPracticeForTest: () => void
      }
    }
  }
}

async function readDebugState(page: Page): Promise<PrototypeDebugState> {
  return page.evaluate(() => {
    const debugWindow = window as PrototypeDebugWindow
    const scene = debugWindow.__NHN_GAME__?.scene.getScene('prototype')

    if (!scene) {
      throw new Error('프로토타입 디버그 장면을 찾을 수 없습니다.')
    }

    return scene.getDebugState()
  })
}

async function waitForActiveToken(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const debugWindow = window as PrototypeDebugWindow
    return Boolean(
      debugWindow.__NHN_GAME__?.scene.getScene('prototype').getDebugState()
        .activeToken,
    )
  })
}

const LOGICAL_WIDTH = 390
const LOGICAL_HEIGHT = 844

interface CanvasTransform {
  readonly x: number
  readonly y: number
  readonly scaleX: number
  readonly scaleY: number
}

async function getCanvasTransform(page: Page): Promise<CanvasTransform> {
  const box = await page.locator('#game-root canvas').boundingBox()

  if (!box) {
    throw new Error('게임 캔버스의 화면 위치를 찾을 수 없습니다.')
  }

  return {
    x: box.x,
    y: box.y,
    scaleX: box.width / LOGICAL_WIDTH,
    scaleY: box.height / LOGICAL_HEIGHT,
  }
}

function toPagePoint(transform: CanvasTransform, x: number, y: number) {
  return {
    x: transform.x + x * transform.scaleX,
    y: transform.y + y * transform.scaleY,
  }
}

async function tapGameCanvas(page: Page): Promise<void> {
  const canvas = page.locator('#game-root canvas')
  const hasTouch = await page.evaluate(() => navigator.maxTouchPoints > 0)

  if (hasTouch) {
    await canvas.tap({ position: { x: 12, y: 12 } })
  } else {
    await canvas.click({ position: { x: 12, y: 12 } })
  }
}

async function skipSoloIntro(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const debugWindow = window as PrototypeDebugWindow
    const scene = debugWindow.__NHN_GAME__?.scene.getScene('prototype')

    if (!scene) {
      return false
    }

    const state = scene.getDebugState()
    return state.introVisible || state.activeToken !== null
  })

  if (!(await readDebugState(page)).introVisible) {
    return
  }

  await tapGameCanvas(page)
  await expect
    .poll(async () => (await readDebugState(page)).introVisible)
    .toBe(false)
}

async function skipPracticeForGameplayTest(page: Page): Promise<void> {
  await waitForActiveToken(page)
  await page.evaluate(() => {
    const scene = (window as PrototypeDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) {
      throw new Error('프로토타입 디버그 장면을 찾을 수 없습니다.')
    }
    scene.skipPracticeForTest()
  })
  await page.waitForFunction(() => {
    const state = (window as PrototypeDebugWindow).__NHN_GAME__?.scene
      .getScene('prototype')
      .getDebugState()
    return state?.practiceStage === 'complete' && state.activeToken !== null
  })
}

async function startSoloGame(page: Page): Promise<void> {
  await enterMainMenu(page)
  await page.getByTestId('solo-start').click()
  await expect(page.locator('#game-root canvas')).toBeVisible()
  await skipSoloIntro(page)
  await skipPracticeForGameplayTest(page)
}

async function startVisualGameForTest(
  page: Page,
  deckSeed: number | string = 7,
): Promise<void> {
  await enterMainMenu(page)
  await page.waitForFunction(() =>
    Boolean((window as PrototypeDebugWindow).__NHN_APP__),
  )
  await page.evaluate((seed) => {
    const debugWindow = window as PrototypeDebugWindow
    const app = debugWindow.__NHN_APP__

    if (!app) {
      throw new Error('앱 디버그 훅을 찾을 수 없습니다.')
    }

    app.getDebugState().startSoloGameForTest(seed)
  }, deckSeed)
  await expect(page.locator('#game-root canvas')).toBeVisible()
  await skipSoloIntro(page)
  await skipPracticeForGameplayTest(page)
}

async function sliceCurrentToken(
  page: Page,
  expectedCompletedRounds = 1,
): Promise<void> {
  await waitForActiveToken(page)
  await page.evaluate(() => {
    const debugWindow = window as PrototypeDebugWindow
    const scene = debugWindow.__NHN_GAME__?.scene.getScene(
      'prototype',
    ) as unknown as {
      activeToken?: {
        tween?: { pause: () => void }
        rotationTween?: { pause: () => void }
      }
    }
    scene.activeToken?.tween?.pause()
    scene.activeToken?.rotationTween?.pause()
  })
  const token = (await readDebugState(page)).activeToken

  if (!token) {
    throw new Error('베기 테스트를 위한 활성 음식이 없습니다.')
  }

  const transform = await getCanvasTransform(page)
  const sliceCenterX =
    token.x +
    (token.judgement.kind === 'alpha-mask'
      ? token.judgement.centerX
      : 0)
  const sliceY =
    token.y +
    (token.judgement.kind === 'alpha-mask'
      ? token.judgement.centerY
      : 0)
  const sliceStart = toPagePoint(
    transform,
    sliceCenterX - token.judgement.radius * 1.5,
    sliceY,
  )
  const sliceEnd = toPagePoint(
    transform,
    sliceCenterX + token.judgement.radius * 1.5,
    sliceY,
  )

  await page.mouse.move(sliceStart.x, sliceStart.y)
  await page.mouse.down()
  await page.mouse.move(sliceEnd.x, sliceEnd.y, { steps: 1 })
  await page.mouse.up()

  await expect
    .poll(async () => (await readDebugState(page)).completedRounds)
    .toBe(expectedCompletedRounds)
  await expect
    .poll(async () => (await readDebugState(page)).lastAction)
    .toBe('slice')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('home defers food assets and solo loads exactly its twenty-menu deck', async ({
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    'The request-scope contract is identical across viewports.',
  )

  const requestedMenuIds: string[] = []
  const freshPage = await context.newPage()
  freshPage.on('request', (request) => {
    if (request.resourceType() !== 'image') {
      return
    }
    const pathname = decodeURIComponent(new URL(request.url()).pathname)
    if (!pathname.includes('/src/assets/food/')) {
      return
    }
    const filename = pathname.split('/').at(-1) ?? ''
    if (!filename.endsWith('.webp')) {
      return
    }
    requestedMenuIds.push(
      filename.replace(/-v2(?=\.webp$)/, '').replace(/\.webp$/, ''),
    )
  })

  try {
    await freshPage.goto('/?asset-preload-probe=1')
    await freshPage.waitForFunction(() =>
      Boolean((window as PrototypeDebugWindow).__NHN_APP__),
    )
    await expect(freshPage.getByTestId('splash-screen')).toBeVisible()
    await freshPage.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }),
    )
    expect(requestedMenuIds).toEqual([])

    await enterMainMenu(freshPage)
    await freshPage.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }),
    )
    expect(requestedMenuIds).toEqual([])

    await startVisualGameForTest(freshPage, 'deck-preload-scope-v1')
    const debugState = await readDebugState(freshPage)

    expect(debugState.deckMenuIds).toHaveLength(20)
    expect(new Set(debugState.deckMenuIds).size).toBe(20)
    expect(requestedMenuIds).toHaveLength(20)
    expect(new Set(requestedMenuIds)).toEqual(new Set(debugState.deckMenuIds))
  } finally {
    await freshPage.close()
  }
})
test('crypto.randomUUID가 없는 모바일 HTTP 환경에서도 혼자 하기를 시작한다', async ({
  page,
}) => {
  await page.evaluate(() => sessionStorage.clear())
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    })
  })

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.reload()

  await expect
    .poll(() => page.evaluate(() => typeof crypto.randomUUID))
    .toBe('undefined')
  await startSoloGame(page)
  await waitForActiveToken(page)

  expect(pageErrors).toEqual([])
})

test('일반 혼자 하기는 연습 없이 첫 실전 라운드를 즉시 시작한다', async ({
  page,
}) => {
  await enterMainMenu(page)
  await page.getByTestId('solo-start').click()
  await expect(page.locator('#game-root canvas')).toBeVisible()
  await waitForActiveToken(page)

  const firstRound = await readDebugState(page)
  expect(firstRound.practiceStage).toBe('complete')
  expect(firstRound.tutorialComplete).toBe(false)
  expect(firstRound.introVisible).toBe(false)
  expect(firstRound.activeToken).not.toBeNull()
  expect(firstRound.completedRounds).toBe(0)
  expect(firstRound.captureCount).toBe(0)
  expect(firstRound.lastAction).toBeNull()
  expect(firstRound.activeToken?.menuId).toBe(firstRound.deckMenuIds[0])
})

test('베기와 포획 연습은 순서대로 진행되고 실전 점수·포획·deck을 소모하지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '연습 상태와 점수 격리는 데스크톱 Chromium에서 한 번 검증합니다.',
  )

  await enterMainMenu(page)
  await page.getByTestId('tutorial-start').click()
  await expect(page.locator('#game-root canvas')).toBeVisible()
  await skipSoloIntro(page)
  await waitForActiveToken(page)

  const slicePractice = await readDebugState(page)
  const sliceToken = slicePractice.activeToken
  expect(slicePractice.practiceStage).toBe('slice')
  expect(slicePractice.tutorialComplete).toBe(false)
  expect(slicePractice.sensoryFeedback.musicRequested).toBe(true)
  expect(slicePractice.sensoryFeedback.musicIntensity).toBe('opening')
  expect(slicePractice.completedPracticeActions).toEqual([])
  expect(slicePractice.completedRounds).toBe(0)
  expect(slicePractice.captureCount).toBe(0)
  expect(slicePractice.filledCaptureSlotCount).toBe(0)
  expect(slicePractice.lastAction).toBeNull()
  expect(sliceToken).not.toBeNull()
  if (!sliceToken) return

  await page.evaluate(() => {
    const scene = (window as PrototypeDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    ) as unknown as {
      activeToken?: {
        tween?: { pause: () => void }
        rotationTween?: { pause: () => void }
      }
    }
    scene.activeToken?.tween?.pause()
    scene.activeToken?.rotationTween?.pause()
  })
  const transform = await getCanvasTransform(page)
  const sliceCenterX =
    sliceToken.x +
    (sliceToken.judgement.kind === 'alpha-mask'
      ? sliceToken.judgement.centerX
      : 0)
  const sliceCenterY =
    sliceToken.y +
    (sliceToken.judgement.kind === 'alpha-mask'
      ? sliceToken.judgement.centerY
      : 0)
  const sliceStart = toPagePoint(
    transform,
    sliceCenterX - sliceToken.judgement.radius * 1.5,
    sliceCenterY,
  )
  const sliceEnd = toPagePoint(
    transform,
    sliceCenterX + sliceToken.judgement.radius * 1.5,
    sliceCenterY,
  )
  await page.mouse.move(sliceStart.x, sliceStart.y)
  await page.mouse.down()
  await page.mouse.move(sliceEnd.x, sliceEnd.y, { steps: 6 })
  await page.mouse.up()

  await expect
    .poll(async () => (await readDebugState(page)).practiceStage)
    .toBe('capture')
  const afterPracticeSlice = await readDebugState(page)
  expect(afterPracticeSlice.completedPracticeActions).toEqual(['slice'])
  expect(afterPracticeSlice.completedRounds).toBe(0)
  expect(afterPracticeSlice.captureCount).toBe(0)
  expect(afterPracticeSlice.filledCaptureSlotCount).toBe(0)
  expect(afterPracticeSlice.lastAction).toBeNull()

  await waitForActiveToken(page)
  const capturePractice = await readDebugState(page)
  const captureToken = capturePractice.activeToken
  expect(capturePractice.practiceStage).toBe('capture')
  expect(captureToken).not.toBeNull()
  if (!captureToken) return

  await page.evaluate(() => {
    const game = (window as PrototypeDebugWindow)
      .__NHN_GAME__ as unknown as {
      events: { once: (eventName: string, handler: () => void) => void }
    }
    game.events.once('tutorial-complete', () => {
      document.body.dataset.tutorialCompleteEvent = 'received'
    })
  })

  const capturePoint = toPagePoint(
    transform,
    captureToken.x + captureToken.currentCaptureCenter.x,
    captureToken.y + captureToken.currentCaptureCenter.y,
  )
  await page.mouse.move(capturePoint.x, capturePoint.y)
  await page.mouse.down()
  await expect
    .poll(async () => (await readDebugState(page)).practiceStage, {
      timeout: 1_000,
    })
    .toBe('complete')
  await page.mouse.up()

  const afterPracticeCapture = await readDebugState(page)
  expect(afterPracticeCapture.completedPracticeActions).toEqual([
    'slice',
    'capture',
  ])
  expect(afterPracticeCapture.completedRounds).toBe(0)
  expect(afterPracticeCapture.captureCount).toBe(0)
  expect(afterPracticeCapture.filledCaptureSlotCount).toBe(0)
  expect(afterPracticeCapture.lastAction).toBeNull()
  await expect
    .poll(async () => (await readDebugState(page)).tutorialComplete, {
      timeout: 2_000,
    })
    .toBe(true)

  const completedTutorial = await readDebugState(page)
  expect(completedTutorial.practiceStage).toBe('complete')
  expect(completedTutorial.activeToken).toBeNull()
  expect(completedTutorial.completedRounds).toBe(0)
  expect(completedTutorial.captureCount).toBe(0)
  expect(completedTutorial.filledCaptureSlotCount).toBe(0)
  expect(completedTutorial.lastAction).toBeNull()
  expect(completedTutorial.personalBestPresentation).toBeNull()
  expect(completedTutorial.sensoryFeedback.musicRequested).toBe(false)
  expect(completedTutorial.sensoryFeedback.narrationPlaying).toBe(false)
  await expect(page.locator('body')).toHaveAttribute(
    'data-tutorial-complete-event',
    'received',
  )

  await page.waitForTimeout(650)
  expect((await readDebugState(page)).activeToken).toBeNull()

  const completionUi = await page.evaluate(() => {
    const scene = (window as PrototypeDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    return {
      names: scene?.children.list.map((child) => child.name) ?? [],
      texts: scene?.children.list
        .map((child) => child.text)
        .filter((text): text is string => typeof text === 'string') ?? [],
    }
  })
  expect(completionUi.names).toContain('tutorial-retry')
  expect(completionUi.names).toContain('tutorial-home')
  expect(completionUi.texts).toContain('연습 완료!')
  expect(completionUi.texts).toContain('다시 연습')
  expect(completionUi.texts).toContain('홈으로')

  const tutorialDeckMenuIds = [...completedTutorial.deckMenuIds]
  const retryPoint = toPagePoint(transform, LOGICAL_WIDTH / 2, 528)
  await page.mouse.click(retryPoint.x, retryPoint.y)
  await expect
    .poll(async () => {
      const state = await readDebugState(page)
      return {
        completedRounds: state.completedRounds,
        introVisible: state.introVisible,
        practiceStage: state.practiceStage,
        tutorialComplete: state.tutorialComplete,
      }
    })
    .toEqual({
      completedRounds: 0,
      introVisible: true,
      practiceStage: 'slice',
      tutorialComplete: false,
    })
  expect((await readDebugState(page)).deckMenuIds).toEqual(
    tutorialDeckMenuIds,
  )

  await skipSoloIntro(page)
  await waitForActiveToken(page)
  await page.evaluate(() => {
    const scene = (window as PrototypeDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    scene?.skipPracticeForTest()
  })
  await expect
    .poll(async () => (await readDebugState(page)).tutorialComplete)
    .toBe(true)
  await page.waitForTimeout(100)
  const retryTransform = await getCanvasTransform(page)
  const homePoint = toPagePoint(retryTransform, LOGICAL_WIDTH / 2, 594)
  await page.mouse.click(homePoint.x, homePoint.y)
  await expect(page.getByTestId('home-screen')).toBeVisible()
})

test('첫 번째와 두 번째 음식을 연속으로 벨 수 있다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '연속 베기 상태 전환은 데스크톱 Chromium에서 한 번 검증합니다.',
  )

  await startSoloGame(page)

  const initialState = await readDebugState(page)
  expect(initialState.practiceStage).toBe('complete')
  expect(initialState.introVisible).toBe(false)
  expect(initialState.completedRounds).toBe(0)

  await sliceCurrentToken(page, 1)
  await sliceCurrentToken(page, 2)

  const afterSecondSlice = await readDebugState(page)
  expect(afterSecondSlice.completedRounds).toBe(2)
  expect(afterSecondSlice.lastAction).toBe('slice')
})

test('실전 베기 스트릭은 3·5·8에서 연출되고 놓치면 초기화된다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '연속 실제 포인터 베기와 배너 상태는 데스크톱 Chromium에서 검증합니다.',
  )

  await startVisualGameForTest(page, 'slice-streak-e2e-v1')
  for (let completedRounds = 1; completedRounds <= 8; completedRounds += 1) {
    await sliceCurrentToken(page, completedRounds)
    const state = await readDebugState(page)
    expect(state.currentSliceStreak).toBe(completedRounds)
    if ([3, 5, 8].includes(completedRounds)) {
      expect(state.lastAnnouncedSliceStreak).toBe(completedRounds)
      expect(state.activeSliceStreakBanner).toBe(completedRounds)
    }
  }

  await waitForActiveToken(page)
  await page.evaluate(() => {
    const scene = (window as PrototypeDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    ) as unknown as {
      resolveRound: (action: { readonly type: 'miss' }) => void
    }
    scene.resolveRound({ type: 'miss' })
  })
  await expect
    .poll(async () => (await readDebugState(page)).completedRounds)
    .toBe(9)
  expect((await readDebugState(page)).currentSliceStreak).toBe(0)
})

test('솔로 결과는 첫 기기 기록과 같은 메뉴 재시도·새 메뉴 선택을 명확히 표시한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    'Phaser 결과 객체 문구는 데스크톱 Chromium에서 한 번 검증합니다.',
  )

  await startVisualGameForTest(page, 'solo-result-actions-e2e-v1')
  await page.evaluate(() => {
    const scene = (window as PrototypeDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    ) as unknown as {
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

  const resultTexts = await page.evaluate(() => {
    const scene = (window as PrototypeDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    return (
      scene?.children.list
        .map((child) => (child as { text?: string }).text)
        .filter((text): text is string => typeof text === 'string') ?? []
    )
  })
  expect(resultTexts).toContain('이 기기 최고 기록 88.0점 · 첫 기록')
  expect(resultTexts).toContain('같은 메뉴로 한 판 더')
  expect(resultTexts).toContain('새 메뉴 고르기')
  expect((await readDebugState(page)).personalBestPresentation).toEqual({
    bestScore: 88,
    status: 'first',
  })

  const transform = await getCanvasTransform(page)
  const newMenuButton = toPagePoint(transform, LOGICAL_WIDTH / 2, 658)
  await page.mouse.click(newMenuButton.x, newMenuButton.y)
  await expect(page.getByTestId('home-screen')).toBeVisible()
})

test('홈에서 핵심 시작 방법을 표시한다', async ({ page }) => {
  await enterMainMenu(page)
  await expect(page).toHaveTitle('오늘 뭐 썰?')
  await expect(page.getByRole('heading', { name: '오늘 뭐 썰?' })).toBeVisible()
  await expect(page.getByTestId('solo-start')).toBeVisible()
  await expect(page.getByTestId('create-room')).toBeVisible()
  const friendJoin = page.getByTestId('friend-join')
  await expect(friendJoin).toBeVisible()
  await expect(friendJoin).not.toHaveAttribute('open', '')
  await expect(page.getByTestId('join-room')).toBeHidden()
  await expect(page.getByTestId('scan-qr')).toBeHidden()
  await friendJoin.locator('summary').click()
  await expect(friendJoin).toHaveAttribute('open', '')
  await expect(page.getByTestId('join-room')).toBeVisible()
  await expect(page.getByTestId('scan-qr')).toBeVisible()
  const gameGuide = page.getByTestId('game-guide')
  await expect(gameGuide).toBeVisible()
  await expect(gameGuide).not.toHaveAttribute('open', '')
  await expect(gameGuide.locator('.game-guide-content')).toBeHidden()
  await gameGuide.getByText('게임 방법', { exact: true }).click()
  await expect(gameGuide).toHaveAttribute('open', '')
  await expect(gameGuide.locator('.game-guide-content')).toBeVisible()
  await expect(gameGuide).toContainText('드래그해서 음식을 반으로 썰어요')
  await expect(gameGuide).toContainText('0.3초 꾹')
  await expect(gameGuide).toContainText('최대 2번')
  await expect(gameGuide).toContainText('놓친 음식은 0점')
  await expect(gameGuide).toContainText('평균 점수에서 제외')
  await expect(page.locator('#game-root canvas')).toHaveCount(0)
})

test('QR 초대 링크는 모바일에서도 일반 홈 대신 초대 화면을 연다', async ({
  page,
}) => {
  await page.goto('/?room=ABCD2EFG')

  await expect(page.getByTestId('invite-home')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '방 ABCD2EFG에 초대됐어요' }),
  ).toBeVisible()
  await expect(page.getByLabel('닉네임')).toBeFocused()
  await expect(page.getByLabel('방 코드')).toHaveValue('ABCD2EFG')
  await expect(page.getByLabel('방 코드')).toHaveAttribute('readonly', '')
  await expect(page.getByTestId('join-room')).toHaveText('이 방에 참가')
  await expect(page.getByTestId('join-room')).toBeInViewport()
  await expect(page.getByTestId('cancel-invite')).toBeVisible()
  await expect(page.getByTestId('solo-start')).toBeHidden()
  await expect(page.getByTestId('create-room')).toBeHidden()
  await expect(page.getByTestId('scan-qr')).toBeHidden()
  await expect(page.getByLabel('점심')).toBeHidden()
  await expect(page.getByTestId('game-guide')).toHaveCount(0)
})

test('대표 음식 이미지를 Phaser 토큰으로 등록한다', async ({ page }) => {
  await startVisualGameForTest(page)
  await waitForActiveToken(page)

  const activeToken = (await readDebugState(page)).activeToken
  expect(activeToken).toMatchObject({
    menuId: 'kimchi-jjigae',
    fallDurationMs: 2_600,
    judgement: {
      kind: 'alpha-mask',
      radius: 64,
      width: 128,
      height: 128,
      alphaThreshold: 32,
    },
    visual: {
      hasVisual: true,
      width: 98,
      height: 112,
    },
  })
})

for (const visualCase of [
  { seed: 36, menuId: 'fried-chicken' },
  { seed: 40, menuId: 'ramyeon' },
] as const) {
  test(`비원형 ${visualCase.menuId} v2 이미지를 게임 토큰으로 등록한다`, async ({
    page,
  }) => {
    await startVisualGameForTest(page, visualCase.seed)
    await waitForActiveToken(page)

    expect((await readDebugState(page)).activeToken).toMatchObject({
      menuId: visualCase.menuId,
      judgement: {
        kind: 'alpha-mask',
        radius: 64,
        width: 128,
        height: 128,
        alphaThreshold: 32,
      },
      visual: { hasVisual: true, width: 112, height: 112 },
    })
  })
}

test('치킨 이미지의 투명한 모서리는 베기로 판정하지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '정밀한 투명 픽셀 경계는 데스크톱 Chromium에서 검증합니다.',
  )

  await startVisualGameForTest(page, 36)
  await waitForActiveToken(page)
  const initial = await readDebugState(page)
  const token = initial.activeToken
  expect(token).toMatchObject({
    menuId: 'fried-chicken',
    judgement: { kind: 'alpha-mask' },
  })
  if (!token) return

  const transform = await getCanvasTransform(page)
  const transparentStart = toPagePoint(transform, token.x + 52, token.y - 45)
  const transparentEnd = toPagePoint(transform, token.x + 52, token.y + 45)
  await page.mouse.move(transparentStart.x, transparentStart.y)
  await page.mouse.down()
  await page.mouse.move(transparentEnd.x, transparentEnd.y, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(80)

  expect((await readDebugState(page)).completedRounds).toBe(0)

  const current = (await readDebugState(page)).activeToken
  expect(current).not.toBeNull()
  if (!current) return
  const bodyStart = toPagePoint(transform, current.x - 80, current.y - 7)
  const bodyEnd = toPagePoint(transform, current.x + 80, current.y - 7)
  await page.mouse.move(bodyStart.x, bodyStart.y)
  await page.mouse.down()
  await page.mouse.move(bodyEnd.x, bodyEnd.y, { steps: 8 })
  await page.mouse.up()

  await expect
    .poll(async () => (await readDebugState(page)).completedRounds)
    .toBe(1)
  await expect
    .poll(async () => (await readDebugState(page)).lastAction)
    .toBe('slice')
})

test('드래그 중에도 음식은 계속 내려온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '마우스 드래그의 연속 낙하는 데스크톱 Chromium에서 검증합니다.',
  )

  await startSoloGame(page)
  await waitForActiveToken(page)
  const start = await readDebugState(page)
  const token = start.activeToken

  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  const transform = await getCanvasTransform(page)
  const pointerStart = toPagePoint(transform, token.x, token.y)
  const dragPoint = toPagePoint(transform, token.x + 24, token.y)

  await page.mouse.move(pointerStart.x, pointerStart.y)
  await page.mouse.down()
  await page.mouse.move(dragPoint.x, dragPoint.y, { steps: 2 })
  await expect
    .poll(async () => (await readDebugState(page)).inputMode)
    .toBe('slice')
  await page.waitForTimeout(180)

  const duringDrag = await readDebugState(page)
  expect(duringDrag.activeToken?.y).toBeGreaterThan(token.y + 18)
  expect(duringDrag.captureCount).toBe(0)
  await page.mouse.up()
})

test('음식 안쪽에서 시작하고 끝내도 양끝을 보정해 베어낸다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '마우스 베기 경로는 데스크톱 Chromium에서 검증합니다.',
  )

  await startVisualGameForTest(page, 7)
  await waitForActiveToken(page)
  const start = await readDebugState(page)
  const cleanedFxBeforeSlice = start.cleanedSliceFxObjectCount
  const token = start.activeToken

  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  expect(token.judgement.kind).toBe('alpha-mask')
  if (token.judgement.kind !== 'alpha-mask') {
    return
  }

  const transform = await getCanvasTransform(page)
  const insideOffset = token.judgement.radius * 0.3
  const sliceY = token.y + token.judgement.centerY
  const sliceCenterX = token.x + token.judgement.centerX
  const sliceStart = toPagePoint(transform, sliceCenterX - insideOffset, sliceY)
  const sliceEnd = toPagePoint(transform, sliceCenterX + insideOffset, sliceY)

  await page.mouse.move(sliceStart.x, sliceStart.y)
  await page.mouse.down()
  await page.mouse.move(sliceEnd.x, sliceEnd.y, { steps: 6 })
  await page.mouse.up()

  await page.waitForTimeout(60)
  const chefDisplaySizes = await page.evaluate(() => {
    const scene = (window as PrototypeDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) throw new Error('Prototype scene is unavailable.')
    return scene.children.list
      .filter((child) => child.texture?.key === 'title-chef-cat')
      .map((child) => ({
        width: child.displayWidth ?? 0,
        height: child.displayHeight ?? 0,
      }))
  })
  expect(chefDisplaySizes).not.toHaveLength(0)
  expect(Math.max(...chefDisplaySizes.map((size) => size.width))).toBeLessThanOrEqual(52.1)
  expect(Math.max(...chefDisplaySizes.map((size) => size.height))).toBeLessThanOrEqual(65.1)
  await expect
    .poll(async () => (await readDebugState(page)).completedRounds)
    .toBe(1)
  await expect
    .poll(async () => (await readDebugState(page)).lastAction)
    .toBe('slice')
  await expect
    .poll(async () => (await readDebugState(page)).activeSliceFxObjectCount)
    .toBeGreaterThan(0)
  const activeFx = await readDebugState(page)
  expect(activeFx.lastSliceFxTier).not.toBeNull()
  expect(activeFx.lastSliceFxProfile).not.toBeNull()
  expect(activeFx.lastSliceFxProfile?.shakeDurationMs).toBeGreaterThan(0)
  expect(activeFx.lastSliceFxProfile?.shakeIntensity).toBeGreaterThan(0)
  expect(activeFx.lastSliceFxProfile?.particleCount).toBeGreaterThan(0)
  await expect
    .poll(async () => (await readDebugState(page)).lastSliceSource)
    .toBe('extended')
  await expect
    .poll(async () => (await readDebugState(page)).lastSliceAngleDegrees)
    .toBeCloseTo(0, 1)
  await expect
    .poll(async () => (await readDebugState(page)).captureCount)
    .toBe(0)
  await expect
    .poll(async () => (await readDebugState(page)).cleanedSlicePieceCount)
    .toBe(2)
  await expect
    .poll(async () => (await readDebugState(page)).activeSlicePieceCount)
    .toBe(0)
  await expect
    .poll(async () => (await readDebugState(page)).activeSliceFxObjectCount)
    .toBe(0)
  expect((await readDebugState(page)).cleanedSliceFxObjectCount).toBeGreaterThan(
    cleanedFxBeforeSlice,
  )
})

test('reduced motion keeps slice grading while removing intense transient FX', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    'The identical normal/reduced pointer path is compared in desktop Chromium.',
  )

  await startVisualGameForTest(page, 7)
  expect((await readDebugState(page)).reducedMotion).toBe(false)
  await sliceCurrentToken(page)

  const normalFx = await readDebugState(page)
  expect(normalFx.lastSliceFxTier).not.toBeNull()
  expect(normalFx.lastSliceFxProfile).not.toBeNull()
  expect(
    (normalFx.lastSliceFxProfile?.hitStopMs ?? 0) +
      (normalFx.lastSliceFxProfile?.shakeDurationMs ?? 0) +
      (normalFx.lastSliceFxProfile?.particleCount ?? 0),
  ).toBeGreaterThan(0)
  await expect
    .poll(async () => (await readDebugState(page)).activeSliceFxObjectCount)
    .toBe(0)

  const reducedPage = await page.context().newPage()
  try {
    await reducedPage.emulateMedia({ reducedMotion: 'reduce' })
    await reducedPage.goto('/')
    await reducedPage.bringToFront()
    await startVisualGameForTest(reducedPage, 7)
    const reducedBeforeSlice = await readDebugState(reducedPage)
    expect(reducedBeforeSlice.reducedMotion).toBe(true)
    const cleanedFxBeforeSlice = reducedBeforeSlice.cleanedSliceFxObjectCount

    await sliceCurrentToken(reducedPage)

    const reducedFx = await readDebugState(reducedPage)
    expect(reducedFx.lastSliceFxTier).toBe(normalFx.lastSliceFxTier)
    expect(reducedFx.lastSliceFxProfile).toMatchObject({
      hitStopMs: 0,
      shakeDurationMs: 0,
      shakeIntensity: 0,
      particleCount: 0,
    })
    await expect
      .poll(
        async () =>
          (await readDebugState(reducedPage)).activeSliceFxObjectCount,
        { timeout: 2_000 },
      )
      .toBe(0)
    expect(
      (await readDebugState(reducedPage)).cleanedSliceFxObjectCount,
    ).toBeGreaterThan(cleanedFxBeforeSlice)
  } finally {
    await reducedPage.close()
  }
})

test('짧은 탭은 포획권이나 라운드를 소비하지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '마우스 짧은 탭 경로는 데스크톱 Chromium에서 검증합니다.',
  )

  await startSoloGame(page)
  await waitForActiveToken(page)
  const start = await readDebugState(page)
  const token = start.activeToken

  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  const transform = await getCanvasTransform(page)
  const tapPoint = toPagePoint(transform, token.x, token.y)

  await page.mouse.move(tapPoint.x, tapPoint.y)
  await page.mouse.down()
  await page.waitForTimeout(120)
  await page.mouse.up()
  await page.waitForTimeout(80)

  const afterTap = await readDebugState(page)
  expect(afterTap.completedRounds).toBe(0)
  expect(afterTap.captureCount).toBe(0)
  expect(afterTap.inputMode).toBe('idle')
  expect(afterTap.pathPointCount).toBe(0)
  expect(afterTap.localPathPointCount).toBe(0)
  expect(afterTap.feedback).toContain('0.3초')
  expect(afterTap.activeToken?.y).toBeGreaterThan(token.y + 12)
})

test('길게 누르다 움직이면 시간이 지나도 포획되지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '마우스 hold→slice 전환은 데스크톱 Chromium에서 검증합니다.',
  )

  await startSoloGame(page)
  await waitForActiveToken(page)
  const start = await readDebugState(page)
  const token = start.activeToken

  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  const transform = await getCanvasTransform(page)
  const holdPoint = toPagePoint(transform, token.x, token.y)
  const dragPoint = toPagePoint(transform, token.x + 24, token.y)

  await page.mouse.move(holdPoint.x, holdPoint.y)
  await page.mouse.down()
  await expect
    .poll(async () => (await readDebugState(page)).inputMode)
    .toBe('hold')
  await page.waitForTimeout(60)
  await page.mouse.move(dragPoint.x, dragPoint.y, { steps: 2 })
  await expect
    .poll(async () => (await readDebugState(page)).inputMode)
    .toBe('slice')
  await page.waitForTimeout(400)

  const afterThreshold = await readDebugState(page)
  expect(afterThreshold.inputMode).toBe('slice')
  expect(afterThreshold.captureCount).toBe(0)
  expect(afterThreshold.completedRounds).toBe(0)
  expect(afterThreshold.activeToken?.y).toBeGreaterThan(token.y + 30)
  await page.mouse.up()
})

test('음식 위를 0.3초 길게 누르면 이동 중인 대상을 포획한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '롱프레스의 마우스 입력 경로는 데스크톱 Chromium에서 검증합니다.',
  )

  await startSoloGame(page)
  await waitForActiveToken(page)
  const start = await readDebugState(page)
  const token = start.activeToken

  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  const transform = await getCanvasTransform(page)
  const capturePoint = toPagePoint(transform, token.x, token.y)

  await page.mouse.move(capturePoint.x, capturePoint.y)
  await page.mouse.down()
  await expect
    .poll(async () => (await readDebugState(page)).inputMode)
    .toBe('hold')
  await page.waitForTimeout(160)
  const duringHold = await readDebugState(page)
  expect(duringHold.activeToken?.y).toBeGreaterThan(token.y + 12)
  await page.waitForTimeout(100)
  const beforeCapture = await readDebugState(page)
  expect(beforeCapture.inputMode).toBe('hold')
  expect(beforeCapture.activeToken?.y).toBeGreaterThan(
    (duringHold.activeToken?.y ?? token.y) + 12,
  )

  await expect
    .poll(async () => (await readDebugState(page)).captureCount, {
      timeout: 1_000,
    })
    .toBe(1)
  await expect
    .poll(async () => (await readDebugState(page)).lastAction)
    .toBe('capture')
  await page.waitForFunction(() => {
    const debugWindow = window as PrototypeDebugWindow
    return (
      debugWindow.__NHN_GAME__?.scene.getScene('prototype').getDebugState()
        .captureEffectY !== null
    )
  })

  const captureEffectStartY = (await readDebugState(page)).captureEffectY
  if (captureEffectStartY === null) {
    throw new Error('포획 이동 중인 음식의 Y 좌표를 찾을 수 없습니다.')
  }
  await page.waitForTimeout(70)
  const captureEffectMiddleY = (await readDebugState(page)).captureEffectY
  if (captureEffectMiddleY === null) {
    throw new Error('포획 이동이 예상보다 일찍 종료됐습니다.')
  }
  await page.waitForTimeout(70)
  const captureEffectLaterY = (await readDebugState(page)).captureEffectY
  if (captureEffectLaterY === null) {
    throw new Error('포획 이동이 예상보다 일찍 종료됐습니다.')
  }
  expect(captureEffectMiddleY).toBeLessThan(captureEffectStartY)
  expect(captureEffectLaterY).toBeLessThan(captureEffectMiddleY)
  await expect
    .poll(async () => (await readDebugState(page)).filledCaptureSlotCount)
    .toBe(1)

  await waitForActiveToken(page)
  const nextTokenBeforeRelease = (await readDebugState(page)).activeToken
  expect(nextTokenBeforeRelease).not.toBeNull()
  await page.mouse.up()
  await page.waitForTimeout(100)

  const afterLateRelease = await readDebugState(page)
  expect(afterLateRelease.completedRounds).toBe(1)
  expect(afterLateRelease.captureCount).toBe(1)
  expect(afterLateRelease.inputMode).toBe('idle')
  expect(afterLateRelease.activeToken?.menuId).toBe(
    nextTokenBeforeRelease?.menuId,
  )
})
test('모바일 터치 드래그로 이동 중인 음식을 베어낸다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    '실제 터치 베기는 모바일 Chromium 프로젝트에서 검증합니다.',
  )

  await startVisualGameForTest(page, 7)
  await waitForActiveToken(page)
  const start = await readDebugState(page)
  const cleanedFxBeforeSlice = start.cleanedSliceFxObjectCount
  const token = start.activeToken

  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  const transform = await getCanvasTransform(page)
  const sliceY = token.y + token.visual.height * 0.17
  const startPoint = toPagePoint(
    transform,
    token.x - token.judgement.radius * 1.5,
    sliceY,
  )
  const endPoint = toPagePoint(
    transform,
    token.x + token.judgement.radius * 1.5,
    sliceY,
  )
  const cdp = await page.context().newCDPSession(page)
  const touchPoint = (x: number, y: number) => ({
    x,
    y,
    id: 1,
    radiusX: 1,
    radiusY: 1,
    force: 1,
  })

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(startPoint.x, startPoint.y)],
  })
  await expect
    .poll(async () => (await readDebugState(page)).inputMode)
    .toBe('slice')

  for (let step = 1; step <= 6; step += 1) {
    const progress = step / 6
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        touchPoint(
          startPoint.x + (endPoint.x - startPoint.x) * progress,
          startPoint.y + (endPoint.y - startPoint.y) * progress,
        ),
      ],
    })
  }

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })

  await expect
    .poll(async () => (await readDebugState(page)).completedRounds)
    .toBe(1)
  await expect
    .poll(async () => (await readDebugState(page)).lastAction)
    .toBe('slice')
  const afterSlice = await readDebugState(page)
  expect(afterSlice.captureCount).toBe(0)
  expect(afterSlice.lastSliceFxTier).not.toBeNull()
  expect(afterSlice.lastSliceFxProfile).not.toBeNull()
  await expect
    .poll(async () => (await readDebugState(page)).activeSliceFxObjectCount)
    .toBe(0)
  expect((await readDebugState(page)).cleanedSliceFxObjectCount).toBeGreaterThan(
    cleanedFxBeforeSlice,
  )
})
test('모바일 길게 누르기로 이동 중인 음식을 포획한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    '실제 터치 포획은 모바일 Chromium 프로젝트에서 검증합니다.',
  )

  await startSoloGame(page)
  await waitForActiveToken(page)
  const start = await readDebugState(page)
  const token = start.activeToken

  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  const transform = await getCanvasTransform(page)
  const capturePoint = toPagePoint(transform, token.x, token.y)
  const cdp = await page.context().newCDPSession(page)

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...capturePoint, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
  })
  await expect
    .poll(async () => (await readDebugState(page)).inputMode)
    .toBe('hold')
  await expect
    .poll(async () => (await readDebugState(page)).captureCount, {
      timeout: 1_000,
    })
    .toBe(1)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })

  await expect
    .poll(async () => (await readDebugState(page)).lastAction)
    .toBe('capture')
  await expect
    .poll(async () => (await readDebugState(page)).filledCaptureSlotCount)
    .toBe(1)
})

test('모바일 touchcancel은 동작이나 점수로 처리하지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    '실제 터치 취소 이벤트는 모바일 Chromium 프로젝트에서 검증합니다.',
  )

  await startSoloGame(page)
  await waitForActiveToken(page)
  const start = await readDebugState(page)
  const token = start.activeToken

  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  const transform = await getCanvasTransform(page)
  const gestureStart = toPagePoint(transform, token.x, token.y)
  const cdp = await page.context().newCDPSession(page)

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...gestureStart, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
  })
  await expect
    .poll(async () => (await readDebugState(page)).inputMode)
    .toBe('hold')
  await page.waitForTimeout(100)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  })
  await page.waitForTimeout(350)

  await expect
    .poll(async () => (await readDebugState(page)).pathPointCount)
    .toBe(0)
  await expect
    .poll(async () => (await readDebugState(page)).localPathPointCount)
    .toBe(0)
  await expect
    .poll(async () => (await readDebugState(page)).inputMode)
    .toBe('idle')
  await expect
    .poll(async () => (await readDebugState(page)).completedRounds)
    .toBe(0)
  await expect
    .poll(async () => (await readDebugState(page)).lastAction)
    .toBeNull()
  await expect
    .poll(async () => (await readDebugState(page)).captureCount)
    .toBe(0)
  const afterCancel = await readDebugState(page)
  expect(afterCancel.feedback).toContain('취소')
  expect(afterCancel.activeToken?.y).toBeGreaterThan(token.y + 20)
})

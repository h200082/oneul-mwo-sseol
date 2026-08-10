import { expect, test, type Page } from '@playwright/test'

import { enterMainMenu } from './appEntry'

interface SensoryDebugState {
  readonly soundEnabled: boolean
  readonly hapticsEnabled: boolean
  readonly hapticsSupported: boolean
  readonly audioState:
    | 'unavailable'
    | 'locked'
    | 'running'
    | 'suspended'
    | 'closed'
  readonly lastCue: string | null
  readonly triggerCount: number
  readonly soundOutputCount: number
  readonly hapticOutputCount: number
  readonly narrationPreparedCount: number
  readonly narrationRequestCount: number
  readonly narrationPlayCount: number
  readonly narrationPlaying: boolean
  readonly musicDucked: boolean
}

interface GameDebugState {
  readonly activeToken: {
    readonly x: number
    readonly menuId: string
    readonly y: number
    readonly fallDurationMs: number
    readonly captureCenter: { readonly x: number; readonly y: number }
    readonly visual: { readonly height: number }
    readonly judgement:
      | {
          readonly kind: 'alpha-mask'
          readonly radius: number
          readonly centerX: number
          readonly centerY: number
        }
      | { readonly kind: 'circle-fallback'; readonly radius: number }
  } | null
  readonly completedRounds: number
  readonly captureCount: number
  readonly lastAction: 'slice' | 'capture' | 'miss' | null
  readonly introVisible: boolean
  readonly inputMode: 'idle' | 'hold' | 'slice'
  readonly pathPointCount: number
  readonly localPathPointCount: number
  readonly narration: {
    readonly menuId: string | null
    readonly text: string | null
    readonly captionVisible: boolean
    readonly requestedEnabled: boolean
    readonly effectiveEnabled: boolean
    readonly audioStarted: boolean
  }
  readonly sensoryFeedback: SensoryDebugState
}

interface SensoryDebugWindow extends Window {
  __SENSORY_PROBE__?: {
    contexts: number
    resumes: number
    starts: number
    stops: number
    vibrations: (number | number[])[]
  }
  __NHN_APP__?: {
    getDebugState: () => {
      sensoryFeedback: SensoryDebugState
      startSoloGameForTest: (deckSeed: number | string) => void
    }
  }
  __NHN_GAME__?: {
    scene: {
      getScene: (key: string) => { getDebugState: () => GameDebugState }
    }
  }
}

const LOGICAL_WIDTH = 390
const LOGICAL_HEIGHT = 844

async function installSensoryProbe(
  page: Page,
  hapticsSupported = true,
  requireTouchPointerUp = false,
): Promise<void> {
  await page.addInitScript(({ supportsHaptics, pointerUpRequired }) => {
    const probe = {
      contexts: 0,
      resumes: 0,
      starts: 0,
      stops: 0,
      vibrations: [] as (number | number[])[],
    }
    ;(window as SensoryDebugWindow).__SENSORY_PROBE__ = probe

    let activePointerEvent: 'pointerdown' | 'pointerup' | null = null
    const markPointerEvent = (event: PointerEvent): void => {
      activePointerEvent = event.type as 'pointerdown' | 'pointerup'
      const markedEvent = activePointerEvent
      window.setTimeout(() => {
        if (activePointerEvent === markedEvent) {
          activePointerEvent = null
        }
      }, 0)
    }
    document.addEventListener('pointerdown', markPointerEvent, true)
    document.addEventListener('pointerup', markPointerEvent, true)

    class FakeAudioParam {
      setValueAtTime(): this {
        return this
      }
      linearRampToValueAtTime(): this {
        return this
      }
      exponentialRampToValueAtTime(): this {
        return this
      }
    }

    class FakeGainNode {
      readonly gain = new FakeAudioParam()
      connect(): this {
        return this
      }
      disconnect(): void {}
    }

    class FakeOscillatorNode {
      readonly frequency = new FakeAudioParam()
      type = 'sine'
      onended: (() => void) | null = null
      connect(): this {
        return this
      }
      disconnect(): void {}
      start(): void {
        probe.starts += 1
      }
      stop(): void {
        probe.stops += 1
        queueMicrotask(() => this.onended?.())
      }
    }

    class FakeAudioContext {
      state = 'suspended'
      currentTime = 0
      readonly destination = {}
      constructor() {
        probe.contexts += 1
      }
      createGain(): FakeGainNode {
        return new FakeGainNode()
      }
      createOscillator(): FakeOscillatorNode {
        return new FakeOscillatorNode()
      }
      async resume(): Promise<void> {
        probe.resumes += 1
        if (pointerUpRequired && activePointerEvent !== 'pointerup') {
          throw new Error('touch audio unlock requires pointerup')
        }
        this.state = 'running'
      }
      async suspend(): Promise<void> {
        this.state = 'suspended'
      }
      async close(): Promise<void> {
        this.state = 'closed'
      }
    }

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    })
    Object.defineProperty(window, 'webkitAudioContext', {
      configurable: true,
      value: FakeAudioContext,
    })
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      configurable: true,
      value: supportsHaptics
        ? (pattern: number | number[]) => {
            probe.vibrations.push(
              Array.isArray(pattern) ? [...pattern] : pattern,
            )
            return true
          }
        : undefined,
    })
  }, {
    supportsHaptics: hapticsSupported,
    pointerUpRequired: requireTouchPointerUp,
  })
}

async function readSensoryDebug(page: Page): Promise<SensoryDebugState> {
  return page.evaluate(() => {
    const state = (window as SensoryDebugWindow).__NHN_APP__?.getDebugState()
      .sensoryFeedback
    if (!state) {
      throw new Error('피드백 디버그 상태를 찾을 수 없습니다.')
    }
    return state
  })
}

async function readGameDebug(page: Page): Promise<GameDebugState> {
  return page.evaluate(() => {
    const scene = (window as SensoryDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) {
      throw new Error('게임 디버그 장면을 찾을 수 없습니다.')
    }
    return scene.getDebugState()
  })
}

async function readNarrationText(
  page: Page,
  menuId: string,
): Promise<string | null> {
  return page.evaluate(async (id) => {
    const modulePath = '/src/data/menuNarrations.ts'
    const module = (await import(/* @vite-ignore */ modulePath)) as {
      getMenuNarration(
        menuId: string,
      ): { readonly text: string } | undefined
    }
    return module.getMenuNarration(id)?.text ?? null
  }, menuId)
}

async function startSoloGame(
  page: Page,
  deckSeed?: number | string,
): Promise<void> {
  if (deckSeed === undefined) {
    await enterMainMenu(page)
    await page.getByTestId('solo-start').click()
  } else {
    await enterMainMenu(page)
    await page.waitForFunction(() =>
      Boolean((window as SensoryDebugWindow).__NHN_APP__),
    )
    await page.evaluate((seed) => {
      const app = (window as SensoryDebugWindow).__NHN_APP__
      if (!app) throw new Error('앱 디버그 상태를 찾을 수 없습니다.')
      app.getDebugState().startSoloGameForTest(seed)
    }, deckSeed)
  }
  await expect(page.locator('#game-root canvas')).toBeVisible()
  await page.waitForFunction(() => {
    const scene = (window as SensoryDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    const state = scene?.getDebugState()
    return Boolean(state?.introVisible || state?.activeToken)
  })

  if ((await readGameDebug(page)).introVisible) {
    const canvas = page.locator('#game-root canvas')
    if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
      await canvas.tap({ position: { x: 12, y: 12 } })
    } else {
      await canvas.click({ position: { x: 12, y: 12 } })
    }
  }
  await waitForActiveToken(page)
  await page.evaluate(() => {
    const scene = (
      window as SensoryDebugWindow
    ).__NHN_GAME__?.scene.getScene('prototype') as unknown as
      | { skipPracticeForTest: () => void }
      | undefined
    scene?.skipPracticeForTest()
  })
  await waitForActiveToken(page)
  await expect
    .poll(async () => (await readSensoryDebug(page)).audioState)
    .toBe('running')
}

async function waitForActiveToken(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    Boolean(
      (window as SensoryDebugWindow).__NHN_GAME__?.scene
        .getScene('prototype')
        .getDebugState().activeToken,
    ),
  )
}

async function getCanvasPoint(
  page: Page,
  logicalX: number,
  logicalY: number,
): Promise<{ readonly x: number; readonly y: number }> {
  const box = await page.locator('#game-root canvas').boundingBox()
  if (!box) {
    throw new Error('게임 캔버스 위치를 찾을 수 없습니다.')
  }
  return {
    x: box.x + logicalX * (box.width / LOGICAL_WIDTH),
    y: box.y + logicalY * (box.height / LOGICAL_HEIGHT),
  }
}

async function sliceActiveToken(page: Page): Promise<void> {
  const box = await page.locator('#game-root canvas').boundingBox()
  if (!box) {
    throw new Error('게임 캔버스 위치를 찾을 수 없습니다.')
  }

  // Sample the moving token only after the one awaited layout read. Reusing
  // this box for both endpoints keeps the canonical center fresh while the
  // food continues to fall.
  const token = (await readGameDebug(page)).activeToken
  if (!token) {
    throw new Error('베어낼 음식이 없습니다.')
  }
  const centerX =
    token.x +
    (token.judgement.kind === 'alpha-mask' ? token.judgement.centerX : 0)
  const centerY =
    token.y +
    (token.judgement.kind === 'alpha-mask' ? token.judgement.centerY : 0)
  const radius = token.judgement.radius
  const toCanvasPoint = (logicalX: number, logicalY: number) => ({
    x: box.x + logicalX * (box.width / LOGICAL_WIDTH),
    y: box.y + logicalY * (box.height / LOGICAL_HEIGHT),
  })
  const start = toCanvasPoint(centerX - radius * 1.5, centerY)
  const end = toCanvasPoint(centerX + radius * 1.5, centerY)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 6 })
  await page.mouse.up()
}

function getCaptureLogicalCenter(
  token: NonNullable<GameDebugState['activeToken']>,
): { readonly x: number; readonly y: number } {
  return {
    x: token.x + token.captureCenter.x,
    y: token.y + token.captureCenter.y,
  }
}

async function getCapturePoint(
  page: Page,
  token: NonNullable<GameDebugState['activeToken']>,
): Promise<{ readonly x: number; readonly y: number }> {
  const center = getCaptureLogicalCenter(token)
  return getCanvasPoint(page, center.x, center.y)
}

async function pressCanvasControl(
  page: Page,
  logicalX: number,
  logicalY: number,
  whilePressed: () => Promise<void>,
): Promise<void> {
  const point = await getCanvasPoint(page, logicalX, logicalY)
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { ...point, id: 1, radiusX: 1, radiusY: 1, force: 1 },
      ],
    })
    await whilePressed()
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    return
  }

  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await whilePressed()
  await page.mouse.up()
}

function expectPositiveShortMultiPulse(
  pattern: number | number[] | undefined,
): void {
  expect(Array.isArray(pattern)).toBe(true)
  if (!Array.isArray(pattern)) {
    return
  }

  expect(pattern.length).toBeGreaterThanOrEqual(3)
  expect(
    pattern.every(
      (duration) =>
        Number.isInteger(duration) && duration > 0 && duration <= 100,
    ),
  ).toBe(true)
  expect(
    pattern.reduce((total, duration) => total + duration, 0),
  ).toBeLessThanOrEqual(250)
}
test('음식이 생성되면 MP3가 없어도 고양이 말풍선은 즉시 표시된다', async ({
  page,
}) => {
  await installSensoryProbe(page)
  await page.goto('/')
  await startSoloGame(page, 'narration-caption-fallback-v1')

  const state = await readGameDebug(page)
  const token = state.activeToken
  if (!token) {
    throw new Error('나레이션을 확인할 음식이 없습니다.')
  }
  const narrationText = await readNarrationText(page, token.menuId)
  expect(narrationText).not.toBeNull()
  expect(state.narration).toMatchObject({
    menuId: token.menuId,
    text: narrationText,
    captionVisible: true,
    requestedEnabled: true,
    effectiveEnabled: true,
    audioStarted: false,
  })
  expect(state.sensoryFeedback).toMatchObject({
    narrationPreparedCount: 0,
    narrationPlayCount: 0,
    narrationPlaying: false,
    musicDucked: false,
  })

  const requestCount = state.sensoryFeedback.narrationRequestCount
  await pressCanvasControl(page, 269, 44, async () => Promise.resolve())
  await expect
    .poll(async () => (await readGameDebug(page)).narration.requestedEnabled)
    .toBe(false)
  const muted = await readGameDebug(page)
  expect(muted.narration.captionVisible).toBe(true)
  expect(muted.sensoryFeedback.narrationRequestCount).toBe(requestCount)

  await pressCanvasControl(page, 269, 44, async () => Promise.resolve())
  await expect
    .poll(async () => (await readGameDebug(page)).narration.effectiveEnabled)
    .toBe(true)
  expect((await readGameDebug(page)).sensoryFeedback.narrationRequestCount).toBe(
    requestCount,
  )

  await expect
    .poll(async () => (await readGameDebug(page)).narration.captionVisible)
    .toBe(false)
  expect((await readGameDebug(page)).activeToken?.menuId).toBe(token.menuId)
})
test('효과음과 진동 설정을 따로 끄고 새로고침 후에도 유지한다', async ({
  page,
}) => {
  await installSensoryProbe(page)
  await page.goto('/')
  await enterMainMenu(page)

  const sound = page.getByTestId('sound-toggle')
  const haptics = page.getByTestId('haptics-toggle')
  await expect(sound).toHaveAttribute('aria-pressed', 'true')
  await expect(sound).toHaveAccessibleName('효과음 끄기')
  await expect(haptics).toBeEnabled()
  await expect(haptics).toHaveAttribute('aria-pressed', 'true')

  await sound.click()
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
  await expect(haptics).toHaveAttribute('aria-pressed', 'true')
  await haptics.click()
  await expect(haptics).toHaveAttribute('aria-pressed', 'false')

  await page.reload()
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByTestId('haptics-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.getByTestId('sound-toggle').click()
  await expect
    .poll(async () => (await readSensoryDebug(page)).soundOutputCount)
    .toBe(1)
  expect((await readSensoryDebug(page)).hapticsEnabled).toBe(false)
})

test('모바일 첫 터치는 pointerup에서 효과음을 잠금 해제한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    '터치 activation 규칙은 모바일 프로젝트에서 검증합니다.',
  )
  await installSensoryProbe(page, true, true)
  await page.goto('/')

  await page.getByTestId('splash-start').tap()
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect
    .poll(async () => (await readSensoryDebug(page)).audioState)
    .toBe('running')

  const probe = await page.evaluate(
    () => (window as SensoryDebugWindow).__SENSORY_PROBE__,
  )
  expect(probe?.resumes).toBe(1)
  expect(probe?.contexts).toBeGreaterThanOrEqual(1)
})
test('게임 HUD 토글은 제스처를 소비하고 홈과 설정을 공유해 유지한다', async ({
  page,
}) => {
  await installSensoryProbe(page)
  await page.goto('/')
  await startSoloGame(page)

  const before = await readSensoryDebug(page)
  const beforeGame = await readGameDebug(page)
  expect(beforeGame.completedRounds).toBe(0)
  expect(beforeGame.inputMode).toBe('idle')

  await pressCanvasControl(page, 317, 44, async () => {
    expect((await readGameDebug(page)).inputMode).toBe('idle')
  })
  await expect
    .poll(async () => (await readSensoryDebug(page)).soundEnabled)
    .toBe(false)

  await pressCanvasControl(page, 365, 44, async () => {
    expect((await readGameDebug(page)).inputMode).toBe('idle')
  })
  await expect
    .poll(async () => (await readSensoryDebug(page)).hapticsEnabled)
    .toBe(false)

  const after = await readSensoryDebug(page)
  const afterGame = await readGameDebug(page)
  expect(after.triggerCount).toBe(before.triggerCount)
  expect(afterGame).toMatchObject({
    completedRounds: 0,
    captureCount: 0,
    lastAction: null,
    inputMode: 'idle',
    pathPointCount: 0,
    localPathPointCount: 0,
  })

  await page.reload()
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByTestId('haptics-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})
test('진동 API가 없어도 효과음과 게임 진행은 정상 동작한다', async ({
  page,
}) => {
  await installSensoryProbe(page, false)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await enterMainMenu(page)

  const haptics = page.getByTestId('haptics-toggle')
  await expect(haptics).toBeDisabled()
  await expect(haptics).toHaveAccessibleName(
    '이 기기에서는 진동을 지원하지 않아요',
  )
  expect((await readSensoryDebug(page)).hapticsSupported).toBe(false)
  const soundOutputCountBeforeGame = (
    await readSensoryDebug(page)
  ).soundOutputCount

  await startSoloGame(page)
  await sliceActiveToken(page)
  await expect
    .poll(async () => (await readGameDebug(page)).lastAction)
    .toBe('slice')
  const sensory = await readSensoryDebug(page)
  expect(sensory.soundOutputCount).toBe(soundOutputCountBeforeGame + 1)
  expect(sensory.hapticOutputCount).toBe(0)
  expect(pageErrors).toEqual([])
})

test('베기·포획·놓침은 완료 순간에 한 번씩 피드백을 확정한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    '마우스 기반 의미 큐 흐름은 데스크톱 프로젝트에서 검증합니다.',
  )
  await installSensoryProbe(page)
  await page.goto('/')
  await startSoloGame(page)

  const firstToken = (await readGameDebug(page)).activeToken
  if (!firstToken) {
    throw new Error('첫 음식이 없습니다.')
  }
  const firstCenter = await getCapturePoint(page, firstToken)
  const beforeTap = (await readSensoryDebug(page)).triggerCount
  await page.mouse.click(firstCenter.x, firstCenter.y)
  await page.waitForTimeout(80)
  expect((await readSensoryDebug(page)).triggerCount).toBe(beforeTap)

  await sliceActiveToken(page)
  await expect
    .poll(async () => (await readGameDebug(page)).completedRounds)
    .toBe(1)
  const afterSlice = await readSensoryDebug(page)
  expect(afterSlice.lastCue).toMatch(/^slice-/u)
  expect(afterSlice.hapticOutputCount).toBe(1)

  await waitForActiveToken(page)
  const captureToken = (await readGameDebug(page)).activeToken
  if (!captureToken) {
    throw new Error('포획할 음식이 없습니다.')
  }
  const capturePoint = await getCapturePoint(page, captureToken)
  await page.mouse.move(capturePoint.x, capturePoint.y)
  await page.mouse.down()
  await expect
    .poll(async () => (await readGameDebug(page)).completedRounds)
    .toBe(2)
  const beforeLateRelease = await readSensoryDebug(page)
  expect(beforeLateRelease.lastCue).toBe('capture')
  expect(beforeLateRelease.hapticOutputCount).toBe(2)
  const captureProbe = await page.evaluate(
    () => (window as SensoryDebugWindow).__SENSORY_PROBE__,
  )
  expectPositiveShortMultiPulse(captureProbe?.vibrations.at(-1))
  await page.mouse.up()
  await page.waitForTimeout(100)
  expect((await readSensoryDebug(page)).triggerCount).toBe(
    beforeLateRelease.triggerCount,
  )

  await waitForActiveToken(page)
  const missToken = (await readGameDebug(page)).activeToken
  await expect
    .poll(async () => (await readGameDebug(page)).lastAction, {
      timeout: (missToken?.fallDurationMs ?? 5_000) + 2_000,
    })
    .toBe('miss')
  const afterMiss = await readSensoryDebug(page)
  expect(afterMiss.lastCue).toBe('miss')
  expect(afterMiss.hapticOutputCount).toBe(3)

})

test('모바일 터치 베기는 진동 피드백을 한 번 발생시킨다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    '모바일 합성 터치 입력은 Pixel 7 프로필에서 검증합니다.',
  )
  await installSensoryProbe(page)
  await page.goto('/')
  await startSoloGame(page, 7)

  const cdp = await page.context().newCDPSession(page)
  const box = await page.locator('#game-root canvas').boundingBox()
  if (!box) {
    throw new Error('게임 캔버스 위치를 찾을 수 없습니다.')
  }
  const token = (await readGameDebug(page)).activeToken
  if (!token) {
    throw new Error('베어낼 음식이 없습니다.')
  }
  const centerX = token.x
  const centerY = token.y + token.visual.height * 0.17
  const toPagePoint = (logicalX: number, logicalY: number) => ({
    x: box.x + logicalX * (box.width / LOGICAL_WIDTH),
    y: box.y + logicalY * (box.height / LOGICAL_HEIGHT),
  })
  const start = toPagePoint(
    centerX - token.judgement.radius * 1.5,
    centerY,
  )
  const end = toPagePoint(
    centerX + token.judgement.radius * 1.5,
    centerY,
  )
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
    touchPoints: [touchPoint(start.x, start.y)],
  })
  for (let step = 1; step <= 6; step += 1) {
    const progress = step / 6
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        touchPoint(
          start.x + (end.x - start.x) * progress,
          start.y + (end.y - start.y) * progress,
        ),
      ],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })

  await expect
    .poll(async () => (await readGameDebug(page)).lastAction)
    .toBe('slice')
  const sensory = await readSensoryDebug(page)
  expect(sensory.lastCue).toMatch(/^slice-/u)
  expect(sensory.hapticOutputCount).toBe(1)
})

test('모바일 길게 누르기 포획은 진동을 한 번만 확정한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    '모바일 합성 터치 입력은 Pixel 7 프로필에서 검증합니다.',
  )
  await installSensoryProbe(page)
  await page.goto('/')
  await startSoloGame(page)

  const token = (await readGameDebug(page)).activeToken
  if (!token) {
    throw new Error('포획할 음식이 없습니다.')
  }
  const capturePoint = await getCapturePoint(page, token)
  const cdp = await page.context().newCDPSession(page)
  const before = await readSensoryDebug(page)
  const physicalVibrationsBefore = await page.evaluate(
    () =>
      (window as SensoryDebugWindow).__SENSORY_PROBE__?.vibrations.length ??
      0,
  )

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { ...capturePoint, id: 1, radiusX: 1, radiusY: 1, force: 1 },
    ],
  })
  await expect
    .poll(async () => (await readGameDebug(page)).inputMode)
    .toBe('hold')
  await expect
    .poll(async () => (await readGameDebug(page)).completedRounds, {
      timeout: 1_000,
    })
    .toBe(1)

  const completed = await readSensoryDebug(page)
  expect(completed.lastCue).toBe('capture')
  expect(completed.triggerCount).toBe(before.triggerCount + 1)
  expect(completed.hapticOutputCount).toBe(before.hapticOutputCount + 1)
  expect(
    await page.evaluate(
      () =>
        (window as SensoryDebugWindow).__SENSORY_PROBE__?.vibrations.length ??
        0,
    ),
  ).toBe(physicalVibrationsBefore)

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as SensoryDebugWindow).__SENSORY_PROBE__?.vibrations.length ??
          0,
      ),
    )
    .toBe(physicalVibrationsBefore + 1)
  const releasedProbe = await page.evaluate(
    () => (window as SensoryDebugWindow).__SENSORY_PROBE__,
  )
  expectPositiveShortMultiPulse(releasedProbe?.vibrations.at(-1))
  expect((await readSensoryDebug(page)).triggerCount).toBe(
    completed.triggerCount,
  )
})

test('모바일 touchcancel은 홀드 피드백을 확정하지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    '모바일 합성 터치 입력은 Pixel 7 프로필에서 검증합니다.',
  )
  await installSensoryProbe(page)
  await page.goto('/')
  await startSoloGame(page)

  const token = (await readGameDebug(page)).activeToken
  if (!token) {
    throw new Error('취소할 포획 대상이 없습니다.')
  }
  const capturePoint = await getCapturePoint(page, token)
  const cdp = await page.context().newCDPSession(page)
  const before = await readSensoryDebug(page)

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { ...capturePoint, id: 1, radiusX: 1, radiusY: 1, force: 1 },
    ],
  })
  await expect
    .poll(async () => (await readGameDebug(page)).inputMode)
    .toBe('hold')
  await page.waitForTimeout(100)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  })
  await page.waitForTimeout(350)

  expect(await readSensoryDebug(page)).toMatchObject({
    triggerCount: before.triggerCount,
    hapticOutputCount: before.hapticOutputCount,
  })
  expect(await readGameDebug(page)).toMatchObject({
    completedRounds: 0,
    captureCount: 0,
    lastAction: null,
    inputMode: 'idle',
    pathPointCount: 0,
    localPathPointCount: 0,
  })
})

test('모바일 홀드에서 드래그로 바꿔도 취소 피드백이 추가되지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    '모바일 합성 터치 입력은 Pixel 7 프로필에서 검증합니다.',
  )
  await installSensoryProbe(page)
  await page.goto('/')
  await startSoloGame(page)

  const token = (await readGameDebug(page)).activeToken
  if (!token) {
    throw new Error('드래그로 전환할 음식이 없습니다.')
  }
  const captureCenter = getCaptureLogicalCenter(token)
  const start = await getCanvasPoint(page, captureCenter.x, captureCenter.y)
  const drag = await getCanvasPoint(page, captureCenter.x + 32, captureCenter.y)
  const cdp = await page.context().newCDPSession(page)
  const touchPoint = (point: { readonly x: number; readonly y: number }) => ({
    ...point,
    id: 1,
    radiusX: 1,
    radiusY: 1,
    force: 1,
  })
  const before = await readSensoryDebug(page)

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(start)],
  })
  await expect
    .poll(async () => (await readGameDebug(page)).inputMode)
    .toBe('hold')
  await page.waitForTimeout(70)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [touchPoint(drag)],
  })
  await expect
    .poll(async () => (await readGameDebug(page)).inputMode)
    .toBe('slice')
  expect(await readSensoryDebug(page)).toMatchObject({
    triggerCount: before.triggerCount,
    hapticOutputCount: before.hapticOutputCount,
  })

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  })
  await page.waitForTimeout(120)
  expect(await readSensoryDebug(page)).toMatchObject({
    triggerCount: before.triggerCount,
    hapticOutputCount: before.hapticOutputCount,
  })
  expect(await readGameDebug(page)).toMatchObject({
    completedRounds: 0,
    captureCount: 0,
    lastAction: null,
    inputMode: 'idle',
    pathPointCount: 0,
    localPathPointCount: 0,
  })
})

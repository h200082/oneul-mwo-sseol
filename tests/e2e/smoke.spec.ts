import { expect, test, type Page } from '@playwright/test'

interface PrototypeDebugState {
  readonly activeToken: {
    readonly x: number
    readonly y: number
    readonly menuId: string
    readonly fallDurationMs: number
    readonly judgement: {
      readonly kind: 'circle'
      readonly radius: number
    }
    readonly visual: {
      readonly hasVisual: boolean
      readonly width: number
      readonly height: number
    }
  } | null
  readonly completedRounds: number
  readonly captureCount: number
  readonly filledCaptureSlotCount: number
  readonly pathPointCount: number
  readonly localPathPointCount: number
  readonly lastSliceAngleDegrees: number | null
  readonly lastSliceSource: 'strict' | 'extended' | null
  readonly inputMode: 'idle' | 'hold' | 'slice'
  readonly activeSlicePieceCount: number
  readonly cleanedSlicePieceCount: number
  readonly lastAction: 'slice' | 'capture' | 'miss' | null
  readonly feedback: string
}

interface PrototypeDebugWindow extends Window {
  __NHN_APP__?: {
    getDebugState: () => {
      startSoloGameForTest: (deckSeed: number | string) => void
    }
  }
  __NHN_GAME__?: {
    scene: {
      getScene: (key: string) => { getDebugState: () => PrototypeDebugState }
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
      debugWindow.__NHN_GAME__?.scene
        .getScene('prototype')
        .getDebugState().activeToken,
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

async function startSoloGame(page: Page): Promise<void> {
  await page.getByTestId('solo-start').click()
  await expect(page.locator('#game-root canvas')).toBeVisible()
}

async function startVisualGameForTest(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    Boolean((window as PrototypeDebugWindow).__NHN_APP__),
  )
  await page.evaluate(() => {
    const debugWindow = window as PrototypeDebugWindow
    const app = debugWindow.__NHN_APP__

    if (!app) {
      throw new Error('앱 디버그 훅을 찾을 수 없습니다.')
    }

    app.getDebugState().startSoloGameForTest(7)
  })
  await expect(page.locator('#game-root canvas')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
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

test('홈에서 핵심 시작 방법을 표시한다', async ({ page }) => {
  await expect(page).toHaveTitle('오늘 뭐 썰?')
  await expect(page.getByRole('heading', { name: '오늘 뭐 썰?' })).toBeVisible()
  await expect(page.getByTestId('solo-start')).toBeVisible()
  await expect(page.getByTestId('create-room')).toBeVisible()
  await expect(page.getByTestId('join-room')).toBeVisible()
  await expect(page.getByTestId('scan-qr')).toBeVisible()
  await expect(page.locator('#game-root canvas')).toHaveCount(0)
})

test('대표 음식 이미지를 Phaser 토큰으로 등록한다', async ({ page }) => {
  await startVisualGameForTest(page)
  await waitForActiveToken(page)

  const activeToken = (await readDebugState(page)).activeToken
  expect(activeToken).toMatchObject({
    menuId: 'kimchi-jjigae',
    fallDurationMs: 2_600,
    judgement: {
      kind: 'circle',
      radius: 64,
    },
    visual: {
      hasVisual: true,
      width: 112,
      height: 112,
    },
  })
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

test('음식 안쪽에서 시작하고 끝내도 양끝을 보정해 베어낸다', async (
  { page },
  testInfo,
) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '마우스 베기 경로는 데스크톱 Chromium에서 검증합니다.',
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
  const insideOffset = token.judgement.radius * 0.55
  const sliceStart = toPagePoint(transform, token.x - insideOffset, token.y)
  const sliceEnd = toPagePoint(transform, token.x + insideOffset, token.y)

  await page.mouse.move(sliceStart.x, sliceStart.y)
  await page.mouse.down()
  await page.mouse.move(sliceEnd.x, sliceEnd.y, { steps: 6 })
  await page.mouse.up()

  await expect
    .poll(async () => (await readDebugState(page)).completedRounds)
    .toBe(1)
  await expect
    .poll(async () => (await readDebugState(page)).lastAction)
    .toBe('slice')
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
})

test('짧은 탭은 포획권이나 라운드를 소비하지 않는다', async (
  { page },
  testInfo,
) => {
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

test('길게 누르다 움직이면 시간이 지나도 포획되지 않는다', async (
  { page },
  testInfo,
) => {
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

test('음식 위를 0.3초 길게 누르면 이동 중인 대상을 포획한다', async (
  { page },
  testInfo,
) => {
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
  await expect
    .poll(async () => (await readDebugState(page)).captureCount, {
      timeout: 1_000,
    })
    .toBe(1)
  await expect
    .poll(async () => (await readDebugState(page)).lastAction)
    .toBe('capture')
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
test('모바일 길게 누르기로 이동 중인 음식을 포획한다', async (
  { page },
  testInfo,
) => {
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
    touchPoints: [
      { ...capturePoint, id: 1, radiusX: 1, radiusY: 1, force: 1 },
    ],
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


test('모바일 touchcancel은 동작이나 점수로 처리하지 않는다', async (
  { page },
  testInfo,
) => {
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

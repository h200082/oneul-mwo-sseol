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
  readonly lastSliceAngleDegrees: number | null
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
      getScene: (key: string) => {
        getDebugState: () => PrototypeDebugState
        pauseActiveTokenForTest: () => void
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
      debugWindow.__NHN_GAME__?.scene
        .getScene('prototype')
        .getDebugState().activeToken,
    )
  })
}

async function pauseActiveToken(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debugWindow = window as PrototypeDebugWindow
    const scene = debugWindow.__NHN_GAME__?.scene.getScene('prototype')

    if (!scene) {
      throw new Error('프로토타입 디버그 장면을 찾을 수 없습니다.')
    }

    scene.pauseActiveTokenForTest()
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

test('토큰을 가로지르면 한 라운드를 베기로 완료한다', async (
  { page },
  testInfo,
) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '모바일 프로젝트의 실제 터치 경로는 실기기 단계에서 검증합니다.',
  )

  await startSoloGame(page)
  await waitForActiveToken(page)
  await pauseActiveToken(page)
  const start = await readDebugState(page)
  const token = start.activeToken

  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  const transform = await getCanvasTransform(page)
  const sliceStart = toPagePoint(
    transform,
    token.x - token.judgement.radius - 28,
    token.y,
  )
  const sliceEnd = toPagePoint(
    transform,
    token.x + token.judgement.radius + 28,
    token.y,
  )

  await page.mouse.move(sliceStart.x, sliceStart.y)
  await page.mouse.down()
  await page.mouse.move(sliceEnd.x, sliceEnd.y, { steps: 12 })
  await page.mouse.up()

  await expect
    .poll(async () => (await readDebugState(page)).completedRounds)
    .toBe(1)
  await expect
    .poll(async () => (await readDebugState(page)).lastAction)
    .toBe('slice')
  await expect
    .poll(async () => (await readDebugState(page)).lastSliceAngleDegrees)
    .toBeCloseTo(0, 3)
  await expect
    .poll(async () => (await readDebugState(page)).cleanedSlicePieceCount)
    .toBe(2)
  await expect
    .poll(async () => (await readDebugState(page)).activeSlicePieceCount)
    .toBe(0)
})

test('토큰 주위에 원을 그리면 포획 슬롯을 사용한다', async (
  { page },
  testInfo,
) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '모바일 프로젝트의 실제 터치 경로는 실기기 단계에서 검증합니다.',
  )

  await startSoloGame(page)
  await waitForActiveToken(page)
  await pauseActiveToken(page)
  const start = await readDebugState(page)
  const token = start.activeToken

  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  const transform = await getCanvasTransform(page)
  const captureRadius = token.judgement.radius + 34
  const captureStart = toPagePoint(
    transform,
    token.x + captureRadius,
    token.y,
  )

  await page.mouse.move(captureStart.x, captureStart.y)
  await page.mouse.down()

  for (let step = 1; step <= 16; step += 1) {
    const angle = (Math.PI * 2 * step) / 16
    const point = toPagePoint(
      transform,
      token.x + Math.cos(angle) * captureRadius,
      token.y + Math.sin(angle) * captureRadius,
    )
    await page.mouse.move(point.x, point.y)
  }

  await page.mouse.up()

  await expect
    .poll(async () => (await readDebugState(page)).captureCount)
    .toBe(1)
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
  await pauseActiveToken(page)
  const start = await readDebugState(page)
  const token = start.activeToken

  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  const transform = await getCanvasTransform(page)
  const gestureStart = toPagePoint(
    transform,
    token.x - token.judgement.radius - 24,
    token.y,
  )
  const gestureEnd = toPagePoint(
    transform,
    token.x + token.judgement.radius + 24,
    token.y,
  )
  const cdp = await page.context().newCDPSession(page)

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...gestureStart, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ ...gestureEnd, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  })

  await expect
    .poll(async () => (await readDebugState(page)).pathPointCount)
    .toBe(0)
  await expect
    .poll(async () => (await readDebugState(page)).completedRounds)
    .toBe(0)
  await expect
    .poll(async () => (await readDebugState(page)).lastAction)
    .toBeNull()
  await expect
    .poll(async () => (await readDebugState(page)).feedback)
    .toContain('다시 시도')

  await pauseActiveToken(page)
})

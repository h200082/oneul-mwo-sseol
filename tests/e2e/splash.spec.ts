import { expect, test, type Page } from '@playwright/test'

type AudioState =
  | 'unavailable'
  | 'locked'
  | 'running'
  | 'suspended'
  | 'closed'

interface SplashDebugWindow extends Window {
  __SPLASH_AUDIO_PROBE__?: {
    readonly contexts: number
    readonly resumes: number
  }
  __NHN_APP__?: {
    getDebugState: () => {
      sensoryFeedback: {
        readonly audioState: AudioState
        readonly musicRequested: boolean
        readonly musicPlaying: boolean
      }
    }
  }
}

const SPLASH_SESSION_KEY = 'oneul-mwo-sseol-splash-entered'

test('일반 첫 접속은 타이틀을 보여주고 게임 시작 뒤 기존 메뉴를 연다', async ({
  page,
}) => {
  await page.goto('/')

  const splash = page.getByTestId('splash-screen')
  await expect(splash).toBeVisible()
  await expect(
    splash.getByRole('heading', { level: 1, name: '뭐 먹을 거냥?' }),
  ).toBeVisible()
  await expect(page.getByTestId('splash-chef-cat')).toBeVisible()
  await expect(page.getByTestId('splash-food')).toHaveCount(4)
  await expect(page.getByTestId('splash-motion-stage')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await expect(page.getByTestId('home-screen')).toHaveCount(0)
  await expect(page.getByTestId('solo-start')).toHaveCount(0)
  await expect(page.locator('#game-root canvas')).toHaveCount(0)

  await page.getByTestId('splash-start').click()

  await expect(splash).toHaveCount(0)
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(page.getByTestId('solo-start')).toBeVisible()
  await expect(page.getByTestId('create-room')).toBeVisible()
  await expect(page.getByTestId('friend-join')).toBeVisible()
  await expect(page.getByTestId('friend-join')).not.toHaveAttribute('open', '')
  await expect(page.getByTestId('join-room')).toBeHidden()
  await expect(page.getByTestId('game-guide')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate((key) => sessionStorage.getItem(key), SPLASH_SESSION_KEY),
    )
    .toBe('1')
})

test('같은 탭의 새로고침은 메뉴를 유지하고 새 브라우저 컨텍스트는 타이틀부터 시작한다', async ({
  browser,
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('splash-start').click()
  await expect(page.getByTestId('home-screen')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(page.getByTestId('splash-screen')).toHaveCount(0)
  await expect(page.getByTestId('solo-start')).toBeVisible()

  const freshContext = await browser.newContext()
  try {
    const freshPage = await freshContext.newPage()
    const appUrl = new URL('/', page.url()).href
    await freshPage.goto(appUrl)
    await expect(freshPage.getByTestId('splash-screen')).toBeVisible()
    await expect(freshPage.getByTestId('home-screen')).toHaveCount(0)
  } finally {
    await freshContext.close()
  }
})

test('QR 초대 링크는 세션 타이틀을 거치지 않고 참가 화면을 바로 연다', async ({
  page,
}) => {
  await page.goto('/?room=ABCD2EFG')

  await expect(page.getByTestId('splash-screen')).toHaveCount(0)
  await expect(page.getByTestId('splash-start')).toHaveCount(0)
  await expect(page.getByTestId('invite-home')).toBeVisible()
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(page.getByLabel('방 코드')).toHaveValue('ABCD2EFG')
  await expect(page.getByTestId('join-room')).toHaveText('이 방에 참가')
})

test('동작 감소 설정에서는 장식 모션 없이 즉시 메뉴로 전환한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '동일한 CSS media contract는 데스크톱 Chromium에서 한 번 검증합니다.',
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const runningAnimations = await page
    .getByTestId('splash-motion-stage')
    .evaluate((stage) =>
      stage
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === 'running').length,
    )
  expect(runningAnimations).toBe(0)

  await page.getByTestId('splash-start').click()
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(page.getByTestId('splash-screen')).toHaveCount(0)
})

test('키보드와 스크린리더에 게임 시작 동작을 명확하게 제공한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '키보드 초점 순서는 데스크톱 Chromium에서 검증합니다.',
  )
  await page.goto('/')

  const splash = page.getByTestId('splash-screen')
  const start = splash.getByRole('button', { name: '게임 시작' })
  await expect(start).toBeVisible()
  await expect(page.locator('h1:visible')).toHaveCount(1)
  await expect(
    page.getByTestId('splash-motion-stage').locator('img:not([alt])'),
  ).toHaveCount(0)

  await page.keyboard.press('Tab')
  await expect(start).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(page.getByTestId('splash-screen')).toHaveCount(0)
})

test('모바일 첫 화면은 가로 넘침 없이 제목과 시작 버튼을 첫 뷰포트에 둔다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    '실제 모바일 viewport 계약은 Pixel 7 프로젝트에서 검증합니다.',
  )
  await page.goto('/')

  const start = page.getByTestId('splash-start')
  await expect(
    page.getByRole('heading', { level: 1, name: '뭐 먹을 거냥?' }),
  ).toBeInViewport()
  await expect(page.getByTestId('splash-chef-cat')).toBeInViewport()
  await expect(start).toBeInViewport()
  const startBox = await start.boundingBox()
  expect(startBox).not.toBeNull()
  expect(startBox!.height).toBeGreaterThanOrEqual(44)
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
          document.documentElement.clientWidth &&
        document.body.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('모바일 게임 시작 한 번으로 오디오를 잠금 해제하지만 메뉴에서 BGM은 재생하지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    '터치 autoplay 해제 규칙은 모바일 Chromium에서 검증합니다.',
  )
  await installAudioProbe(page)
  await page.goto('/')

  await expect
    .poll(async () => (await readSensoryState(page)).audioState)
    .toBe('locked')
  expect(await readSensoryState(page)).toMatchObject({
    musicRequested: false,
    musicPlaying: false,
  })

  await page.getByTestId('splash-start').tap()
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect
    .poll(async () => (await readSensoryState(page)).audioState)
    .toBe('running')
  expect(await readSensoryState(page)).toMatchObject({
    musicRequested: false,
    musicPlaying: false,
  })
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as SplashDebugWindow).__SPLASH_AUDIO_PROBE__?.resumes,
      ),
    )
    .toBe(1)
})

async function readSensoryState(page: Page): Promise<{
  readonly audioState: AudioState
  readonly musicRequested: boolean
  readonly musicPlaying: boolean
}> {
  return page.evaluate(() => {
    const state = (window as SplashDebugWindow).__NHN_APP__?.getDebugState()
      .sensoryFeedback
    if (!state) {
      throw new Error('Sensory debug state is unavailable.')
    }
    return state
  })
}

async function installAudioProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = { contexts: 0, resumes: 0 }
    ;(window as SplashDebugWindow).__SPLASH_AUDIO_PROBE__ = probe

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
      start(): void {}
      stop(): void {
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
  })
}

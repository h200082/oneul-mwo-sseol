import { expect, test, type Page } from '@playwright/test'

import { enterMainMenu } from './appEntry'

interface FeedbackDefaultsDebugWindow extends Window {
  __FEEDBACK_DEFAULTS_AUDIO_PROBE__?: {
    readonly starts: number
  }
  readonly __NHN_APP__?: {
    getDebugState(): {
      readonly sensoryFeedback: {
        readonly soundEnabled: boolean
        readonly hapticsEnabled: boolean
        readonly audioState:
          | 'unavailable'
          | 'locked'
          | 'running'
          | 'suspended'
          | 'closed'
        readonly musicRequested: boolean
        readonly musicPlaying: boolean
        readonly musicStartCount: number
      }
      readonly narrationPreference: {
        readonly requestedEnabled: boolean
        readonly effectiveEnabled: boolean
      }
    }
  }
}

test('첫 실행은 효과음·BGM·진동·나레이션이 모두 켜지고 일반 게임 시작에서 BGM이 재생된다', async ({
  page,
}) => {
  await installFeedbackCapabilities(page)
  await page.goto('/')
  await enterMainMenu(page)

  await expect(page.getByTestId('sound-toggle')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('haptics-toggle')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('narration-toggle')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('narration-toggle')).toHaveAttribute(
    'data-effective',
    'true',
  )

  expect(await readFeedbackState(page)).toMatchObject({
    sensoryFeedback: {
      soundEnabled: true,
      hapticsEnabled: true,
    },
    narrationPreference: {
      requestedEnabled: true,
      effectiveEnabled: true,
    },
  })

  await page.getByTestId('solo-start').click()
  await expect(page.locator('#game-root canvas')).toBeVisible()
  await expect
    .poll(async () => (await readFeedbackState(page)).sensoryFeedback)
    .toMatchObject({
      soundEnabled: true,
      audioState: 'running',
      musicRequested: true,
      musicPlaying: true,
      musicStartCount: 1,
    })

  const probe = await page.evaluate(
    () =>
      (window as FeedbackDefaultsDebugWindow)
        .__FEEDBACK_DEFAULTS_AUDIO_PROBE__,
  )
  expect(probe?.starts).toBeGreaterThan(0)
})

test('사용자가 명시적으로 끈 설정은 새로고침 뒤에도 다시 켜지지 않는다', async ({
  page,
}) => {
  await installFeedbackCapabilities(page)
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'oneul-mwo-sseol-feedback-v1',
      JSON.stringify({ soundEnabled: false, hapticsEnabled: false }),
    )
    window.localStorage.setItem('oneul-mwo-sseol-narration-enabled', '0')
  })
  await page.goto('/')
  await enterMainMenu(page)

  await expect(page.getByTestId('sound-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByTestId('haptics-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByTestId('narration-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(await readFeedbackState(page)).toMatchObject({
    sensoryFeedback: {
      soundEnabled: false,
      hapticsEnabled: false,
    },
    narrationPreference: {
      requestedEnabled: false,
      effectiveEnabled: false,
    },
  })

  await page.reload()
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByTestId('haptics-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByTestId('narration-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

async function readFeedbackState(page: Page) {
  return page.evaluate(() => {
    const state = (
      window as FeedbackDefaultsDebugWindow
    ).__NHN_APP__?.getDebugState()
    if (!state) {
      throw new Error('앱 피드백 디버그 상태를 찾을 수 없습니다.')
    }
    return state
  })
}

async function installFeedbackCapabilities(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = { starts: 0 }
    ;(
      window as FeedbackDefaultsDebugWindow
    ).__FEEDBACK_DEFAULTS_AUDIO_PROBE__ = probe

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
      stop(): void {}
    }

    class FakeAudioContext {
      state = 'suspended'
      currentTime = 0
      readonly destination = {}
      createGain(): FakeGainNode {
        return new FakeGainNode()
      }
      createOscillator(): FakeOscillatorNode {
        return new FakeOscillatorNode()
      }
      async resume(): Promise<void> {
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
      value: () => true,
    })
  })
}

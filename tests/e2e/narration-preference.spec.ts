import { expect, test, type Page } from '@playwright/test'

import { enterMainMenu } from './appEntry'

interface NarrationDebugWindow extends Window {
  readonly __NHN_APP__?: {
    getDebugState(): {
      readonly sensoryFeedback: {
        readonly soundEnabled: boolean
      }
      readonly narrationPreference: {
        readonly requestedEnabled: boolean
        readonly effectiveEnabled: boolean
      }
    }
  }
}

test('기존 VOX 설정은 SOUND에 통합되고 두 음향 상태가 함께 보존된다', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem('unified-sound-legacy-seeded') === '1') {
      return
    }
    window.sessionStorage.setItem('unified-sound-legacy-seeded', '1')
    window.localStorage.setItem(
      'oneul-mwo-sseol-feedback-v1',
      JSON.stringify({ soundEnabled: true, hapticsEnabled: true }),
    )
    window.localStorage.setItem('oneul-mwo-sseol-narration-enabled', '0')
  })
  await page.goto('/')
  await enterMainMenu(page)

  const sound = page.getByTestId('sound-toggle')
  await expect(page.getByTestId('narration-toggle')).toHaveCount(0)
  await expect(sound).toHaveAttribute('aria-pressed', 'true')
  await expect(sound).toHaveAccessibleName('음향 끄기')
  expect(await readUnifiedSoundState(page)).toEqual({
    soundEnabled: true,
    requestedEnabled: true,
    effectiveEnabled: true,
  })
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem('oneul-mwo-sseol-narration-enabled'),
    ),
  ).toBe('1')

  await sound.click()
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
  expect(await readUnifiedSoundState(page)).toEqual({
    soundEnabled: false,
    requestedEnabled: false,
    effectiveEnabled: false,
  })

  await page.reload()
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(await readUnifiedSoundState(page)).toEqual({
    soundEnabled: false,
    requestedEnabled: false,
    effectiveEnabled: false,
  })

  await page.getByTestId('sound-toggle').click()
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(await readUnifiedSoundState(page)).toEqual({
    soundEnabled: true,
    requestedEnabled: true,
    effectiveEnabled: true,
  })
})

async function readUnifiedSoundState(page: Page) {
  const state = await page.evaluate(() => {
    const debugWindow = window as NarrationDebugWindow
    return debugWindow.__NHN_APP__?.getDebugState()
  })
  if (!state) throw new Error('통합 음향 상태를 찾을 수 없습니다.')
  return {
    soundEnabled: state.sensoryFeedback.soundEnabled,
    requestedEnabled: state.narrationPreference.requestedEnabled,
    effectiveEnabled: state.narrationPreference.effectiveEnabled,
  }
}

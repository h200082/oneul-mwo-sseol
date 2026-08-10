import { expect, test } from '@playwright/test'

import { enterMainMenu } from './appEntry'

interface NarrationDebugWindow extends Window {
  readonly __NHN_APP__?: {
    getDebugState(): {
      readonly narrationPreference: {
        readonly requestedEnabled: boolean
        readonly effectiveEnabled: boolean
      }
    }
  }
}

test('나레이션 설정은 기기별로 보존되고 마스터 효과음과 독립적으로 표시된다', async ({
  page,
}) => {
  await page.goto('/')
  await enterMainMenu(page)

  const sound = page.getByTestId('sound-toggle')
  const narration = page.getByTestId('narration-toggle')

  await expect(narration).toHaveAttribute('aria-pressed', 'true')
  await expect(narration).toHaveAttribute('data-effective', 'true')
  await expect(narration).toHaveAccessibleName('나레이션 끄기')

  await narration.click()
  await expect(narration).toHaveAttribute('aria-pressed', 'false')
  await expect(narration).toHaveAttribute('data-effective', 'false')
  await expect(narration).toHaveAccessibleName('나레이션 켜기')

  await page.reload()
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(page.getByTestId('narration-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.getByTestId('narration-toggle').click()
  await expect(page.getByTestId('narration-toggle')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await sound.click()

  await expect(sound).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('narration-toggle')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('narration-toggle')).toHaveAttribute(
    'data-effective',
    'false',
  )
  await expect(page.getByTestId('narration-toggle')).toHaveAttribute(
    'title',
    '효과음을 켜면 나레이션이 재생돼요',
  )

  await sound.click()
  await expect(page.getByTestId('narration-toggle')).toHaveAttribute(
    'data-effective',
    'true',
  )

  const state = await page.evaluate(() => {
    const debugWindow = window as NarrationDebugWindow
    return debugWindow.__NHN_APP__?.getDebugState().narrationPreference
  })
  expect(state).toEqual({
    requestedEnabled: true,
    effectiveEnabled: true,
  })
})

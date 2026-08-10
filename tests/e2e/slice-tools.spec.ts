import { expect, test, type Page } from '@playwright/test'

import {
  RAINBOW_SLICE_TOOL_ID,
  RAINBOW_TRAIL_COLORS,
  SELECTED_SLICE_TOOL_STORAGE_KEY,
} from '../../src/game/sliceTools'
import { enterMainMenu } from './appEntry'

interface SliceToolDebugState {
  readonly activeToken: {
    readonly x: number
    readonly y: number
    readonly judgement:
      | {
          readonly kind: 'alpha-mask'
          readonly radius: number
          readonly centerX: number
          readonly centerY: number
        }
      | {
          readonly kind: 'circle-fallback'
          readonly radius: number
        }
  } | null
  readonly sliceTool: 'classic-knife' | 'rainbow-knife'
  readonly lastTrailSegmentColors: readonly number[]
  readonly inputMode: 'idle' | 'hold' | 'slice'
  readonly activeRainbowStarDustCount: number
  readonly emittedRainbowStarDustCount: number
  readonly cleanedRainbowStarDustCount: number
}

interface SliceToolDebugWindow extends Window {
  __NHN_GAME__?: {
    scene: {
      getScene: (key: string) => {
        activeToken?: {
          tween?: { pause: () => void }
          rotationTween?: { pause: () => void }
        }
        getDebugState: () => SliceToolDebugState
      }
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('oneul-mwo-sseol-splash-entered', '1')
  })
  await page.goto('/')
  await enterMainMenu(page)
})

test('업적과 도구 칸에서 냥손톱과 무지개 회칼을 선택하고 저장한다', async ({
  page,
}) => {
  const achievementPanel = page.getByTestId('achievement-panel')
  const toolPanel = page.getByTestId('tool-panel')
  const classicButton = page.getByTestId('select-classic-knife')
  const rainbowButton = page.getByTestId('select-rainbow-knife')
  const pawImage = page.getByTestId('nyang-claw-paw')

  await expect(achievementPanel).not.toHaveAttribute('open', '')
  await achievementPanel.locator('summary').click()
  await expect(page.getByTestId('achievement-sushi-master')).toContainText(
    '초밥 마스터',
  )
  await expect(page.getByTestId('achievement-sushi-master')).toContainText(
    '초밥 5회 포획 성공',
  )
  await expect(achievementPanel).toContainText('업데이트 시 추가')

  await expect(toolPanel).not.toHaveAttribute('open', '')
  await toolPanel.locator('summary').click()
  await expect(toolPanel).toContainText('냥손톱')
  await expect(classicButton).toHaveAttribute(
    'aria-label',
    '냥손톱 장착 중',
  )
  await expect(pawImage).toBeVisible()
  expect(
    await pawImage.evaluate(
      (image) =>
        image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
    ),
  ).toBe(true)
  await expect(classicButton).toHaveAttribute('aria-pressed', 'true')
  await expect(rainbowButton).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('tool-rainbow-knife')).toContainText(
    '초밥 마스터 칭호',
  )
  await expect(page.getByTestId('tool-rainbow-knife')).toContainText(
    '초밥 5회 포획 성공 시 사용 가능',
  )
  await expect(page.getByTestId('tool-rainbow-knife')).toContainText(
    '현재 버전에서는 바로 체험할 수 있어요.',
  )

  await rainbowButton.click()
  await expect(rainbowButton).toHaveAttribute('aria-pressed', 'true')
  await expect(classicButton).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('selected-tool-summary')).toHaveText(
    '무지개 회칼 장착 중',
  )
  expect(
    await page.evaluate(
      (storageKey) => window.localStorage.getItem(storageKey),
      SELECTED_SLICE_TOOL_STORAGE_KEY,
    ),
  ).toBe(RAINBOW_SLICE_TOOL_ID)

  await page.reload()
  await enterMainMenu(page)
  await page.getByTestId('tool-panel').locator('summary').click()
  await expect(page.getByTestId('select-rainbow-knife')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('무지개 회칼은 일곱 색 궤적과 떨어지는 별가루를 사용한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '포인터 궤적은 데스크톱에서 한 번 검증하고 모바일은 UI 레이아웃을 검증합니다.',
  )

  await page.getByTestId('tool-panel').locator('summary').click()
  await page.getByTestId('select-rainbow-knife').click()
  await page.getByTestId('solo-start').click()
  await expect(page.locator('#game-root canvas')).toBeVisible()
  await waitForActiveToken(page)

  const state = await readSliceToolDebugState(page)
  const token = state.activeToken
  expect(state.sliceTool).toBe(RAINBOW_SLICE_TOOL_ID)
  expect(token).not.toBeNull()
  if (!token) {
    return
  }

  await pauseActiveToken(page)
  const canvasBox = await page.locator('#game-root canvas').boundingBox()
  expect(canvasBox).not.toBeNull()
  if (!canvasBox) {
    return
  }

  const centerX =
    token.x +
    (token.judgement.kind === 'alpha-mask'
      ? token.judgement.centerX
      : 0)
  const centerY =
    token.y +
    (token.judgement.kind === 'alpha-mask'
      ? token.judgement.centerY
      : 0)
  const scaleX = canvasBox.width / 390
  const scaleY = canvasBox.height / 844
  const start = {
    x:
      canvasBox.x +
      (centerX - token.judgement.radius * 1.45) * scaleX,
    y: canvasBox.y + centerY * scaleY,
  }
  const end = {
    x:
      canvasBox.x +
      (centerX + token.judgement.radius * 1.45) * scaleX,
    y: canvasBox.y + centerY * scaleY,
  }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 14 })

  const duringDrag = await readSliceToolDebugState(page)
  const uniqueTrailColors = new Set(duringDrag.lastTrailSegmentColors)
  expect(duringDrag.inputMode).toBe('slice')
  expect(uniqueTrailColors.size).toBeGreaterThanOrEqual(4)
  expect(
    [...uniqueTrailColors].every((color) =>
      RAINBOW_TRAIL_COLORS.includes(
        color as (typeof RAINBOW_TRAIL_COLORS)[number],
      ),
    ),
  ).toBe(true)

  expect(duringDrag.emittedRainbowStarDustCount).toBeGreaterThan(0)
  expect(duringDrag.activeRainbowStarDustCount).toBeGreaterThan(0)
  expect(duringDrag.activeRainbowStarDustCount).toBeLessThanOrEqual(14)
  await page.mouse.up()
  await expect
    .poll(
      async () =>
        (await readSliceToolDebugState(page)).activeRainbowStarDustCount,
      { timeout: 1_500 },
    )
    .toBe(0)
  expect(
    (await readSliceToolDebugState(page)).cleanedRainbowStarDustCount,
  ).toBeGreaterThan(0)
})

async function waitForActiveToken(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const scene = (window as SliceToolDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    return Boolean(scene?.getDebugState().activeToken)
  })
}

async function readSliceToolDebugState(
  page: Page,
): Promise<SliceToolDebugState> {
  return page.evaluate(() => {
    const scene = (window as SliceToolDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) {
      throw new Error('프로토타입 디버그 장면을 찾을 수 없습니다.')
    }
    return scene.getDebugState()
  })
}

async function pauseActiveToken(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scene = (window as SliceToolDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    scene?.activeToken?.tween?.pause()
    scene?.activeToken?.rotationTween?.pause()
  })
}

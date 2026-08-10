import { expect, test, type Page } from '@playwright/test'

import {
  ROOM_RESULT_SYNC_GRACE_MS,
  ROOM_RESULT_WINDOW_MS,
} from '../../src/domain/room'
import { enterMainMenu } from './appEntry'

interface RoomGameDebugState {
  readonly activeToken: {
    readonly x: number
    readonly y: number
  } | null
  readonly mealTime: 'lunch' | 'dinner'
  readonly deckSeed: string | number
  readonly deckMenuIds: readonly string[]
  readonly completedRounds: number
  readonly captureCount: number
  readonly filledCaptureSlotCount: number
  readonly lastAction: 'slice' | 'capture' | 'miss' | null
  readonly practiceStage: 'slice' | 'capture' | 'complete'
  readonly tutorialComplete: boolean
  readonly completedPracticeActions: readonly ('slice' | 'capture')[]
}

interface AppResultDebugState {
  readonly sensoryFeedback: {
    readonly lastCue: string | null
    readonly triggerCount: number
  }
  readonly submitRoomResultForTest: (input: {
    readonly score: number
    readonly capturedMenuIds: readonly string[]
    readonly completedAt?: number
  }) => Promise<void>
}

interface GameDebugWindow extends Window {
  __NHN_APP__?: {
    getDebugState: () => AppResultDebugState
  }
  __NHN_GAME__?: {
    scene: {
      getScene: (key: string) => {
        getDebugState: () => RoomGameDebugState
      }
    }
  }
}

async function readRoomGameDebugState(
  page: Page,
): Promise<RoomGameDebugState> {
  return page.evaluate(() => {
    const game = (window as GameDebugWindow).__NHN_GAME__
    const scene = game?.scene.getScene('prototype')

    if (!scene) {
      throw new Error('방 게임 장면을 찾을 수 없습니다.')
    }

    return scene.getDebugState()
  })
}

async function waitForRoomGameRound(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const state = await readRoomGameDebugState(page)
      return {
        practiceStage: state.practiceStage,
        hasActiveToken: state.activeToken !== null,
      }
    })
    .toEqual({ practiceStage: 'complete', hasActiveToken: true })
}

async function readAppSensoryDebugState(
  page: Page,
): Promise<AppResultDebugState['sensoryFeedback']> {
  return page.evaluate(() => {
    const app = (window as GameDebugWindow).__NHN_APP__
    if (!app) {
      throw new Error('앱 디버그 인터페이스를 찾을 수 없습니다.')
    }

    return app.getDebugState().sensoryFeedback
  })
}

async function submitRoomResultForTest(
  page: Page,
  input: {
    readonly score: number
    readonly capturedMenuIds: readonly string[]
    readonly completedAt?: number
  },
): Promise<void> {
  await page.evaluate(async (submission) => {
    const app = (window as GameDebugWindow).__NHN_APP__
    if (!app) {
      throw new Error('앱 디버그 인터페이스를 찾을 수 없습니다.')
    }

    await app.getDebugState().submitRoomResultForTest(submission)
  }, input)
}

function normalizedText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

const GAME_CANVAS_TIMEOUT_MS = 12_000
const BRIGHT_SCREEN_BACKGROUND = 'rgb(255, 247, 232)'

test('참가 저장 직후 방장이 시작해도 두 기기 준비 확인 뒤 함께 카운트다운한다', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '멀티탭 동기화 E2E는 데스크톱 프로젝트에서 한 번 검증합니다.',
  )

  await page.goto('/')
  await enterMainMenu(page)
  await page.getByLabel('닉네임').fill('방장')
  await page.getByLabel('저녁').check()
  await page.getByTestId('create-room').click()

  const roomCode = (await page.getByTestId('room-code').textContent())?.trim()
  expect(roomCode).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/)
  if (!roomCode) {
    return
  }

  await expect(page.getByTestId('room-qr')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/,
  )
  await expect(page.getByTestId('player-count')).toHaveText('1/8')
  await expect(page.getByTestId('start-room')).toBeDisabled()
  await expect(
    page.getByRole('button', { name: /^준비$/ }),
  ).toHaveCount(0)

  const participantPage = await context.newPage()
  const invitePath = `/?room=${roomCode.toLowerCase()}`
  await participantPage.goto(invitePath)

  await expect(participantPage.getByTestId('invite-home')).toBeVisible()
  await expect(participantPage.getByLabel('방 코드')).toHaveValue(roomCode)
  await expect(participantPage.getByLabel('방 코드')).toHaveAttribute(
    'readonly',
    '',
  )
  await expect(participantPage.getByLabel('닉네임')).toBeFocused()
  await expect(participantPage.getByTestId('solo-start')).toBeHidden()
  await expect(participantPage.getByTestId('create-room')).toBeHidden()
  await expect(participantPage.getByTestId('scan-qr')).toBeHidden()
  await expect(participantPage.getByLabel('점심')).toBeHidden()
  await expect(participantPage.getByTestId('join-room')).toHaveText(
    '이 방에 참가',
  )

  await participantPage.getByTestId('cancel-invite').click()
  await expect(participantPage).not.toHaveURL(/[?&]room=/u)
  await expect(participantPage.getByTestId('invite-home')).toHaveCount(0)
  await expect(participantPage.getByTestId('create-room')).toBeVisible()
  await expect(participantPage.getByTestId('splash-screen')).toHaveCount(0)

  await participantPage.goto(invitePath)
  await expect(participantPage.getByTestId('invite-home')).toBeVisible()
  await participantPage.getByLabel('닉네임').fill('참가자')
  await participantPage.getByLabel('닉네임').press('Enter')

  // 참가 기기의 lobby 렌더/구독을 기다리지 않고, 서버 명단에 들어온 즉시
  // 방장이 시작한다. 실제 초대 직후 발생하는 준비 handshake 경쟁을 고정한다.
  await expect(page.getByTestId('player-count')).toHaveText('2/8')
  await expect(page.getByTestId('start-room')).toBeEnabled()
  await expect(page.getByTestId('start-room')).toHaveText('2명으로 시작')

  await page.getByTestId('start-room').click()
  const hostCountdown = page.getByTestId('countdown')
  const participantCountdown = participantPage.getByTestId('countdown')
  await expect(hostCountdown).toBeVisible()
  await expect(participantCountdown).toBeVisible()
  await expect(hostCountdown).toHaveAttribute('role', 'timer')
  await expect(hostCountdown).toHaveAccessibleName(
    '게임 시작까지 남은 시간',
  )
  await expect(participantCountdown).toHaveAccessibleName(
    '게임 시작까지 남은 시간',
  )

  await expect(page.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })
  await expect(participantPage.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })

  const hostState = await readRoomGameDebugState(page)
  const participantState = await readRoomGameDebugState(participantPage)

  expect(hostState.mealTime).toBe('dinner')
  expect(participantState.mealTime).toBe('dinner')
  expect(participantState.deckSeed).toBe(hostState.deckSeed)
  expect(participantState.deckMenuIds).toEqual(hostState.deckMenuIds)
  expect(hostState.deckMenuIds).toHaveLength(20)
})

test('저장된 닉네임이 있으면 초대 링크에서 같은 방으로 자동 참가한다', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '멀티탭 동기화 E2E는 데스크톱 프로젝트에서 한 번 검증합니다.',
  )

  await page.goto('/')
  await enterMainMenu(page)
  await page.getByLabel('닉네임').fill('자동입장 방장')
  await page.getByTestId('create-room').click()

  const roomCode = (await page.getByTestId('room-code').textContent())?.trim()
  expect(roomCode).toBeTruthy()
  if (!roomCode) {
    return
  }

  const participantPage = await context.newPage()
  await participantPage.addInitScript(() => {
    sessionStorage.setItem(
      'oneul-mwo-sseol-nickname',
      '자동참가자',
    )
  })
  await participantPage.goto(`/?room=${roomCode}`)

  await expect(participantPage.getByTestId('invite-home')).toHaveCount(0)
  await expect(page.getByTestId('player-count')).toHaveText('2/8')
  await expect(participantPage.getByTestId('player-count')).toHaveText('2/8')
  await expect(
    participantPage
      .getByTestId('player-list')
      .getByText('자동참가자', { exact: true }),
  ).toBeVisible()
})

test('두 탭의 결과를 기다렸다가 같은 순위와 겹침 메뉴를 공개한다', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '멀티탭 결과 동기화 E2E는 데스크톱 프로젝트에서 한 번 검증합니다.',
  )

  await page.goto('/')
  await enterMainMenu(page)
  await page.getByLabel('닉네임').fill('우승자')
  await page.getByTestId('create-room').click()

  const roomCode = (await page.getByTestId('room-code').textContent())?.trim()
  expect(roomCode).toBeTruthy()
  if (!roomCode) {
    return
  }

  await expect(page.locator('.lobby-screen')).toHaveCSS(
    'background-color',
    BRIGHT_SCREEN_BACKGROUND,
  )

  const participantPage = await context.newPage()
  await participantPage.goto(`/?room=${roomCode}`)
  await participantPage.getByLabel('닉네임').fill('꼴찌')
  await participantPage.getByTestId('join-room').click()

  await expect(page.getByTestId('player-count')).toHaveText('2/8', {
    timeout: 8_000,
  })
  await expect(participantPage.getByTestId('player-count')).toHaveText('2/8', {
    timeout: 8_000,
  })
  await page.getByTestId('start-room').click()
  await expect(page.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })
  await expect(participantPage.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })

  const hostSensoryBeforeResult = await readAppSensoryDebugState(page)
  await submitRoomResultForTest(page, {
    score: 95,
    capturedMenuIds: ['pizza', 'pasta'],
    completedAt: 1_754_000_001_000,
  })

  await expect(page.locator('#game-root canvas')).toHaveCount(0)
  await expect(page.getByTestId('room-results-waiting')).toBeVisible()
  await expect(page.getByTestId('room-results-waiting')).toHaveCSS(
    'background-color',
    BRIGHT_SCREEN_BACKGROUND,
  )
  await expect(page.getByTestId('result-progress')).toHaveText('1/2')

  const participantSensoryBeforeResult =
    await readAppSensoryDebugState(participantPage)
  await submitRoomResultForTest(participantPage, {
    score: 70,
    capturedMenuIds: ['pizza'],
    completedAt: 1_754_000_002_000,
  })

  await expect(page.getByTestId('room-results-summary')).toBeVisible()
  await expect(
    participantPage.getByTestId('room-results-summary'),
  ).toBeVisible()

  await expect
    .poll(async () => {
      const sensory = await readAppSensoryDebugState(page)
      return {
        lastCue: sensory.lastCue,
        triggerDelta:
          sensory.triggerCount - hostSensoryBeforeResult.triggerCount,
      }
    })
    .toEqual({ lastCue: 'results', triggerDelta: 1 })
  await expect
    .poll(async () => {
      const sensory = await readAppSensoryDebugState(participantPage)
      return {
        lastCue: sensory.lastCue,
        triggerDelta:
          sensory.triggerCount -
          participantSensoryBeforeResult.triggerCount,
      }
    })
    .toEqual({ lastCue: 'results', triggerDelta: 1 })

  const standings = page.getByTestId('result-standing')
  await expect(standings).toHaveCount(2)
  await expect(standings.nth(0)).toContainText('1위')
  await expect(standings.nth(0)).toContainText('우승자')
  await expect(standings.nth(0)).toContainText('95점')
  await expect(standings.nth(0).getByTestId('capture-slot')).toHaveCount(2)
  await expect(standings.nth(0)).toContainText('피자')
  await expect(standings.nth(0)).toContainText('파스타')

  const pizzaImage = standings
    .nth(0)
    .locator('[data-menu-id="pizza"] img')
  await expect(pizzaImage).toBeVisible()
  await expect
    .poll(() =>
      pizzaImage.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0)

  await expect(standings.nth(1)).toContainText('2위')
  await expect(standings.nth(1)).toContainText('꼴찌')
  await expect(standings.nth(1)).toContainText('70점')
  await expect(standings.nth(1).getByTestId('capture-slot')).toHaveCount(2)
  await expect(standings.nth(1)).toContainText('피자')
  await expect(standings.nth(1)).toContainText('빈칸')

  await expect(
    page.getByRole('heading', { name: '1등의 점심 PICK' }),
  ).toBeVisible()
  await expect(page.getByTestId('winner-summary')).toContainText('우승자')
  await expect(page.getByTestId('winner-summary')).toContainText('피자')
  await expect(page.getByTestId('winner-summary')).toContainText('파스타')

  const overlap = page.getByTestId('overlap-summary')
  await expect(
    page.getByRole('heading', { name: '정확히 겹친 오늘의 메뉴' }),
  ).toBeVisible()
  await expect(overlap.getByTestId('overlapped-menu')).toHaveCount(1)
  await expect(overlap.getByTestId('category-affinity')).toHaveCount(0)
  await expect(overlap).toContainText('피자')
  await expect(page.getByTestId('overlap-max-count')).toHaveText('2회 선택')
  await expect(overlap).toContainText('2회 선택')
  await expect(overlap).toContainText('우승자')
  await expect(overlap).toContainText('꼴찌')
  await expect(page.getByTestId('result-outcome')).toContainText(
    '꼴찌가 1등의 식사를 부담',
  )
  await expect(page.getByTestId('result-personal-best')).toContainText(
    '이 기기 최고 기록',
  )
  const resultSectionOrder = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="room-results-summary"]')
    const candidates = document
      .querySelector('[data-testid="overlap-summary"]')
      ?.closest('section')
    const outcome = document.querySelector('[data-testid="result-outcome"]')
    const personalBest = document.querySelector(
      '[data-testid="result-personal-best"]',
    )
    const standingsSection = document
      .querySelector('[data-testid="result-standings"]')
      ?.closest('section')
    if (!root || !candidates || !outcome || !personalBest || !standingsSection) {
      throw new Error('result section missing')
    }
    const children = Array.from(root.children)
    return [candidates, outcome, personalBest, standingsSection].map((child) =>
      children.indexOf(child),
    )
  })
  expect(resultSectionOrder).toEqual(
    [...resultSectionOrder].sort((left, right) => left - right),
  )
  await expect(page.getByTestId('room-results-summary')).toHaveCSS(
    'background-color',
    BRIGHT_SCREEN_BACKGROUND,
  )

  const hostResultText = normalizedText(
    await page.getByTestId('room-results-summary').innerText(),
  )
  const participantResultText = normalizedText(
    await participantPage.getByTestId('room-results-summary').innerText(),
  )
  expect(participantResultText).toBe(hostResultText)

  await page.getByTestId('result-new-menu').click()
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(page.getByTestId('splash-screen')).toHaveCount(0)
  await expect(page.getByTestId('solo-start')).toBeVisible()
})

test('결과 마감 뒤 미제출 참가자를 미완주로 확정하고 타이머를 정리한다', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '두 페이지 deadline 동기화는 데스크톱 Chromium에서 한 번 검증합니다.',
  )

  const fixedTime = new Date('2026-08-04T12:00:00.000Z')
  await page.clock.install({ time: fixedTime })
  await page.goto('/')
  await enterMainMenu(page)
  await page.getByLabel('닉네임').fill('완주 방장')
  await page.getByTestId('create-room').click()

  const roomCode = (await page.getByTestId('room-code').textContent())?.trim()
  expect(roomCode).toBeTruthy()
  if (!roomCode) {
    return
  }

  const participantPage = await context.newPage()
  await participantPage.clock.install({ time: fixedTime })
  await participantPage.goto(`/?room=${roomCode}`)
  await participantPage.getByLabel('닉네임').fill('중도 이탈자')
  await participantPage.getByTestId('join-room').click()
  await expect(page.getByTestId('player-count')).toHaveText('2/8')

  await page.getByTestId('start-room').click()
  await expect(page.getByTestId('countdown')).toBeVisible()
  await expect(participantPage.getByTestId('countdown')).toBeVisible()
  await Promise.all([
    page.clock.fastForward(4_100),
    participantPage.clock.fastForward(4_100),
  ])
  await expect(page.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })
  await expect(participantPage.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })
  await submitRoomResultForTest(page, {
    score: 0,
    capturedMenuIds: ['pizza'],
  })
  await expect(page.getByTestId('room-results-waiting')).toBeVisible()
  await expect(page.getByTestId('result-progress')).toHaveText('1/2')
  await expect(page.getByTestId('result-deadline-countdown')).toBeVisible()

  await Promise.all([
    page.clock.fastForward(
      ROOM_RESULT_WINDOW_MS + ROOM_RESULT_SYNC_GRACE_MS + 2_500,
    ),
    participantPage.clock.fastForward(
      ROOM_RESULT_WINDOW_MS + ROOM_RESULT_SYNC_GRACE_MS + 2_500,
    ),
  ])
  await expect(page.getByTestId('room-results-summary')).toBeVisible()
  await expect(
    participantPage.getByTestId('room-results-summary'),
  ).toBeVisible()

  const standings = page.getByTestId('result-standing')
  await expect(standings).toHaveCount(2)
  await expect(standings.nth(0)).toContainText('완주 방장')
  await expect(standings.nth(0)).toContainText('0점')
  await expect(standings.nth(1)).toContainText('중도 이탈자')
  await expect(standings.nth(1)).toContainText('미완주 · 0점')
  await expect(standings.nth(1).getByTestId('capture-slot')).toHaveCount(2)
  await expect(standings.nth(1)).toContainText('빈칸')
  await expect(page.getByTestId('result-outcome')).toContainText(
    '중도 이탈자님이 완주 방장님의 식사를 부담해요.',
  )
  await expect(
    page.getByRole('heading', { name: '각자의 PICK에서 고르기' }),
  ).toBeVisible()
  await expect(page.getByTestId('individual-pick')).toHaveCount(1)
  await expect(page.getByTestId('individual-pick')).toContainText('완주 방장')
  await expect(page.getByTestId('individual-pick')).toContainText('피자')
  await expect(page.getByTestId('category-affinity')).toHaveCount(0)
  await expect(page.getByTestId('overlapped-menu')).toHaveCount(0)
  await expect(
    participantPage.getByTestId('result-standing').allTextContents(),
  ).resolves.toEqual(await standings.allTextContents())

  await page.getByTestId('result-home').click()
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(page.getByTestId('splash-screen')).toHaveCount(0)
  await expect(page.getByTestId('solo-start')).toBeVisible()
  await page.clock.fastForward(10_000)
  await expect(page.getByTestId('solo-start')).toBeVisible()
  await expect(page.getByTestId('room-results-summary')).toHaveCount(0)
  await participantPage.close()
})

test('대기실에서 방장이 나가면 첫 참가자가 방장을 승계한다', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '멀티탭 동기화 E2E는 데스크톱 프로젝트에서 한 번 검증합니다.',
  )

  await page.goto('/')
  await enterMainMenu(page)
  await page.getByLabel('닉네임').fill('나가는 방장')
  await page.getByTestId('create-room').click()

  const roomCode = (await page.getByTestId('room-code').textContent())?.trim()
  expect(roomCode).toBeTruthy()
  if (!roomCode) {
    return
  }

  const participantPage = await context.newPage()
  await participantPage.goto(`/?room=${roomCode}`)
  await participantPage.getByLabel('닉네임').fill('새 방장')
  await participantPage.getByTestId('join-room').click()

  await expect(page.getByTestId('player-count')).toHaveText('2/8')
  await page.getByTestId('leave-room').click()

  await expect(page.getByTestId('solo-start')).toBeVisible()
  await expect(participantPage.getByTestId('player-count')).toHaveText('1/8')
  await expect(participantPage.getByTestId('start-room')).toBeVisible()
  await expect(participantPage.getByTestId('start-room')).toBeDisabled()
  await expect(
    participantPage
      .getByTestId('player-list')
      .getByText('방장', { exact: true }),
  ).toBeVisible()
})

test('대기실을 새로고침한 플레이어가 같은 자리로 복귀한다', async ({
  page,
}) => {
  await page.goto('/')
  await enterMainMenu(page)
  await page.getByLabel('닉네임').fill('새로고침 방장')
  await page.getByTestId('create-room').click()

  const roomCode = (await page.getByTestId('room-code').textContent())?.trim()
  expect(roomCode).toBeTruthy()
  if (!roomCode) {
    return
  }

  await expect(page).toHaveURL(new RegExp(`[?&]room=${roomCode}`))
  await page.reload()
  await expect(page.getByTestId('player-count')).toHaveText('1/8')
  await expect(page.getByTestId('start-room')).toBeVisible()
  await expect(page.getByTestId('start-room')).toBeDisabled()
  await expect(page.getByTestId('player-list').getByRole('listitem')).toHaveCount(1)
})

test('게임 중 새로고침하면 같은 덱의 시작된 방으로 복귀한다', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '멀티탭 새로고침 복귀 E2E는 데스크톱 프로젝트에서 검증합니다.',
  )

  await page.goto('/')
  await enterMainMenu(page)
  await page.getByLabel('닉네임').fill('복귀 방장')
  await page.getByLabel('저녁').check()
  await page.getByTestId('create-room').click()

  const roomCode = (await page.getByTestId('room-code').textContent())?.trim()
  expect(roomCode).toBeTruthy()
  if (!roomCode) {
    return
  }

  const participantPage = await context.newPage()
  await participantPage.goto(`/?room=${roomCode}`)
  await participantPage.getByLabel('닉네임').fill('게임 유지 참가자')
  await participantPage.getByTestId('join-room').click()

  await expect(page.getByTestId('player-count')).toHaveText('2/8')
  await page.getByTestId('start-room').click()
  await expect(page.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })
  await expect(participantPage.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })

  await Promise.all([
    waitForRoomGameRound(page),
    waitForRoomGameRound(participantPage),
  ])
  const [hostGame, participantGame] = await Promise.all([
    readRoomGameDebugState(page),
    readRoomGameDebugState(participantPage),
  ])
  expect(hostGame.practiceStage).toBe('complete')
  expect(participantGame.practiceStage).toBe('complete')
  expect(hostGame.tutorialComplete).toBe(false)
  expect(participantGame.tutorialComplete).toBe(false)
  expect(hostGame.completedPracticeActions).toEqual([])
  expect(participantGame.completedPracticeActions).toEqual([])
  expect(hostGame.completedRounds).toBe(0)
  expect(participantGame.completedRounds).toBe(0)
  const activeToken = (await readRoomGameDebugState(page)).activeToken
  const canvasBounds = await page.locator('#game-root canvas').boundingBox()
  expect(activeToken).not.toBeNull()
  expect(canvasBounds).not.toBeNull()
  if (!activeToken || !canvasBounds) {
    return
  }

  await page.mouse.move(
    canvasBounds.x + (activeToken.x / 390) * canvasBounds.width,
    canvasBounds.y + (activeToken.y / 844) * canvasBounds.height,
  )
  await page.mouse.down()
  await page.waitForTimeout(380)
  await page.mouse.up()

  await expect
    .poll(
      async () =>
        (await readRoomGameDebugState(page)).filledCaptureSlotCount,
    )
    .toBe(1)
  const beforeReload = await readRoomGameDebugState(page)
  expect(beforeReload.completedRounds).toBe(1)
  expect(beforeReload.captureCount).toBe(1)
  expect(beforeReload.lastAction).toBe('capture')

  await page.reload()

  await expect(page.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })
  const afterReload = await readRoomGameDebugState(page)
  expect(afterReload.mealTime).toBe('dinner')
  expect(afterReload.deckSeed).toBe(beforeReload.deckSeed)
  expect(afterReload.deckMenuIds).toEqual(beforeReload.deckMenuIds)
  expect(afterReload.completedRounds).toBe(beforeReload.completedRounds)
  expect(afterReload.lastAction).toBe(beforeReload.lastAction)
  expect(afterReload.captureCount).toBe(beforeReload.captureCount)
  expect(afterReload.filledCaptureSlotCount).toBe(
    beforeReload.filledCaptureSlotCount,
  )
})

test('결과 대기 중 새로고침하면 게임을 재실행하지 않고 대기로 복귀한다', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '멀티탭 결과 복귀 E2E는 데스크톱 프로젝트에서 검증합니다.',
  )

  await page.goto('/')
  await enterMainMenu(page)
  await page.getByLabel('닉네임').fill('결과 복귀 방장')
  await page.getByLabel('저녁').check()
  await page.getByTestId('create-room').click()

  const roomCode = (await page.getByTestId('room-code').textContent())?.trim()
  expect(roomCode).toBeTruthy()
  if (!roomCode) {
    return
  }

  const participantPage = await context.newPage()
  await participantPage.goto(`/?room=${roomCode}`)
  await participantPage.getByLabel('닉네임').fill('늦은 참가자')
  await participantPage.getByTestId('join-room').click()

  await expect(page.getByTestId('player-count')).toHaveText('2/8')
  await page.getByTestId('start-room').click()
  await expect(page.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })
  await expect(participantPage.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })

  await submitRoomResultForTest(page, {
    score: 88,
    capturedMenuIds: ['pizza'],
    completedAt: 1_754_000_003_000,
  })
  await expect(page.getByTestId('room-results-waiting')).toBeVisible()
  await expect(page.getByTestId('result-progress')).toHaveText('1/2')

  await page.reload()

  await expect(page.locator('#game-root canvas')).toHaveCount(0)
  await expect(page.getByTestId('room-results-waiting')).toBeVisible()
  await expect(page.getByTestId('result-progress')).toHaveText('1/2')
  await expect(page.getByTestId('result-submit-status')).toHaveText(
    '내 결과 제출 완료',
  )

  await submitRoomResultForTest(participantPage, {
    score: 72,
    capturedMenuIds: ['shabu-shabu', 'pasta'],
    completedAt: 1_754_000_004_000,
  })

  await expect(page.getByTestId('room-results-summary')).toBeVisible()
  await expect(
    participantPage.getByTestId('room-results-summary'),
  ).toBeVisible()
  await expect(page.getByTestId('result-standing')).toHaveCount(2)
  await expect(page.getByTestId('result-standing').nth(0)).toContainText(
    '결과 복귀 방장',
  )
  await expect(
    page.getByRole('heading', { name: '1등의 저녁 PICK' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '가까운 취향으로 고른 후보' }),
  ).toBeVisible()
  const categoryAffinity = page.getByTestId('category-affinity')
  await expect(categoryAffinity).toHaveCount(1)
  await expect(categoryAffinity).toHaveAttribute('data-category', 'shared-dish')
  await expect(categoryAffinity).toContainText('둘 다 함께 먹는 메뉴파')
  await expect(categoryAffinity).toContainText('오늘은 함께 나눠 먹는 취향')
  await expect(categoryAffinity).toContainText('결과 복귀 방장')
  await expect(categoryAffinity).toContainText('늦은 참가자')
  await expect(page.getByTestId('overlapped-menu')).toHaveCount(0)
  await expect(page.getByTestId('overlap-max-count')).toHaveText('2명 일치')
})

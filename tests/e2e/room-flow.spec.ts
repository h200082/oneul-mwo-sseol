import { expect, test, type Page } from '@playwright/test'

interface RoomGameDebugState {
  readonly mealTime: 'lunch' | 'dinner'
  readonly deckSeed: string | number
  readonly deckMenuIds: readonly string[]
}

interface AppResultDebugState {
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

test('방장은 두 번째 참가자가 들어오면 준비 버튼 없이 시작한다', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '멀티탭 동기화 E2E는 데스크톱 프로젝트에서 한 번 검증합니다.',
  )

  await page.goto('/')
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
  await participantPage.goto(`/?room=${roomCode.toLowerCase()}`)
  await expect(participantPage.getByLabel('방 코드')).toHaveValue(roomCode)
  await participantPage.getByLabel('닉네임').fill('참가자')
  await participantPage.getByTestId('join-room').click()

  await expect(page.getByTestId('player-count')).toHaveText('2/8')
  await expect(page.getByTestId('start-room')).toBeEnabled()
  await expect(page.getByTestId('start-room')).toHaveText('2명으로 시작')

  await page.getByTestId('start-room').click()
  await expect(page.getByTestId('countdown')).toBeVisible()
  await expect(participantPage.getByTestId('countdown')).toBeVisible()

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

test('두 탭의 결과를 기다렸다가 같은 순위와 겹침 메뉴를 공개한다', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '멀티탭 결과 동기화 E2E는 데스크톱 프로젝트에서 한 번 검증합니다.',
  )

  await page.goto('/')
  await page.getByLabel('닉네임').fill('우승자')
  await page.getByTestId('create-room').click()

  const roomCode = (await page.getByTestId('room-code').textContent())?.trim()
  expect(roomCode).toBeTruthy()
  if (!roomCode) {
    return
  }

  const participantPage = await context.newPage()
  await participantPage.goto(`/?room=${roomCode}`)
  await participantPage.getByLabel('닉네임').fill('꼴찌')
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
    score: 95,
    capturedMenuIds: ['pizza', 'pasta'],
    completedAt: 1_754_000_001_000,
  })

  await expect(page.locator('#game-root canvas')).toHaveCount(0)
  await expect(page.getByTestId('room-results-waiting')).toBeVisible()
  await expect(page.getByTestId('result-progress')).toHaveText('1/2')

  await submitRoomResultForTest(participantPage, {
    score: 70,
    capturedMenuIds: ['pizza'],
    completedAt: 1_754_000_002_000,
  })

  await expect(page.getByTestId('room-results-summary')).toBeVisible()
  await expect(
    participantPage.getByTestId('room-results-summary'),
  ).toBeVisible()

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
    page.getByRole('heading', { name: '단독 1등 메뉴' }),
  ).toBeVisible()
  await expect(page.getByTestId('winner-summary')).toContainText('우승자')
  await expect(page.getByTestId('winner-summary')).toContainText('피자')
  await expect(page.getByTestId('winner-summary')).toContainText('파스타')

  const overlap = page.getByTestId('overlap-summary')
  await expect(overlap.getByTestId('overlapped-menu')).toHaveCount(1)
  await expect(overlap).toContainText('피자')
  await expect(overlap).toContainText('2명 포획')
  await expect(overlap).toContainText('우승자')
  await expect(overlap).toContainText('꼴찌')
  await expect(page.getByTestId('result-outcome')).toContainText(
    '꼴찌가 1등의 식사를 부담',
  )

  const hostResultText = normalizedText(
    await page.getByTestId('room-results-summary').innerText(),
  )
  const participantResultText = normalizedText(
    await participantPage.getByTestId('room-results-summary').innerText(),
  )
  expect(participantResultText).toBe(hostResultText)

  await page.getByTestId('result-home').click()
  await expect(page.getByTestId('solo-start')).toBeVisible()
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
  await page.getByLabel('닉네임').fill('새로고침 방장')
  await page.getByTestId('create-room').click()

  const roomCode = (await page.getByTestId('room-code').textContent())?.trim()
  expect(roomCode).toBeTruthy()
  if (!roomCode) {
    return
  }

  await expect(page).toHaveURL(new RegExp(`[?&]room=${roomCode}`))
  await page.reload()
  await expect(page.getByLabel('닉네임')).toHaveValue('새로고침 방장')
  await expect(page.getByLabel('방 코드')).toHaveValue(roomCode)

  await page.getByTestId('join-room').click()

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

  const beforeReload = await readRoomGameDebugState(page)
  await page.reload()
  await expect(page.getByLabel('닉네임')).toHaveValue('복귀 방장')
  await expect(page.getByLabel('방 코드')).toHaveValue(roomCode)
  await page.getByTestId('join-room').click()

  await expect(page.locator('#game-root canvas')).toBeVisible({
    timeout: GAME_CANVAS_TIMEOUT_MS,
  })
  const afterReload = await readRoomGameDebugState(page)
  expect(afterReload.mealTime).toBe('dinner')
  expect(afterReload.deckSeed).toBe(beforeReload.deckSeed)
  expect(afterReload.deckMenuIds).toEqual(beforeReload.deckMenuIds)
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
  await page.getByLabel('닉네임').fill('결과 복귀 방장')
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
  await expect(page.getByLabel('닉네임')).toHaveValue('결과 복귀 방장')
  await expect(page.getByLabel('방 코드')).toHaveValue(roomCode)
  await page.getByTestId('join-room').click()

  await expect(page.locator('#game-root canvas')).toHaveCount(0)
  await expect(page.getByTestId('room-results-waiting')).toBeVisible()
  await expect(page.getByTestId('result-progress')).toHaveText('1/2')
  await expect(page.getByTestId('result-submit-status')).toHaveText(
    '내 결과 제출 완료',
  )

  await submitRoomResultForTest(participantPage, {
    score: 72,
    capturedMenuIds: ['pizza', 'pasta'],
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
  await expect(page.getByTestId('overlap-summary')).toContainText('피자')
})

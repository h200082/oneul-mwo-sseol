import { expect, test, type Locator } from '@playwright/test'

import { enterMainMenu } from './appEntry'

const FRIEND_JOIN_TEST_ID = 'friend-join'

test('일반 홈의 게임 방법과 친구 방 참가는 독립적으로 접고 펼친다', async ({
  page,
}) => {
  await page.goto('/')
  await enterMainMenu(page)

  const gameGuide = page.getByTestId('game-guide')
  const aiVoiceDisclosure = page.getByTestId('ai-voice-disclosure')
  const friendJoin = page.getByTestId(FRIEND_JOIN_TEST_ID)
  const friendJoinSummary = friendJoin.locator('summary')
  const friendJoinContent = page.getByTestId('friend-join-content')

  await expect(page.getByTestId('tutorial-start')).toBeVisible()
  await expect(page.getByTestId('tutorial-start')).toHaveText('튜토리얼 하기')
  await expect(gameGuide).not.toHaveAttribute('open', '')
  await expect(aiVoiceDisclosure).toBeHidden()
  await expect(friendJoin).not.toHaveAttribute('open', '')
  await expect(friendJoinSummary).toHaveText('친구 방 참가')
  await expect(friendJoinContent).toBeHidden()
  await expect(page.getByLabel('방 코드')).toBeHidden()
  await expect(page.getByTestId('join-room')).toBeHidden()
  await expect(page.getByTestId('scan-qr')).toBeHidden()

  await friendJoinSummary.focus()
  await expect(friendJoinSummary).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(friendJoin).toHaveAttribute('open', '')
  await expect(friendJoinContent).toBeVisible()
  await expect(page.getByLabel('방 코드')).toBeVisible()
  await expect(page.getByTestId('join-room')).toBeVisible()
  await expect(page.getByTestId('scan-qr')).toBeVisible()
  await expect(gameGuide).not.toHaveAttribute('open', '')

  await gameGuide.locator('summary').click()
  await expect(gameGuide).toHaveAttribute('open', '')
  await expect(aiVoiceDisclosure).toBeVisible()
  await expect(aiVoiceDisclosure).toHaveText(
    '이 게임의 일부 음식 나레이션은 Microsoft Azure AI Speech로 생성한 AI 합성 음성입니다. 실제 인물의 녹음이나 성대모사가 아닙니다.',
  )
  await expect(friendJoin).toHaveAttribute('open', '')

  await friendJoinSummary.click()
  await expect(friendJoin).not.toHaveAttribute('open', '')
  await expect(friendJoinContent).toBeHidden()
  await expect(gameGuide).toHaveAttribute('open', '')
})

test('QR 초대 링크는 친구 참가 영역을 펼친 채 바로 보여준다', async ({
  page,
}) => {
  await page.goto('/?room=ABCD2EFG')

  const friendJoin = page.getByTestId(FRIEND_JOIN_TEST_ID)
  await expect(page.getByTestId('splash-screen')).toHaveCount(0)
  await expect(page.getByTestId('invite-home')).toBeVisible()
  await expect(friendJoin).toHaveAttribute('open', '')
  await expect(page.getByTestId('friend-join-content')).toBeVisible()
  await expect(page.getByLabel('방 코드')).toHaveValue('ABCD2EFG')
  await expect(page.getByLabel('방 코드')).toHaveAttribute('readonly', '')
  await expect(page.getByTestId('join-room')).toHaveText('이 방에 참가')
  await expect(page.getByTestId('join-room')).toBeInViewport()
  await expect(page.getByTestId('tutorial-start')).toBeHidden()

  await page.getByTestId('cancel-invite').click()
  await expect(page).not.toHaveURL(/[?&]room=/u)
  await expect(page.getByTestId('invite-home')).toHaveCount(0)
  await expect(page.getByTestId(FRIEND_JOIN_TEST_ID)).not.toHaveAttribute(
    'open',
    '',
  )
})

test('접힌 친구 참가 영역을 펼쳐 코드로 실제 방에 들어간다', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    '두 탭 로컬 방 동기화는 데스크톱 Chromium에서 한 번 검증합니다.',
  )

  await page.goto('/')
  await enterMainMenu(page)
  await page.getByLabel('닉네임').fill('방장')
  await page.getByTestId('create-room').click()

  const roomCode = (await page.getByTestId('room-code').textContent())?.trim()
  expect(roomCode).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/)
  if (!roomCode) {
    return
  }

  const participantPage = await context.newPage()
  await participantPage.goto('/')
  await enterMainMenu(participantPage)
  await participantPage.getByLabel('닉네임').fill('참가자')

  const friendJoin = participantPage.getByTestId(FRIEND_JOIN_TEST_ID)
  await expect(friendJoin).not.toHaveAttribute('open', '')
  await friendJoin.locator('summary').click()
  await participantPage.getByLabel('방 코드').fill(roomCode.toLowerCase())
  await participantPage.getByTestId('join-room').click()

  await expect(page.getByTestId('player-count')).toHaveText('2/8')
  await expect(participantPage.getByTestId('player-count')).toHaveText('2/8')
})

test('밝은 타이틀과 우상단 피드백 설정은 320px 화면에서도 정돈되어 있다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    '320px 모바일 레이아웃은 모바일 Chromium에서 검증합니다.',
  )
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/')

  const splash = page.getByTestId('splash-screen')
  await expect(splash).toBeVisible()
  const splashBackground = await splash.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  expect(relativeLuminance(parseRgb(splashBackground))).toBeGreaterThan(0.55)

  await page.getByTestId('splash-start').tap()
  const home = page.getByTestId('home-screen')
  const settings = page.getByTestId('feedback-settings')
  const setupCard = page.locator('.setup-card')
  const tutorialStart = page.getByTestId('tutorial-start')
  await expect(home).toBeVisible()
  await expect(settings).toBeVisible()
  await expect(tutorialStart).toBeVisible()
  const homeBackground = await home.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  expect(relativeLuminance(parseRgb(homeBackground))).toBeGreaterThan(0.55)

  const [homeBox, settingsBox, setupBox] = await Promise.all([
    requiredBox(home),
    requiredBox(settings),
    requiredBox(setupCard),
  ])
  const tutorialBox = await requiredBox(tutorialStart)
  expect(tutorialBox.height).toBeGreaterThanOrEqual(44)
  expect(tutorialBox.x).toBeGreaterThanOrEqual(setupBox.x)
  expect(tutorialBox.x + tutorialBox.width).toBeLessThanOrEqual(
    setupBox.x + setupBox.width + 1,
  )
  expect(settingsBox.x).toBeGreaterThanOrEqual(homeBox.x + homeBox.width / 2)
  expect(settingsBox.y + settingsBox.height).toBeLessThanOrEqual(setupBox.y)
  expect(settingsBox.x + settingsBox.width).toBeLessThanOrEqual(
    homeBox.x + homeBox.width + 1,
  )

  for (const testId of ['sound-toggle', 'haptics-toggle']) {
    const control = page.getByTestId(testId)
    const box = await requiredBox(control)
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeLessThanOrEqual(52)
    expect(box.height).toBeLessThanOrEqual(52)
    await expect(control).toHaveAttribute('aria-pressed', /^(true|false)$/u)
  }

  const sound = page.getByTestId('sound-toggle')
  const haptics = page.getByTestId('haptics-toggle')
  const soundPressedBefore = await sound.getAttribute('aria-pressed')
  await sound.tap()
  await expect(sound).toHaveAttribute(
    'aria-pressed',
    soundPressedBefore === 'true' ? 'false' : 'true',
  )
  const soundBoxAfterToggle = await requiredBox(sound)
  expect(soundBoxAfterToggle.width).toBeLessThanOrEqual(52)
  expect(soundBoxAfterToggle.height).toBeLessThanOrEqual(52)
  await expect(sound).not.toContainText('효과음')
  await expect(sound).toHaveText('SOUND')
  await expect(haptics).toHaveText('VIB')

  await expect(sound).toHaveAccessibleName(
    /^음향 (끄기|켜기)$/u,
  )
  await expect(page.getByTestId('narration-toggle')).toHaveCount(0)
  await expect(haptics).toHaveAccessibleName(
    /^(진동 (끄기|켜기)|이 기기에서는 진동을 지원하지 않아요)$/u,
  )
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
          document.documentElement.clientWidth &&
        document.body.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

async function requiredBox(locator: Locator): Promise<NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

function parseRgb(value: string): readonly [number, number, number] {
  const channels = value.match(/[\d.]+/gu)?.slice(0, 3).map(Number)
  expect(channels).toHaveLength(3)
  return [channels![0]!, channels![1]!, channels![2]!]
}

function relativeLuminance([
  red,
  green,
  blue,
]: readonly [number, number, number]): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

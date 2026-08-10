import {
  devices,
  expect,
  test,
  type Page,
} from '@playwright/test'

import { enterMainMenu } from '../e2e/appEntry'

const APP_URL = 'http://127.0.0.1:4174'
const GAME_CANVAS_TIMEOUT_MS = 15_000

interface DebugPlayer {
  readonly playerId: string
  readonly nickname: string
}

interface DebugRoom {
  readonly code: string
  readonly status: 'waiting' | 'preparing' | 'started'
  readonly players: readonly DebugPlayer[]
  readonly start?: {
    readonly startId: string
    readonly deckSeed: string | number
    readonly contentVersion: string
    readonly roster: readonly DebugPlayer[]
    readonly readyPlayerIds: readonly string[]
    readonly startAt?: number
  }
}

interface DebugAppState {
  readonly playerId: string
  readonly backend: 'local' | 'firebase'
  readonly roomCode: string | null
  readonly room: DebugRoom | null
  readonly gameVisible: boolean
  readonly submitRoomResultForTest: (input: {
    readonly score: number
    readonly capturedMenuIds: readonly string[]
    readonly completedAt?: number
  }) => Promise<void>
}

interface DebugGameState {
  readonly mealTime: 'lunch' | 'dinner'
  readonly deckSeed: string | number
  readonly deckMenuIds: readonly string[]
}

interface DebugWindow extends Window {
  __NHN_APP__?: {
    getDebugState: () => DebugAppState
  }
  __NHN_GAME__?: {
    scene: {
      getScene: (key: string) => {
        getDebugState: () => DebugGameState
      }
    }
  }
}

function mobileContextOptions(
  deviceName: 'Pixel 7' | 'iPhone 13',
) {
  const {
    defaultBrowserType,
    ...contextOptions
  } = devices[deviceName]
  void defaultBrowserType
  return {
    ...contextOptions,
    baseURL: APP_URL,
    locale: 'ko-KR',
  }
}

function collectBrowserErrors(
  page: Page,
  errors: string[],
): void {
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`)
    }
  })
}

async function waitForDebugApp(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    Boolean((window as DebugWindow).__NHN_APP__),
  )
}

async function readAppState(page: Page): Promise<DebugAppState> {
  return page.evaluate(() => {
    const app = (window as DebugWindow).__NHN_APP__
    if (!app) {
      throw new Error('App debug state is unavailable.')
    }
    return app.getDebugState()
  })
}

async function readGameState(page: Page): Promise<DebugGameState> {
  return page.evaluate(() => {
    const game = (window as DebugWindow).__NHN_GAME__
    const scene = game?.scene.getScene('prototype')
    if (!scene) {
      throw new Error('Game debug state is unavailable.')
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
    const app = (window as DebugWindow).__NHN_APP__
    if (!app) {
      throw new Error('App debug state is unavailable.')
    }
    await app.getDebugState().submitRoomResultForTest(submission)
  }, input)
}

test('two isolated Firebase mobile clients complete ready handshake and results', async ({
  browser,
}) => {
  const hostContext = await browser.newContext(
    mobileContextOptions('Pixel 7'),
  )
  const guestContext = await browser.newContext(
    mobileContextOptions('iPhone 13'),
  )
  const hostErrors: string[] = []
  const guestErrors: string[] = []
  let releaseGuestVisuals: () => void = () => undefined

  try {
    const hostPage = await hostContext.newPage()
    const guestPage = await guestContext.newPage()
    collectBrowserErrors(hostPage, hostErrors)
    collectBrowserErrors(guestPage, guestErrors)

    await hostPage.goto('/')
    await waitForDebugApp(hostPage)
    await enterMainMenu(hostPage)
    const initialHostState = await readAppState(hostPage)
    expect(initialHostState.backend).toBe('firebase')

    await hostPage.locator('#nickname-input').fill('Firebase Host')
    await hostPage
      .locator('input[name="meal-time"][value="dinner"]')
      .check()
    await hostPage.getByTestId('create-room').click()

    const roomCode = (
      await hostPage.getByTestId('room-code').textContent()
    )?.trim()
    expect(roomCode).toMatch(
      /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/,
    )
    if (!roomCode) {
      throw new Error('Host room code is unavailable.')
    }

    await guestPage.goto(`/?room=${roomCode}`)
    await waitForDebugApp(guestPage)
    const initialGuestState = await readAppState(guestPage)
    expect(initialGuestState.backend).toBe('firebase')
    expect(initialGuestState.playerId).not.toBe(
      initialHostState.playerId,
    )
    await expect(guestPage.getByTestId('invite-home')).toBeVisible()
    await expect(guestPage.getByLabel('방 코드')).toHaveValue(roomCode)

    await guestPage.locator('#nickname-input').fill('Firebase Guest')
    await guestPage.getByTestId('join-room').click()

    await expect(hostPage.getByTestId('player-count')).toHaveText(
      '2/8',
      { timeout: 10_000 },
    )
    await expect(guestPage.getByTestId('player-count')).toHaveText(
      '2/8',
      { timeout: 10_000 },
    )

    const [waitingHost, waitingGuest] = await Promise.all([
      readAppState(hostPage),
      readAppState(guestPage),
    ])
    expect(waitingHost.room?.status).toBe('waiting')
    expect(waitingGuest.room?.status).toBe('waiting')

    let blockedGuestVisualRequests = 0
    const guestVisualGate = new Promise<void>((resolve) => {
      releaseGuestVisuals = resolve
    })
    await guestPage.route(
      /\/src\/assets\/food\/.*\.webp(?:\?.*)?$/,
      async (route) => {
        blockedGuestVisualRequests += 1
        await guestVisualGate
        await route.continue()
      },
    )

    await hostPage.getByTestId('start-room').click()

    await expect
      .poll(() => blockedGuestVisualRequests, {
        timeout: 5_000,
        intervals: [25, 50, 100],
      })
      .toBeGreaterThan(0)

    const [preparingHost, preparingGuest] = await Promise.all([
      readAppState(hostPage),
      readAppState(guestPage),
    ])
    expect(preparingHost.room?.status).toBe('preparing')
    expect(preparingGuest.room?.status).toBe('preparing')
    expect(preparingHost.room?.start?.startId).toBe(
      preparingGuest.room?.start?.startId,
    )
    expect(
      preparingHost.room?.start?.readyPlayerIds ?? [],
    ).not.toContain(initialGuestState.playerId)
    expect(
      preparingGuest.room?.start?.readyPlayerIds ?? [],
    ).not.toContain(initialGuestState.playerId)
    await Promise.all([
      expect(hostPage.getByTestId('countdown')).toHaveCount(0),
      expect(guestPage.getByTestId('countdown')).toHaveCount(0),
    ])

    releaseGuestVisuals()
    releaseGuestVisuals = () => undefined

    await Promise.all([
      expect(hostPage.getByTestId('countdown')).toBeVisible({
        timeout: 10_000,
      }),
      expect(guestPage.getByTestId('countdown')).toBeVisible({
        timeout: 10_000,
      }),
    ])
    await Promise.all([
      expect(hostPage.locator('#game-root canvas')).toBeVisible({
        timeout: GAME_CANVAS_TIMEOUT_MS,
      }),
      expect(guestPage.locator('#game-root canvas')).toBeVisible({
        timeout: GAME_CANVAS_TIMEOUT_MS,
      }),
    ])

    const [hostApp, guestApp, hostGame, guestGame] =
      await Promise.all([
        readAppState(hostPage),
        readAppState(guestPage),
        readGameState(hostPage),
        readGameState(guestPage),
      ])

    expect(hostApp.roomCode).toBe(roomCode)
    expect(guestApp.roomCode).toBe(roomCode)
    expect(hostApp.room?.code).toBe(roomCode)
    expect(guestApp.room?.code).toBe(roomCode)
    expect(hostApp.room?.status).toBe('started')
    expect(guestApp.room?.status).toBe('started')
    expect(hostApp.gameVisible).toBe(true)
    expect(guestApp.gameVisible).toBe(true)

    const expectedPlayerIds = [
      initialHostState.playerId,
      initialGuestState.playerId,
    ]
    expect(
      hostApp.room?.players.map((player) => player.playerId),
    ).toEqual(expectedPlayerIds)
    expect(
      guestApp.room?.players.map((player) => player.playerId),
    ).toEqual(expectedPlayerIds)
    expect(
      hostApp.room?.start?.roster.map(
        (player) => player.playerId,
      ),
    ).toEqual(expectedPlayerIds)
    expect(
      guestApp.room?.start?.roster.map(
        (player) => player.playerId,
      ),
    ).toEqual(expectedPlayerIds)
    expect(
      [...(hostApp.room?.start?.readyPlayerIds ?? [])].sort(),
    ).toEqual([...expectedPlayerIds].sort())
    expect(
      [...(guestApp.room?.start?.readyPlayerIds ?? [])].sort(),
    ).toEqual([...expectedPlayerIds].sort())
    expect(hostApp.room?.start?.startId).toBe(
      guestApp.room?.start?.startId,
    )
    expect(hostApp.room?.start?.startAt).toBe(
      guestApp.room?.start?.startAt,
    )
    expect(hostApp.room?.start?.startAt).toEqual(expect.any(Number))

    expect(guestGame.mealTime).toBe(hostGame.mealTime)
    expect(guestGame.deckSeed).toBe(hostGame.deckSeed)
    expect(guestGame.deckMenuIds).toEqual(hostGame.deckMenuIds)
    expect(hostGame.deckMenuIds).toHaveLength(20)
    expect(hostApp.room?.start?.deckSeed).toBe(hostGame.deckSeed)
    expect(guestApp.room?.start?.deckSeed).toBe(guestGame.deckSeed)

    await submitRoomResultForTest(hostPage, {
      score: 95,
      capturedMenuIds: ['pizza', 'pasta'],
      completedAt: 1_754_000_001_000,
    })
    await expect(hostPage.getByTestId('room-results-waiting')).toBeVisible({
      timeout: 10_000,
    })
    await expect(hostPage.getByTestId('result-progress')).toHaveText('1/2')

    await submitRoomResultForTest(guestPage, {
      score: 70,
      capturedMenuIds: ['pizza'],
      completedAt: 1_754_000_002_000,
    })
    await Promise.all([
      expect(hostPage.getByTestId('room-results-summary')).toBeVisible({
        timeout: 10_000,
      }),
      expect(guestPage.getByTestId('room-results-summary')).toBeVisible({
        timeout: 10_000,
      }),
    ])

    const [hostStandings, guestStandings] = await Promise.all([
      hostPage.getByTestId('result-standing').allTextContents(),
      guestPage.getByTestId('result-standing').allTextContents(),
    ])
    expect(hostStandings).toHaveLength(2)
    expect(guestStandings).toEqual(hostStandings)
    expect(hostStandings[0]).toContain('Firebase Host')
    expect(hostStandings[0]).toContain('95')
    expect(hostStandings[1]).toContain('Firebase Guest')
    expect(hostStandings[1]).toContain('70')
    expect(hostErrors).toEqual([])
    expect(guestErrors).toEqual([])
  } finally {
    releaseGuestVisuals()
    await Promise.all([
      hostContext.close(),
      guestContext.close(),
    ])
  }
})

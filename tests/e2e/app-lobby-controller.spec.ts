import { expect, test, type Page } from '@playwright/test'

interface ControllerHarnessOptions {
  readonly failFirstQrRender?: boolean
}

interface ControllerHarnessWindow extends Window {
  __APP_LOBBY_SYNC_TEST__?: {
    readonly emitStarted: () => void
    readonly emitWaiting: () => void
    readonly applyWaitingSnapshot: () => boolean
    readonly emitSubscriptionError: () => void
    readonly holdNextGet: () => void
    readonly resolveHeldGet: () => void
    readonly triggerOnlineAndVisible: () => string
    readonly getRoomStatus: () => 'waiting' | 'started' | null
    readonly getSubscribeCalls: () => number
    readonly getAuthoritativeGetCalls: () => number
    readonly getActiveSubscriptions: () => number
    readonly getSyncPhase: () => string
  }
}

async function installControllerHarness(
  page: Page,
  options: ControllerHarnessOptions = {},
): Promise<void> {
  await page.goto('/')
  await page.evaluate(async (harnessOptions: ControllerHarnessOptions) => {
    type HarnessRoom = {
      readonly status: 'waiting' | 'started'
    }
    type HarnessRoomListener = (room: HarnessRoom | null) => void
    type HarnessErrorListener = (error: unknown) => void
    type HarnessStartOptions = {
      readonly requesterPlayerId: string
      readonly deckSeed: string | number
      readonly contentVersion: string
      readonly startAt: number
    }

    const controllerModulePath = '/src/app/AppController.ts'
    const roomModulePath = '/src/domain/room.ts'
    const [{ AppController }, roomDomain] = await Promise.all([
      import(controllerModulePath),
      import(roomModulePath),
    ])

    document.body.innerHTML = `
      <main id="controller-test-root">
        <div id="game-root" aria-label="테스트 게임 화면"></div>
      </main>
    `

    if (harnessOptions.failFirstQrRender) {
      const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL
      let shouldFail = true
      HTMLCanvasElement.prototype.toDataURL = function (
        type?: string,
        quality?: number,
      ): string {
        if (shouldFail) {
          shouldFail = false
          throw new Error('simulated QR canvas failure')
        }
        return originalToDataUrl.call(this, type, quality)
      }
    }

    const hostRoom = roomDomain.createRoom({
      mealTime: 'lunch',
      playerId: 'host-player',
      nickname: '방장',
      rng: () => 0,
    })
    const waitingRoom = roomDomain.joinRoom(hostRoom, {
      playerId: 'guest-player',
      nickname: '참가자',
    }) as HarnessRoom
    let startedRoom: HarnessRoom | null = null
    let roomListener: HarnessRoomListener | null = null
    let lastRoomListener: HarnessRoomListener | null = null
    let roomErrorListener: HarnessErrorListener | null = null
    let subscribeCalls = 0
    let authoritativeGetCalls = 0
    let activeSubscriptions = 0
    let holdNextGet = false
    let heldGetResolver: ((room: HarnessRoom) => void) | null = null

    const emitRoom = (room: HarnessRoom): void => {
      try {
        roomListener?.(room)
      } catch (error) {
        roomErrorListener?.(error)
      }
    }

    const createStartedRoom = (startAt = Date.now() + 30_000): HarnessRoom => {
      startedRoom ??= roomDomain.startRoom(waitingRoom, {
        requesterPlayerId: 'host-player',
        deckSeed: 'controller-sync-seed',
        contentVersion: 'menus-v1',
        startAt,
      }) as HarnessRoom
      return startedRoom
    }

    const gateway = {
      create: async () => waitingRoom,
      join: async () => waitingRoom,
      get: async (): Promise<HarnessRoom> => {
        authoritativeGetCalls += 1
        if (!holdNextGet) {
          return waitingRoom
        }
        holdNextGet = false
        return new Promise<HarnessRoom>((resolve) => {
          heldGetResolver = resolve
        })
      },
      leave: async () => waitingRoom,
      subscribe: async (
        _roomCode: string,
        listener: HarnessRoomListener,
        onError?: HarnessErrorListener,
      ) => {
        subscribeCalls += 1
        activeSubscriptions += 1
        roomListener = listener
        lastRoomListener = listener
        roomErrorListener = onError ?? null
        let active = true
        return () => {
          if (!active) {
            return
          }
          active = false
          activeSubscriptions -= 1
          if (roomListener === listener) {
            roomListener = null
            roomErrorListener = null
          }
        }
      },
      start: async (
        _roomCode: string,
        startOptions: HarnessStartOptions,
      ) => {
        // No listener echo: the controller must consume the transaction return.
        startedRoom = roomDomain.startRoom(
          waitingRoom,
          startOptions,
        ) as HarnessRoom
        return startedRoom
      },
      submitResult: async () => [],
      readAuthoritativeResultState: async () => ({
        finalization: 'open',
        results: [],
      }),
      subscribeResults: async () => () => undefined,
      dispose: () => undefined,
    }

    const root = document.querySelector('#controller-test-root')
    if (!(root instanceof HTMLElement)) {
      throw new Error('controller test root missing')
    }

    const app = new AppController(root, gateway, {
      playerId: 'host-player',
      backend: 'firebase',
    })
    app.start()

    ;(window as ControllerHarnessWindow).__APP_LOBBY_SYNC_TEST__ = {
      emitStarted: () => emitRoom(createStartedRoom()),
      emitWaiting: () => {
        lastRoomListener?.(waitingRoom)
      },
      applyWaitingSnapshot: () =>
        (
          app as unknown as {
            updateLobby: (room: HarnessRoom) => boolean
          }
        ).updateLobby(waitingRoom),
      emitSubscriptionError: () => {
        const onError = roomErrorListener
        onError?.(new Error('simulated listener failure'))
      },
      holdNextGet: () => {
        holdNextGet = true
      },
      resolveHeldGet: () => {
        const resolve = heldGetResolver
        if (!resolve) {
          throw new Error('no authoritative get is waiting')
        }
        heldGetResolver = null
        resolve(waitingRoom)
      },
      triggerOnlineAndVisible: () => {
        try {
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'visible',
          })
        } catch {
          // A foreground Playwright page is visible even if the override is blocked.
        }
        window.dispatchEvent(new Event('online'))
        document.dispatchEvent(new Event('visibilitychange'))
        return document.visibilityState
      },
      getRoomStatus: () => app.getDebugState().room?.status ?? null,
      getSubscribeCalls: () => subscribeCalls,
      getAuthoritativeGetCalls: () => authoritativeGetCalls,
      getActiveSubscriptions: () => activeSubscriptions,
      getSyncPhase: () => app.getDebugState().roomSync.phase,
    }
  }, options)

  await page.getByLabel('닉네임').fill('방장')
  await page.getByTestId('create-room').click()
}

type HarnessGetter =
  | 'getRoomStatus'
  | 'getSubscribeCalls'
  | 'getAuthoritativeGetCalls'
  | 'getActiveSubscriptions'
  | 'getSyncPhase'

async function readHarnessValue<T>(
  page: Page,
  key: HarnessGetter,
): Promise<T> {
  return page.evaluate((methodName) => {
    const harness = (window as ControllerHarnessWindow).__APP_LOBBY_SYNC_TEST__
    if (!harness) {
      throw new Error('controller lobby sync harness missing')
    }
    return harness[methodName]()
  }, key) as Promise<T>
}

type HarnessEvent =
  | 'emitStarted'
  | 'emitWaiting'
  | 'emitSubscriptionError'
  | 'holdNextGet'
  | 'resolveHeldGet'

async function emitHarnessEvent(
  page: Page,
  event: HarnessEvent,
): Promise<void> {
  await page.evaluate((eventName) => {
    const harness = (window as ControllerHarnessWindow).__APP_LOBBY_SYNC_TEST__
    if (!harness) {
      throw new Error('controller lobby sync harness missing')
    }
    harness[eventName]()
  }, event)
}

test.describe('AppController lobby synchronization', () => {
  test('QR 생성 실패가 최초 명단 렌더·구독·시작 수신을 막지 않는다', async ({
    page,
  }) => {
    await installControllerHarness(page, { failFirstQrRender: true })

    await expect(page.getByTestId('player-count')).toHaveText('2/8')
    await expect(page.getByTestId('player-list').getByRole('listitem')).toHaveCount(2)
    await expect
      .poll(() => readHarnessValue<number>(page, 'getSubscribeCalls'))
      .toBe(1)

    await emitHarnessEvent(page, 'emitStarted')
    await expect(page.getByTestId('countdown')).toBeVisible()
  })

  test('start 반환 상태만으로 listener echo 없이 호스트를 시작한다', async ({
    page,
  }) => {
    await installControllerHarness(page)
    await expect(page.getByTestId('start-room')).toBeEnabled()

    await page.getByTestId('start-room').click()

    await expect(page.getByTestId('countdown')).toBeVisible()
    await expect
      .poll(() => readHarnessValue<string | null>(page, 'getRoomStatus'))
      .toBe('started')
  })

  test('started를 본 뒤 도착한 stale waiting 상태로 역행하지 않는다', async ({
    page,
  }) => {
    await installControllerHarness(page)

    await emitHarnessEvent(page, 'emitStarted')
    await expect(page.getByTestId('countdown')).toBeVisible()
    await expect
      .poll(() => readHarnessValue<number>(page, 'getActiveSubscriptions'))
      .toBe(0)
    await emitHarnessEvent(page, 'emitWaiting')
    const waitingAccepted = await page.evaluate(() => {
      const harness = (window as ControllerHarnessWindow).__APP_LOBBY_SYNC_TEST__
      if (!harness) {
        throw new Error('controller lobby sync harness missing')
      }
      return harness.applyWaitingSnapshot()
    })
    expect(waitingAccepted).toBe(false)

    await expect
      .poll(() => readHarnessValue<string | null>(page, 'getRoomStatus'))
      .toBe('started')
    await expect(page.getByTestId('countdown')).toBeVisible()
  })

  test('구독 오류 후 bounded backoff로 authoritative get과 재구독을 수행한다', async ({
    page,
  }) => {
    await installControllerHarness(page)
    await expect(page.getByTestId('start-room')).toBeEnabled()
    await expect
      .poll(() => readHarnessValue<number>(page, 'getSubscribeCalls'))
      .toBe(1)

    await emitHarnessEvent(page, 'emitSubscriptionError')

    await expect(page.getByTestId('start-room')).toBeDisabled()
    await expect
      .poll(() => readHarnessValue<string>(page, 'getSyncPhase'))
      .toBe('recovering')
    await expect
      .poll(() => readHarnessValue<number>(page, 'getAuthoritativeGetCalls'))
      .toBe(1)
    await expect
      .poll(() => readHarnessValue<number>(page, 'getSubscribeCalls'))
      .toBe(2)
    await expect
      .poll(() => readHarnessValue<number>(page, 'getActiveSubscriptions'))
      .toBe(1)
    await expect
      .poll(() => readHarnessValue<string>(page, 'getSyncPhase'))
      .toBe('live')
    await expect(page.getByTestId('start-room')).toBeEnabled()
  })

  test('동시 online·visible 복구가 하나의 get과 하나의 재구독을 공유한다', async ({
    page,
  }) => {
    await installControllerHarness(page)
    await emitHarnessEvent(page, 'holdNextGet')

    const visibilityState = await page.evaluate(() => {
      const harness = (window as ControllerHarnessWindow).__APP_LOBBY_SYNC_TEST__
      if (!harness) {
        throw new Error('controller lobby sync harness missing')
      }
      return harness.triggerOnlineAndVisible()
    })

    expect(visibilityState).toBe('visible')
    await expect
      .poll(() => readHarnessValue<number>(page, 'getAuthoritativeGetCalls'))
      .toBe(1)
    await expect
      .poll(() => readHarnessValue<number>(page, 'getActiveSubscriptions'))
      .toBe(0)
    expect(await readHarnessValue<number>(page, 'getSubscribeCalls')).toBe(1)

    await emitHarnessEvent(page, 'resolveHeldGet')

    await expect
      .poll(() => readHarnessValue<number>(page, 'getSubscribeCalls'))
      .toBe(2)
    await expect
      .poll(() => readHarnessValue<number>(page, 'getActiveSubscriptions'))
      .toBe(1)
    await expect
      .poll(() => readHarnessValue<string>(page, 'getSyncPhase'))
      .toBe('live')
    expect(await readHarnessValue<number>(page, 'getAuthoritativeGetCalls')).toBe(1)
  })
})

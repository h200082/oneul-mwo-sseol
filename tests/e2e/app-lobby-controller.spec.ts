import { expect, test, type Page } from '@playwright/test'

import { enterMainMenu } from './appEntry'

interface ControllerHarnessOptions {
  readonly failFirstQrRender?: boolean
  readonly startWithOnePlayer?: boolean
  readonly autoReadyGuest?: boolean
}

interface ControllerHarnessWindow extends Window {
  __APP_LOBBY_SYNC_TEST__?: {
    readonly emitStarted: () => void
    readonly emitWaiting: () => void
    readonly emitCachedMetadata: () => void
    readonly advanceServerToJoinedSilently: () => void
    readonly advanceServerToWaitingSilently: () => void
    readonly advanceServerToStartedSilently: () => void
    readonly acknowledgeGuestAndEmit: () => void
    readonly emitGuestOnlyReadySnapshot: () => void
    readonly applyWaitingSnapshot: () => boolean
    readonly emitSubscriptionError: () => void
    readonly holdNextGet: () => void
    readonly resolveHeldGet: () => void
    readonly triggerOnlineAndVisible: () => string
    readonly getRoomStatus: () => 'waiting' | 'preparing' | 'started' | null
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
      readonly status: 'waiting' | 'preparing' | 'started'
    }
    type HarnessRoomListener = (room: HarnessRoom | null) => void
    type HarnessErrorListener = (error: unknown) => void
    type HarnessMetadataListener = (metadata: {
      readonly fromCache: boolean
      readonly hasPendingWrites: boolean
    }) => void
    type HarnessPrepareOptions = {
      readonly requesterPlayerId: string
      readonly startId: string
      readonly deckSeed: string | number
      readonly contentVersion: string
    }
    type HarnessReadyOptions = {
      readonly playerId: string
      readonly startId: string
    }
    type HarnessFinalizeOptions = {
      readonly requesterPlayerId: string
      readonly startId: string
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
    const joinedRoom = roomDomain.joinRoom(hostRoom, {
      playerId: 'guest-player',
      nickname: '참가자',
    }) as HarnessRoom
    const waitingRoom = (
      harnessOptions.startWithOnePlayer ? hostRoom : joinedRoom
    ) as HarnessRoom
    let authoritativeRoom: HarnessRoom = waitingRoom
    let preparingRoom: HarnessRoom | null = null
    let startedRoom: HarnessRoom | null = null
    let roomListener: HarnessRoomListener | null = null
    let lastRoomListener: HarnessRoomListener | null = null
    let roomErrorListener: HarnessErrorListener | null = null
    let roomMetadataListener: HarnessMetadataListener | null = null
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

    const createPreparedRoom = (): HarnessRoom => {
      preparingRoom ??= roomDomain.prepareRoomStart(joinedRoom, {
        requesterPlayerId: 'host-player',
        startId: 'controller-sync-start',
        deckSeed: 'controller-sync-seed',
        contentVersion: 'menus-v2',
      }) as HarnessRoom
      return preparingRoom
    }

    const createStartedRoom = (startAt = Date.now() + 30_000): HarnessRoom => {
      if (startedRoom) {
        return startedRoom
      }
      let readyRoom = createPreparedRoom()
      readyRoom = roomDomain.acknowledgeRoomReady(readyRoom, {
        playerId: 'host-player',
        startId: 'controller-sync-start',
      }) as HarnessRoom
      readyRoom = roomDomain.acknowledgeRoomReady(readyRoom, {
        playerId: 'guest-player',
        startId: 'controller-sync-start',
      }) as HarnessRoom
      preparingRoom = readyRoom
      startedRoom = roomDomain.finalizeRoomStart(readyRoom, {
        requesterPlayerId: 'host-player',
        startId: 'controller-sync-start',
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
          return authoritativeRoom
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
        onMetadata?: HarnessMetadataListener,
      ) => {
        subscribeCalls += 1
        activeSubscriptions += 1
        roomListener = listener
        lastRoomListener = listener
        roomErrorListener = onError ?? null
        roomMetadataListener = onMetadata ?? null
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
            roomMetadataListener = null
          }
        }
      },
      prepareStart: async (
        _roomCode: string,
        startOptions: HarnessPrepareOptions,
      ) => {
        preparingRoom = roomDomain.prepareRoomStart(
          authoritativeRoom,
          startOptions,
        ) as HarnessRoom
        authoritativeRoom = preparingRoom
        return preparingRoom
      },
      acknowledgeReady: async (
        _roomCode: string,
        readyOptions: HarnessReadyOptions,
      ) => {
        let readyRoom = roomDomain.acknowledgeRoomReady(
          authoritativeRoom,
          readyOptions,
        ) as HarnessRoom
        if (
          harnessOptions.autoReadyGuest !== false &&
          readyRoom.status === 'preparing'
        ) {
          readyRoom = roomDomain.acknowledgeRoomReady(readyRoom, {
            playerId: 'guest-player',
            startId: readyOptions.startId,
          }) as HarnessRoom
        }
        preparingRoom = readyRoom
        authoritativeRoom = readyRoom
        return readyRoom
      },
      finalizeStart: async (
        _roomCode: string,
        finalizeOptions: HarnessFinalizeOptions,
      ) => {
        startedRoom = roomDomain.finalizeRoomStart(
          authoritativeRoom,
          finalizeOptions,
        ) as HarnessRoom
        authoritativeRoom = startedRoom
        return startedRoom
      },
      start: async () => {
        throw new Error('legacy direct start must not be used')
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
      emitCachedMetadata: () => {
        roomMetadataListener?.({
          fromCache: true,
          hasPendingWrites: false,
        })
      },
      advanceServerToJoinedSilently: () => {
        authoritativeRoom = joinedRoom
      },
      advanceServerToWaitingSilently: () => {
        authoritativeRoom = waitingRoom
      },
      advanceServerToStartedSilently: () => {
        authoritativeRoom = createStartedRoom()
      },
      acknowledgeGuestAndEmit: () => {
        if (authoritativeRoom.status !== 'preparing') {
          throw new Error('room is not preparing')
        }
        const startId = (
          authoritativeRoom as HarnessRoom & {
            readonly start: { readonly startId: string }
          }
        ).start.startId
        preparingRoom = roomDomain.acknowledgeRoomReady(authoritativeRoom, {
          playerId: 'guest-player',
          startId,
        }) as HarnessRoom
        authoritativeRoom = preparingRoom
        emitRoom(preparingRoom)
      },
      emitGuestOnlyReadySnapshot: () => {
        if (authoritativeRoom.status !== 'preparing') {
          throw new Error('room is not preparing')
        }
        const currentStart = (
          authoritativeRoom as HarnessRoom & {
            readonly start: {
              readonly startId: string
              readonly deckSeed: string | number
              readonly contentVersion: string
            }
          }
        ).start
        let regressedRoom = roomDomain.prepareRoomStart(joinedRoom, {
          requesterPlayerId: 'host-player',
          startId: currentStart.startId,
          deckSeed: currentStart.deckSeed,
          contentVersion: currentStart.contentVersion,
        }) as HarnessRoom
        regressedRoom = roomDomain.acknowledgeRoomReady(regressedRoom, {
          playerId: 'guest-player',
          startId: currentStart.startId,
        }) as HarnessRoom
        preparingRoom = regressedRoom
        authoritativeRoom = regressedRoom
        emitRoom(regressedRoom)
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
        resolve(authoritativeRoom)
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

  await enterMainMenu(page)
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
  | 'emitCachedMetadata'
  | 'advanceServerToJoinedSilently'
  | 'advanceServerToWaitingSilently'
  | 'advanceServerToStartedSilently'
  | 'acknowledgeGuestAndEmit'
  | 'emitGuestOnlyReadySnapshot'
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

  test('3단계 반환 상태만으로 listener echo 없이 호스트를 시작한다', async ({
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

  test('모든 기기가 준비되기 전에는 카운트다운을 시작하지 않는다', async ({
    page,
  }) => {
    await installControllerHarness(page, { autoReadyGuest: false })
    await page.getByTestId('start-room').click()

    await expect
      .poll(() => readHarnessValue<string | null>(page, 'getRoomStatus'), {
        timeout: 7_000,
      })
      .toBe('preparing')
    await expect(page.getByTestId('start-room')).toHaveText('준비 1/2', {
      timeout: 7_000,
    })
    await expect(page.getByTestId('countdown')).toHaveCount(0)

    await emitHarnessEvent(page, 'acknowledgeGuestAndEmit')

    await expect(page.getByTestId('countdown')).toBeVisible({
      timeout: 7_000,
    })
    await expect
      .poll(() => readHarnessValue<string | null>(page, 'getRoomStatus'))
      .toBe('started')
  })

  test('동시 ACK에서 내 준비 기록이 유실돼도 다시 ACK하고 시작한다', async ({
    page,
  }) => {
    await installControllerHarness(page, { autoReadyGuest: false })
    await page.getByTestId('start-room').click()

    await expect(page.getByTestId('start-room')).toHaveText('준비 1/2', {
      timeout: 7_000,
    })
    await emitHarnessEvent(page, 'emitGuestOnlyReadySnapshot')

    await expect(page.getByTestId('countdown')).toBeVisible({
      timeout: 7_000,
    })
    await expect
      .poll(() => readHarnessValue<string | null>(page, 'getRoomStatus'))
      .toBe('started')
  })

  test('stale authoritative 상태를 거절한 뒤에도 heartbeat를 계속한다', async ({
    page,
  }) => {
    await installControllerHarness(page, { autoReadyGuest: false })
    await page.getByTestId('start-room').click()
    await expect(page.getByTestId('start-room')).toHaveText('준비 1/2', {
      timeout: 7_000,
    })

    await emitHarnessEvent(page, 'advanceServerToWaitingSilently')
    const getCallsBefore = await readHarnessValue<number>(
      page,
      'getAuthoritativeGetCalls',
    )
    await expect
      .poll(
        () => readHarnessValue<number>(page, 'getAuthoritativeGetCalls'),
        { timeout: 7_000 },
      )
      .toBeGreaterThan(getCallsBefore + 1)

    await expect
      .poll(() => readHarnessValue<string | null>(page, 'getRoomStatus'))
      .toBe('preparing')
    await expect(page.getByTestId('countdown')).toHaveCount(0)
  })

  test('최초 waiting 뒤 listener가 조용히 멈춰도 heartbeat get으로 started를 복구한다', async ({
    page,
  }) => {
    await installControllerHarness(page)
    await expect(page.getByTestId('player-count')).toHaveText('2/8')
    await expect
      .poll(() => readHarnessValue<number>(page, 'getSubscribeCalls'))
      .toBe(1)

    // 최초 server waiting 이후에는 listener event와 error를 모두 생략한다.
    await emitHarnessEvent(page, 'emitWaiting')
    await expect
      .poll(() => readHarnessValue<string | null>(page, 'getRoomStatus'))
      .toBe('waiting')
    const getCallsBefore = await readHarnessValue<number>(
      page,
      'getAuthoritativeGetCalls',
    )

    await emitHarnessEvent(page, 'advanceServerToStartedSilently')

    await expect
      .poll(
        () => readHarnessValue<number>(page, 'getAuthoritativeGetCalls'),
        { timeout: 7_000 },
      )
      .toBeGreaterThan(getCallsBefore)
    await expect(page.getByTestId('countdown')).toBeVisible({
      timeout: 7_000,
    })
    await expect(page.locator('.lobby-screen')).toHaveCount(0)
    await expect
      .poll(() => readHarnessValue<string | null>(page, 'getRoomStatus'))
      .toBe('started')
    await expect
      .poll(() => readHarnessValue<number>(page, 'getActiveSubscriptions'))
      .toBe(0)
  })

  test('1인 waiting 뒤 join event를 놓쳐도 저속 heartbeat로 2인 상태를 복구한다', async ({
    page,
  }) => {
    await installControllerHarness(page, { startWithOnePlayer: true })
    await expect(page.getByTestId('player-count')).toHaveText('1/8')
    await emitHarnessEvent(page, 'emitWaiting')
    const getCallsBefore = await readHarnessValue<number>(
      page,
      'getAuthoritativeGetCalls',
    )

    await emitHarnessEvent(page, 'advanceServerToJoinedSilently')

    await expect
      .poll(
        () => readHarnessValue<number>(page, 'getAuthoritativeGetCalls'),
        { timeout: 8_000 },
      )
      .toBeGreaterThan(getCallsBefore)
    await expect(page.getByTestId('player-count')).toHaveText('2/8')
    await expect(page.getByTestId('start-room')).toBeEnabled()
  })

  test('fromCache metadata를 받으면 heartbeat 전에 서버 상태를 재확인한다', async ({
    page,
  }) => {
    await installControllerHarness(page)
    await expect
      .poll(() => readHarnessValue<number>(page, 'getSubscribeCalls'))
      .toBe(1)
    await emitHarnessEvent(page, 'emitWaiting')
    await emitHarnessEvent(page, 'advanceServerToStartedSilently')
    const getCallsBefore = await readHarnessValue<number>(
      page,
      'getAuthoritativeGetCalls',
    )

    await emitHarnessEvent(page, 'emitCachedMetadata')

    await expect
      .poll(
        () => readHarnessValue<number>(page, 'getAuthoritativeGetCalls'),
        { timeout: 1_000 },
      )
      .toBeGreaterThan(getCallsBefore)
    await expect(page.getByTestId('countdown')).toBeVisible()
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
    await emitHarnessEvent(page, 'emitWaiting')
    const getCallsBefore = await readHarnessValue<number>(
      page,
      'getAuthoritativeGetCalls',
    )

    await emitHarnessEvent(page, 'emitSubscriptionError')

    await expect(page.getByTestId('start-room')).toBeDisabled()
    await expect
      .poll(() => readHarnessValue<string>(page, 'getSyncPhase'))
      .toBe('recovering')
    await expect
      .poll(() => readHarnessValue<number>(page, 'getAuthoritativeGetCalls'))
      .toBeGreaterThan(getCallsBefore)
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
    await emitHarnessEvent(page, 'emitWaiting')
    const getCallsBefore = await readHarnessValue<number>(
      page,
      'getAuthoritativeGetCalls',
    )
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
      .toBe(getCallsBefore + 1)
    await expect
      .poll(() => readHarnessValue<number>(page, 'getActiveSubscriptions'))
      .toBe(1)
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
    expect(
      await readHarnessValue<number>(page, 'getAuthoritativeGetCalls'),
    ).toBe(getCallsBefore + 1)
  })

  test('authoritative get이 멈춰도 deadline 뒤 refresh lock을 풀고 복구한다', async ({
    page,
  }) => {
    await installControllerHarness(page)
    await emitHarnessEvent(page, 'emitWaiting')
    const getCallsBefore = await readHarnessValue<number>(
      page,
      'getAuthoritativeGetCalls',
    )
    const subscribeCallsBefore = await readHarnessValue<number>(
      page,
      'getSubscribeCalls',
    )
    await emitHarnessEvent(page, 'holdNextGet')

    await expect
      .poll(
        () => readHarnessValue<number>(page, 'getAuthoritativeGetCalls'),
        { timeout: 5_000 },
      )
      .toBe(getCallsBefore + 1)
    await expect
      .poll(
        () => readHarnessValue<number>(page, 'getAuthoritativeGetCalls'),
        { timeout: 8_000 },
      )
      .toBeGreaterThan(getCallsBefore + 1)
    await expect
      .poll(() => readHarnessValue<string>(page, 'getSyncPhase'))
      .toBe('live')
    await expect
      .poll(() => readHarnessValue<number>(page, 'getActiveSubscriptions'))
      .toBe(1)
    expect(
      await readHarnessValue<number>(page, 'getSubscribeCalls'),
    ).toBe(subscribeCallsBefore)
  })
})

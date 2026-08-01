import { describe, expect, test, vi } from 'vitest'

import {
  MAX_ROOM_PLAYERS,
  type Room,
} from '../src/domain/room'
import {
  BrowserRoomNotificationChannel,
  LocalRoomGateway,
} from '../src/rooms/LocalRoomGateway'
import type {
  RoomNotificationChannel,
  RoomUnsubscribe,
} from '../src/rooms/RoomGateway'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

class InterleavingStorage extends MemoryStorage {
  beforeNextPlayerResultWrite: (() => void) | null = null

  override setItem(key: string, value: string): void {
    if (
      this.beforeNextPlayerResultWrite &&
      key.includes(':result:')
    ) {
      const callback = this.beforeNextPlayerResultWrite
      this.beforeNextPlayerResultWrite = null
      callback()
    }

    super.setItem(key, value)
  }
}

class MemoryNotificationHub {
  private readonly listeners = new Set<(code: string) => void>()

  createChannel(): RoomNotificationChannel {
    return {
      publish: (code) => {
        for (const listener of this.listeners) {
          listener(code)
        }
      },
      subscribe: (listener): RoomUnsubscribe => {
        this.listeners.add(listener)
        return () => {
          this.listeners.delete(listener)
        }
      },
    }
  }
}

function constantRandom(value: number): () => number {
  return () => value
}

describe('LocalRoomGateway', () => {
  test('방을 만들고 정규화된 코드로 조회한다', async () => {
    const storage = new MemoryStorage()
    const gateway = new LocalRoomGateway({
      storage,
      notifications: new MemoryNotificationHub().createChannel(),
      rng: constantRandom(0),
    })

    const created = await gateway.create({
      mealTime: 'lunch',
      playerId: 'host-1',
      nickname: ' 방장 ',
    })

    expect(created.code).toBe('22222222')
    await expect(gateway.get('2222-2222')).resolves.toEqual(created)
    expect((await gateway.get(created.code))?.players[0]?.nickname).toBe(
      '방장',
    )
  })

  test('기존 코드 충돌 시 도메인 코드 생성기를 다시 호출한다', async () => {
    const storage = new MemoryStorage()
    const hub = new MemoryNotificationHub()
    const randomValues = [
      ...Array<number>(16).fill(0),
      ...Array<number>(8).fill(0.5),
    ]
    let randomIndex = 0
    const gateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
      rng: () => randomValues[randomIndex++] ?? 0.5,
    })

    const first = await gateway.create({
      mealTime: 'lunch',
      playerId: 'host-1',
      nickname: '첫 방장',
    })
    const second = await gateway.create({
      mealTime: 'dinner',
      playerId: 'host-2',
      nickname: '둘째 방장',
    })

    expect(first.code).toBe('22222222')
    expect(second.code).not.toBe(first.code)
    expect(await gateway.get(first.code)).toEqual(first)
    expect(await gateway.get(second.code)).toEqual(second)
  })

  test('충돌 제한을 넘으면 명시적인 게이트웨이 오류를 낸다', async () => {
    const storage = new MemoryStorage()
    const hub = new MemoryNotificationHub()
    const gateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
      rng: constantRandom(0),
      maxCodeAttempts: 1,
    })

    await gateway.create({
      mealTime: 'lunch',
      playerId: 'host-1',
      nickname: '첫 방장',
    })

    await expect(
      gateway.create({
        mealTime: 'lunch',
        playerId: 'host-2',
        nickname: '둘째 방장',
      }),
    ).rejects.toMatchObject({
      code: 'ROOM_CODE_COLLISION',
    })
  })

  test('공유 Storage와 알림 채널로 다른 탭 구독을 갱신한다', async () => {
    const storage = new MemoryStorage()
    const hub = new MemoryNotificationHub()
    const hostGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
      rng: constantRandom(0.25),
    })
    const guestGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
    })
    const room = await hostGateway.create({
      mealTime: 'dinner',
      playerId: 'host',
      nickname: '방장',
    })
    const snapshots: Array<Room | null> = []
    const unsubscribe = await hostGateway.subscribe(
      room.code,
      (snapshot) => snapshots.push(snapshot),
    )

    expect(snapshots).toEqual([room])

    await guestGateway.join(' ' + room.code.toLowerCase() + ' ', {
      playerId: 'guest',
      nickname: '참가자',
    })

    expect(snapshots.at(-1)?.players.map((player) => player.playerId)).toEqual(
      ['host', 'guest'],
    )

    unsubscribe()
    await guestGateway.start(room.code, {
      requesterPlayerId: 'host',
      deckSeed: 'shared-seed',
      contentVersion: 'menus-v1',
      startAt: 1_000,
    })

    expect(snapshots).toHaveLength(2)
  })

  test('정원과 시작 후 참가 잠금은 도메인 오류를 그대로 보존한다', async () => {
    const storage = new MemoryStorage()
    const hub = new MemoryNotificationHub()
    const gateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
      rng: constantRandom(0.4),
    })
    const room = await gateway.create({
      mealTime: 'lunch',
      playerId: 'player-0',
      nickname: '참가자 0',
    })

    for (let index = 1; index < MAX_ROOM_PLAYERS; index += 1) {
      await gateway.join(room.code, {
        playerId: `player-${index}`,
        nickname: `참가자 ${index}`,
      })
    }

    await expect(
      gateway.join(room.code, {
        playerId: 'player-8',
        nickname: '참가자 8',
      }),
    ).rejects.toMatchObject({
      code: 'ROOM_FULL',
    })

    await gateway.start(room.code, {
      requesterPlayerId: 'player-0',
      deckSeed: 42,
      contentVersion: 'menus-v1',
      startAt: 2_000,
    })

    await expect(
      gateway.join(room.code, {
        playerId: 'late-player',
        nickname: '늦은 참가자',
      }),
    ).rejects.toMatchObject({
      code: 'ROOM_ALREADY_STARTED',
    })
  })

  test('방장만 두 명 이상인 방을 시작할 수 있다', async () => {
    const storage = new MemoryStorage()
    const gateway = new LocalRoomGateway({
      storage,
      notifications: new MemoryNotificationHub().createChannel(),
      rng: constantRandom(0.6),
    })
    const room = await gateway.create({
      mealTime: 'dinner',
      playerId: 'host',
      nickname: '방장',
    })
    const startOptions = {
      requesterPlayerId: 'host',
      deckSeed: 'dinner-seed',
      contentVersion: 'menus-v1',
      startAt: 3_000,
    } as const

    await expect(
      gateway.start(room.code, startOptions),
    ).rejects.toMatchObject({
      code: 'NOT_ENOUGH_PLAYERS',
    })

    await gateway.join(room.code, {
      playerId: 'guest',
      nickname: '참가자',
    })

    await expect(
      gateway.start(room.code, {
        ...startOptions,
        requesterPlayerId: 'guest',
      }),
    ).rejects.toMatchObject({
      code: 'HOST_ONLY',
    })

    const started = await gateway.start(room.code, startOptions)
    expect(started.status).toBe('started')
    expect(started.start.roster).toEqual(started.players)
  })

  test('없는 방과 손상된 저장 데이터는 구분해 보고한다', async () => {
    const storage = new MemoryStorage()
    const gateway = new LocalRoomGateway({
      storage,
      notifications: new MemoryNotificationHub().createChannel(),
      rng: constantRandom(0.8),
    })

    await expect(
      gateway.join('ZZZZZZZZ', {
        playerId: 'guest',
        nickname: '참가자',
      }),
    ).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    })

    storage.setItem('nhn-meal-game:room:ZZZZZZZZ', '{bad json')
    await expect(gateway.get('ZZZZZZZZ')).rejects.toMatchObject({
      code: 'CORRUPT_ROOM_DATA',
    })
  })
})

describe('LocalRoomGateway leave', () => {
  test('방장 이탈을 다른 탭에 알리고 첫 참가자를 방장으로 승계한다', async () => {
    const storage = new MemoryStorage()
    const hub = new MemoryNotificationHub()
    const hostGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
      rng: constantRandom(0.3),
    })
    const guestGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
    })
    const observerGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
    })
    const room = await hostGateway.create({
      mealTime: 'lunch',
      playerId: 'host',
      nickname: '방장',
    })
    await guestGateway.join(room.code, {
      playerId: 'guest-1',
      nickname: '첫 참가자',
    })
    await guestGateway.join(room.code, {
      playerId: 'guest-2',
      nickname: '둘째 참가자',
    })
    const snapshots: Array<Room | null> = []
    await observerGateway.subscribe(room.code, (snapshot) => {
      snapshots.push(snapshot)
    })

    const left = await hostGateway.leave(room.code, ' host ')

    expect(left).toMatchObject({
      hostPlayerId: 'guest-1',
      status: 'waiting',
    })
    expect(left?.players).toEqual([
      {
        playerId: 'guest-1',
        nickname: '첫 참가자',
        role: 'host',
        rosterOrder: 0,
      },
      {
        playerId: 'guest-2',
        nickname: '둘째 참가자',
        role: 'member',
        rosterOrder: 1,
      },
    ])
    expect(snapshots.at(-1)).toEqual(left)
    await expect(guestGateway.get(room.code)).resolves.toEqual(left)
  })

  test('마지막 참가자 이탈 시 방을 삭제하고 null을 알린다', async () => {
    const storage = new MemoryStorage()
    const hub = new MemoryNotificationHub()
    const hostGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
      rng: constantRandom(0.45),
    })
    const observerGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
    })
    const room = await hostGateway.create({
      mealTime: 'dinner',
      playerId: 'host',
      nickname: '방장',
    })
    const snapshots: Array<Room | null> = []
    await observerGateway.subscribe(room.code, (snapshot) => {
      snapshots.push(snapshot)
    })

    await expect(
      hostGateway.leave(room.code, 'host'),
    ).resolves.toBeNull()

    await expect(observerGateway.get(room.code)).resolves.toBeNull()
    expect(snapshots).toEqual([room, null])
  })

  test('시작된 방의 이탈 요청은 저장 상태를 덮어쓰지 않는다', async () => {
    const storage = new MemoryStorage()
    const gateway = new LocalRoomGateway({
      storage,
      notifications: new MemoryNotificationHub().createChannel(),
      rng: constantRandom(0.7),
    })
    const room = await gateway.create({
      mealTime: 'dinner',
      playerId: 'host',
      nickname: '방장',
    })
    await gateway.join(room.code, {
      playerId: 'guest',
      nickname: '참가자',
    })
    const started = await gateway.start(room.code, {
      requesterPlayerId: 'host',
      deckSeed: 'locked-seed',
      contentVersion: 'menus-v1',
      startAt: 4_000,
    })

    await expect(
      gateway.leave(room.code, 'guest'),
    ).rejects.toMatchObject({
      code: 'ROOM_ALREADY_STARTED',
    })
    await expect(gateway.get(room.code)).resolves.toEqual(started)
  })
})

describe('LocalRoomGateway results', () => {
  test('시작된 방의 잠긴 명단 참가자만 결과를 제출할 수 있다', async () => {
    const gateway = new LocalRoomGateway({
      storage: new MemoryStorage(),
      notifications: new MemoryNotificationHub().createChannel(),
      rng: constantRandom(0.12),
    })
    const room = await gateway.create({
      mealTime: 'lunch',
      playerId: 'host',
      nickname: '방장',
    })
    const result = {
      playerId: 'host',
      score: 90,
      capturedMenuIds: ['pizza'],
      completedAt: 10,
    } as const

    await expect(
      gateway.submitResult(room.code, result),
    ).rejects.toMatchObject({ code: 'ROOM_NOT_STARTED' })

    await gateway.join(room.code, {
      playerId: 'guest',
      nickname: '참가자',
    })
    await gateway.start(room.code, {
      requesterPlayerId: 'host',
      deckSeed: 'seed',
      contentVersion: 'menus-v1',
      startAt: 1,
    })

    await expect(
      gateway.submitResult(room.code, {
        ...result,
        playerId: 'intruder',
      }),
    ).rejects.toMatchObject({ code: 'PLAYER_NOT_IN_ROSTER' })
  })

  test('최초 결과를 탭 간 공유하고 동일 재전송만 멱등 허용한다', async () => {
    const storage = new MemoryStorage()
    const hub = new MemoryNotificationHub()
    const hostGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
      rng: constantRandom(0.18),
    })
    const observerGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
    })
    const room = await createStartedRoom(hostGateway)
    const snapshots: Array<readonly unknown[]> = []
    await observerGateway.subscribeResults(room.code, (results) => {
      snapshots.push(results)
    })
    const submission = {
      playerId: ' host ',
      score: 91.236,
      capturedMenuIds: [' pizza '],
      completedAt: 100,
    } as const

    const first = await hostGateway.submitResult(
      room.code,
      submission,
    )

    expect(first).toEqual([
      {
        playerId: 'host',
        score: 91.24,
        capturedMenuIds: ['pizza'],
        completedAt: 100,
      },
    ])
    expect(snapshots).toEqual([[], first])

    await expect(
      hostGateway.submitResult(room.code, submission),
    ).resolves.toEqual(first)
    expect(snapshots).toHaveLength(2)

    await expect(
      hostGateway.submitResult(room.code, {
        ...submission,
        score: 92,
      }),
    ).rejects.toMatchObject({ code: 'RESULT_ALREADY_SUBMITTED' })
  })

  test('서로 다른 탭의 동시 제출을 플레이어별 키로 모두 보존한다', async () => {
    const storage = new InterleavingStorage()
    const hub = new MemoryNotificationHub()
    const hostGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
      rng: constantRandom(0.2),
    })
    const guestGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
    })
    const room = await createStartedRoom(hostGateway)
    let guestSubmission:
      | Promise<readonly unknown[]>
      | undefined

    storage.beforeNextPlayerResultWrite = () => {
      guestSubmission = guestGateway.submitResult(room.code, {
        playerId: 'guest',
        score: 84,
        capturedMenuIds: ['ramyeon'],
        completedAt: 101,
      })
    }

    await hostGateway.submitResult(room.code, {
      playerId: 'host',
      score: 93,
      capturedMenuIds: ['pizza'],
      completedAt: 100,
    })
    expect(guestSubmission).toBeDefined()
    await guestSubmission

    let storedResults: readonly unknown[] = []
    await guestGateway.subscribeResults(room.code, (results) => {
      storedResults = results
    })

    expect(storedResults).toEqual([
      {
        playerId: 'host',
        score: 93,
        capturedMenuIds: ['pizza'],
        completedAt: 100,
      },
      {
        playerId: 'guest',
        score: 84,
        capturedMenuIds: ['ramyeon'],
        completedAt: 101,
      },
    ])
    expect(
      storage.getItem(
        `nhn-meal-game:room:${room.code}:result:host`,
      ),
    ).not.toBeNull()
    expect(
      storage.getItem(
        `nhn-meal-game:room:${room.code}:result:guest`,
      ),
    ).not.toBeNull()
  })

  test('기존 배열 결과를 읽을 때 플레이어별 키로 마이그레이션한다', async () => {
    const storage = new MemoryStorage()
    const gateway = new LocalRoomGateway({
      storage,
      notifications: new MemoryNotificationHub().createChannel(),
      rng: constantRandom(0.21),
    })
    const room = await createStartedRoom(gateway)
    const legacyKey = `nhn-meal-game:room:${room.code}:results`
    const legacyResult = {
      playerId: 'host',
      score: 77,
      capturedMenuIds: ['pasta'],
      completedAt: 90,
    }
    storage.setItem(legacyKey, JSON.stringify([legacyResult]))

    let snapshot: readonly unknown[] = []
    await gateway.subscribeResults(room.code, (results) => {
      snapshot = results
    })

    expect(snapshot).toEqual([legacyResult])
    expect(storage.getItem(legacyKey)).toBeNull()
    expect(
      JSON.parse(
        storage.getItem(
          `nhn-meal-game:room:${room.code}:result:host`,
        )!,
      ),
    ).toEqual(legacyResult)
  })

  test('손상된 저장 결과를 거부하고 외부 알림 오류를 구독자에게 전달한다', async () => {
    const storage = new MemoryStorage()
    const hub = new MemoryNotificationHub()
    const gateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
      rng: constantRandom(0.22),
    })
    const room = await createStartedRoom(gateway)
    const errors: unknown[] = []
    await gateway.subscribeResults(
      room.code,
      () => undefined,
      (error) => errors.push(error),
    )

    storage.setItem(
      `nhn-meal-game:room:${room.code}:results`,
      JSON.stringify([
        {
          playerId: 'host',
          score: 50,
          capturedMenuIds: ['pizza', 'pizza'],
          completedAt: 1,
        },
      ]),
    )
    hub.createChannel().publish(room.code)

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ code: 'CORRUPT_RESULT_DATA' })
    await expect(
      gateway.submitResult(room.code, {
        playerId: 'host',
        score: 50,
        capturedMenuIds: [],
        completedAt: 1,
      }),
    ).rejects.toMatchObject({ code: 'CORRUPT_RESULT_DATA' })
  })

  test('방 삭제 시 별도 결과 저장 데이터도 삭제하고 빈 결과를 알린다', async () => {
    const storage = new MemoryStorage()
    const hub = new MemoryNotificationHub()
    const owner = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
      rng: constantRandom(0.28),
    })
    const observer = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
    })
    const room = await owner.create({
      mealTime: 'dinner',
      playerId: 'host',
      nickname: '방장',
    })
    const snapshots: Array<readonly unknown[]> = []
    await observer.subscribeResults(room.code, (results) => {
      snapshots.push(results)
    })
    const resultsKey = `nhn-meal-game:room:${room.code}:results`
    storage.setItem(
      resultsKey,
      JSON.stringify([
        {
          playerId: 'host',
          score: 80,
          capturedMenuIds: [],
          completedAt: 1,
        },
      ]),
    )
    const playerResultKey =
      `nhn-meal-game:room:${room.code}:result:host`
    storage.setItem(
      playerResultKey,
      JSON.stringify({
        playerId: 'host',
        score: 80,
        capturedMenuIds: [],
        completedAt: 1,
      }),
    )

    await owner.leave(room.code, 'host')

    expect(storage.getItem(resultsKey)).toBeNull()
    expect(storage.getItem(playerResultKey)).toBeNull()
    expect(snapshots.at(-1)).toEqual([])
  })

  test('구독 해제와 dispose 이후에는 결과 listener를 호출하지 않는다', async () => {
    const storage = new MemoryStorage()
    const hub = new MemoryNotificationHub()
    const hostGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
      rng: constantRandom(0.32),
    })
    const observerGateway = new LocalRoomGateway({
      storage,
      notifications: hub.createChannel(),
    })
    const room = await createStartedRoom(hostGateway)
    const snapshots: Array<readonly unknown[]> = []
    await observerGateway.subscribeResults(room.code, (results) => {
      snapshots.push(results)
    })

    observerGateway.dispose()
    await hostGateway.submitResult(room.code, {
      playerId: 'host',
      score: 88,
      capturedMenuIds: [],
      completedAt: 12,
    })

    expect(snapshots).toEqual([[]])
  })
})

test('storage-event fallback은 결과 키에서도 정확한 8자리 방 코드만 알린다', () => {
  let storageListener:
    | ((event: StorageEvent) => void)
    | undefined
  const fakeWindow = {
    addEventListener: (
      type: string,
      listener: (event: StorageEvent) => void,
    ) => {
      if (type === 'storage') {
        storageListener = listener
      }
    },
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('window', fakeWindow)

  try {
    const channel = new BrowserRoomNotificationChannel()
    const codes: string[] = []
    channel.subscribe((code) => codes.push(code))

    storageListener?.({
      key: 'nhn-meal-game:room:ABCDEFGH:results',
    } as StorageEvent)

    expect(codes).toEqual(['ABCDEFGH'])
    channel.close()
  } finally {
    vi.unstubAllGlobals()
  }
})

async function createStartedRoom(gateway: LocalRoomGateway) {
  const room = await gateway.create({
    mealTime: 'lunch',
    playerId: 'host',
    nickname: '방장',
  })
  await gateway.join(room.code, {
    playerId: 'guest',
    nickname: '참가자',
  })
  return gateway.start(room.code, {
    requesterPlayerId: 'host',
    deckSeed: 'shared-seed',
    contentVersion: 'menus-v1',
    startAt: 1,
  })
}

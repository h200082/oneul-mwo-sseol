import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import { readFile } from 'node:fs/promises'
import {
  ROOM_RESULT_SYNC_GRACE_MS,
  ROOM_RESULT_WINDOW_MS,
} from '../src/domain/room'
import { FirebaseRoomGateway } from '../src/firebase/FirebaseRoomGateway'

const PROJECT_ID = 'demo-oneul-mwo-sseol'
const ROOM_CODE = 'ABCDEFGH'
const emulatorAddress = process.env.FIRESTORE_EMULATOR_HOST
const describeWithEmulator = emulatorAddress ? describe : describe.skip

describeWithEmulator('Cloud Firestore security rules', () => {
  let testEnvironment: RulesTestEnvironment

  beforeAll(async () => {
    const { host, port } = parseEmulatorAddress(emulatorAddress!)
    testEnvironment = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port,
        rules: await readFile(
          new URL('../firestore.rules', import.meta.url),
          'utf8',
        ),
      },
    })
  }, 30_000)

  beforeEach(async () => {
    await testEnvironment.clearFirestore()
  })

  afterAll(async () => {
    await testEnvironment?.cleanup()
  })

  it('requires authentication for exact room reads and blocks room listing', async () => {
    await seedRoom(waitingRoom(['host-uid']))

    const anonymousDb = testEnvironment
      .unauthenticatedContext()
      .firestore()
    const signedInDb = testEnvironment
      .authenticatedContext('guest-uid')
      .firestore()

    await assertFails(getDoc(doc(anonymousDb, 'rooms', ROOM_CODE)))
    await assertSucceeds(getDoc(doc(signedInDb, 'rooms', ROOM_CODE)))
    await assertFails(getDocs(collection(signedInDb, 'rooms')))
  })

  it('allows only a valid authenticated host to create a room', async () => {
    const hostDb = testEnvironment
      .authenticatedContext('host-uid')
      .firestore()
    const otherDb = testEnvironment
      .authenticatedContext('other-uid')
      .firestore()

    await assertSucceeds(
      setDoc(
        doc(hostDb, 'rooms', ROOM_CODE),
        waitingRoom(['host-uid'], true),
      ),
    )
    await assertFails(
      setDoc(
        doc(otherDb, 'rooms', 'BCDEFGHJ'),
        waitingRoom(['host-uid'], true, 'BCDEFGHJ'),
      ),
    )
  })

  it('permits self-join but rejects adding a different identity', async () => {
    await seedRoom(waitingRoom(['host-uid']))
    const memberDb = testEnvironment
      .authenticatedContext('member-uid')
      .firestore()
    const roomRef = doc(memberDb, 'rooms', ROOM_CODE)

    await assertSucceeds(
      updateDoc(roomRef, {
        memberIds: ['host-uid', 'member-uid'],
        players: {
          'host-uid': { nickname: '방장' },
          'member-uid': { nickname: '참가자' },
        },
        updatedAt: serverTimestamp(),
      }),
    )

    await seedRoom(
      waitingRoom(['host-uid']),
      'BCDEFGHJ',
    )
    await assertFails(
      updateDoc(doc(memberDb, 'rooms', 'BCDEFGHJ'), {
        memberIds: ['host-uid', 'victim-uid'],
        players: {
          'host-uid': { nickname: '방장' },
          'victim-uid': { nickname: '대리 참가' },
        },
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a ninth participant', async () => {
    const memberIds = Array.from(
      { length: 8 },
      (_, index) => `player-${index + 1}`,
    )
    await seedRoom(waitingRoom(memberIds))
    const ninthDb = testEnvironment
      .authenticatedContext('player-9')
      .firestore()

    await assertFails(
      updateDoc(doc(ninthDb, 'rooms', ROOM_CODE), {
        memberIds: [...memberIds, 'player-9'],
        players: Object.fromEntries(
          [...memberIds, 'player-9'].map((playerId, index) => [
            playerId,
            { nickname: `참가자 ${index + 1}` },
          ]),
        ),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('requires host prepare, self-ready acknowledgements, and all-ready finalize', async () => {
    await seedRoom(waitingRoom(['host-uid', 'member-uid']))
    const hostDb = testEnvironment
      .authenticatedContext('host-uid')
      .firestore()
    const memberDb = testEnvironment
      .authenticatedContext('member-uid')
      .firestore()
    const outsiderDb = testEnvironment
      .authenticatedContext('outsider-uid')
      .firestore()

    const prepareUpdate = {
      schemaVersion: 3,
      status: 'preparing',
      start: {
        startId: 'round-1',
        deckSeed: 'shared-seed',
        contentVersion: 'menus-v1',
        startAt: null,
        resultDeadlineAt: null,
        rosterIds: ['host-uid', 'member-uid'],
        readyPlayerIds: [],
      },
      updatedAt: serverTimestamp(),
    }

    await assertFails(
      updateDoc(doc(memberDb, 'rooms', ROOM_CODE), prepareUpdate),
    )
    await assertSucceeds(
      updateDoc(doc(hostDb, 'rooms', ROOM_CODE), prepareUpdate),
    )
    await assertFails(
      updateDoc(doc(memberDb, 'rooms', ROOM_CODE), {
        memberIds: ['host-uid', 'member-uid', 'late-uid'],
        players: {
          'host-uid': { nickname: '방장' },
          'member-uid': { nickname: '참가자' },
          'late-uid': { nickname: '지각생' },
        },
        updatedAt: serverTimestamp(),
      }),
    )

    await assertSucceeds(
      updateDoc(doc(hostDb, 'rooms', ROOM_CODE), {
        'start.readyPlayerIds': ['host-uid'],
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(doc(outsiderDb, 'rooms', ROOM_CODE), {
        'start.readyPlayerIds': ['host-uid', 'outsider-uid'],
        updatedAt: serverTimestamp(),
      }),
    )
    const earlyStartAt = Timestamp.fromMillis(Date.now() + 3_000)
    await assertFails(
      updateDoc(doc(hostDb, 'rooms', ROOM_CODE), {
        status: 'started',
        'start.startAt': earlyStartAt,
        'start.resultDeadlineAt': Timestamp.fromMillis(
          earlyStartAt.toMillis() + ROOM_RESULT_WINDOW_MS,
        ),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(doc(memberDb, 'rooms', ROOM_CODE), {
        'start.startId': 'stale-round',
        'start.readyPlayerIds': ['host-uid', 'member-uid'],
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(doc(memberDb, 'rooms', ROOM_CODE), {
        'start.readyPlayerIds': ['host-uid', 'member-uid'],
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(doc(memberDb, 'rooms', ROOM_CODE), {
        'start.readyPlayerIds': ['host-uid', 'member-uid'],
        updatedAt: serverTimestamp(),
      }),
    )

    const startAt = Timestamp.fromMillis(Date.now() + 3_000)
    const finalizeUpdate = {
      status: 'started',
      'start.startAt': startAt,
      'start.resultDeadlineAt': Timestamp.fromMillis(
        startAt.toMillis() + ROOM_RESULT_WINDOW_MS,
      ),
      updatedAt: serverTimestamp(),
    }
    await assertFails(
      updateDoc(doc(memberDb, 'rooms', ROOM_CODE), finalizeUpdate),
    )
    await assertSucceeds(
      updateDoc(doc(hostDb, 'rooms', ROOM_CODE), finalizeUpdate),
    )
  })

  it('allows one immutable self-result and participant-only result reads', async () => {
    await seedRoom(startedRoom(['host-uid', 'member-uid']))
    const hostDb = testEnvironment
      .authenticatedContext('host-uid')
      .firestore()
    const memberDb = testEnvironment
      .authenticatedContext('member-uid')
      .firestore()
    const outsiderDb = testEnvironment
      .authenticatedContext('outsider-uid')
      .firestore()
    const hostResult = doc(
      hostDb,
      'rooms',
      ROOM_CODE,
      'results',
      'host-uid',
    )

    await assertSucceeds(
      setDoc(hostResult, {
        playerId: 'host-uid',
        score: 94.5,
        capturedMenuIds: ['ramyeon', 'gimbap'],
        completedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      setDoc(hostResult, {
        playerId: 'host-uid',
        score: 100,
        capturedMenuIds: ['ramyeon'],
        completedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      setDoc(
        doc(
          memberDb,
          'rooms',
          ROOM_CODE,
          'results',
          'host-uid',
        ),
        {
          playerId: 'host-uid',
          score: 1,
          capturedMenuIds: [],
          completedAt: serverTimestamp(),
        },
      ),
    )
    await assertFails(
      setDoc(
        doc(
          outsiderDb,
          'rooms',
          ROOM_CODE,
          'results',
          'outsider-uid',
        ),
        {
          playerId: 'outsider-uid',
          score: 1,
          capturedMenuIds: [],
          completedAt: serverTimestamp(),
        },
      ),
    )

    await assertSucceeds(
      getDocs(collection(memberDb, 'rooms', ROOM_CODE, 'results')),
    )
    await assertFails(
      getDocs(
        collection(outsiderDb, 'rooms', ROOM_CODE, 'results'),
      ),
    )
  })

  it('rejects a legacy waiting-to-started shortcut', async () => {
    await seedRoom(
      waitingRoom(['host-uid', 'member-uid'], false, ROOM_CODE, 1),
    )
    const hostDb = testEnvironment
      .authenticatedContext('host-uid')
      .firestore()
    const startAt = Timestamp.now()

    await assertFails(
      updateDoc(doc(hostDb, 'rooms', ROOM_CODE), {
        status: 'started',
        start: {
          deckSeed: 'legacy-seed',
          contentVersion: 'menus-v1',
          startAt,
          rosterIds: ['host-uid', 'member-uid'],
        },
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('opens the server finalization probe only after grace', async () => {
    const closedStartAt = Timestamp.fromMillis(
      Date.now() -
        ROOM_RESULT_WINDOW_MS -
        ROOM_RESULT_SYNC_GRACE_MS -
        1_000,
    )
    await seedRoom(
      startedRoom(['host-uid', 'member-uid'], closedStartAt, 3),
    )
    const hostDb = testEnvironment
      .authenticatedContext('host-uid')
      .firestore()

    const closedProbe = await assertSucceeds(
      getDoc(
        doc(
          hostDb,
          'rooms',
          ROOM_CODE,
          'resultFinalization',
          'ready',
        ),
      ),
    )
    expect(closedProbe.exists()).toBe(false)

    const openCode = 'DEFGHJKM'
    await seedRoom(
      {
        ...startedRoom(['host-uid', 'member-uid']),
        code: openCode,
      },
      openCode,
    )
    await assertFails(
      getDoc(
        doc(
          hostDb,
          'rooms',
          openCode,
          'resultFinalization',
          'ready',
        ),
      ),
    )
  })

  it('rejects a new result after the server deadline', async () => {
    const expiredStartAt = Timestamp.fromMillis(
      Date.now() - ROOM_RESULT_WINDOW_MS - 1_000,
    )
    await seedRoom(startedRoom(['host-uid', 'member-uid'], expiredStartAt))
    const hostDb = testEnvironment
      .authenticatedContext('host-uid')
      .firestore()

    await assertFails(
      setDoc(
        doc(hostDb, 'rooms', ROOM_CODE, 'results', 'host-uid'),
        {
          playerId: 'host-uid',
          score: 100,
          capturedMenuIds: ['pizza'],
          completedAt: serverTimestamp(),
        },
      ),
    )
  })

  it('rejects room values that the domain decoder cannot accept', async () => {
    const hostDb = testEnvironment
      .authenticatedContext('host-uid')
      .firestore()
    const blankNicknameRoom = waitingRoom(
      ['host-uid'],
      true,
      'CDEFGHJK',
    )

    await assertFails(
      setDoc(doc(hostDb, 'rooms', 'CDEFGHJK'), {
        ...blankNicknameRoom,
        players: {
          'host-uid': { nickname: '\t' },
        },
      }),
    )

    await seedRoom(
      waitingRoom(['host-uid', 'member-uid']),
      'DEFGHJKM',
    )
    const invalidStartAt = Timestamp.now()
    await assertFails(
      updateDoc(doc(hostDb, 'rooms', 'DEFGHJKM'), {
        status: 'started',
        start: {
          deckSeed: Number.NaN,
          contentVersion: '\t',
          startAt: invalidStartAt,
          resultDeadlineAt: Timestamp.fromMillis(
            invalidStartAt.toMillis() + ROOM_RESULT_WINDOW_MS,
          ),
          rosterIds: ['host-uid', 'member-uid'],
        },
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('reads a closed authoritative result state from the server', async () => {
    const closedStartAt = Timestamp.fromMillis(
      Date.now() -
        ROOM_RESULT_WINDOW_MS -
        ROOM_RESULT_SYNC_GRACE_MS -
        1_000,
    )
    await seedRoom(
      startedRoom(['host-uid', 'member-uid'], closedStartAt, 1),
    )
    const gateway = new FirebaseRoomGateway(
      testEnvironment
        .authenticatedContext('host-uid')
        .firestore() as unknown as Firestore,
      'host-uid',
    )

    try {
      await expect(
        gateway.readAuthoritativeResultState(ROOM_CODE),
      ).resolves.toEqual({
        finalization: 'closed',
        results: [],
      })
    } finally {
      gateway.dispose()
    }
  })

  it('runs the Firebase gateway room and result flow against the rules', async () => {
    const hostGateway = new FirebaseRoomGateway(
      testEnvironment
        .authenticatedContext('host-uid')
        .firestore() as unknown as Firestore,
      'host-uid',
      { rng: () => 0 },
    )
    const memberGateway = new FirebaseRoomGateway(
      testEnvironment
        .authenticatedContext('member-uid')
        .firestore() as unknown as Firestore,
      'member-uid',
    )

    try {
      const created = await hostGateway.create({
        mealTime: 'lunch',
        playerId: 'host-uid',
        nickname: '방장',
      })
      expect(created.code).toBe('22222222')

      const joined = await memberGateway.join(created.code, {
        playerId: 'member-uid',
        nickname: '참가자',
      })
      expect(joined.players.map((player) => player.playerId)).toEqual([
        'host-uid',
        'member-uid',
      ])

      const prepared = await hostGateway.prepareStart(created.code, {
        requesterPlayerId: 'host-uid',
        startId: 'gateway-round-1',
        deckSeed: 'shared-seed',
        contentVersion: 'menus-v1',
      })
      expect(prepared.start.readyPlayerIds).toEqual([])
      await hostGateway.acknowledgeReady(created.code, {
        playerId: 'host-uid',
        startId: prepared.start.startId,
      })
      const allReady = await memberGateway.acknowledgeReady(created.code, {
        playerId: 'member-uid',
        startId: prepared.start.startId,
      })
      expect(allReady.start.readyPlayerIds).toEqual([
        'host-uid',
        'member-uid',
      ])
      const started = await hostGateway.finalizeStart(created.code, {
        requesterPlayerId: 'host-uid',
        startId: prepared.start.startId,
        startAt: Date.now() + 3_000,
      })
      expect(started.start.roster).toHaveLength(2)
      await expect(
        hostGateway.start(created.code, {
          requesterPlayerId: 'host-uid',
          deckSeed: started.start.deckSeed,
          contentVersion: started.start.contentVersion,
          startAt: started.start.startAt,
        }),
      ).resolves.toEqual(started)

      const observedResults: string[][] = []
      const listenerErrors: unknown[] = []
      const unsubscribeResults =
        await hostGateway.subscribeResults(
          created.code,
          (results) => {
            observedResults.push(
              results.map((result) => result.playerId),
            )
          },
          (error) => listenerErrors.push(error),
        )
      const hostResults = await hostGateway.submitResult(created.code, {
        playerId: 'host-uid',
        score: 98.25,
        capturedMenuIds: ['ramyeon', 'gimbap'],
        completedAt: Date.now(),
      })
      expect(hostResults).toHaveLength(1)
      await expect(
        hostGateway.readAuthoritativeResultState(created.code),
      ).resolves.toMatchObject({
        finalization: 'open',
        results: [{ playerId: 'host-uid' }],
      })

      const allResults = await memberGateway.submitResult(created.code, {
        playerId: 'member-uid',
        score: 91,
        capturedMenuIds: ['ramyeon'],
        completedAt: Date.now(),
      })
      expect(
        allResults.map((result) => result.playerId),
      ).toEqual(['host-uid', 'member-uid'])

      await vi.waitFor(() => {
        expect(observedResults.at(-1)).toEqual([
          'host-uid',
          'member-uid',
        ])
      })
      expect(listenerErrors).toEqual([])
      unsubscribeResults()
    } finally {
      hostGateway.dispose()
      memberGateway.dispose()
    }
  })

  it('delivers the started room to a late guest subscriber without cached regression', async () => {
    const hostGateway = new FirebaseRoomGateway(
      testEnvironment
        .authenticatedContext('late-host-uid')
        .firestore() as unknown as Firestore,
      'late-host-uid',
      { rng: () => 0 },
    )
    const memberGateway = new FirebaseRoomGateway(
      testEnvironment
        .authenticatedContext('late-member-uid')
        .firestore() as unknown as Firestore,
      'late-member-uid',
    )
    const hostStates: string[] = []
    const memberStates: string[] = []
    const listenerErrors: unknown[] = []
    let unsubscribeHost: (() => void) | undefined
    let unsubscribeMember: (() => void) | undefined

    const describeRoom = (
      room: Awaited<ReturnType<FirebaseRoomGateway['get']>>,
    ): string => {
      if (!room) {
        return 'missing'
      }
      const playerIds = room.players
        .map((player) => player.playerId)
        .join(',')
      const rosterIds =
        room.status === 'started'
          ? room.start.roster
              .map((player) => player.playerId)
              .join(',')
          : ''
      return [room.status, playerIds, rosterIds].join('|')
    }

    try {
      const created = await hostGateway.create({
        mealTime: 'lunch',
        playerId: 'late-host-uid',
        nickname: 'Late host',
      })
      unsubscribeHost = await hostGateway.subscribe(
        created.code,
        (room) => hostStates.push(describeRoom(room)),
        (error) => listenerErrors.push(error),
      )

      const preflight = await memberGateway.get(created.code)
      expect(describeRoom(preflight)).toBe(
        'waiting|late-host-uid|',
      )

      const joined = await memberGateway.join(created.code, {
        playerId: 'late-member-uid',
        nickname: 'Late member',
      })
      expect(describeRoom(joined)).toBe(
        'waiting|late-host-uid,late-member-uid|',
      )

      await vi.waitFor(
        () => {
          expect(hostStates.at(-1)).toBe(
            'waiting|late-host-uid,late-member-uid|',
          )
        },
        { timeout: 5_000 },
      )

      const prepared = await hostGateway.prepareStart(created.code, {
        requesterPlayerId: 'late-host-uid',
        startId: 'late-subscription-round',
        deckSeed: 'late-subscription-seed',
        contentVersion: 'menus-v1',
      })
      await hostGateway.acknowledgeReady(created.code, {
        playerId: 'late-host-uid',
        startId: prepared.start.startId,
      })
      await memberGateway.acknowledgeReady(created.code, {
        playerId: 'late-member-uid',
        startId: prepared.start.startId,
      })
      const started = await hostGateway.finalizeStart(created.code, {
        requesterPlayerId: 'late-host-uid',
        startId: prepared.start.startId,
        startAt: Date.now() + 3_000,
      })
      const expectedStarted =
        'started|late-host-uid,late-member-uid|' +
        'late-host-uid,late-member-uid'
      expect(describeRoom(started)).toBe(expectedStarted)

      unsubscribeMember = await memberGateway.subscribe(
        created.code,
        (room) => memberStates.push(describeRoom(room)),
        (error) => listenerErrors.push(error),
      )

      await vi.waitFor(
        () => {
          expect(hostStates.at(-1)).toBe(expectedStarted)
          expect(memberStates.at(-1)).toBe(expectedStarted)
        },
        { timeout: 5_000 },
      )
      expect(memberStates.length).toBeGreaterThan(0)
      expect(
        memberStates.every((state) => state === expectedStarted),
      ).toBe(true)
      expect(listenerErrors).toEqual([])
    } finally {
      unsubscribeMember?.()
      unsubscribeHost?.()
      hostGateway.dispose()
      memberGateway.dispose()
    }
  })

  async function seedRoom(
    room: Record<string, unknown>,
    roomCode = ROOM_CODE,
  ): Promise<void> {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'rooms', roomCode),
        room,
      )
    })
  }
})

function waitingRoom(
  memberIds: readonly string[],
  useServerTimestamps = false,
  code = ROOM_CODE,
  schemaVersion: 1 | 2 | 3 = 2,
): Record<string, unknown> {
  const timestamp = useServerTimestamps
    ? serverTimestamp()
    : Timestamp.now()

  return {
    schemaVersion,
    code,
    mealTime: 'lunch',
    status: 'waiting',
    hostPlayerId: memberIds[0],
    memberIds: [...memberIds],
    players: Object.fromEntries(
      memberIds.map((playerId, index) => [
        playerId,
        { nickname: index === 0 ? '방장' : `참가자 ${index}` },
      ]),
    ),
    start: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function startedRoom(
  memberIds: readonly string[],
  startAt = Timestamp.now(),
  schemaVersion: 1 | 2 | 3 = 2,
): Record<string, unknown> {
  return {
    ...waitingRoom(memberIds, false, ROOM_CODE, schemaVersion),
    status: 'started',
    start: {
      ...(schemaVersion === 3
        ? {
            startId: 'seeded-round',
          }
        : {}),
      deckSeed: 'shared-seed',
      contentVersion: 'menus-v1',
      startAt,
      ...(schemaVersion !== 1
        ? {
            resultDeadlineAt: Timestamp.fromMillis(
              startAt.toMillis() + ROOM_RESULT_WINDOW_MS,
            ),
          }
        : {}),
      rosterIds: [...memberIds],
      ...(schemaVersion === 3
        ? {
            readyPlayerIds: [...memberIds],
          }
        : {}),
    },
  }
}

function parseEmulatorAddress(address: string): {
  readonly host: string
  readonly port: number
} {
  const separatorIndex = address.lastIndexOf(':')
  const host = address.slice(0, separatorIndex)
  const port = Number(address.slice(separatorIndex + 1))
  if (!host || !Number.isInteger(port)) {
    throw new Error(
      `Invalid FIRESTORE_EMULATOR_HOST: ${address}`,
    )
  }
  return { host, port }
}

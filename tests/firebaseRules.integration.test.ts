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
  })

  beforeEach(async () => {
    await testEnvironment.clearFirestore()
  })

  afterAll(async () => {
    await testEnvironment.cleanup()
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

  it('lets only the host start and locks the roster', async () => {
    await seedRoom(waitingRoom(['host-uid', 'member-uid']))
    const hostDb = testEnvironment
      .authenticatedContext('host-uid')
      .firestore()
    const memberDb = testEnvironment
      .authenticatedContext('member-uid')
      .firestore()

    const startUpdate = {
      status: 'started',
      start: {
        deckSeed: 'shared-seed',
        contentVersion: 'menus-v1',
        startAt: serverTimestamp(),
        rosterIds: ['host-uid', 'member-uid'],
      },
      updatedAt: serverTimestamp(),
    }

    await assertFails(
      updateDoc(doc(memberDb, 'rooms', ROOM_CODE), startUpdate),
    )
    await assertSucceeds(
      updateDoc(doc(hostDb, 'rooms', ROOM_CODE), startUpdate),
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
    await assertFails(
      updateDoc(doc(hostDb, 'rooms', 'DEFGHJKM'), {
        status: 'started',
        start: {
          deckSeed: Number.NaN,
          contentVersion: '\t',
          startAt: serverTimestamp(),
          rosterIds: ['host-uid', 'member-uid'],
        },
        updatedAt: serverTimestamp(),
      }),
    )
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

      const started = await hostGateway.start(created.code, {
        requesterPlayerId: 'host-uid',
        deckSeed: 'shared-seed',
        contentVersion: 'menus-v1',
        startAt: Date.now(),
      })
      expect(started.start.roster).toHaveLength(2)

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
): Record<string, unknown> {
  const timestamp = useServerTimestamps
    ? serverTimestamp()
    : Timestamp.now()

  return {
    schemaVersion: 1,
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
): Record<string, unknown> {
  return {
    ...waitingRoom(memberIds),
    status: 'started',
    start: {
      deckSeed: 'shared-seed',
      contentVersion: 'menus-v1',
      startAt: Timestamp.now(),
      rosterIds: [...memberIds],
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

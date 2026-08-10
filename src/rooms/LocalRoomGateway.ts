import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_RESULT_SYNC_GRACE_MS,
  ROOM_RESULT_WINDOW_MS,
  acknowledgeRoomReady as acknowledgeDomainRoomReady,
  createRoom as createDomainRoom,
  finalizeRoomStart as finalizeDomainRoomStart,
  joinRoom as joinDomainRoom,
  leaveRoom as leaveDomainRoom,
  prepareRoomStart as prepareDomainRoomStart,
  type AcknowledgeRoomReadyOptions,
  type CreateRoomOptions,
  type FinalizeRoomStartOptions,
  type PrepareRoomStartOptions,
  type PreparingRoom,
  type Room,
  type RoomPlayer,
  type RoomRandomSource,
  type StartedRoom,
  type StartRoomOptions,
  type WaitingRoom,
} from '../domain/room'
import {
  validateRoomResultSubmission,
  type RoomResultSubmission,
} from '../domain/roomResults'
import {
  normalizeRoomCode,
  RoomInviteError,
} from './roomInvite'
import type {
  AuthoritativeRoomResultState,
  RoomGateway,
  RoomErrorListener,
  RoomListener,
  RoomNotificationChannel,
  RoomResultsErrorListener,
  RoomResultsListener,
  RoomUnsubscribe,
} from './RoomGateway'

const DEFAULT_STORAGE_PREFIX = 'nhn-meal-game:room:'
const DEFAULT_CHANNEL_NAME = 'nhn-meal-game:rooms'
const DEFAULT_CODE_ATTEMPTS = 16

export type LocalRoomGatewayErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_CODE_COLLISION'
  | 'CORRUPT_ROOM_DATA'
  | 'CORRUPT_RESULT_DATA'
  | 'ROOM_NOT_STARTED'
  | 'PLAYER_NOT_IN_ROSTER'
  | 'RESULT_ALREADY_SUBMITTED'
  | 'RESULT_DEADLINE_PASSED'
  | 'STORAGE_UNAVAILABLE'

interface ResultSubscription {
  readonly listener: RoomResultsListener
  readonly onError: RoomResultsErrorListener | null
}

export class LocalRoomGatewayError extends Error {
  readonly code: LocalRoomGatewayErrorCode

  constructor(
    code: LocalRoomGatewayErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'LocalRoomGatewayError'
    this.code = code
  }
}

export interface LocalRoomGatewayOptions {
  readonly storage?: Storage
  readonly notifications?: RoomNotificationChannel
  readonly rng?: RoomRandomSource
  readonly storagePrefix?: string
  readonly maxCodeAttempts?: number
  readonly now?: () => number
}

/**
 * Local-only multiplayer prototype.
 *
 * Storage is the source of truth and the notification channel only invalidates
 * cached lobby views in other same-origin tabs. This deliberately is not a
 * server replacement: localStorage has no cross-device reach, authentication,
 * security rules, or atomic transactions. Firebase will replace this gateway
 * without changing AppController's RoomGateway dependency.
 */
export class LocalRoomGateway implements RoomGateway {
  private readonly storage: Storage
  private readonly notifications: RoomNotificationChannel
  private readonly rng: RoomRandomSource
  private readonly storagePrefix: string
  private readonly maxCodeAttempts: number
  private readonly now: () => number
  private readonly listeners = new Map<string, Set<RoomListener>>()
  private readonly resultListeners = new Map<
    string,
    Set<ResultSubscription>
  >()
  private readonly stopNotifications: RoomUnsubscribe

  constructor(options: LocalRoomGatewayOptions = {}) {
    this.storage = options.storage ?? requireBrowserStorage()
    this.storagePrefix =
      options.storagePrefix ?? DEFAULT_STORAGE_PREFIX
    this.notifications =
      options.notifications ??
      new BrowserRoomNotificationChannel(this.storagePrefix)
    this.rng = options.rng ?? Math.random
    this.maxCodeAttempts =
      options.maxCodeAttempts ?? DEFAULT_CODE_ATTEMPTS
    this.now = options.now ?? Date.now

    if (
      !Number.isInteger(this.maxCodeAttempts) ||
      this.maxCodeAttempts <= 0
    ) {
      throw new RangeError(
        'maxCodeAttempts must be a positive integer.',
      )
    }

    this.stopNotifications = this.notifications.subscribe(
      (roomCode) => {
        this.handleExternalNotification(roomCode)
      },
    )
  }

  async create(
    options: CreateRoomOptions,
  ): Promise<WaitingRoom> {
    const rng = options.rng ?? this.rng

    for (
      let attempt = 0;
      attempt < this.maxCodeAttempts;
      attempt += 1
    ) {
      const room = createDomainRoom({ ...options, rng })
      if (this.readRaw(room.code) !== null) {
        continue
      }

      this.writeRoom(room)
      this.announce(room)
      return room
    }

    throw new LocalRoomGatewayError(
      'ROOM_CODE_COLLISION',
      `고유한 방 코드를 ${this.maxCodeAttempts}회 안에 만들지 못했습니다.`,
    )
  }

  async join(
    roomCode: string,
    player: {
      readonly playerId: string
      readonly nickname: string
    },
  ): Promise<WaitingRoom> {
    const room = this.requireRoom(roomCode)
    const updated = joinDomainRoom(room, player)
    this.writeRoom(updated)
    this.announce(updated)
    return updated
  }

  async get(roomCode: string): Promise<Room | null> {
    const code = normalizeRoomCode(roomCode)
    return this.readRoom(code)
  }

  async leave(
    roomCode: string,
    playerId: string,
  ): Promise<WaitingRoom | null> {
    const room = this.requireRoom(roomCode)
    const updated = leaveDomainRoom(room, playerId)

    if (updated) {
      this.writeRoom(updated)
      this.announce(updated)
    } else {
      this.deleteRoom(room.code)
      this.announceDeletion(room.code)
    }

    return updated
  }

  async subscribe(
    roomCode: string,
    listener: RoomListener,
    _onError?: RoomErrorListener,
  ): Promise<RoomUnsubscribe> {
    const code = normalizeRoomCode(roomCode)
    const roomListeners =
      this.listeners.get(code) ?? new Set<RoomListener>()

    roomListeners.add(listener)
    this.listeners.set(code, roomListeners)
    listener(this.readRoom(code))

    return () => {
      const current = this.listeners.get(code)
      current?.delete(listener)
      if (current?.size === 0) {
        this.listeners.delete(code)
      }
    }
  }

  async start(
    roomCode: string,
    options: StartRoomOptions,
  ): Promise<StartedRoom> {
    const room = this.requireRoom(roomCode)
    if (room.status === 'waiting') {
      throw new Error(
        'Ready handshake required before finalizing room start.',
      )
    }
    if (
      room.start.deckSeed !== options.deckSeed ||
      room.start.contentVersion !== options.contentVersion
    ) {
      throw new Error(
        'Legacy start retry does not match the prepared start.',
      )
    }
    const updated = finalizeDomainRoomStart(room, {
      requesterPlayerId: options.requesterPlayerId,
      startId: room.start.startId,
      startAt: options.startAt,
    })
    this.writeRoom(updated)
    this.announce(updated)
    return updated
  }

  async prepareStart(
    roomCode: string,
    options: PrepareRoomStartOptions,
  ): Promise<PreparingRoom> {
    const updated = prepareDomainRoomStart(
      this.requireRoom(roomCode),
      options,
    )
    this.writeRoom(updated)
    this.announce(updated)
    return updated
  }

  async acknowledgeReady(
    roomCode: string,
    options: AcknowledgeRoomReadyOptions,
  ): Promise<PreparingRoom | StartedRoom> {
    const updated = acknowledgeDomainRoomReady(
      this.requireRoom(roomCode),
      options,
    )
    this.writeRoom(updated)
    this.announce(updated)
    return updated
  }

  async finalizeStart(
    roomCode: string,
    options: FinalizeRoomStartOptions,
  ): Promise<StartedRoom> {
    const updated = finalizeDomainRoomStart(
      this.requireRoom(roomCode),
      options,
    )
    this.writeRoom(updated)
    this.announce(updated)
    return updated
  }

  async submitResult(
    roomCode: string,
    submission: RoomResultSubmission,
  ): Promise<readonly RoomResultSubmission[]> {
    const room = this.requireRoom(roomCode)
    if (room.status !== 'started') {
      throw new LocalRoomGatewayError(
        'ROOM_NOT_STARTED',
        `방 "${room.code}"은(는) 아직 시작되지 않았습니다.`,
      )
    }

    const result = validateRoomResultSubmission(submission)
    if (
      !room.start.roster.some(
        (player) => player.playerId === result.playerId,
      )
    ) {
      throw new LocalRoomGatewayError(
        'PLAYER_NOT_IN_ROSTER',
        `플레이어 "${result.playerId}"은(는) 잠긴 명단에 없습니다.`,
      )
    }

    const beforeSubmission = this.readResults(room.code)
    const existing = beforeSubmission.find(
      (item) => item.playerId === result.playerId,
    )
    if (existing) {
      if (sameResult(existing, result)) {
        return beforeSubmission
      }
      throw new LocalRoomGatewayError(
        'RESULT_ALREADY_SUBMITTED',
        `플레이어 "${result.playerId}"의 최초 결과는 변경할 수 없습니다.`,
      )
    }

    if (this.now() > room.start.resultDeadlineAt) {
      throw new LocalRoomGatewayError(
        'RESULT_DEADLINE_PASSED',
        '결과 제출 마감시간이 지나 미완주로 처리됩니다.',
      )
    }

    this.writePlayerResult(room.code, result)
    const updated = this.readResults(room.code)
    this.notifyResultListeners(room.code, updated)
    this.notifications.publish(room.code)
    return updated
  }

  async readAuthoritativeResultState(
    roomCode: string,
  ): Promise<Readonly<AuthoritativeRoomResultState>> {
    const room = this.requireRoom(roomCode)
    if (room.status !== 'started') {
      throw new LocalRoomGatewayError(
        'ROOM_NOT_STARTED',
        '시작된 방에서만 결과 마감 상태를 확인할 수 있습니다.',
      )
    }

    return Object.freeze({
      finalization:
        this.now() >=
        room.start.resultDeadlineAt + ROOM_RESULT_SYNC_GRACE_MS
          ? 'closed'
          : 'open',
      results: this.readResults(room.code),
    })
  }

  async subscribeResults(
    roomCode: string,
    listener: RoomResultsListener,
    onError?: RoomResultsErrorListener,
  ): Promise<RoomUnsubscribe> {
    const code = normalizeRoomCode(roomCode)
    const subscription: ResultSubscription = {
      listener,
      onError: onError ?? null,
    }
    const listeners =
      this.resultListeners.get(code) ?? new Set<ResultSubscription>()
    listeners.add(subscription)
    this.resultListeners.set(code, listeners)

    try {
      listener(this.readResults(code))
    } catch (error) {
      listeners.delete(subscription)
      if (listeners.size === 0) {
        this.resultListeners.delete(code)
      }
      throw error
    }

    return () => {
      const current = this.resultListeners.get(code)
      current?.delete(subscription)
      if (current?.size === 0) {
        this.resultListeners.delete(code)
      }
    }
  }

  /**
   * Releases the gateway's channel listener. Room subscriptions are also
   * cleared; callers normally keep one gateway for the lifetime of the app.
   */
  dispose(): void {
    this.stopNotifications()
    this.listeners.clear()
    this.resultListeners.clear()
    if (this.notifications instanceof BrowserRoomNotificationChannel) {
      this.notifications.close()
    }
  }

  private requireRoom(roomCode: string): Room {
    const code = normalizeRoomCode(roomCode)
    const room = this.readRoom(code)

    if (!room) {
      throw new LocalRoomGatewayError(
        'ROOM_NOT_FOUND',
        `방 "${code}"을(를) 찾을 수 없습니다.`,
      )
    }

    return room
  }

  private announce(room: Room): void {
    this.notifyListeners(room.code, room)
    this.notifications.publish(room.code)
  }

  private announceDeletion(roomCode: string): void {
    this.notifyListeners(roomCode, null)
    this.notifyResultListeners(roomCode, Object.freeze([]))
    this.notifications.publish(roomCode)
  }

  private handleExternalNotification(roomCode: string): void {
    let code: string
    try {
      code = normalizeRoomCode(roomCode)
    } catch (error) {
      if (error instanceof RoomInviteError) {
        return
      }
      throw error
    }

    try {
      const room = this.readRoom(code)
      this.notifyListeners(code, room)
    } catch {
      // Existing room subscribers retain the last valid snapshot.
    }

    try {
      const results = this.readResults(code)
      this.notifyResultListeners(code, results)
    } catch (error) {
      this.notifyResultErrors(code, error)
    }
  }

  private notifyListeners(
    roomCode: string,
    room: Room | null,
  ): void {
    for (const listener of this.listeners.get(roomCode) ?? []) {
      try {
        listener(room)
      } catch {
        // A view callback must not roll back an already-persisted room.
      }
    }
  }

  private notifyResultListeners(
    roomCode: string,
    results: readonly RoomResultSubmission[],
  ): void {
    for (const subscription of this.resultListeners.get(roomCode) ?? []) {
      try {
        subscription.listener(results)
      } catch {
        // A view callback must not roll back a persisted result.
      }
    }
  }

  private notifyResultErrors(roomCode: string, error: unknown): void {
    for (const subscription of this.resultListeners.get(roomCode) ?? []) {
      if (!subscription.onError) {
        continue
      }
      try {
        subscription.onError(error)
      } catch {
        // One error callback must not prevent other subscribers.
      }
    }
  }

  private readRoom(roomCode: string): Room | null {
    const raw = this.readRaw(roomCode)
    if (raw === null) {
      return null
    }

    try {
      return deserializeRoom(raw, roomCode)
    } catch (error) {
      if (error instanceof LocalRoomGatewayError) {
        throw error
      }

      throw new LocalRoomGatewayError(
        'CORRUPT_ROOM_DATA',
        `방 "${roomCode}"의 저장 데이터가 올바르지 않습니다.`,
        { cause: error },
      )
    }
  }

  private readRaw(roomCode: string): string | null {
    try {
      return this.storage.getItem(this.storageKey(roomCode))
    } catch (error) {
      throw new LocalRoomGatewayError(
        'STORAGE_UNAVAILABLE',
        '브라우저 저장소에서 방을 읽을 수 없습니다.',
        { cause: error },
      )
    }
  }

  private readResults(
    roomCode: string,
  ): readonly RoomResultSubmission[] {
    try {
      const room = this.readRoom(roomCode)
      const legacyRaw = this.readResultStorageItem(
        this.resultsStorageKey(roomCode),
      )

      if (!room || room.status !== 'started') {
        if (legacyRaw === null) {
          return Object.freeze([])
        }
        throw new Error(
          'Stored results require an existing started room.',
        )
      }

      if (legacyRaw !== null) {
        this.migrateLegacyResults(
          roomCode,
          room.start.roster.map((player) => player.playerId),
          deserializeResults(legacyRaw),
        )
      }

      const results: RoomResultSubmission[] = []
      for (const player of room.start.roster) {
        const raw = this.readResultStorageItem(
          this.playerResultStorageKey(roomCode, player.playerId),
        )
        if (raw === null) {
          continue
        }

        const result = deserializeResult(raw)
        if (result.playerId !== player.playerId) {
          throw new Error(
            'A stored result does not match its player key.',
          )
        }
        results.push(result)
      }

      return Object.freeze(results)
    } catch (error) {
      if (
        error instanceof LocalRoomGatewayError &&
        error.code === 'STORAGE_UNAVAILABLE'
      ) {
        throw error
      }
      throw new LocalRoomGatewayError(
        'CORRUPT_RESULT_DATA',
        `방 "${roomCode}"의 결과 저장 데이터가 올바르지 않습니다.`,
        { cause: error },
      )
    }
  }

  private writeRoom(room: Room): void {
    try {
      this.storage.setItem(
        this.storageKey(room.code),
        JSON.stringify(room),
      )
    } catch (error) {
      throw new LocalRoomGatewayError(
        'STORAGE_UNAVAILABLE',
        '브라우저 저장소에 방을 저장할 수 없습니다.',
        { cause: error },
      )
    }
  }

  private writePlayerResult(
    roomCode: string,
    result: RoomResultSubmission,
  ): void {
    this.writeResultStorageItem(
      this.playerResultStorageKey(roomCode, result.playerId),
      JSON.stringify(result),
    )
  }

  private readResultStorageItem(key: string): string | null {
    try {
      return this.storage.getItem(key)
    } catch (error) {
      throw new LocalRoomGatewayError(
        'STORAGE_UNAVAILABLE',
        '브라우저 저장소에서 경기 결과를 읽을 수 없습니다.',
        { cause: error },
      )
    }
  }

  private writeResultStorageItem(key: string, value: string): void {
    try {
      this.storage.setItem(key, value)
    } catch (error) {
      throw new LocalRoomGatewayError(
        'STORAGE_UNAVAILABLE',
        '브라우저 저장소에 경기 결과를 저장할 수 없습니다.',
        { cause: error },
      )
    }
  }

  private removeResultStorageItem(key: string): void {
    try {
      this.storage.removeItem(key)
    } catch (error) {
      throw new LocalRoomGatewayError(
        'STORAGE_UNAVAILABLE',
        '브라우저 저장소에서 경기 결과를 삭제할 수 없습니다.',
        { cause: error },
      )
    }
  }

  private deleteRoom(roomCode: string): void {
    try {
      const playerResultPrefix = this.playerResultStoragePrefix(roomCode)
      const resultKeys: string[] = []
      for (let index = 0; index < this.storage.length; index += 1) {
        const key = this.storage.key(index)
        if (key?.startsWith(playerResultPrefix)) {
          resultKeys.push(key)
        }
      }

      this.storage.removeItem(this.storageKey(roomCode))
      this.storage.removeItem(this.resultsStorageKey(roomCode))
      for (const key of resultKeys) {
        this.storage.removeItem(key)
      }
    } catch (error) {
      throw new LocalRoomGatewayError(
        'STORAGE_UNAVAILABLE',
        '브라우저 저장소에서 방과 경기 결과를 삭제할 수 없습니다.',
        { cause: error },
      )
    }
  }

  private storageKey(roomCode: string): string {
    return `${this.storagePrefix}${roomCode}`
  }

  private resultsStorageKey(roomCode: string): string {
    return `${this.storagePrefix}${roomCode}:results`
  }

  private playerResultStoragePrefix(roomCode: string): string {
    return `${this.storagePrefix}${roomCode}:result:`
  }

  private playerResultStorageKey(
    roomCode: string,
    playerId: string,
  ): string {
    return `${this.playerResultStoragePrefix(roomCode)}${encodeURIComponent(playerId)}`
  }

  private migrateLegacyResults(
    roomCode: string,
    rosterPlayerIds: readonly string[],
    legacyResults: readonly RoomResultSubmission[],
  ): void {
    const rosterIds = new Set(rosterPlayerIds)
    for (const legacyResult of legacyResults) {
      if (!rosterIds.has(legacyResult.playerId)) {
        throw new Error(
          'A legacy result player is not in the locked roster.',
        )
      }

      const key = this.playerResultStorageKey(
        roomCode,
        legacyResult.playerId,
      )
      const existingRaw = this.readResultStorageItem(key)
      if (existingRaw === null) {
        this.writeResultStorageItem(
          key,
          JSON.stringify(legacyResult),
        )
        continue
      }

      const existing = deserializeResult(existingRaw)
      if (!sameResult(existing, legacyResult)) {
        throw new Error(
          'Legacy and per-player results disagree.',
        )
      }
    }

    this.removeResultStorageItem(
      this.resultsStorageKey(roomCode),
    )
  }
}

/**
 * BroadcastChannel is preferred. The storage-event fallback needs no explicit
 * publish because localStorage.setItem emits that event in the other tabs.
 */
export class BrowserRoomNotificationChannel
  implements RoomNotificationChannel
{
  private readonly listeners = new Set<(roomCode: string) => void>()
  private readonly broadcastChannel: BroadcastChannel | null
  private readonly handleStorageEvent: (
    event: StorageEvent,
  ) => void

  constructor(
    private readonly storagePrefix = DEFAULT_STORAGE_PREFIX,
    channelName = DEFAULT_CHANNEL_NAME,
  ) {
    const browserWindow =
      typeof window === 'undefined' ? null : window

    this.broadcastChannel =
      browserWindow && 'BroadcastChannel' in browserWindow
        ? new browserWindow.BroadcastChannel(channelName)
        : null

    this.broadcastChannel?.addEventListener(
      'message',
      (event: MessageEvent<unknown>) => {
        if (typeof event.data === 'string') {
          this.emit(event.data)
        }
      },
    )

    this.handleStorageEvent = (event) => {
      if (
        this.broadcastChannel ||
        !event.key?.startsWith(this.storagePrefix)
      ) {
        return
      }

      const suffix = event.key.slice(this.storagePrefix.length)
      const possibleCode = suffix.slice(0, ROOM_CODE_LENGTH)
      try {
        this.emit(normalizeRoomCode(possibleCode))
      } catch {
        // Ignore unrelated keys that happen to share the prefix.
      }
    }

    browserWindow?.addEventListener(
      'storage',
      this.handleStorageEvent,
    )
  }

  publish(roomCode: string): void {
    this.broadcastChannel?.postMessage(roomCode)
  }

  subscribe(
    listener: (roomCode: string) => void,
  ): RoomUnsubscribe {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  close(): void {
    this.broadcastChannel?.close()
    if (typeof window !== 'undefined') {
      window.removeEventListener(
        'storage',
        this.handleStorageEvent,
      )
    }
    this.listeners.clear()
  }

  private emit(roomCode: string): void {
    for (const listener of this.listeners) {
      listener(roomCode)
    }
  }
}

interface StoredRoomShape {
  readonly code: string
  readonly mealTime: 'lunch' | 'dinner'
  readonly status: 'waiting' | 'preparing' | 'started'
  readonly hostPlayerId: string
  readonly players: readonly StoredPlayerShape[]
  readonly start: unknown
}

interface StoredPlayerShape {
  readonly playerId: string
  readonly nickname: string
  readonly role: 'host' | 'member'
  readonly rosterOrder: number
}

function deserializeRoom(raw: string, expectedCode: string): Room {
  const value: unknown = JSON.parse(raw)
  const stored = readStoredRoom(value)
  const code = normalizeRoomCode(stored.code)

  if (code !== expectedCode) {
    throw new Error('The stored room code does not match its key.')
  }

  validateStoredRoster(stored)
  const host = stored.players[0]
  if (!host) {
    throw new Error('A stored room must contain its host.')
  }

  let room: Room = createDomainRoom({
    mealTime: stored.mealTime,
    playerId: host.playerId,
    nickname: host.nickname,
    rng: createCodeRandomSource(code),
  })

  for (const player of stored.players.slice(1)) {
    room = joinDomainRoom(room, {
      playerId: player.playerId,
      nickname: player.nickname,
    })
  }

  if (stored.status === 'waiting') {
    if (stored.start !== null) {
      throw new Error('A waiting room cannot contain start data.')
    }
    return room
  }

  const start = readStoredStart(stored.start)
  validateStoredStartRoster(start.roster, room.players)

  let prepared: PreparingRoom | StartedRoom = prepareDomainRoomStart(room, {
    requesterPlayerId: stored.hostPlayerId,
    startId: start.startId,
    deckSeed: start.deckSeed,
    contentVersion: start.contentVersion,
  })
  for (const playerId of start.readyPlayerIds) {
    prepared = acknowledgeDomainRoomReady(prepared, {
      playerId,
      startId: start.startId,
    })
  }

  if (stored.status === 'preparing') {
    if (start.startAt !== null || start.resultDeadlineAt !== null) {
      throw new Error(
        'A preparing stored room cannot contain finalized timestamps.',
      )
    }
    return prepared
  }
  if (start.startAt === null || start.resultDeadlineAt === null) {
    throw new Error('A started stored room requires finalized timestamps.')
  }
  const startedRoom = finalizeDomainRoomStart(prepared, {
    requesterPlayerId: stored.hostPlayerId,
    startId: start.startId,
    startAt: start.startAt,
  })
  if (startedRoom.start.resultDeadlineAt !== start.resultDeadlineAt) {
    throw new Error('Stored result deadline is inconsistent.')
  }
  return startedRoom
}

function readStoredRoom(value: unknown): StoredRoomShape {
  if (!isRecord(value)) {
    throw new Error('Stored room data must be an object.')
  }

  const {
    code,
    mealTime,
    status,
    hostPlayerId,
    players,
    start,
  } = value

  if (
    typeof code !== 'string' ||
    (mealTime !== 'lunch' && mealTime !== 'dinner') ||
    (status !== 'waiting' &&
      status !== 'preparing' &&
      status !== 'started') ||
    typeof hostPlayerId !== 'string' ||
    !Array.isArray(players)
  ) {
    throw new Error('Stored room data has an invalid shape.')
  }

  return {
    code,
    mealTime,
    status,
    hostPlayerId,
    players: players.map(readStoredPlayer),
    start,
  }
}

function readStoredPlayer(value: unknown): StoredPlayerShape {
  if (!isRecord(value)) {
    throw new Error('Stored player data must be an object.')
  }

  const { playerId, nickname, role, rosterOrder } = value
  if (
    typeof playerId !== 'string' ||
    typeof nickname !== 'string' ||
    (role !== 'host' && role !== 'member') ||
    typeof rosterOrder !== 'number'
  ) {
    throw new Error('Stored player data has an invalid shape.')
  }

  return { playerId, nickname, role, rosterOrder }
}

function validateStoredRoster(room: StoredRoomShape): void {
  const host = room.players[0]
  if (
    !host ||
    host.playerId !== room.hostPlayerId ||
    host.role !== 'host' ||
    host.rosterOrder !== 0
  ) {
    throw new Error('Stored room host data is inconsistent.')
  }

  room.players.forEach((player, index) => {
    const expectedRole = index === 0 ? 'host' : 'member'
    if (
      player.role !== expectedRole ||
      player.rosterOrder !== index
    ) {
      throw new Error('Stored room roster order is inconsistent.')
    }
  })
}

interface StoredStartShape {
  readonly startId: string
  readonly deckSeed: string | number
  readonly contentVersion: string
  readonly startAt: number | null
  readonly resultDeadlineAt: number | null
  readonly roster: readonly StoredPlayerShape[]
  readonly readyPlayerIds: readonly string[]
}

function readStoredStart(value: unknown): StoredStartShape {
  if (!isRecord(value)) {
    throw new Error('A started room must contain start data.')
  }

  const {
    startId,
    deckSeed,
    contentVersion,
    startAt,
    resultDeadlineAt,
    roster,
    readyPlayerIds,
  } = value
  if (
    (typeof deckSeed !== 'string' &&
      typeof deckSeed !== 'number') ||
    typeof contentVersion !== 'string' ||
    (startAt !== undefined &&
      startAt !== null &&
      typeof startAt !== 'number') ||
    (resultDeadlineAt !== undefined &&
      resultDeadlineAt !== null &&
      typeof resultDeadlineAt !== 'number') ||
    !Array.isArray(roster) ||
    (readyPlayerIds !== undefined &&
      (!Array.isArray(readyPlayerIds) ||
        readyPlayerIds.some(
          (playerId) => typeof playerId !== 'string',
        )))
  ) {
    throw new Error('Stored room start data has an invalid shape.')
  }

  const storedRoster = roster.map(readStoredPlayer)
  const rosterIds = storedRoster.map((player) => player.playerId)
  const normalizedReadyIds =
    readyPlayerIds === undefined
      ? rosterIds
      : (readyPlayerIds as string[])
  const normalizedStartAt =
    typeof startAt === 'number' ? startAt : null
  if (
    new Set(normalizedReadyIds).size !== normalizedReadyIds.length ||
    normalizedReadyIds.some((playerId) => !rosterIds.includes(playerId))
  ) {
    throw new Error('Stored room ready ids are inconsistent.')
  }

  return {
    startId:
      typeof startId === 'string' && startId.trim().length > 0
        ? startId
        : 'legacy-start',
    deckSeed,
    contentVersion,
    startAt: normalizedStartAt,
    resultDeadlineAt:
      resultDeadlineAt ??
      (normalizedStartAt === null
        ? null
        : normalizedStartAt + ROOM_RESULT_WINDOW_MS),
    roster: storedRoster,
    readyPlayerIds: normalizedReadyIds,
  }
}

function validateStoredStartRoster(
  storedRoster: readonly StoredPlayerShape[],
  currentRoster: readonly RoomPlayer[],
): void {
  if (storedRoster.length !== currentRoster.length) {
    throw new Error('Stored start roster length is inconsistent.')
  }

  storedRoster.forEach((player, index) => {
    const current = currentRoster[index]
    if (
      !current ||
      player.playerId !== current.playerId ||
      player.nickname !== current.nickname ||
      player.role !== current.role ||
      player.rosterOrder !== current.rosterOrder
    ) {
      throw new Error('Stored start roster is inconsistent.')
    }
  })
}

function deserializeResults(
  raw: string,
): readonly RoomResultSubmission[] {
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value)) {
    throw new Error('Stored room results must be an array.')
  }

  const seenPlayerIds = new Set<string>()
  const results = value.map((item) => {
    if (!isRecord(item)) {
      throw new Error('A stored room result must be an object.')
    }
    const { playerId, score, capturedMenuIds, completedAt } = item
    if (
      typeof playerId !== 'string' ||
      typeof score !== 'number' ||
      !Array.isArray(capturedMenuIds) ||
      !capturedMenuIds.every((menuId) => typeof menuId === 'string') ||
      typeof completedAt !== 'number'
    ) {
      throw new Error('A stored room result has an invalid shape.')
    }

    const result = validateRoomResultSubmission({
      playerId,
      score,
      capturedMenuIds,
      completedAt,
    })
    if (seenPlayerIds.has(result.playerId)) {
      throw new Error(`Duplicate stored player result: ${result.playerId}`)
    }
    seenPlayerIds.add(result.playerId)
    return result
  })

  return Object.freeze(results)
}

function deserializeResult(raw: string): Readonly<RoomResultSubmission> {
  const value: unknown = JSON.parse(raw)
  if (!isRecord(value)) {
    throw new Error('A stored room result must be an object.')
  }
  const { playerId, score, capturedMenuIds, completedAt } = value
  if (
    typeof playerId !== 'string' ||
    typeof score !== 'number' ||
    !Array.isArray(capturedMenuIds) ||
    !capturedMenuIds.every((menuId) => typeof menuId === 'string') ||
    typeof completedAt !== 'number'
  ) {
    throw new Error('A stored room result has an invalid shape.')
  }
  return validateRoomResultSubmission({
    playerId,
    score,
    capturedMenuIds,
    completedAt,
  })
}

function sameResult(
  left: RoomResultSubmission,
  right: RoomResultSubmission,
): boolean {
  return (
    left.playerId === right.playerId &&
    left.score === right.score &&
    left.completedAt === right.completedAt &&
    left.capturedMenuIds.length === right.capturedMenuIds.length &&
    left.capturedMenuIds.every(
      (menuId, index) => menuId === right.capturedMenuIds[index],
    )
  )
}

function createCodeRandomSource(code: string): RoomRandomSource {
  let index = 0

  return () => {
    const character = code[index]
    if (!character) {
      throw new Error('Room-code reconstruction exhausted its input.')
    }

    index += 1
    const alphabetIndex = ROOM_CODE_ALPHABET.indexOf(character)
    if (alphabetIndex < 0) {
      throw new Error('Stored room code contains an invalid character.')
    }

    return (alphabetIndex + 0.5) / ROOM_CODE_ALPHABET.length
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireBrowserStorage(): Storage {
  if (typeof window === 'undefined') {
    throw new LocalRoomGatewayError(
      'STORAGE_UNAVAILABLE',
      '브라우저 밖에서는 Storage를 직접 주입해야 합니다.',
    )
  }

  return window.localStorage
}

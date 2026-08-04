import QRCode from 'qrcode'

import {
  canStartRoom,
  normalizeNickname,
  type MealTime,
  type Room,
  type StartedRoom,
  type WaitingRoom,
} from '../domain/room'
import { createRandomUuid } from '../domain/randomUuid'
import {
  aggregateRoomResults,
  type RoomResultSubmission,
  type RoomResultsSummary,
} from '../domain/roomResults'
import { MENU_CATALOG, type MenuItem } from '../data/menus'
import { getMenuVisual } from '../data/menuVisuals'
import type {
  GameLaunchOptions,
  PlayerGameResult,
} from '../game/gameTypes'
import {
  QrScannerError,
  scanRoomCodeFromCamera,
} from '../qr/QrScannerService'
import { LocalRoomGateway } from '../rooms/LocalRoomGateway'
import type { RoomGateway } from '../rooms/RoomGateway'
import {
  buildRoomInviteUrl,
  normalizeRoomCode,
  readRoomCodeFromUrl,
} from '../rooms/roomInvite'
import { GameHost } from './GameHost'

const PLAYER_ID_STORAGE_KEY = 'oneul-mwo-sseol-player-id'
const NICKNAME_STORAGE_KEY = 'oneul-mwo-sseol-nickname'
const CONTENT_VERSION = 'menus-v1'
const ROOM_COUNTDOWN_MS = 3_000

const MENU_BY_ID = new Map(MENU_CATALOG.map((menu) => [menu.id, menu]))

interface HomeElements {
  readonly nickname: HTMLInputElement
  readonly roomCode: HTMLInputElement
  readonly status: HTMLElement
}

export type AppBackend = 'local' | 'firebase'

export interface AppControllerOptions {
  readonly playerId?: string
  readonly backend?: AppBackend
}

export interface AppDebugRoomResultInput {
  readonly score: number
  readonly capturedMenuIds: readonly string[]
  readonly completedAt?: number
}

export interface AppDebugState {
  readonly playerId: string
  readonly backend: AppBackend
  readonly roomCode: string | null
  readonly room: Room | null
  readonly gameVisible: boolean
  readonly startSoloGameForTest: (
    deckSeed: GameLaunchOptions['deckSeed'],
  ) => void
  readonly submitRoomResultForTest: (
    input: AppDebugRoomResultInput,
  ) => Promise<void>
}

interface ActiveRoomResultFlow {
  readonly room: StartedRoom
  readonly submission: RoomResultSubmission
  readonly generation: number
  results: readonly RoomResultSubmission[]
  submissionPending: boolean
  subscriptionPending: boolean
  submissionError: string | null
  subscriptionError: string | null
  complete: boolean
}

export class AppController {
  private readonly screenRoot: HTMLElement
  private readonly gameRoot: HTMLElement
  private readonly gameHost: GameHost
  private readonly playerId: string
  private readonly backend: AppBackend
  private unsubscribeRoom: (() => void) | null = null
  private unsubscribeResults: (() => void) | null = null
  private countdownInterval: number | null = null
  private gameStartTimeout: number | null = null
  private currentRoom: Room | null = null
  private scheduledRoomKey: string | null = null
  private scannerAbortController: AbortController | null = null
  private viewGeneration = 0
  private homeActionPending = false
  private activeHomeAction: symbol | null = null
  private activeRoomResultFlow: ActiveRoomResultFlow | null = null

  constructor(
    private readonly appRoot: HTMLElement,
    private readonly roomGateway: RoomGateway = new LocalRoomGateway(),
    options: AppControllerOptions = {},
  ) {
    const gameRoot = appRoot.querySelector<HTMLElement>('#game-root')
    if (!gameRoot) {
      throw new Error('게임 루트 요소를 찾을 수 없습니다.')
    }

    this.gameRoot = gameRoot
    this.screenRoot = document.createElement('section')
    this.screenRoot.id = 'screen-root'
    this.appRoot.prepend(this.screenRoot)

    this.playerId = resolvePlayerId(options.playerId)
    this.backend =
      options.backend ??
      (roomGateway instanceof LocalRoomGateway ? 'local' : 'firebase')
    this.gameHost = new GameHost(this.gameRoot, () => {
      this.returnHome()
    }, (result) => {
      if (result.mode === 'room') {
        queueMicrotask(() => {
          void this.handleGameResult(result)
        })
      }
    })
  }

  start(): void {
    const invitedRoomCode = readRoomCodeFromUrl(window.location.href)
    this.renderHome(invitedRoomCode)
  }

  destroy(): void {
    this.viewGeneration += 1
    this.activeHomeAction = null
    this.homeActionPending = false
    this.cleanupRoomFlow()
    this.gameHost.stop()
    this.roomGateway.dispose?.()
    this.screenRoot.remove()
  }

  getDebugState(): AppDebugState {
    return {
      playerId: this.playerId,
      backend: this.backend,
      roomCode: this.currentRoom?.code ?? null,
      room: this.currentRoom,
      gameVisible: !this.gameRoot.hidden,
      startSoloGameForTest: (deckSeed) => {
        if (!import.meta.env.DEV) {
          throw new Error('솔로 게임 테스트 훅은 개발 모드에서만 사용할 수 있습니다.')
        }
        this.startGame({
          mode: 'solo',
          mealTime: 'lunch',
          deckSeed,
        })
      },
      submitRoomResultForTest: async (input) => {
        if (!import.meta.env.DEV) {
          throw new Error('게임 결과 테스트 훅은 개발 모드에서만 사용할 수 있습니다.')
        }
        const room = this.currentRoom
        if (!room || room.status !== 'started') {
          throw new Error('시작된 방 게임이 없습니다.')
        }

        await this.handleGameResult({
          mode: 'room',
          mealTime: room.mealTime,
          deckSeed: room.start.deckSeed,
          roomCode: room.code,
          score: input.score,
          capturedMenuIds: [...input.capturedMenuIds],
          completedAt: input.completedAt ?? Date.now(),
        })
      },
    }
  }

  private renderHome(invitedRoomCode: string | null = null): void {
    this.viewGeneration += 1
    this.cleanupRoomFlow()
    this.gameHost.stop()
    this.homeActionPending = false
    this.activeHomeAction = null
    this.screenRoot.hidden = false
    this.screenRoot.innerHTML = `
      <div class="app-screen home-screen">
        <header class="brand-block">
          <p class="eyebrow">POP ARCADE MENU BATTLE</p>
          <h1>오늘 뭐 썰?</h1>
          <p class="brand-copy">
            먹고 싶은 메뉴는 포획하고<br />
            나머지는 정확히 반으로 썰어보세요.
          </p>
        </header>

        <section class="setup-card" aria-labelledby="play-setup-title">
          <h2 id="play-setup-title">바로 시작하기</h2>

          <label class="field-label" for="nickname-input">닉네임</label>
          <input
            id="nickname-input"
            class="text-input"
            maxlength="16"
            autocomplete="nickname"
            placeholder="예: 라면킬러"
          />

          <fieldset class="meal-picker">
            <legend>식사 시간</legend>
            <label>
              <input type="radio" name="meal-time" value="lunch" checked />
              <span>점심</span>
            </label>
            <label>
              <input type="radio" name="meal-time" value="dinner" />
              <span>저녁</span>
            </label>
          </fieldset>

          <div class="primary-actions">
            <button
              class="button button-accent"
              type="button"
              data-testid="solo-start"
            >
              혼자 하기
            </button>
            <button
              class="button button-primary"
              type="button"
              data-testid="create-room"
            >
              방 만들기
            </button>
          </div>
        </section>

        <section class="join-card" aria-labelledby="join-title">
          <div>
            <p class="section-kicker">친구 방 참가</p>
            <h2 id="join-title">8자리 코드를 입력하세요</h2>
          </div>
          <div class="join-row">
            <input
              id="room-code-input"
              class="text-input code-input"
              maxlength="12"
              autocapitalize="characters"
              autocomplete="off"
              placeholder="ABCD2EFG"
              aria-label="방 코드"
            />
            <button
              class="button button-secondary"
              type="button"
              data-testid="join-room"
            >
              참가
            </button>
          </div>
          <button
            class="button button-ghost scan-button"
            type="button"
            data-testid="scan-qr"
          >
            앱에서 QR 스캔
          </button>
        </section>

        <p class="prototype-note" data-testid="backend-note">
          ${
            this.backend === 'local'
              ? `현재 방 연결은 같은 브라우저의 여러 탭에서 검증하는 로컬 시제품입니다.
                실제 휴대폰 간 연결은 Firebase 설정 후 활성화됩니다.`
              : `Firebase 실시간 방 연결이 활성화되어 있습니다.
                초대 링크나 QR로 다른 기기에서도 참가할 수 있습니다.`
          }
        </p>
        <p class="form-status" role="status" data-testid="home-status"></p>
      </div>
    `

    const elements = this.getHomeElements()
    elements.nickname.value =
      sessionStorage.getItem(NICKNAME_STORAGE_KEY) ?? ''
    elements.roomCode.value = invitedRoomCode ?? ''

    this.query<HTMLButtonElement>('[data-testid="solo-start"]').addEventListener(
      'click',
      () => {
        if (this.homeActionPending) {
          return
        }
        const mealTime = this.readMealTime()
        this.startGame({
          mode: 'solo',
          mealTime,
          deckSeed: createDeckSeed('solo'),
        })
      },
    )

    this.query<HTMLButtonElement>('[data-testid="create-room"]').addEventListener(
      'click',
      () => {
        void this.createRoom(elements)
      },
    )

    this.query<HTMLButtonElement>('[data-testid="join-room"]').addEventListener(
      'click',
      () => {
        void this.joinRoom(elements)
      },
    )

    this.query<HTMLButtonElement>('[data-testid="scan-qr"]').addEventListener(
      'click',
      () => {
        void this.openQrScanner(elements)
      },
    )

    if (invitedRoomCode) {
      elements.status.textContent =
        '초대 링크를 확인했습니다. 닉네임을 입력하고 참가하세요.'
      elements.nickname.focus()
    }
  }

  private async openQrScanner(elements: HomeElements): Promise<void> {
    this.scannerAbortController?.abort()
    const abortController = new AbortController()
    this.scannerAbortController = abortController
    const overlay = document.createElement('div')
    overlay.className = 'scanner-overlay'
    overlay.dataset.testid = 'qr-scanner'
    overlay.innerHTML = `
      <div class="scanner-panel">
        <div class="scanner-heading">
          <div>
            <p class="eyebrow">QR SCANNER</p>
            <h2>친구 화면의 QR을 비춰주세요</h2>
          </div>
          <button
            class="icon-button"
            type="button"
            data-testid="cancel-scan"
            aria-label="QR 스캔 닫기"
          >×</button>
        </div>
        <div class="video-frame">
          <video data-testid="scanner-video"></video>
          <span aria-hidden="true"></span>
        </div>
        <p>인식되지 않으면 링크나 8자리 코드를 사용해도 됩니다.</p>
      </div>
    `
    this.screenRoot.append(overlay)

    const cancelButton = overlay.querySelector<HTMLButtonElement>(
      '[data-testid="cancel-scan"]',
    )
    const video = overlay.querySelector<HTMLVideoElement>(
      '[data-testid="scanner-video"]',
    )
    if (!cancelButton || !video) {
      overlay.remove()
      throw new Error('QR 스캐너 화면을 만들지 못했습니다.')
    }

    cancelButton.addEventListener('click', () => abortController.abort())

    try {
      const roomCode = await scanRoomCodeFromCamera(video, {
        signal: abortController.signal,
      })
      elements.roomCode.value = roomCode
      elements.status.textContent =
        `방 코드 ${roomCode}를 인식했습니다. 닉네임을 확인하고 참가하세요.`
    } catch (error) {
      if (!(error instanceof QrScannerError && error.code === 'ABORTED')) {
        elements.status.textContent = toUserMessage(error)
      }
    } finally {
      abortController.abort()
      if (this.scannerAbortController === abortController) {
        this.scannerAbortController = null
      }
      overlay.remove()
    }
  }

  private async createRoom(elements: HomeElements): Promise<void> {
    if (this.homeActionPending) {
      return
    }
    const action = Symbol('create-room')
    const generation = this.viewGeneration
    this.homeActionPending = true
    this.activeHomeAction = action
    this.setHomeActionsDisabled(true)

    try {
      const nickname = this.readNickname(elements.nickname)
      elements.status.textContent = '방을 만들고 있어요…'

      const room = await this.roomGateway.create({
        playerId: this.playerId,
        nickname,
        mealTime: this.readMealTime(),
      })

      if (!this.isCurrentHomeAction(action, generation)) {
        return
      }
      await this.renderLobby(room)
    } catch (error) {
      if (this.activeHomeAction === action) {
        elements.status.textContent = toUserMessage(error)
      }
    } finally {
      if (this.activeHomeAction === action) {
        this.activeHomeAction = null
        this.homeActionPending = false
        this.setHomeActionsDisabled(false)
      }
    }
  }

  private async joinRoom(elements: HomeElements): Promise<void> {
    if (this.homeActionPending) {
      return
    }
    const action = Symbol('join-room')
    const generation = this.viewGeneration
    this.homeActionPending = true
    this.activeHomeAction = action
    this.setHomeActionsDisabled(true)

    try {
      const nickname = this.readNickname(elements.nickname)
      const roomCode = normalizeRoomCode(elements.roomCode.value)
      elements.status.textContent = '방 상태를 확인하고 있어요…'

      const existingRoom = await this.roomGateway.get(roomCode)
      if (!this.isCurrentHomeAction(action, generation)) {
        return
      }
      if (existingRoom?.status === 'started') {
        this.assertCanResumeStartedRoom(existingRoom)
        const initialResults = await readFirstRoomResults(
          this.roomGateway,
          roomCode,
        )
        if (!this.isCurrentHomeAction(action, generation)) {
          return
        }
        await this.resumeStartedRoom(existingRoom, initialResults)
        return
      }

      elements.status.textContent = '방에 참가하고 있어요…'
      let room: WaitingRoom
      try {
        room = await this.roomGateway.join(roomCode, {
          playerId: this.playerId,
          nickname,
        })
      } catch (joinError) {
        const latestRoom = await this.roomGateway.get(roomCode)
        if (!this.isCurrentHomeAction(action, generation)) {
          return
        }
        if (latestRoom?.status !== 'started') {
          throw joinError
        }
        this.assertCanResumeStartedRoom(latestRoom)

        const initialResults = await readFirstRoomResults(
          this.roomGateway,
          roomCode,
        )
        if (!this.isCurrentHomeAction(action, generation)) {
          return
        }
        await this.resumeStartedRoom(latestRoom, initialResults)
        return
      }

      if (!this.isCurrentHomeAction(action, generation)) {
        return
      }
      await this.renderLobby(room)
    } catch (error) {
      if (this.activeHomeAction === action) {
        elements.status.textContent = toUserMessage(error)
      }
    } finally {
      if (this.activeHomeAction === action) {
        this.activeHomeAction = null
        this.homeActionPending = false
        this.setHomeActionsDisabled(false)
      }
    }
  }

  private async renderLobby(initialRoom: WaitingRoom): Promise<void> {
    this.cleanupRoomFlow()
    const generation = ++this.viewGeneration
    this.currentRoom = initialRoom
    const lobbyUrl = new URL(window.location.href)
    lobbyUrl.searchParams.set('room', initialRoom.code)
    window.history.replaceState({}, '', lobbyUrl)

    this.screenRoot.hidden = false
    this.gameRoot.hidden = true
    this.screenRoot.innerHTML = `
      <div class="app-screen lobby-screen">
        <header class="lobby-heading">
          <button
            class="icon-button"
            type="button"
            data-testid="leave-room"
            aria-label="홈으로 돌아가기"
          >←</button>
          <div>
            <p class="eyebrow">${
              this.backend === 'local'
                ? 'LOCAL ROOM PROTOTYPE'
                : 'FIREBASE LIVE ROOM'
            }</p>
            <h1>친구를 초대하세요</h1>
          </div>
        </header>

        <section class="invite-card">
          <div class="qr-frame">
            <img data-testid="room-qr" alt="방 초대 QR 코드" />
          </div>
          <div class="invite-copy">
            <span>방 코드</span>
            <strong data-testid="room-code"></strong>
            <small data-testid="meal-label"></small>
          </div>
          <button
            class="button button-secondary"
            type="button"
            data-testid="copy-invite"
          >초대 링크 복사</button>
        </section>

        <section class="roster-card">
          <div class="roster-heading">
            <h2>참가자</h2>
            <span data-testid="player-count"></span>
          </div>
          <ol class="player-list" data-testid="player-list"></ol>
        </section>

        <div class="lobby-footer">
          <p role="status" data-testid="lobby-status"></p>
          <button
            class="button button-accent"
            type="button"
            data-testid="start-room"
            disabled
          >2명부터 시작할 수 있어요</button>
        </div>
      </div>
    `

    const inviteUrl = buildRoomInviteUrl(
      window.location.href,
      initialRoom.code,
    )
    const roomCodeElement = this.query<HTMLElement>(
      '[data-testid="room-code"]',
    )
    roomCodeElement.textContent = initialRoom.code

    const qrImage = this.query<HTMLImageElement>(
      '[data-testid="room-qr"]',
    )
    const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#101821',
        light: '#fff8e7',
      },
    })
    if (generation !== this.viewGeneration) {
      return
    }
    qrImage.src = qrDataUrl

    this.query<HTMLButtonElement>('[data-testid="leave-room"]').addEventListener(
      'click',
      () => {
        void this.leaveCurrentRoom()
      },
    )
    this.query<HTMLButtonElement>('[data-testid="copy-invite"]').addEventListener(
      'click',
      (event) => {
        void this.shareInvite(
          inviteUrl,
          event.currentTarget as HTMLButtonElement,
        )
      },
    )
    this.query<HTMLButtonElement>('[data-testid="start-room"]').addEventListener(
      'click',
      () => {
        void this.startCurrentRoom()
      },
    )

    this.updateLobby(initialRoom)
    const unsubscribe = await this.roomGateway.subscribe(
      initialRoom.code,
      (room) => {
        if (generation !== this.viewGeneration) {
          return
        }
        if (!room) {
          this.showLobbyError('방을 찾을 수 없습니다.')
          return
        }
        this.updateLobby(room)
      },
      (error) => {
        if (generation !== this.viewGeneration) {
          return
        }
        this.showLobbyError(
          `방 동기화 오류: ${toUserMessage(error)}`,
        )
      },
    )
    if (generation !== this.viewGeneration) {
      unsubscribe()
      return
    }
    this.unsubscribeRoom = unsubscribe
  }

  private updateLobby(room: Room): void {
    this.currentRoom = room

    if (room.status === 'started') {
      this.scheduleRoomGame(room)
      return
    }

    const playerCount = this.query<HTMLElement>(
      '[data-testid="player-count"]',
    )
    playerCount.textContent = `${room.players.length}/8`

    const mealLabel = this.query<HTMLElement>(
      '[data-testid="meal-label"]',
    )
    mealLabel.textContent =
      room.mealTime === 'lunch' ? '점심 메뉴' : '저녁 메뉴'

    const playerList = this.query<HTMLOListElement>(
      '[data-testid="player-list"]',
    )
    playerList.replaceChildren(
      ...room.players.map((player) => {
        const item = document.createElement('li')
        const order = document.createElement('span')
        const nickname = document.createElement('strong')
        const role = document.createElement('small')

        order.textContent = String(player.rosterOrder + 1)
        nickname.textContent = player.nickname
        role.textContent = player.role === 'host' ? '방장' : '참가'
        item.append(order, nickname, role)
        return item
      }),
    )

    const isHost = room.hostPlayerId === this.playerId
    const startButton = this.query<HTMLButtonElement>(
      '[data-testid="start-room"]',
    )
    const lobbyStatus = this.query<HTMLElement>(
      '[data-testid="lobby-status"]',
    )

    startButton.hidden = !isHost
    startButton.disabled = !canStartRoom(room, this.playerId)
    startButton.textContent = startButton.disabled
      ? '2명부터 시작할 수 있어요'
      : `${room.players.length}명으로 시작`
    lobbyStatus.textContent = isHost
      ? '참가자가 들어오면 준비 확인 없이 바로 시작할 수 있어요.'
      : '방장이 시작하면 자동으로 카운트다운이 시작됩니다.'
  }

  private async startCurrentRoom(): Promise<void> {
    const room = this.currentRoom
    if (!room || room.status !== 'waiting') {
      return
    }

    try {
      await this.roomGateway.start(room.code, {
        requesterPlayerId: this.playerId,
        deckSeed: createDeckSeed(room.code),
        contentVersion: CONTENT_VERSION,
        startAt: Date.now() + ROOM_COUNTDOWN_MS,
      })
    } catch (error) {
      this.showLobbyError(toUserMessage(error))
    }
  }

  private scheduleRoomGame(room: StartedRoom): void {
    if (room.start.contentVersion !== CONTENT_VERSION) {
      this.showLobbyError(
        '게임 콘텐츠 버전이 달라 시작할 수 없습니다. 새로고침해 주세요.',
      )
      return
    }

    const scheduleKey = `${room.code}:${String(room.start.deckSeed)}`
    if (this.scheduledRoomKey === scheduleKey) {
      return
    }
    this.scheduledRoomKey = scheduleKey

    this.screenRoot.innerHTML = `
      <div class="app-screen countdown-screen">
        <p class="eyebrow">ROOM ${room.code}</p>
        <p>명단이 잠겼습니다</p>
        <strong data-testid="countdown">3</strong>
        <span>모두 같은 메뉴로 시작합니다</span>
      </div>
    `

    const countdown = this.query<HTMLElement>(
      '[data-testid="countdown"]',
    )
    const updateCountdown = () => {
      const remaining = Math.max(0, room.start.startAt - Date.now())
      countdown.textContent = String(Math.max(1, Math.ceil(remaining / 1_000)))
    }
    updateCountdown()
    this.countdownInterval = window.setInterval(updateCountdown, 100)

    const delay = Math.max(0, room.start.startAt - Date.now())
    this.gameStartTimeout = window.setTimeout(() => {
      this.startGame({
        mode: 'room',
        mealTime: room.mealTime,
        deckSeed: room.start.deckSeed,
        roomCode: room.code,
      })
    }, delay)
  }

  private startGame(options: GameLaunchOptions): void {
    this.viewGeneration += 1
    this.cleanupRoomSubscription()
    this.cleanupResultSubscription()
    this.activeRoomResultFlow = null
    this.clearCountdown()
    this.screenRoot.hidden = true
    this.gameHost.start(options)
  }

  private assertCanResumeStartedRoom(
    room: StartedRoom,
  ): void {
    if (room.start.contentVersion !== CONTENT_VERSION) {
      throw new Error(
        '게임 콘텐츠 버전이 달라 복귀할 수 없습니다. 새로고침해 주세요.',
      )
    }

    if (
      !room.start.roster.some(
        (player) => player.playerId === this.playerId,
      )
    ) {
      throw new Error(
        '이미 시작된 방입니다. 잠긴 참가자 명단에 있는 플레이어만 복귀할 수 있습니다.',
      )
    }
  }

  private async resumeStartedRoom(
    room: StartedRoom,
    initialResults: readonly RoomResultSubmission[],
  ): Promise<void> {
    this.assertCanResumeStartedRoom(room)

    const roomUrl = new URL(window.location.href)
    roomUrl.searchParams.set('room', room.code)
    window.history.replaceState({}, '', roomUrl)
    this.currentRoom = room

    const ownResult = initialResults.find(
      (result) => result.playerId === this.playerId,
    )
    if (!ownResult) {
      this.startGame({
        mode: 'room',
        mealTime: room.mealTime,
        deckSeed: room.start.deckSeed,
        roomCode: room.code,
      })
      return
    }

    this.gameHost.stop()
    this.cleanupRoomSubscription()
    this.cleanupResultSubscription()
    this.clearCountdown()
    const generation = ++this.viewGeneration
    this.screenRoot.hidden = false

    const flow: ActiveRoomResultFlow = {
      room,
      submission: ownResult,
      generation,
      results: [],
      submissionPending: false,
      subscriptionPending: false,
      submissionError: null,
      subscriptionError: null,
      complete: false,
    }
    this.activeRoomResultFlow = flow
    this.handleRoomResultsSnapshot(flow, initialResults)

    if (!flow.complete && this.isActiveResultFlow(flow)) {
      await this.subscribeToRoomResults(flow)
    }
  }

  private async handleGameResult(
    result: Readonly<PlayerGameResult>,
  ): Promise<void> {
    if (result.mode !== 'room') {
      return
    }

    const room = this.currentRoom
    this.gameHost.stop()
    this.cleanupRoomSubscription()
    this.cleanupResultSubscription()
    this.clearCountdown()
    const generation = ++this.viewGeneration
    this.screenRoot.hidden = false

    if (
      !room ||
      room.status !== 'started' ||
      result.roomCode !== room.code ||
      result.mealTime !== room.mealTime ||
      result.deckSeed !== room.start.deckSeed ||
      !room.start.roster.some(
        (player) => player.playerId === this.playerId,
      )
    ) {
      this.activeRoomResultFlow = null
      this.renderRoomResultFailure(
        '잠긴 방 정보와 게임 결과가 일치하지 않습니다.',
      )
      return
    }

    const flow: ActiveRoomResultFlow = {
      room,
      submission: {
        playerId: this.playerId,
        score: result.score,
        capturedMenuIds: [...result.capturedMenuIds],
        completedAt: result.completedAt,
      },
      generation,
      results: [],
      submissionPending: false,
      subscriptionPending: false,
      submissionError: null,
      subscriptionError: null,
      complete: false,
    }
    this.activeRoomResultFlow = flow
    this.renderRoomResultWaiting(flow)

    await this.subscribeToRoomResults(flow)
    if (!this.isActiveResultFlow(flow)) {
      return
    }
    await this.submitActiveRoomResult(flow)
  }

  private async subscribeToRoomResults(
    flow: ActiveRoomResultFlow,
  ): Promise<void> {
    if (!this.isActiveResultFlow(flow) || flow.subscriptionPending) {
      return
    }

    this.cleanupResultSubscription()
    flow.subscriptionPending = true
    flow.subscriptionError = null
    this.renderRoomResultWaiting(flow)

    try {
      const unsubscribe = await this.roomGateway.subscribeResults(
        flow.room.code,
        (results) => {
          if (this.isActiveResultFlow(flow)) {
            this.handleRoomResultsSnapshot(flow, results)
          }
        },
        (error) => {
          if (!this.isActiveResultFlow(flow) || flow.complete) {
            return
          }
          flow.subscriptionError =
            `결과 구독 오류: ${toUserMessage(error)}`
          this.renderRoomResultWaiting(flow)
        },
      )

      if (!this.isActiveResultFlow(flow) || flow.complete) {
        unsubscribe()
        return
      }
      this.unsubscribeResults = unsubscribe
    } catch (error) {
      if (this.isActiveResultFlow(flow)) {
        flow.subscriptionError =
          `결과 구독 오류: ${toUserMessage(error)}`
      }
    } finally {
      if (this.isActiveResultFlow(flow)) {
        flow.subscriptionPending = false
        if (!flow.complete) {
          this.renderRoomResultWaiting(flow)
        }
      }
    }
  }

  private async submitActiveRoomResult(
    flow: ActiveRoomResultFlow,
  ): Promise<void> {
    if (
      !this.isActiveResultFlow(flow) ||
      flow.submissionPending ||
      flow.complete
    ) {
      return
    }

    flow.submissionPending = true
    flow.submissionError = null
    this.renderRoomResultWaiting(flow)

    try {
      const results = await this.roomGateway.submitResult(
        flow.room.code,
        flow.submission,
      )
      if (this.isActiveResultFlow(flow)) {
        this.handleRoomResultsSnapshot(flow, results)
      }
    } catch (error) {
      if (this.isActiveResultFlow(flow)) {
        flow.submissionError =
          `결과 제출 실패: ${toUserMessage(error)}`
      }
    } finally {
      if (this.isActiveResultFlow(flow)) {
        flow.submissionPending = false
        if (!flow.complete) {
          this.renderRoomResultWaiting(flow)
        }
      }
    }
  }

  private handleRoomResultsSnapshot(
    flow: ActiveRoomResultFlow,
    results: readonly RoomResultSubmission[],
  ): void {
    if (!this.isActiveResultFlow(flow) || flow.complete) {
      return
    }

    const rosterIds = new Set(
      flow.room.start.roster.map((player) => player.playerId),
    )
    const submissionByPlayer = new Map<string, RoomResultSubmission>()

    for (const result of results) {
      if (
        rosterIds.has(result.playerId) &&
        !submissionByPlayer.has(result.playerId)
      ) {
        submissionByPlayer.set(result.playerId, result)
      }
    }

    flow.results = flow.room.start.roster
      .map((player) => submissionByPlayer.get(player.playerId))
      .filter(
        (result): result is RoomResultSubmission =>
          result !== undefined,
      )

    if (flow.results.length < flow.room.start.roster.length) {
      flow.complete = false
      this.renderRoomResultWaiting(flow)
      return
    }

    const summary = aggregateRoomResults(
      flow.room.start.roster.map((player) => {
        const result = submissionByPlayer.get(player.playerId)
        if (!result) {
          throw new Error(
            `잠긴 참가자 ${player.playerId}의 결과가 없습니다.`,
          )
        }

        return {
          playerId: player.playerId,
          displayName: player.nickname,
          rosterOrder: player.rosterOrder,
          score: result.score,
          capturedMenuIds: result.capturedMenuIds,
        }
      }),
    )

    flow.complete = true
    this.cleanupResultSubscription()
    this.renderRoomResultsSummary(flow.room, summary)
  }

  private renderRoomResultWaiting(
    flow: ActiveRoomResultFlow,
  ): void {
    if (!this.isActiveResultFlow(flow) || flow.complete) {
      return
    }

    const submittedPlayerIds = new Set(
      flow.results.map((result) => result.playerId),
    )
    const submittedCount = submittedPlayerIds.size
    const totalCount = flow.room.start.roster.length
    const ownSubmitted = submittedPlayerIds.has(this.playerId)

    this.screenRoot.innerHTML = `
      <div
        class="app-screen results-waiting-screen"
        data-testid="room-results-waiting"
      >
        <header class="results-heading">
          <p class="eyebrow">${
            this.backend === 'local'
              ? 'LOCAL RESULT SYNC'
              : 'FIREBASE RESULT SYNC'
          }</p>
          <h1>친구들의 결과를 기다리는 중</h1>
          <p>잠긴 참가자 명단의 결과가 모두 도착하면 함께 공개돼요.</p>
        </header>

        <section class="result-progress-card">
          <span>도착한 결과</span>
          <strong data-testid="result-progress">${submittedCount}/${totalCount}</strong>
          <div
            class="result-progress-track"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="${totalCount}"
            aria-valuenow="${submittedCount}"
          >
            <span style="width: ${(submittedCount / totalCount) * 100}%"></span>
          </div>
        </section>

        <ol
          class="result-waiting-roster"
          data-testid="result-waiting-roster"
        ></ol>

        <div class="result-sync-status" aria-live="polite">
          <p data-testid="result-submit-status"></p>
          <p data-testid="result-subscription-status"></p>
        </div>

        <div class="result-retry-actions">
          <button
            class="button button-accent"
            type="button"
            data-testid="retry-result-submit"
          >내 결과 다시 제출</button>
          <button
            class="button button-secondary"
            type="button"
            data-testid="retry-result-subscribe"
          >결과 다시 연결</button>
        </div>

        <button
          class="button button-ghost result-home-button"
          type="button"
          data-testid="result-home"
        >홈으로</button>
      </div>
    `

    const roster = this.query<HTMLOListElement>(
      '[data-testid="result-waiting-roster"]',
    )
    roster.replaceChildren(
      ...flow.room.start.roster.map((player) => {
        const item = document.createElement('li')
        const name = document.createElement('strong')
        const state = document.createElement('span')
        const submitted = submittedPlayerIds.has(player.playerId)

        name.textContent = player.nickname
        state.textContent = submitted ? '제출 완료' : '플레이 중'
        state.className = submitted ? 'is-submitted' : ''
        item.append(name, state)
        return item
      }),
    )

    const submitStatus = this.query<HTMLElement>(
      '[data-testid="result-submit-status"]',
    )
    submitStatus.textContent = flow.submissionError
      ? flow.submissionError
      : flow.submissionPending
        ? '내 결과를 제출하고 있어요…'
        : ownSubmitted
          ? '내 결과 제출 완료'
          : '내 결과 제출을 준비하고 있어요.'

    const subscriptionStatus = this.query<HTMLElement>(
      '[data-testid="result-subscription-status"]',
    )
    subscriptionStatus.textContent = flow.subscriptionError
      ? flow.subscriptionError
      : flow.subscriptionPending
        ? '실시간 결과에 연결하고 있어요…'
        : '실시간 결과 연결됨'

    const retrySubmit = this.query<HTMLButtonElement>(
      '[data-testid="retry-result-submit"]',
    )
    retrySubmit.hidden = flow.submissionError === null
    retrySubmit.disabled = flow.submissionPending
    retrySubmit.addEventListener('click', () => {
      void this.submitActiveRoomResult(flow)
    })

    const retrySubscribe = this.query<HTMLButtonElement>(
      '[data-testid="retry-result-subscribe"]',
    )
    retrySubscribe.hidden = flow.subscriptionError === null
    retrySubscribe.disabled = flow.subscriptionPending
    retrySubscribe.addEventListener('click', () => {
      void this.subscribeToRoomResults(flow)
    })

    this.query<HTMLButtonElement>(
      '[data-testid="result-home"]',
    ).addEventListener('click', () => {
      this.returnHome()
    })
  }

  private renderRoomResultsSummary(
    room: StartedRoom,
    summary: Readonly<RoomResultsSummary>,
  ): void {
    this.screenRoot.innerHTML = `
      <div
        class="app-screen room-results-screen"
        data-testid="room-results-summary"
      >
        <header class="results-heading results-heading-complete">
          <p class="eyebrow">ROOM ${room.code} · FINAL</p>
          <h1>오늘의 경기 결과</h1>
          <p>점수와 포획 메뉴를 보고 함께 식사를 골라보세요.</p>
        </header>

        <section class="result-section standings-section">
          <div class="result-section-heading">
            <div>
              <span>RANKING</span>
              <h2>최종 순위</h2>
            </div>
            <small>${summary.standings.length}명</small>
          </div>
          <ol
            class="result-standings"
            data-testid="result-standings"
          ></ol>
        </section>

        <section class="result-section winner-section">
          <div class="result-section-heading">
            <div>
              <span>WINNER PICKS</span>
              <h2>${
                summary.winners.length === 1
                  ? '단독 1등 메뉴'
                  : '공동 1등 메뉴'
              }</h2>
            </div>
          </div>
          <div
            class="winner-picks"
            data-testid="winner-summary"
          ></div>
        </section>

        <section class="result-section overlap-section">
          <div class="result-section-heading">
            <div>
              <span>MATCHED PICKS</span>
              <h2>공동 최다 겹침 메뉴</h2>
            </div>
          </div>
          <div
            class="overlap-list"
            data-testid="overlap-summary"
          ></div>
        </section>

        <section
          class="result-outcome-card"
          data-testid="result-outcome"
        ></section>

        <button
          class="button button-accent result-home-button"
          type="button"
          data-testid="result-home"
        >홈으로</button>
      </div>
    `

    const standings = this.query<HTMLOListElement>(
      '[data-testid="result-standings"]',
    )
    standings.replaceChildren(
      ...summary.standings.map((standing) => {
        const item = document.createElement('li')
        item.className = 'result-standing'
        item.dataset.testid = 'result-standing'
        if (standing.rank === 1) {
          item.classList.add('is-winner')
        }

        const rank = document.createElement('strong')
        rank.className = 'result-rank'
        rank.textContent = standing.isScoreTied
          ? `공동 ${standing.rank}위`
          : `${standing.rank}위`

        const player = document.createElement('div')
        player.className = 'result-player'
        const name = document.createElement('strong')
        const score = document.createElement('span')
        name.textContent = standing.displayName
        score.textContent = `${formatScore(standing.score)}점`
        player.append(name, score)

        const captures = document.createElement('div')
        captures.className = 'result-capture-slots'
        captures.append(
          ...standing.capturedMenuSlots.map((menuId) =>
            this.createResultMenuSlot(menuId),
          ),
        )

        item.append(rank, player, captures)
        return item
      }),
    )

    const winnerPicks = this.query<HTMLElement>(
      '[data-testid="winner-summary"]',
    )
    winnerPicks.replaceChildren(
      ...summary.winners.map((winner) => {
        const card = document.createElement('article')
        card.className = 'winner-pick-card'
        const heading = document.createElement('h3')
        heading.textContent =
          `${winner.displayName} · ${formatScore(winner.score)}점`
        const slots = document.createElement('div')
        slots.className = 'result-capture-slots result-capture-slots-large'
        slots.append(
          ...winner.capturedMenuSlots.map((menuId) =>
            this.createResultMenuSlot(menuId),
          ),
        )
        card.append(heading, slots)
        return card
      }),
    )

    const overlapSummary = this.query<HTMLElement>(
      '[data-testid="overlap-summary"]',
    )
    if (summary.mostOverlappedMenus.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'result-empty-copy'
      const winnerCapturedAnyMenu = summary.winners.some(
        (winner) => winner.capturedMenuIds.length > 0,
      )
      empty.textContent = winnerCapturedAnyMenu
        ? '겹친 메뉴가 없어요. 1등의 포획 메뉴를 보며 함께 골라보세요.'
        : '겹친 메뉴와 1등의 포획 메뉴가 없어요. 순위를 참고해 함께 골라보세요.'
      overlapSummary.append(empty)
    } else {
      const nameByPlayerId = new Map(
        summary.standings.map((standing) => [
          standing.playerId,
          standing.displayName,
        ]),
      )

      overlapSummary.append(
        ...summary.mostOverlappedMenus.map((overlap) => {
          const card = document.createElement('article')
          card.className = 'overlap-card'
          card.dataset.testid = 'overlapped-menu'
          const menu = this.createResultMenuSlot(overlap.menuId)
          const copy = document.createElement('div')
          const count = document.createElement('strong')
          const capturers = document.createElement('span')
          count.textContent = `${overlap.captureCount}명 포획`
          capturers.textContent = overlap.playerIds
            .map(
              (playerId) =>
                nameByPlayerId.get(playerId) ?? playerId,
            )
            .join(' · ')
          copy.append(count, capturers)
          card.append(menu, copy)
          return card
        }),
      )
    }

    const outcome = this.query<HTMLElement>(
      '[data-testid="result-outcome"]',
    )
    const outcomeTitle = document.createElement('strong')
    const outcomeCopy = document.createElement('p')
    const soleWinner = summary.winners.length === 1
    const soleLastPlace = summary.lastPlaces.length === 1

    if (soleWinner && soleLastPlace) {
      outcomeTitle.textContent = '꼴찌가 1등의 식사를 부담'
      outcomeCopy.textContent =
        `${summary.lastPlaces[0]!.displayName}님이 ` +
        `${summary.winners[0]!.displayName}님의 식사를 부담해요.`
    } else {
      outcomeTitle.textContent = '공동 순위 · 함께 합의'
      outcomeCopy.textContent =
        `1등: ${formatStandingNames(summary.winners)} · ` +
        `꼴찌: ${formatStandingNames(summary.lastPlaces)}. ` +
        '공동 순위의 메뉴와 부담 방식은 모두 함께 정해 주세요.'
    }
    outcome.append(outcomeTitle, outcomeCopy)

    this.query<HTMLButtonElement>(
      '[data-testid="result-home"]',
    ).addEventListener('click', () => {
      this.returnHome()
    })
  }

  private createResultMenuSlot(
    menuId: string | null,
  ): HTMLElement {
    const slot = document.createElement('div')
    slot.className = 'result-menu-slot'
    slot.dataset.testid = 'capture-slot'

    const art = document.createElement('span')
    art.className = 'result-menu-art'
    art.setAttribute('aria-hidden', 'true')
    const label = document.createElement('small')

    if (menuId === null) {
      slot.classList.add('is-empty')
      art.textContent = '＋'
      label.textContent = '빈칸'
      slot.append(art, label)
      return slot
    }

    const menu: MenuItem | undefined = MENU_BY_ID.get(menuId)
    const visual = getMenuVisual(menuId)
    slot.dataset.menuId = menuId
    art.style.backgroundColor = menu?.placeholderColor ?? '#526579'

    if (visual) {
      const image = document.createElement('img')
      image.alt = ''
      image.decoding = 'async'
      image.addEventListener(
        'error',
        () => {
          image.remove()
          art.textContent = menu?.nameKo.slice(0, 1) ?? '?'
        },
        { once: true },
      )
      image.src = visual.imageUrl
      art.append(image)
    } else {
      art.textContent = menu?.nameKo.slice(0, 1) ?? '?'
    }

    label.textContent = menu?.nameKo ?? menuId
    slot.append(art, label)
    return slot
  }

  private renderRoomResultFailure(message: string): void {
    this.screenRoot.innerHTML = `
      <div class="app-screen results-waiting-screen">
        <header class="results-heading">
          <p class="eyebrow">RESULT ERROR</p>
          <h1>공동 결과를 열 수 없어요</h1>
          <p data-testid="result-fatal-error"></p>
        </header>
        <button
          class="button button-accent result-home-button"
          type="button"
          data-testid="result-home"
        >홈으로</button>
      </div>
    `
    this.query<HTMLElement>(
      '[data-testid="result-fatal-error"]',
    ).textContent = message
    this.query<HTMLButtonElement>(
      '[data-testid="result-home"]',
    ).addEventListener('click', () => {
      this.returnHome()
    })
  }

  private isActiveResultFlow(
    flow: ActiveRoomResultFlow,
  ): boolean {
    return (
      this.activeRoomResultFlow === flow &&
      this.viewGeneration === flow.generation
    )
  }

  private async shareInvite(
    inviteUrl: string,
    button: HTMLButtonElement,
  ): Promise<void> {
    try {
      if (navigator.share) {
        await navigator.share({
          title: '오늘 뭐 썰? 방 초대',
          text: '같이 메뉴를 포획하고 식사 내기를 해요.',
          url: inviteUrl,
        })
        button.textContent = '초대 완료'
        return
      }

      await navigator.clipboard.writeText(inviteUrl)
      button.textContent = '링크 복사 완료'
    } catch {
      button.textContent = '주소창 링크를 복사해 주세요'
    }
  }

  private async leaveCurrentRoom(): Promise<void> {
    const room = this.currentRoom
    if (!room || room.status !== 'waiting') {
      this.returnHome()
      return
    }

    const generation = this.viewGeneration
    const leaveButton = this.screenRoot.querySelector<HTMLButtonElement>(
      '[data-testid="leave-room"]',
    )
    if (leaveButton) {
      leaveButton.disabled = true
    }

    try {
      await this.roomGateway.leave(room.code, this.playerId)
      if (generation === this.viewGeneration) {
        this.returnHome()
      }
    } catch (error) {
      if (generation !== this.viewGeneration) {
        return
      }
      if (leaveButton) {
        leaveButton.disabled = false
      }
      this.showLobbyError(toUserMessage(error))
    }
  }

  private returnHome(): void {
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    window.history.replaceState({}, '', url)
    this.renderHome()
  }

  private cleanupRoomFlow(): void {
    this.stopQrScanner()
    this.cleanupRoomSubscription()
    this.cleanupResultSubscription()
    this.clearCountdown()
    this.activeRoomResultFlow = null
    this.currentRoom = null
    this.scheduledRoomKey = null
  }

  private cleanupResultSubscription(): void {
    this.unsubscribeResults?.()
    this.unsubscribeResults = null
  }

  private cleanupRoomSubscription(): void {
    this.unsubscribeRoom?.()
    this.unsubscribeRoom = null
  }

  private clearCountdown(): void {
    if (this.countdownInterval !== null) {
      window.clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }
    if (this.gameStartTimeout !== null) {
      window.clearTimeout(this.gameStartTimeout)
      this.gameStartTimeout = null
    }
  }

  private stopQrScanner(): void {
    this.scannerAbortController?.abort()
    this.scannerAbortController = null
    this.screenRoot
      .querySelector<HTMLElement>('[data-testid="qr-scanner"]')
      ?.remove()
  }

  private readNickname(input: HTMLInputElement): string {
    const nickname = normalizeNickname(input.value)
    sessionStorage.setItem(NICKNAME_STORAGE_KEY, nickname)
    return nickname
  }

  private readMealTime(): MealTime {
    const input = this.screenRoot.querySelector<HTMLInputElement>(
      'input[name="meal-time"]:checked',
    )
    return input?.value === 'dinner' ? 'dinner' : 'lunch'
  }

  private getHomeElements(): HomeElements {
    return {
      nickname: this.query<HTMLInputElement>('#nickname-input'),
      roomCode: this.query<HTMLInputElement>('#room-code-input'),
      status: this.query<HTMLElement>('[data-testid="home-status"]'),
    }
  }

  private showLobbyError(message: string): void {
    const status = this.screenRoot.querySelector<HTMLElement>(
      '[data-testid="lobby-status"]',
    )
    if (status) {
      status.textContent = message
    }
  }

  private setHomeActionsDisabled(disabled: boolean): void {
    for (const button of this.screenRoot.querySelectorAll<HTMLButtonElement>(
      [
        '[data-testid="solo-start"]',
        '[data-testid="create-room"]',
        '[data-testid="join-room"]',
      ].join(', '),
    )) {
      button.disabled = disabled
    }
  }

  private isCurrentHomeAction(
    action: symbol,
    generation: number,
  ): boolean {
    return (
      this.activeHomeAction === action &&
      this.viewGeneration === generation
    )
  }

  private query<T extends Element>(selector: string): T {
    const element = this.screenRoot.querySelector<T>(selector)
    if (!element) {
      throw new Error(`화면 요소를 찾을 수 없습니다: ${selector}`)
    }
    return element
  }
}

function getOrCreatePlayerId(): string {
  const existing = sessionStorage.getItem(PLAYER_ID_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const playerId = createRandomUuid()
  sessionStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId)
  return playerId
}

function resolvePlayerId(playerId: string | undefined): string {
  if (playerId === undefined) {
    return getOrCreatePlayerId()
  }

  const normalized = playerId.normalize('NFKC').trim()
  if (normalized.length === 0) {
    throw new TypeError('플레이어 ID는 비어 있을 수 없습니다.')
  }

  return normalized
}

function readFirstRoomResults(
  roomGateway: RoomGateway,
  roomCode: string,
): Promise<readonly RoomResultSubmission[]> {
  return new Promise((resolve, reject) => {
    let settled = false
    let unsubscribe: (() => void) | null = null
    let unsubscribeRequested = false
    let didUnsubscribe = false

    const unsubscribeOnce = () => {
      if (didUnsubscribe) {
        return
      }
      if (!unsubscribe) {
        unsubscribeRequested = true
        return
      }

      didUnsubscribe = true
      const stop = unsubscribe
      unsubscribe = null
      try {
        stop()
      } catch {
        // A completed one-shot read must not be reopened by cleanup errors.
      }
    }

    const resolveOnce = (
      results: readonly RoomResultSubmission[],
    ) => {
      if (settled) {
        return
      }
      settled = true
      unsubscribeOnce()
      resolve([...results])
    }

    const rejectOnce = (error: unknown) => {
      if (settled) {
        return
      }
      settled = true
      unsubscribeOnce()
      reject(error)
    }

    let subscribePromise: Promise<() => void>
    try {
      subscribePromise = roomGateway.subscribeResults(
        roomCode,
        resolveOnce,
        rejectOnce,
      )
    } catch (error) {
      rejectOnce(error)
      return
    }

    void subscribePromise.then(
      (stop) => {
        unsubscribe = stop
        if (unsubscribeRequested) {
          unsubscribeOnce()
        }
      },
      rejectOnce,
    )
  })
}

function createDeckSeed(prefix: string): string {
  return `${prefix}-${Date.now()}-${createRandomUuid()}`
}

function toUserMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

function formatScore(score: number): string {
  return score.toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatStandingNames(
  standings: readonly { readonly displayName: string }[],
): string {
  return standings.map((standing) => standing.displayName).join(', ')
}

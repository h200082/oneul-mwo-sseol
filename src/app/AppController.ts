import QRCode from 'qrcode'

import chefCatImageUrl from '../assets/title/chef-cat-v1.webp'
import gimbapImageUrl from '../assets/title/title-food-gimbap.webp'
import pizzaImageUrl from '../assets/title/title-food-pizza.webp'
import ramyeonImageUrl from '../assets/title/title-food-ramyeon.webp'
import tteokbokkiImageUrl from '../assets/title/title-food-tteokbokki.webp'
import {
  ROOM_RESULT_SYNC_GRACE_MS,
  ROOM_RESULT_WINDOW_MS,
  canStartRoom,
  normalizeNickname,
  type MealTime,
  type PreparingRoom,
  type Room,
  type StartedRoom,
  type WaitingRoom,
} from '../domain/room'
import { createRandomUuid } from '../domain/randomUuid'
import type { RoomResultSubmission } from '../domain/roomResults'
import {
  resolveRoomResults,
  type FinalRoomResultsSummary,
} from '../domain/roomResultResolution'
import { resolveRoomMenuCandidates } from '../domain/roomMenuCandidates'
import { MENU_CATALOG, type MenuItem } from '../data/menus'
import { getMenuVisual } from '../data/menuVisuals'
import {
  createBrowserSensoryFeedback,
  type SensoryFeedback,
  type SensoryFeedbackDebugState,
} from '../feedback/SensoryFeedback'
import {
  createBrowserNarrationPreference,
  type NarrationPreference,
  type NarrationPreferenceListener,
  type NarrationPreferenceState,
} from '../feedback/narrationPreference'
import type {
  GameLaunchOptions,
  PlayerGameResult,
} from '../game/gameTypes'
import {
  createRoomGameProgressIdentity,
  RoomGameProgressStore,
  type RoomGameProgressIdentity,
} from '../game/gameProgress'
import { PersonalBestStore } from '../game/personalBestStore'
import {
  QrScannerError,
  scanRoomCodeFromCamera,
} from '../qr/QrScannerService'
import { LocalRoomGateway } from '../rooms/LocalRoomGateway'
import type {
  AuthoritativeRoomResultState,
  RoomGateway,
  RoomSnapshotMetadata,
} from '../rooms/RoomGateway'
import {
  buildRoomInviteUrl,
  normalizeRoomCode,
  readRoomCodeFromUrl,
} from '../rooms/roomInvite'
import { GameHost } from './GameHost'

const PLAYER_ID_STORAGE_KEY = 'oneul-mwo-sseol-player-id'
const NICKNAME_STORAGE_KEY = 'oneul-mwo-sseol-nickname'
const SPLASH_ENTERED_STORAGE_KEY = 'oneul-mwo-sseol-splash-entered'
const SPLASH_TRANSITION_MS = 380
const CONTENT_VERSION = 'menus-v2'
const ROOM_COUNTDOWN_MS = 4_000
const ROOM_COUNTDOWN_SOUND_SCALE = 0.8
const ROOM_EVENT_SOUND_SCALE = 0.86
const RESULT_COUNTDOWN_REFRESH_MS = 1_000
const RESULT_FINALIZATION_RETRY_MS = 2_000
const ROOM_SYNC_WATCHDOG_MS = 5_000
const ROOM_SYNC_RECONCILIATION_INTERVAL_MS = 2_000
const ROOM_SYNC_SINGLE_PLAYER_RECONCILIATION_INTERVAL_MS = 5_000
const ROOM_SYNC_DEGRADED_RECONCILIATION_INTERVAL_MS = 10_000
const ROOM_SYNC_SERVER_READ_TIMEOUT_MS = 4_000
const ROOM_SYNC_RETRY_DELAYS_MS = [500, 1_500, 3_000] as const
const NARRATION_ICON_MARKUP = `
  <span class="feedback-icon feedback-icon-narration" aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M6 5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-5 3v-3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  </span>
`

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
  readonly sensoryFeedback?: SensoryFeedback
  readonly narrationPreference?: NarrationPreference
}

export interface AppDebugRoomResultInput {
  readonly score: number
  readonly capturedMenuIds: readonly string[]
  readonly completedAt?: number
}

export type RoomSyncPhase =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'recovering'
  | 'failed'

type LobbyRefreshReason =
  | 'retry'
  | 'manual'
  | 'visible'
  | 'online'
  | 'cache'
  | 'reconcile'

export interface AppDebugRoomSyncState {
  readonly phase: RoomSyncPhase
  readonly lastSyncedAt: number | null
  readonly retryCount: number
  readonly errorCode: string | null
}

export interface AppDebugState {
  readonly playerId: string
  readonly backend: AppBackend
  readonly roomCode: string | null
  readonly room: Room | null
  readonly roomSync: Readonly<AppDebugRoomSyncState>
  readonly sensoryFeedback: Readonly<SensoryFeedbackDebugState>
  readonly narrationPreference: Readonly<NarrationPreferenceState>
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
  readonly submission: RoomResultSubmission | null
  readonly generation: number
  results: readonly RoomResultSubmission[]
  submissionPending: boolean
  submissionTask: Promise<void> | null
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
  private readonly gameProgressStore: RoomGameProgressStore
  private readonly personalBestStore: PersonalBestStore
  private readonly sensoryFeedback: SensoryFeedback
  private readonly narrationPreference: NarrationPreference
  private unsubscribeRoom: (() => void) | null = null
  private unsubscribeResults: (() => void) | null = null
  private countdownInterval: number | null = null
  private gameStartTimeout: number | null = null
  private resultDeadlineTimeout: number | null = null
  private resultDeadlineInterval: number | null = null
  private currentRoom: Room | null = null
  private scheduledRoomKey: string | null = null
  private roomStartPending = false
  private roomPreparationKey: string | null = null
  private roomPreparationTask: Promise<void> | null = null
  private roomReadyAckKey: string | null = null
  private roomReadyAckPending = false
  private roomFinalizeKey: string | null = null
  private roomFinalizePending = false
  private roomSyncPhase: RoomSyncPhase = 'idle'
  private roomSyncLastEventAt: number | null = null
  private roomSyncRetryCount = 0
  private roomSyncErrorCode: string | null = null
  private roomSyncConnectionToken = 0
  private roomSyncServerConnectionToken: number | null = null
  private roomSyncNeedsReconnect = false
  private roomSyncWatchdogTimeout: number | null = null
  private roomSyncRetryTimeout: number | null = null
  private roomSyncReconciliationTimeout: number | null = null
  private roomSyncRefreshTask: Promise<void> | null = null
  private lobbyVisibilityHandler: (() => void) | null = null
  private lobbyOnlineHandler: (() => void) | null = null
  private lobbyFocusHandler: (() => void) | null = null
  private lobbyPageShowHandler: (() => void) | null = null
  private scannerAbortController: AbortController | null = null
  private viewGeneration = 0
  private splashTransitionTimeout: number | null = null
  private splashEnteredInMemory = false
  private homeActionPending = false
  private activeHomeAction: symbol | null = null
  private activeRoomResultFlow: ActiveRoomResultFlow | null = null
  private readonly sensoryPointerUpHandler = (
    event: PointerEvent,
  ): void => {
    if (event.pointerType !== 'mouse' && !event.isPrimary) {
      return
    }
    const unlockTask = this.sensoryFeedback.unlock()
    this.sensoryFeedback.releaseGesture()
    void unlockTask
  }
  private readonly sensoryKeyboardActivationHandler = (): void => {
    void this.sensoryFeedback.unlock()
  }
  private readonly sensoryPointerCancelHandler = (
    event: PointerEvent,
  ): void => {
    if (event.pointerType !== 'mouse' && !event.isPrimary) {
      return
    }
    this.sensoryFeedback.cancelPrimedGesture()
  }
  private readonly sensoryPointerDownHandler = (
    event: PointerEvent,
  ): void => {
    if (event.pointerType === 'mouse') {
      void this.sensoryFeedback.unlock()
      return
    }
    if (event.isPrimary) {
      this.sensoryFeedback.primeForGesture()
    }
  }

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
    this.gameProgressStore = new RoomGameProgressStore(window.localStorage)
    this.personalBestStore = new PersonalBestStore(window.localStorage)
    this.sensoryFeedback =
      options.sensoryFeedback ?? createBrowserSensoryFeedback()
    this.narrationPreference =
      options.narrationPreference ??
      createBrowserNarrationPreference(() => this.sensoryFeedback.soundEnabled)
    this.appRoot.addEventListener(
      'pointerdown',
      this.sensoryPointerDownHandler,
      true,
    )
    this.appRoot.addEventListener(
      'pointerup',
      this.sensoryPointerUpHandler,
      true,
    )
    this.appRoot.addEventListener(
      'pointercancel',
      this.sensoryPointerCancelHandler,
      true,
    )
    this.appRoot.addEventListener(
      'keydown',
      this.sensoryKeyboardActivationHandler,
      true,
    )
    this.gameHost = new GameHost(this.gameRoot, () => {
      this.returnHome()
    }, (result) => {
      queueMicrotask(() => {
        void this.handleGameResult(result)
      })
    }, this.gameProgressStore, this.sensoryFeedback, this.narrationPreference)
  }

  start(): void {
    const invitedRoomCode = readRoomCodeFromUrl(window.location.href)
    if (invitedRoomCode) {
      this.renderHome(invitedRoomCode)
      return
    }

    if (this.hasEnteredSplashThisSession()) {
      this.renderHome()
      return
    }

    this.renderSplash()
  }

  destroy(): void {
    this.viewGeneration += 1
    this.clearSplashTransition()
    this.activeHomeAction = null
    this.homeActionPending = false
    this.cleanupRoomFlow()
    this.appRoot.removeEventListener(
      'pointerdown',
      this.sensoryPointerDownHandler,
      true,
    )
    this.appRoot.removeEventListener(
      'pointerup',
      this.sensoryPointerUpHandler,
      true,
    )
    this.appRoot.removeEventListener(
      'pointercancel',
      this.sensoryPointerCancelHandler,
      true,
    )
    this.appRoot.removeEventListener(
      'keydown',
      this.sensoryKeyboardActivationHandler,
      true,
    )
    this.gameHost.stop()
    this.sensoryFeedback.destroy()
    this.roomGateway.dispose?.()
    this.screenRoot.remove()
  }

  private hasEnteredSplashThisSession(): boolean {
    if (this.splashEnteredInMemory) {
      return true
    }

    try {
      const hasEntered =
        window.sessionStorage.getItem(SPLASH_ENTERED_STORAGE_KEY) === '1'
      if (hasEntered) {
        this.splashEnteredInMemory = true
      }
      return hasEntered
    } catch {
      return false
    }
  }

  private markSplashEntered(): void {
    this.splashEnteredInMemory = true
    try {
      window.sessionStorage.setItem(SPLASH_ENTERED_STORAGE_KEY, '1')
    } catch {
      // A privacy-restricted browser can still keep the state in memory.
    }
  }

  private clearSplashTransition(): void {
    if (this.splashTransitionTimeout === null) {
      return
    }

    window.clearTimeout(this.splashTransitionTimeout)
    this.splashTransitionTimeout = null
  }

  private renderSplash(): void {
    const splashGeneration = ++this.viewGeneration
    this.clearSplashTransition()
    this.cleanupRoomFlow()
    this.gameHost.stop()
    this.homeActionPending = false
    this.activeHomeAction = null
    this.screenRoot.hidden = false
    this.screenRoot.innerHTML = `
      <div class="app-screen splash-screen" data-testid="splash-screen">
        <div class="splash-backdrop" aria-hidden="true">
          <span class="splash-glow splash-glow-coral"></span>
          <span class="splash-glow splash-glow-mint"></span>
          <span class="splash-speed-line splash-speed-line-one"></span>
          <span class="splash-speed-line splash-speed-line-two"></span>
          <span class="splash-speed-line splash-speed-line-three"></span>
        </div>

        <header class="splash-heading">
          <p class="eyebrow">POP ARCADE MENU BATTLE</p>
          <h1>오늘 뭐 <strong>썰?</strong></h1>
          <p>베고, 고르고, 오늘 메뉴 결정!</p>
        </header>

        <div
          class="splash-motion-stage"
          data-testid="splash-motion-stage"
          aria-hidden="true"
        >
          <img
            class="splash-food splash-food-ramyeon"
            data-testid="splash-food"
            src="${ramyeonImageUrl}"
            alt=""
          />
          <img
            class="splash-food splash-food-gimbap"
            data-testid="splash-food"
            src="${gimbapImageUrl}"
            alt=""
          />
          <img
            class="splash-food splash-food-tteokbokki"
            data-testid="splash-food"
            src="${tteokbokkiImageUrl}"
            alt=""
          />
          <img
            class="splash-food splash-food-pizza"
            data-testid="splash-food"
            src="${pizzaImageUrl}"
            alt=""
          />
          <span class="splash-slash splash-slash-primary"></span>
          <span class="splash-slash splash-slash-secondary"></span>
          <span class="splash-score-burst">PERFECT!</span>
          <img
            class="splash-chef-cat"
            data-testid="splash-chef-cat"
            src="${chefCatImageUrl}"
            alt=""
          />
        </div>

        <div class="splash-action">
          <button
            class="button button-accent splash-start-button"
            type="button"
            data-testid="splash-start"
          >게임 시작</button>
          <p>친구들과 메뉴를 썰고 오늘의 식사를 골라보세요.</p>
        </div>
      </div>
    `

    const splash = this.query<HTMLElement>(
      '[data-testid="splash-screen"]',
    )
    const startButton = this.query<HTMLButtonElement>(
      '[data-testid="splash-start"]',
    )
    startButton.addEventListener('click', () => {
      if (
        splashGeneration !== this.viewGeneration ||
        startButton.disabled
      ) {
        return
      }

      startButton.disabled = true
      this.markSplashEntered()
      splash.classList.add('is-leaving')
      splash.setAttribute('aria-busy', 'true')

      void this.sensoryFeedback.unlock().then((unlocked) => {
        if (unlocked && splashGeneration === this.viewGeneration) {
          this.sensoryFeedback.trigger('ui-confirm')
        }
      })

      const reduceMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches
      this.splashTransitionTimeout = window.setTimeout(
        () => {
          this.splashTransitionTimeout = null
          if (splashGeneration !== this.viewGeneration) {
            return
          }
          this.renderHome()
        },
        reduceMotion ? 0 : SPLASH_TRANSITION_MS,
      )
    })
  }

  getDebugState(): AppDebugState {
    return {
      playerId: this.playerId,
      backend: this.backend,
      roomCode: this.currentRoom?.code ?? null,
      room: this.currentRoom,
      roomSync: Object.freeze({
        phase: this.roomSyncPhase,
        lastSyncedAt: this.roomSyncLastEventAt,
        retryCount: this.roomSyncRetryCount,
        errorCode: this.roomSyncErrorCode,
      }),
      sensoryFeedback: this.sensoryFeedback.getDebugState(),
      narrationPreference: this.narrationPreference.getState(),
      gameVisible: !this.gameRoot.hidden,
      startSoloGameForTest: (deckSeed) => {
        if (!import.meta.env.DEV) {
          throw new Error('솔로 게임 테스트 훅은 개발 모드에서만 사용할 수 있습니다.')
        }
        void this.prepareAndStartGame({
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

  getNarrationPreferenceState(): Readonly<NarrationPreferenceState> {
    return this.narrationPreference.getState()
  }

  setNarrationEnabled(enabled: boolean): void {
    this.narrationPreference.setEnabled(enabled)
    this.updateHomeFeedbackControls()
  }

  subscribeNarrationPreference(
    listener: NarrationPreferenceListener,
  ): () => void {
    return this.narrationPreference.subscribe(listener)
  }

  private updateHomeFeedbackControls(): void {
    const soundToggle =
      this.screenRoot.querySelector<HTMLButtonElement>(
        '[data-testid="sound-toggle"]',
      )
    const narrationToggle =
      this.screenRoot.querySelector<HTMLButtonElement>(
        '[data-testid="narration-toggle"]',
      )
    const hapticsToggle =
      this.screenRoot.querySelector<HTMLButtonElement>(
        '[data-testid="haptics-toggle"]',
      )
    if (!soundToggle || !narrationToggle || !hapticsToggle) {
      return
    }

    soundToggle.setAttribute(
      'aria-pressed',
      String(this.sensoryFeedback.soundEnabled),
    )
    soundToggle.setAttribute(
      'aria-label',
      `효과음 ${this.sensoryFeedback.soundEnabled ? '끄기' : '켜기'}`,
    )
    soundToggle.innerHTML = '<span aria-hidden="true">♪</span>'

    const narrationState = this.narrationPreference.getState()
    narrationToggle.setAttribute(
      'aria-pressed',
      String(narrationState.requestedEnabled),
    )
    narrationToggle.setAttribute(
      'aria-label',
      `나레이션 ${narrationState.requestedEnabled ? '끄기' : '켜기'}`,
    )
    narrationToggle.dataset.effective = String(
      narrationState.effectiveEnabled,
    )
    narrationToggle.title =
      narrationState.requestedEnabled && !narrationState.effectiveEnabled
        ? '효과음을 켜면 나레이션이 재생돼요'
        : ''
    narrationToggle.innerHTML = NARRATION_ICON_MARKUP

    const hapticsAvailable = this.sensoryFeedback.hapticsSupported
    hapticsToggle.disabled = !hapticsAvailable
    hapticsToggle.setAttribute(
      'aria-pressed',
      String(
        hapticsAvailable && this.sensoryFeedback.hapticsEnabled,
      ),
    )
    hapticsToggle.setAttribute(
      'aria-label',
      hapticsAvailable
        ? `진동 ${this.sensoryFeedback.hapticsEnabled ? '끄기' : '켜기'}`
        : '이 기기에서는 진동을 지원하지 않아요',
    )
    hapticsToggle.innerHTML = '<span aria-hidden="true">≋</span>'
  }

  private renderHome(invitedRoomCode: string | null = null): void {
    const isInviteMode = invitedRoomCode !== null
    const homeGeneration = ++this.viewGeneration
    this.clearSplashTransition()
    this.cleanupRoomFlow()
    this.gameHost.stop()
    this.homeActionPending = false
    this.activeHomeAction = null
    this.screenRoot.hidden = false
    this.screenRoot.innerHTML = `
      <div
        class="app-screen home-screen${isInviteMode ? ' home-screen-invite' : ''}"
        data-testid="home-screen"
      >
        <header
          class="brand-block"
          ${isInviteMode ? 'data-testid="invite-home"' : ''}
        >
          <p class="eyebrow">POP ARCADE MENU BATTLE</p>
          <h1>오늘 뭐 썰?</h1>
          <p class="brand-copy">
            먹고 싶은 메뉴는 포획하고<br />
            나머지는 정확히 반으로 썰어보세요.
          </p>
          <div
            class="feedback-settings"
            data-testid="feedback-settings"
            role="group"
            aria-label="게임 피드백 설정"
          >
            <button
              class="feedback-toggle"
              type="button"
              data-testid="sound-toggle"
              aria-pressed="${this.sensoryFeedback.soundEnabled ? 'true' : 'false'}"
              aria-label="효과음 ${this.sensoryFeedback.soundEnabled ? '끄기' : '켜기'}"
            >
              <span aria-hidden="true">♪</span>
            </button>
            <button
              class="feedback-toggle feedback-toggle-narration"
              type="button"
              data-testid="narration-toggle"
              aria-pressed="${this.narrationPreference.requestedEnabled ? 'true' : 'false'}"
              aria-label="나레이션 ${this.narrationPreference.requestedEnabled ? '끄기' : '켜기'}"
              data-effective="${this.narrationPreference.effectiveEnabled ? 'true' : 'false'}"
              title="${
                this.narrationPreference.requestedEnabled &&
                !this.narrationPreference.effectiveEnabled
                  ? '효과음을 켜면 나레이션이 재생돼요'
                  : ''
              }"
            >
              ${NARRATION_ICON_MARKUP}
            </button>
            <button
              class="feedback-toggle"
              type="button"
              data-testid="haptics-toggle"
              aria-pressed="${
                this.sensoryFeedback.hapticsSupported &&
                this.sensoryFeedback.hapticsEnabled
                  ? 'true'
                  : 'false'
              }"
              aria-label="${
                this.sensoryFeedback.hapticsSupported
                  ? `진동 ${this.sensoryFeedback.hapticsEnabled ? '끄기' : '켜기'}`
                  : '이 기기에서는 진동을 지원하지 않아요'
              }"
              ${this.sensoryFeedback.hapticsSupported ? '' : 'disabled'}
            >
              <span aria-hidden="true">≋</span>
            </button>
          </div>
        </header>

        <section class="setup-card" aria-labelledby="play-setup-title">
          <h2 id="play-setup-title">
            ${
              isInviteMode ? `방 ${invitedRoomCode}에 초대됐어요` : '바로 시작하기'
            }
          </h2>

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
            <button
              class="button button-ghost tutorial-start"
              type="button"
              data-testid="tutorial-start"
            >
              튜토리얼 하기
            </button>
          </div>
        </section>

        ${
          isInviteMode
            ? ''
            : `
              <details class="game-guide" data-testid="game-guide">
                <summary>게임 방법</summary>
                <div class="game-guide-content">
                  <p><strong>드래그</strong>해서 음식을 반으로 썰어요.</p>
                  <p><strong>0.3초 꾹</strong> 누르면 먹고 싶은 메뉴를 포획해요.</p>
                  <ul>
                    <li>포획은 한 판에 최대 2번까지 가능해요.</li>
                    <li>놓친 음식은 0점으로 계산돼요.</li>
                    <li>포획한 음식은 평균 점수에서 제외돼요.</li>
                  </ul>
                  <p
                    class="ai-voice-disclosure"
                    data-testid="ai-voice-disclosure"
                  >이 게임의 일부 음식 나레이션은 Microsoft Azure AI Speech로 생성한 AI 합성 음성입니다. 실제 인물의 녹음이나 성대모사가 아닙니다.</p>
                </div>
              </details>
            `
        }

        <details
          class="join-card friend-join"
          data-testid="friend-join"
          ${isInviteMode ? 'open' : ''}
        >
          <summary>${isInviteMode ? '초대받은 방 참가' : '친구 방 참가'}</summary>
          <div
            class="friend-join-content"
            data-testid="friend-join-content"
          >
            <div>
            <p class="section-kicker">
              ${isInviteMode ? 'ROOM INVITATION' : '친구 방 참가'}
            </p>
            <h2 id="join-title">
              ${isInviteMode ? '초대받은 방을 확인해 주세요' : '8자리 코드를 입력하세요'}
            </h2>
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
              ${isInviteMode ? 'readonly' : ''}
            />
            <button
              class="button button-secondary"
              type="button"
              data-testid="join-room"
            >
              ${isInviteMode ? '이 방에 참가' : '참가'}
            </button>
          </div>
          <button
            class="button button-ghost scan-button"
            type="button"
            data-testid="scan-qr"
          >
            앱에서 QR 스캔
          </button>
          ${
            isInviteMode
              ? `
                <button
                  class="button button-ghost invite-cancel-button"
                  type="button"
                  data-testid="cancel-invite"
                >다른 방 찾기</button>
              `
              : ''
            }
          </div>
        </details>

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
    elements.nickname.value = this.readStoredNickname()
    elements.roomCode.value = invitedRoomCode ?? ''

    this.query<HTMLButtonElement>('[data-testid="sound-toggle"]').addEventListener(
      'click',
      () => {
        const enabled = !this.sensoryFeedback.soundEnabled
        this.sensoryFeedback.setSoundEnabled(enabled)
        this.updateHomeFeedbackControls()
        if (enabled) {
          void this.sensoryFeedback.unlock().then((unlocked) => {
            if (unlocked) {
              this.sensoryFeedback.trigger('ui-confirm')
            }
          })
        }
      },
    )
    this.query<HTMLButtonElement>(
      '[data-testid="narration-toggle"]',
    ).addEventListener('click', () => {
      this.setNarrationEnabled(!this.narrationPreference.requestedEnabled)
    })
    this.query<HTMLButtonElement>(
      '[data-testid="haptics-toggle"]',
    ).addEventListener('click', () => {
      this.sensoryFeedback.setHapticsEnabled(
        !this.sensoryFeedback.hapticsEnabled,
      )
      this.updateHomeFeedbackControls()
    })

    this.query<HTMLButtonElement>('[data-testid="solo-start"]').addEventListener(
      'click',
      () => {
        void this.startSoloGame(elements)
      },
    )

    this.query<HTMLButtonElement>(
      '[data-testid="tutorial-start"]',
    ).addEventListener('click', () => {
      void this.startTutorial(elements)
    })

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
      elements.nickname.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') {
          return
        }
        event.preventDefault()
        void this.joinRoom(elements)
      })

      this.query<HTMLButtonElement>(
        '[data-testid="cancel-invite"]',
      ).addEventListener('click', () => {
        const url = new URL(window.location.href)
        url.searchParams.delete('room')
        window.history.replaceState({}, '', url)
        this.markSplashEntered()
        this.renderHome()
      })

      const savedNickname = elements.nickname.value
      if (savedNickname) {
        elements.status.textContent =
          `${savedNickname}님으로 초대받은 방에 입장하고 있어요…`
        queueMicrotask(() => {
          if (
            this.viewGeneration !== homeGeneration ||
            this.homeActionPending
          ) {
            return
          }
          void this.joinRoom(elements)
        })
        return
      }

      elements.status.textContent =
        '닉네임을 한 번 입력하면 다음 QR부터 바로 입장합니다.'
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

  private async startSoloGame(elements: HomeElements): Promise<void> {
    if (this.homeActionPending) {
      return
    }

    const action = Symbol('solo-game')
    const generation = this.viewGeneration
    const mealTime = this.readMealTime()
    const previousPersonalBest = this.personalBestStore.read({
      mode: 'solo',
      mealTime,
      contentVersion: CONTENT_VERSION,
    })
    const options: GameLaunchOptions = {
      mode: 'solo',
      mealTime,
      deckSeed: createDeckSeed('solo'),
      ...(previousPersonalBest
        ? { previousPersonalBestScore: previousPersonalBest.score }
        : {}),
    }
    this.homeActionPending = true
    this.activeHomeAction = action
    this.setHomeActionsDisabled(true)
    elements.status.textContent = '이번 판의 메뉴를 준비하고 있어요…'

    try {
      await this.prepareAndStartGame(
        options,
        () => this.isCurrentHomeAction(action, generation),
      )
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
        const resultState =
          await this.roomGateway.readAuthoritativeResultState(roomCode)
        if (!this.isCurrentHomeAction(action, generation)) {
          return
        }
        await this.resumeStartedRoom(existingRoom, resultState)
        return
      }
      if (existingRoom?.status === 'preparing') {
        this.assertCanResumePreparingRoom(existingRoom)
        await this.renderLobby(existingRoom)
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
        if (latestRoom?.status === 'preparing') {
          this.assertCanResumePreparingRoom(latestRoom)
          await this.renderLobby(latestRoom)
          return
        }
        if (latestRoom?.status !== 'started') {
          throw joinError
        }
        this.assertCanResumeStartedRoom(latestRoom)

        const resultState =
          await this.roomGateway.readAuthoritativeResultState(roomCode)
        if (!this.isCurrentHomeAction(action, generation)) {
          return
        }
        await this.resumeStartedRoom(latestRoom, resultState)
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

  private async renderLobby(
    initialRoom: WaitingRoom | PreparingRoom,
  ): Promise<void> {
    this.assertLobbyRoomIdentity(initialRoom, initialRoom.code)
    this.cleanupRoomFlow()
    const generation = ++this.viewGeneration
    this.currentRoom = initialRoom
    this.roomSyncPhase = 'live'
    this.roomSyncLastEventAt = Date.now()
    this.roomSyncRetryCount = 0
    this.roomSyncErrorCode = null
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
          <div class="qr-frame" data-testid="room-qr-frame" data-state="loading">
            <img data-testid="room-qr" alt="방 초대 QR 코드" hidden />
            <span data-testid="room-qr-status">QR 준비 중</span>
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
            class="button button-ghost lobby-sync-retry"
            type="button"
            data-testid="retry-room-sync"
            hidden
          >다시 동기화</button>
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
    this.query<HTMLElement>('[data-testid="room-code"]').textContent =
      initialRoom.code

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
    this.query<HTMLButtonElement>(
      '[data-testid="retry-room-sync"]',
    ).addEventListener('click', () => {
      if (!this.isActiveLobby(initialRoom.code, generation)) {
        return
      }
      this.roomSyncRetryCount = 0
      this.roomSyncErrorCode = null
      this.requestLobbyRefresh(initialRoom.code, generation, 'manual')
    })

    this.updateLobby(initialRoom)
    this.setupLobbyRecoveryTriggers(initialRoom.code, generation)
    void this.startLobbySubscription(initialRoom.code, generation, true)
    void this.renderLobbyQr(inviteUrl, initialRoom.code, generation)
  }

  private async renderLobbyQr(
    inviteUrl: string,
    roomCode: string,
    generation: number,
  ): Promise<void> {
    try {
      const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
        width: 220,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#101821',
          light: '#fff8e7',
        },
      })
      if (!this.isActiveLobby(roomCode, generation)) {
        return
      }

      const qrImage = this.screenRoot.querySelector<HTMLImageElement>(
        '[data-testid="room-qr"]',
      )
      const qrStatus = this.screenRoot.querySelector<HTMLElement>(
        '[data-testid="room-qr-status"]',
      )
      const qrFrame = this.screenRoot.querySelector<HTMLElement>(
        '[data-testid="room-qr-frame"]',
      )
      if (!qrImage || !qrStatus || !qrFrame) {
        return
      }

      qrImage.src = qrDataUrl
      qrImage.hidden = false
      qrStatus.hidden = true
      qrFrame.dataset.state = 'ready'
    } catch {
      if (!this.isActiveLobby(roomCode, generation)) {
        return
      }

      const qrStatus = this.screenRoot.querySelector<HTMLElement>(
        '[data-testid="room-qr-status"]',
      )
      const qrFrame = this.screenRoot.querySelector<HTMLElement>(
        '[data-testid="room-qr-frame"]',
      )
      if (qrStatus && qrFrame) {
        qrStatus.textContent = 'QR을 만들지 못했어요. 링크나 방 코드를 사용하세요.'
        qrFrame.dataset.state = 'error'
      }
      this.logRoomSync('qr-generation-failed', roomCode)
    }
  }

  private async startLobbySubscription(
    roomCode: string,
    generation: number,
    serverStateConfirmed = false,
  ): Promise<void> {
    if (!this.isActiveLobby(roomCode, generation)) {
      return
    }

    this.dropRoomSubscription()
    const connectionToken = this.roomSyncConnectionToken
    if (!serverStateConfirmed) {
      this.roomSyncPhase = 'connecting'
      this.roomSyncErrorCode = null
      this.renderLobbySyncUi()
    }
    this.armLobbySyncWatchdog(roomCode, generation, connectionToken)
    this.logRoomSync('subscription-started', roomCode)

    try {
      const unsubscribe = await this.roomGateway.subscribe(
        roomCode,
        (room) => {
          this.handleLobbySnapshot(
            room,
            roomCode,
            generation,
            connectionToken,
          )
        },
        () => {
          this.handleLobbySubscriptionFailure(
            roomCode,
            generation,
            connectionToken,
            'SYNC-002',
          )
        },
        (metadata) => {
          this.handleLobbySnapshotMetadata(
            metadata,
            roomCode,
            generation,
            connectionToken,
          )
        },
      )
      if (
        !this.isActiveLobby(roomCode, generation) ||
        connectionToken !== this.roomSyncConnectionToken
      ) {
        unsubscribe()
        return
      }
      this.unsubscribeRoom = unsubscribe
    } catch {
      this.handleLobbySubscriptionFailure(
        roomCode,
        generation,
        connectionToken,
        'SYNC-002',
      )
    }
  }

  private handleLobbySnapshotMetadata(
    metadata: Readonly<RoomSnapshotMetadata>,
    roomCode: string,
    generation: number,
    connectionToken: number,
  ): void {
    if (
      !this.isActiveLobby(roomCode, generation) ||
      connectionToken !== this.roomSyncConnectionToken ||
      metadata.hasPendingWrites ||
      !metadata.fromCache
    ) {
      return
    }

    this.logRoomSync('cache-snapshot-observed', roomCode)
    if (this.roomSyncServerConnectionToken !== connectionToken) {
      return
    }

    this.roomSyncNeedsReconnect = true
    this.roomSyncPhase = 'recovering'
    this.roomSyncErrorCode = 'SYNC-007'
    this.renderLobbySyncUi()
    this.requestLobbyRefresh(roomCode, generation, 'cache')
  }

  private handleLobbySnapshot(
    room: Room | null,
    roomCode: string,
    generation: number,
    connectionToken: number,
  ): void {
    if (
      !this.isActiveLobby(roomCode, generation) ||
      connectionToken !== this.roomSyncConnectionToken
    ) {
      return
    }
    if (!room) {
      this.scheduleLobbyRecovery(roomCode, generation, 'SYNC-003')
      return
    }

    try {
      this.assertLobbyRoomIdentity(room, roomCode)
    } catch {
      this.scheduleLobbyRecovery(roomCode, generation, 'SYNC-004')
      return
    }
    if (!this.shouldAcceptRoomSnapshot(room)) {
      this.logRoomSync('stale-snapshot-ignored', roomCode, room)
      return
    }

    this.clearRoomSyncWatchdog()
    this.clearRoomSyncRetryTimeout()
    this.roomSyncServerConnectionToken = connectionToken
    this.roomSyncNeedsReconnect = false
    this.roomSyncPhase = 'live'
    this.roomSyncLastEventAt = Date.now()
    this.roomSyncRetryCount = 0
    this.roomSyncErrorCode = null
    this.logRoomSync('server-snapshot-accepted', roomCode, room)
    this.updateLobby(room)
  }

  private handleLobbySubscriptionFailure(
    roomCode: string,
    generation: number,
    connectionToken: number,
    errorCode: string,
  ): void {
    if (
      !this.isActiveLobby(roomCode, generation) ||
      connectionToken !== this.roomSyncConnectionToken
    ) {
      return
    }
    this.scheduleLobbyRecovery(roomCode, generation, errorCode)
  }

  private armLobbySyncWatchdog(
    roomCode: string,
    generation: number,
    connectionToken: number,
  ): void {
    this.clearRoomSyncWatchdog()
    this.roomSyncWatchdogTimeout = window.setTimeout(() => {
      this.roomSyncWatchdogTimeout = null
      this.handleLobbySubscriptionFailure(
        roomCode,
        generation,
        connectionToken,
        'SYNC-001',
      )
    }, ROOM_SYNC_WATCHDOG_MS)
  }

  private scheduleLobbyRecovery(
    roomCode: string,
    generation: number,
    errorCode: string,
  ): void {
    if (!this.isActiveLobby(roomCode, generation)) {
      return
    }

    this.clearLobbyReconciliation()
    this.dropRoomSubscription()
    this.clearRoomSyncRetryTimeout()
    if (this.roomSyncRetryCount >= ROOM_SYNC_RETRY_DELAYS_MS.length) {
      this.roomSyncPhase = 'failed'
      this.roomSyncErrorCode = errorCode
      this.renderLobbySyncUi()
      this.logRoomSync('recovery-exhausted', roomCode)
      const room = this.currentRoom
      if (room && room.status !== 'started') {
        this.scheduleLobbyReconciliation(
          room,
          ROOM_SYNC_DEGRADED_RECONCILIATION_INTERVAL_MS,
        )
      }
      return
    }

    const delay = ROOM_SYNC_RETRY_DELAYS_MS[this.roomSyncRetryCount]!
    this.roomSyncRetryCount += 1
    this.roomSyncPhase = 'recovering'
    this.roomSyncErrorCode = errorCode
    this.renderLobbySyncUi()
    this.logRoomSync('recovery-scheduled', roomCode)
    this.roomSyncRetryTimeout = window.setTimeout(() => {
      this.roomSyncRetryTimeout = null
      this.requestLobbyRefresh(roomCode, generation, 'retry')
    }, delay)
  }

  private requestLobbyRefresh(
    roomCode: string,
    generation: number,
    reason: LobbyRefreshReason,
  ): void {
    if (
      !this.isActiveLobby(roomCode, generation) ||
      this.roomSyncRefreshTask
    ) {
      return
    }

    const task = this.performLobbyRefresh(roomCode, generation, reason)
    this.roomSyncRefreshTask = task
    void task.finally(() => {
      if (this.roomSyncRefreshTask === task) {
        this.roomSyncRefreshTask = null
      }
    })
  }

  private async performLobbyRefresh(
    roomCode: string,
    generation: number,
    reason: LobbyRefreshReason,
  ): Promise<void> {
    if (!this.isActiveLobby(roomCode, generation)) {
      return
    }

    this.clearLobbyReconciliation()
    this.clearRoomSyncRetryTimeout()
    if (reason !== 'reconcile' && reason !== 'cache') {
      this.roomSyncPhase = 'connecting'
      this.roomSyncErrorCode = null
      this.renderLobbySyncUi()
    }
    if (reason !== 'reconcile') {
      this.logRoomSync(`refresh-${reason}`, roomCode)
    }

    try {
      const room = await this.readLobbyRoomWithDeadline(roomCode)
      if (!this.isActiveLobby(roomCode, generation)) {
        return
      }
      if (!room) {
        this.scheduleLobbyRecovery(roomCode, generation, 'SYNC-003')
        return
      }
      this.assertLobbyRoomIdentity(room, roomCode)
      if (!this.shouldAcceptRoomSnapshot(room)) {
        this.logRoomSync('stale-refresh-ignored', roomCode, room)
        const currentRoom = this.currentRoom
        if (currentRoom && currentRoom.status !== 'started') {
          this.scheduleLobbyReconciliation(currentRoom)
        }
        return
      }

      this.clearRoomSyncRetryTimeout()
      this.roomSyncPhase = 'live'
      this.roomSyncLastEventAt = Date.now()
      this.roomSyncRetryCount = 0
      this.roomSyncErrorCode = null
      if (reason !== 'reconcile' || room.status === 'started') {
        this.logRoomSync('refresh-accepted', roomCode, room)
      }
      this.updateLobby(room)
      if (
        room.status !== 'started' &&
        (reason !== 'reconcile' ||
          this.roomSyncNeedsReconnect ||
          this.unsubscribeRoom === null ||
          this.roomSyncServerConnectionToken === null)
      ) {
        void this.startLobbySubscription(roomCode, generation, true)
      }
    } catch {
      if (this.isActiveLobby(roomCode, generation)) {
        if (reason === 'reconcile' || reason === 'cache') {
          this.handleLobbyReconciliationFailure(
            roomCode,
            generation,
            reason,
          )
        } else {
          this.scheduleLobbyRecovery(roomCode, generation, 'SYNC-005')
        }
      }
    }
  }

  private handleLobbyReconciliationFailure(
    roomCode: string,
    generation: number,
    reason: 'reconcile' | 'cache',
  ): void {
    if (!this.isActiveLobby(roomCode, generation)) {
      return
    }

    if (reason === 'cache') {
      this.roomSyncNeedsReconnect = true
    }
    this.roomSyncRetryCount = Math.min(
      this.roomSyncRetryCount + 1,
      ROOM_SYNC_RETRY_DELAYS_MS.length,
    )
    const exhausted =
      this.roomSyncRetryCount >= ROOM_SYNC_RETRY_DELAYS_MS.length
    this.roomSyncPhase = exhausted ? 'failed' : 'recovering'
    this.roomSyncErrorCode = 'SYNC-005'
    this.renderLobbySyncUi()
    this.logRoomSync('reconciliation-failed', roomCode)

    const room = this.currentRoom
    if (!room || room.status === 'started') {
      return
    }
    const delay = exhausted
      ? ROOM_SYNC_DEGRADED_RECONCILIATION_INTERVAL_MS
      : ROOM_SYNC_RETRY_DELAYS_MS[this.roomSyncRetryCount - 1]!
    this.scheduleLobbyReconciliation(room, delay)
  }

  private readLobbyRoomWithDeadline(roomCode: string): Promise<Room | null> {
    return new Promise((resolve, reject) => {
      let settled = false
      const timeout = window.setTimeout(() => {
        if (settled) {
          return
        }
        settled = true
        reject(new Error('Room server read timed out.'))
      }, ROOM_SYNC_SERVER_READ_TIMEOUT_MS)

      void this.roomGateway.get(roomCode).then(
        (room) => {
          if (settled) {
            return
          }
          settled = true
          window.clearTimeout(timeout)
          resolve(room)
        },
        (error: unknown) => {
          if (settled) {
            return
          }
          settled = true
          window.clearTimeout(timeout)
          reject(error)
        },
      )
    })
  }

  private scheduleLobbyReconciliation(
    room: WaitingRoom | PreparingRoom,
    delay = room.status === 'waiting' && room.players.length < 2
      ? ROOM_SYNC_SINGLE_PLAYER_RECONCILIATION_INTERVAL_MS
      : ROOM_SYNC_RECONCILIATION_INTERVAL_MS,
  ): void {
    this.clearLobbyReconciliation()
    const generation = this.viewGeneration
    if (!this.isActiveLobby(room.code, generation)) {
      return
    }

    this.roomSyncReconciliationTimeout = window.setTimeout(() => {
      this.roomSyncReconciliationTimeout = null
      if (!this.isActiveLobby(room.code, generation)) {
        return
      }
      this.requestLobbyRefresh(room.code, generation, 'reconcile')
    }, delay)
  }

  private setupLobbyRecoveryTriggers(
    roomCode: string,
    generation: number,
  ): void {
    this.cleanupLobbyRecoveryTriggers()
    const requestForegroundRefresh = (): void => {
      if (this.roomSyncPhase === 'failed') {
        this.roomSyncRetryCount = 0
      }
      this.requestLobbyRefresh(roomCode, generation, 'visible')
    }
    this.lobbyVisibilityHandler = () => {
      if (document.visibilityState !== 'visible') {
        return
      }
      requestForegroundRefresh()
    }
    this.lobbyOnlineHandler = () => {
      if (this.roomSyncPhase === 'failed') {
        this.roomSyncRetryCount = 0
      }
      this.requestLobbyRefresh(roomCode, generation, 'online')
    }
    this.lobbyFocusHandler = requestForegroundRefresh
    this.lobbyPageShowHandler = requestForegroundRefresh
    document.addEventListener('visibilitychange', this.lobbyVisibilityHandler)
    window.addEventListener('online', this.lobbyOnlineHandler)
    window.addEventListener('focus', this.lobbyFocusHandler)
    window.addEventListener('pageshow', this.lobbyPageShowHandler)
  }

  private updateLobby(room: Room): boolean {
    if (!this.shouldAcceptRoomSnapshot(room)) {
      this.logRoomSync('state-regression-ignored', room.code, room)
      return false
    }
    if (
      room.status !== 'started' &&
      !this.screenRoot.querySelector('.lobby-screen')
    ) {
      return false
    }

    this.currentRoom = room
    if (room.status === 'started') {
      this.scheduleRoomGame(room)
      return true
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

    this.renderLobbySyncUi()
    this.scheduleLobbyReconciliation(room)
    if (room.status === 'preparing') {
      void this.prepareCurrentRoom(room)
    }
    return true
  }

  private renderLobbySyncUi(): void {
    const room = this.currentRoom
    if (!room || room.status === 'started') {
      return
    }

    const startButton = this.screenRoot.querySelector<HTMLButtonElement>(
      '[data-testid="start-room"]',
    )
    const lobbyStatus = this.screenRoot.querySelector<HTMLElement>(
      '[data-testid="lobby-status"]',
    )
    const retryButton = this.screenRoot.querySelector<HTMLButtonElement>(
      '[data-testid="retry-room-sync"]',
    )
    if (!startButton || !lobbyStatus || !retryButton) {
      return
    }

    const isHost = room.hostPlayerId === this.playerId
    const leaveButton = this.screenRoot.querySelector<HTMLButtonElement>(
      '[data-testid="leave-room"]',
    )
    if (leaveButton) {
      const ownReady =
        room.status === 'preparing' &&
        room.start.readyPlayerIds.includes(this.playerId)
      const leaveWouldAbandonReadyStart =
        room.status === 'preparing' &&
        (ownReady || this.roomReadyAckPending || this.roomFinalizePending)
      leaveButton.disabled = leaveWouldAbandonReadyStart
      leaveButton.title = leaveWouldAbandonReadyStart
        ? '기기 준비가 확정돼 공통 시작을 기다리고 있어요.'
        : room.status === 'preparing'
          ? '준비 확인 전에는 홈으로 나갈 수 있어요.'
          : ''
    }
    startButton.hidden = !isHost
    if (room.status === 'preparing') {
      startButton.disabled = true
      startButton.textContent =
        `준비 ${room.start.readyPlayerIds.length}/${room.start.roster.length}`
    } else {
      startButton.disabled =
        this.roomStartPending ||
        this.roomSyncPhase !== 'live' ||
        !canStartRoom(room, this.playerId)
      startButton.textContent = this.roomStartPending
        ? '게임을 준비하고 있어요'
        : canStartRoom(room, this.playerId)
          ? `${room.players.length}명으로 시작`
          : '2명부터 시작할 수 있어요'
    }

    let message: string
    switch (this.roomSyncPhase) {
      case 'live':
        if (room.status === 'preparing') {
          const readyCount = room.start.readyPlayerIds.length
          const totalCount = room.start.roster.length
          const ownReady = room.start.readyPlayerIds.includes(this.playerId)
          const allReady = readyCount === totalCount
          message = allReady
            ? isHost
              ? '모두 준비 완료 · 공통 시작 시간을 맞추고 있어요.'
              : '모두 준비 완료 · 방장이 시작 시간을 맞추고 있어요.'
            : ownReady
              ? `내 준비 완료 · 다른 기기를 기다리는 중 (${readyCount}/${totalCount})`
              : `메뉴 이미지와 게임을 준비하는 중 (${readyCount}/${totalCount})`
        } else {
          message = isHost
            ? '시작하면 모든 기기의 준비를 확인한 뒤 함께 출발해요.'
            : '방장이 시작하면 기기 준비 후 자동으로 카운트다운이 시작됩니다.'
        }
        break
      case 'recovering':
        message = `방 연결을 다시 확인하고 있어요 (${this.roomSyncRetryCount}/${ROOM_SYNC_RETRY_DELAYS_MS.length}).`
        break
      case 'failed':
        message = `[${this.roomSyncErrorCode ?? 'SYNC-000'}] 방 연결을 확인하지 못했어요. 다시 동기화해 주세요.`
        break
      case 'idle':
      case 'connecting':
        message = '방 동기화 확인 중...'
        break
    }

    if (lobbyStatus.textContent !== message) {
      lobbyStatus.textContent = message
    }
    lobbyStatus.dataset.syncPhase = this.roomSyncPhase
    retryButton.hidden = this.roomSyncPhase !== 'failed'
  }

  private shouldAcceptRoomSnapshot(room: Room): boolean {
    const currentRoom = this.currentRoom
    if (!currentRoom || currentRoom.code !== room.code) {
      return true
    }
    if (
      currentRoom.status === 'started' &&
      room.status !== 'started'
    ) {
      return false
    }
    if (currentRoom.status === 'preparing' && room.status === 'waiting') {
      return false
    }
    if (
      currentRoom.status !== 'waiting' &&
      room.status !== 'waiting' &&
      currentRoom.start.startId !== room.start.startId
    ) {
      this.roomSyncErrorCode = 'SYNC-006'
      this.logRoomSync('conflicting-start-ignored', room.code, room)
      return false
    }
    if (
      currentRoom.status === 'preparing' &&
      room.status === 'preparing' &&
      currentRoom.start.readyPlayerIds.some(
        (playerId) => !room.start.readyPlayerIds.includes(playerId),
      )
    ) {
      const ownReadyWasLost =
        currentRoom.start.readyPlayerIds.includes(this.playerId) &&
        !room.start.readyPlayerIds.includes(this.playerId)
      if (ownReadyWasLost) {
        this.roomReadyAckKey = null
        this.logRoomSync('own-ready-regression-repair', room.code, room)
        return true
      }
      return false
    }
    if (
      currentRoom.status === 'started' &&
      room.status === 'started' &&
      !sameRoomStart(currentRoom, room)
    ) {
      this.roomSyncErrorCode = 'SYNC-006'
      this.logRoomSync('conflicting-start-ignored', room.code, room)
      return false
    }
    return true
  }

  private assertLobbyRoomIdentity(room: Room, expectedCode: string): void {
    if (room.code !== normalizeRoomCode(expectedCode)) {
      throw new Error('방 코드가 현재 초대와 일치하지 않습니다.')
    }
    const host = room.players.find(
      (player) => player.playerId === room.hostPlayerId,
    )
    if (!host || host.role !== 'host') {
      throw new Error('방장 정보가 올바르지 않습니다.')
    }
    if (!room.players.some((player) => player.playerId === this.playerId)) {
      throw new Error('현재 참가자 정보가 방 명단에 없습니다.')
    }
    if (
      room.status !== 'waiting' &&
      (!room.start.roster.some(
        (player) => player.playerId === this.playerId,
      ) ||
        !room.start.roster.some(
          (player) => player.playerId === room.hostPlayerId,
        ))
    ) {
      throw new Error('잠긴 게임 명단이 방 참가자 정보와 일치하지 않습니다.')
    }
  }

  private isActiveLobby(roomCode: string, generation: number): boolean {
    return (
      generation === this.viewGeneration &&
      this.currentRoom?.code === roomCode &&
      this.currentRoom.status !== 'started' &&
      this.screenRoot.querySelector('.lobby-screen') !== null
    )
  }

  private logRoomSync(
    event: string,
    roomCode: string,
    room: Room | null = this.currentRoom,
  ): void {
    console.info('[room-sync]', {
      event,
      roomCode,
      phase: this.roomSyncPhase,
      roomStatus: room?.status ?? null,
      playerCount: room?.players.length ?? null,
      retryCount: this.roomSyncRetryCount,
      errorCode: this.roomSyncErrorCode,
      at: new Date().toISOString(),
    })
  }

  private async startCurrentRoom(): Promise<void> {
    const room = this.currentRoom
    if (
      !room ||
      room.status !== 'waiting' ||
      this.roomStartPending ||
      this.roomSyncPhase !== 'live'
    ) {
      return
    }

    const generation = this.viewGeneration
    let startError: string | null = null
    this.roomStartPending = true
    this.renderLobbySyncUi()
    try {
      const preparedRoom = await this.roomGateway.prepareStart(room.code, {
        requesterPlayerId: this.playerId,
        startId: createRandomUuid(),
        deckSeed: createDeckSeed(room.code),
        contentVersion: CONTENT_VERSION,
      })
      if (
        generation !== this.viewGeneration ||
        this.currentRoom?.code !== room.code
      ) {
        return
      }
      this.assertLobbyRoomIdentity(preparedRoom, room.code)
      if (!this.shouldAcceptRoomSnapshot(preparedRoom)) {
        return
      }

      this.roomSyncPhase = 'live'
      this.roomSyncLastEventAt = Date.now()
      this.roomSyncErrorCode = null
      this.logRoomSync('prepare-response-accepted', room.code, preparedRoom)
      this.updateLobby(preparedRoom)
    } catch (error) {
      startError = toUserMessage(error)
    } finally {
      if (this.isActiveLobby(room.code, generation)) {
        this.roomStartPending = false
        this.renderLobbySyncUi()
        if (startError) {
          this.showLobbyError(startError)
        }
      }
    }
  }

  private async startTutorial(elements: HomeElements): Promise<void> {
    if (this.homeActionPending) {
      return
    }

    const action = Symbol('tutorial')
    const generation = this.viewGeneration
    const options: GameLaunchOptions = {
      mode: 'solo',
      launchMode: 'tutorial',
      mealTime: this.readMealTime(),
      deckSeed: createDeckSeed('tutorial'),
    }
    this.homeActionPending = true
    this.activeHomeAction = action
    this.setHomeActionsDisabled(true)
    elements.status.textContent = '베기와 포획 연습을 준비하고 있어요.'

    try {
      await this.prepareAndStartGame(
        options,
        () => this.isCurrentHomeAction(action, generation),
      )
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

  private async prepareCurrentRoom(room: PreparingRoom): Promise<void> {
    if (room.start.contentVersion !== CONTENT_VERSION) {
      this.showLobbyError(
        '게임 콘텐츠 버전이 달라 준비할 수 없습니다. 새로고침해 주세요.',
      )
      return
    }
    if (
      !room.start.roster.some(
        (player) => player.playerId === this.playerId,
      )
    ) {
      this.showLobbyError('잠긴 참가자 명단에 현재 기기가 없습니다.')
      return
    }

    const preparationKey = createRoomPreparationKey(room)
    if (this.roomPreparationKey !== preparationKey) {
      this.roomPreparationKey = preparationKey
      this.roomReadyAckKey = null
      this.roomFinalizeKey = null
      this.roomReadyAckPending = false
      this.roomFinalizePending = false
      this.roomPreparationTask = this.gameHost.prepare(
        this.createRoomPreparationLaunchOptions(room),
      )
      this.logRoomSync('device-prepare-started', room.code, room)
    }

    const preparationTask = this.roomPreparationTask
    if (!preparationTask) {
      return
    }

    try {
      await preparationTask
    } catch (error) {
      if (this.isCurrentRoomPreparation(room.code, preparationKey)) {
        this.showLobbyError(`게임 준비 실패: ${toUserMessage(error)}`)
      }
      return
    }
    if (!this.isCurrentRoomPreparation(room.code, preparationKey)) {
      return
    }

    this.logRoomSync('device-prepare-complete', room.code, room)
    const latestRoom = this.currentRoom
    if (
      !latestRoom ||
      latestRoom.status !== 'preparing' ||
      latestRoom.start.startId !== room.start.startId
    ) {
      return
    }
    if (latestRoom.start.readyPlayerIds.includes(this.playerId)) {
      this.roomReadyAckKey = preparationKey
      this.renderLobbySyncUi()
      void this.finalizePreparedRoomIfHost(latestRoom)
      return
    }
    if (
      this.roomReadyAckPending ||
      this.roomReadyAckKey === preparationKey
    ) {
      return
    }

    const generation = this.viewGeneration
    this.roomReadyAckPending = true
    this.renderLobbySyncUi()
    try {
      const readyRoom = await this.roomGateway.acknowledgeReady(room.code, {
        playerId: this.playerId,
        startId: room.start.startId,
      })
      if (
        generation !== this.viewGeneration ||
        this.currentRoom?.code !== room.code
      ) {
        return
      }
      this.roomReadyAckKey = preparationKey
      this.assertLobbyRoomIdentity(readyRoom, room.code)
      if (this.shouldAcceptRoomSnapshot(readyRoom)) {
        this.logRoomSync('ready-response-accepted', room.code, readyRoom)
        this.updateLobby(readyRoom)
      }
    } catch (error) {
      if (this.isCurrentRoomPreparation(room.code, preparationKey)) {
        this.showLobbyError(`기기 준비 확인 실패: ${toUserMessage(error)}`)
      }
    } finally {
      this.roomReadyAckPending = false
      if (this.isCurrentRoomPreparation(room.code, preparationKey)) {
        this.renderLobbySyncUi()
      }
    }
  }

  private async finalizePreparedRoomIfHost(
    room: PreparingRoom,
  ): Promise<void> {
    if (
      room.hostPlayerId !== this.playerId ||
      room.start.readyPlayerIds.length !== room.start.roster.length ||
      room.start.roster.some(
        (player) => !room.start.readyPlayerIds.includes(player.playerId),
      )
    ) {
      return
    }

    const preparationKey = createRoomPreparationKey(room)
    if (
      this.roomFinalizePending ||
      this.roomFinalizeKey === preparationKey ||
      !this.isCurrentRoomPreparation(room.code, preparationKey)
    ) {
      return
    }

    const generation = this.viewGeneration
    this.roomFinalizePending = true
    this.renderLobbySyncUi()
    try {
      const startedRoom = await this.roomGateway.finalizeStart(room.code, {
        requesterPlayerId: this.playerId,
        startId: room.start.startId,
        startAt: Date.now() + ROOM_COUNTDOWN_MS,
      })
      if (
        generation !== this.viewGeneration ||
        this.currentRoom?.code !== room.code
      ) {
        return
      }
      this.roomFinalizeKey = preparationKey
      this.assertLobbyRoomIdentity(startedRoom, room.code)
      if (this.shouldAcceptRoomSnapshot(startedRoom)) {
        this.logRoomSync('finalize-response-accepted', room.code, startedRoom)
        this.updateLobby(startedRoom)
      }
    } catch (error) {
      if (this.isCurrentRoomPreparation(room.code, preparationKey)) {
        this.showLobbyError(`공통 시작 시간 확정 실패: ${toUserMessage(error)}`)
      }
    } finally {
      this.roomFinalizePending = false
      if (this.isCurrentRoomPreparation(room.code, preparationKey)) {
        this.renderLobbySyncUi()
      }
    }
  }

  private isCurrentRoomPreparation(
    roomCode: string,
    preparationKey: string,
  ): boolean {
    return (
      this.isActiveLobby(roomCode, this.viewGeneration) &&
      this.currentRoom?.status === 'preparing' &&
      createRoomPreparationKey(this.currentRoom) === preparationKey
    )
  }

  private scheduleRoomGame(room: StartedRoom): void {
    if (room.start.contentVersion !== CONTENT_VERSION) {
      this.cleanupLobbySync()
      this.showLobbyError(
        '게임 콘텐츠 버전이 달라 시작할 수 없습니다. 새로고침해 주세요.',
      )
      return
    }

    const scheduleKey = createRoomPreparationKey(room)
    if (this.scheduledRoomKey === scheduleKey) {
      return
    }
    this.scheduledRoomKey = scheduleKey
    const generation = this.viewGeneration
    const launchOptions = this.createRoomGameLaunchOptions(room)
    const preparationTask =
      this.roomPreparationKey === scheduleKey && this.roomPreparationTask
        ? this.roomPreparationTask
        : this.gameHost.prepare(launchOptions)
    this.cleanupLobbySync()

    this.screenRoot.innerHTML = `
      <div class="app-screen countdown-screen">
        <p class="eyebrow">ROOM ${room.code}</p>
        <p>명단이 잠겼습니다</p>
        <strong
          data-testid="countdown"
          role="timer"
          aria-live="polite"
          aria-label="게임 시작까지 남은 시간"
        >4</strong>
        <span class="countdown-controls">
          <b>드래그</b>해서 베기 · <b>0.3초 꾹</b> 눌러 포획
        </span>
        <span>모두 같은 메뉴로 시작합니다</span>
      </div>
    `

    const countdown = this.query<HTMLElement>(
      '[data-testid="countdown"]',
    )
    let previousCountdownValue: number | null = null
    const updateCountdown = () => {
      const remaining = Math.max(0, room.start.startAt - Date.now())
      const nextValue = Math.max(1, Math.ceil(remaining / 1_000))
      countdown.textContent = String(nextValue)
      if (nextValue !== previousCountdownValue) {
        previousCountdownValue = nextValue
        this.sensoryFeedback.trigger('countdown', ROOM_COUNTDOWN_SOUND_SCALE)
      }
    }
    updateCountdown()
    this.countdownInterval = window.setInterval(updateCountdown, 100)

    const delay = Math.max(0, room.start.startAt - Date.now())
    this.gameStartTimeout = window.setTimeout(() => {
      void this.prepareAndStartGame(
        launchOptions,
        () => {
          const currentRoom = this.currentRoom
          return Boolean(
            generation === this.viewGeneration &&
              currentRoom &&
              currentRoom.status === 'started' &&
              sameRoomStart(currentRoom, room),
          )
        },
        preparationTask,
      ).then((started) => {
        if (!started) {
          return
        }
        this.sensoryFeedback.trigger('start', ROOM_EVENT_SOUND_SCALE)
        this.scheduleRoomResultDeadline(room)
      })
    }, delay)
  }

  private async prepareAndStartGame(
    options: GameLaunchOptions,
    canStart: () => boolean = () => true,
    preparationTask: Promise<void> = this.gameHost.prepare(options),
  ): Promise<boolean> {
    const generation = this.viewGeneration
    await preparationTask
    if (generation !== this.viewGeneration || !canStart()) {
      return false
    }

    this.startGame(options)
    return true
  }

  private startGame(options: GameLaunchOptions): void {
    this.clearSplashTransition()
    this.gameProgressStore.clearForPlayerExcept(
      this.playerId,
      options.progressIdentity ?? null,
    )
    this.viewGeneration += 1
    this.cleanupLobbySync()
    this.cleanupResultSubscription()
    this.clearRoomResultDeadline()
    this.activeRoomResultFlow = null
    this.clearCountdown()
    this.screenRoot.hidden = true
    this.gameHost.start(options)
  }
  private createRoomGameLaunchOptions(
    room: StartedRoom,
  ): GameLaunchOptions {
    return {
      ...this.createRoomPreparationLaunchOptions(room),
      progressIdentity: this.createRoomProgressIdentity(room),
    }
  }

  private createRoomPreparationLaunchOptions(
    room: PreparingRoom | StartedRoom,
  ): GameLaunchOptions {
    return {
      mode: 'room',
      mealTime: room.mealTime,
      deckSeed: room.start.deckSeed,
      roomCode: room.code,
    }
  }

  private createRoomProgressIdentity(
    room: StartedRoom,
  ): Readonly<RoomGameProgressIdentity> {
    return createRoomGameProgressIdentity(
      this.playerId,
      room.code,
      room.start.startAt,
      room.start.deckSeed,
    )
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

  private assertCanResumePreparingRoom(room: PreparingRoom): void {
    if (room.start.contentVersion !== CONTENT_VERSION) {
      throw new Error(
        '게임 콘텐츠 버전이 달라 준비에 복귀할 수 없습니다. 새로고침해 주세요.',
      )
    }
    if (
      !room.start.roster.some(
        (player) => player.playerId === this.playerId,
      )
    ) {
      throw new Error(
        '이미 준비 중인 방입니다. 잠긴 참가자 명단에 있는 플레이어만 복귀할 수 있습니다.',
      )
    }
  }

  private async resumeStartedRoom(
    room: StartedRoom,
    resultState: Readonly<AuthoritativeRoomResultState>,
  ): Promise<void> {
    this.assertCanResumeStartedRoom(room)

    const roomUrl = new URL(window.location.href)
    roomUrl.searchParams.set('room', room.code)
    window.history.replaceState({}, '', roomUrl)
    this.currentRoom = room

    const ownResult = resultState.results.find(
      (result) => result.playerId === this.playerId,
    )
    if (ownResult) {
      this.personalBestStore.record(
        {
          mode: 'room',
          mealTime: room.mealTime,
          contentVersion: CONTENT_VERSION,
        },
        ownResult.score,
        ownResult.completedAt,
        room.start.deckSeed,
      )
    }
    if (ownResult || resultState.finalization === 'closed') {
      this.gameProgressStore.clear(this.createRoomProgressIdentity(room))
    }
    if (resultState.finalization === 'open' && !ownResult) {
      this.screenRoot.hidden = false
      this.scheduleRoomGame(room)
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
      submission: ownResult ?? null,
      generation,
      results: [],
      submissionPending: false,
      submissionTask: null,
      subscriptionPending: false,
      submissionError: null,
      subscriptionError: null,
      complete: false,
    }
    this.activeRoomResultFlow = flow
    if (resultState.finalization === 'open') {
      this.scheduleRoomResultDeadline(room)
    }
    this.handleRoomResultsSnapshot(
      flow,
      resultState.results,
      resultState.finalization === 'closed',
    )

    if (!flow.complete && this.isActiveResultFlow(flow)) {
      await this.subscribeToRoomResults(flow)
    }
  }

  private async handleGameResult(
    result: Readonly<PlayerGameResult>,
  ): Promise<void> {
    this.personalBestStore.record(
      {
        mode: result.mode,
        mealTime: result.mealTime,
        contentVersion: CONTENT_VERSION,
      },
      result.score,
      result.completedAt,
      result.deckSeed,
    )
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
      submissionTask: null,
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
      flow.submissionTask !== null ||
      flow.complete ||
      !flow.submission
    ) {
      return
    }

    flow.submissionPending = true
    flow.submissionError = null
    this.renderRoomResultWaiting(flow)

    const submissionTask = this.roomGateway
      .submitResult(flow.room.code, flow.submission)
      .then((results) => {
        this.gameProgressStore.clear(
          this.createRoomProgressIdentity(flow.room),
        )
        if (this.isActiveResultFlow(flow)) {
          this.handleRoomResultsSnapshot(flow, results)
        }
      })
      .catch((error: unknown) => {
        if (this.isActiveResultFlow(flow)) {
          flow.submissionError =
            `결과 제출 실패: ${toUserMessage(error)}`
        }
      })
      .finally(() => {
        if (this.isActiveResultFlow(flow)) {
          flow.submissionPending = false
          if (!flow.complete) {
            this.renderRoomResultWaiting(flow)
          }
        }
      })

    flow.submissionTask = submissionTask
    await submissionTask
    if (
      this.isActiveResultFlow(flow) &&
      flow.submissionTask === submissionTask
    ) {
      flow.submissionTask = null
    }
  }

  private handleRoomResultsSnapshot(
    flow: ActiveRoomResultFlow,
    results: readonly RoomResultSubmission[],
    finalizeMissing = false,
  ): void {
    if (!this.isActiveResultFlow(flow) || flow.complete) {
      return
    }

    const resolution = resolveRoomResults(
      flow.room.start.roster,
      results,
      flow.room.start.resultDeadlineAt,
      finalizeMissing,
    )
    flow.results = resolution.receivedResults

    if (!resolution.isFinal || !resolution.summary) {
      flow.complete = false
      this.renderRoomResultWaiting(flow)
      return
    }

    flow.complete = true
    this.gameProgressStore.clear(
      this.createRoomProgressIdentity(flow.room),
    )
    this.cleanupResultSubscription()
    this.clearRoomResultDeadline()
    this.renderRoomResultsSummary(flow.room, resolution.summary)
    this.sensoryFeedback.trigger('results', ROOM_EVENT_SOUND_SCALE)
  }

  private async handleRoomResultDeadline(
    room: StartedRoom,
  ): Promise<void> {
    if (!this.isCurrentStartedRoom(room)) {
      return
    }

    const initialFlow = this.activeRoomResultFlow
    if (initialFlow?.complete) {
      return
    }
    if (initialFlow?.submissionTask) {
      await initialFlow.submissionTask
    }
    if (
      !this.isCurrentStartedRoom(room) ||
      this.activeRoomResultFlow?.complete
    ) {
      return
    }

    try {
      const resultState =
        await this.roomGateway.readAuthoritativeResultState(room.code)
      if (!this.isCurrentStartedRoom(room)) {
        return
      }

      let flow = this.activeRoomResultFlow
      if (resultState.finalization === 'open') {
        if (flow && this.isActiveResultFlow(flow) && !flow.complete) {
          this.handleRoomResultsSnapshot(flow, resultState.results)
        }
        if (!flow?.complete) {
          this.scheduleRoomResultFinalizationRetry(room)
        }
        return
      }

      if (!flow || !this.isActiveResultFlow(flow)) {
        this.gameHost.stop()
        this.cleanupRoomSubscription()
        this.cleanupResultSubscription()
        this.clearCountdown()
        const generation = ++this.viewGeneration
        this.screenRoot.hidden = false
        flow = {
          room,
          submission: null,
          generation,
          results: [],
          submissionPending: false,
          submissionTask: null,
          subscriptionPending: false,
          submissionError: null,
          subscriptionError: null,
          complete: false,
        }
        this.activeRoomResultFlow = flow
      }

      flow.subscriptionError = null
      this.handleRoomResultsSnapshot(flow, resultState.results, true)
    } catch (error) {
      if (!this.isCurrentStartedRoom(room)) {
        return
      }
      const flow = this.activeRoomResultFlow
      if (flow?.complete) {
        return
      }
      if (flow && this.isActiveResultFlow(flow)) {
        flow.subscriptionError =
          `서버 마감 확인 오류: ${toUserMessage(error)}`
        this.renderRoomResultWaiting(flow)
      }
      this.scheduleRoomResultFinalizationRetry(room)
    }
  }

  private isCurrentStartedRoom(room: StartedRoom): boolean {
    return Boolean(
      this.currentRoom &&
        this.currentRoom.status === 'started' &&
        this.currentRoom.code === room.code &&
        this.currentRoom.start.startId === room.start.startId,
    )
  }

  private scheduleRoomResultDeadline(room: StartedRoom): void {
    this.clearRoomResultDeadline()

    this.resultDeadlineInterval = window.setInterval(() => {
      const countdown = this.screenRoot.querySelector<HTMLElement>(
        '[data-testid="result-deadline-countdown"]',
      )
      if (countdown) {
        countdown.textContent = formatResultDeadlineRemaining(
          room.start.resultDeadlineAt,
        )
      }
    }, RESULT_COUNTDOWN_REFRESH_MS)

    const estimatedDelay =
      room.start.resultDeadlineAt +
      ROOM_RESULT_SYNC_GRACE_MS -
      Date.now()
    const delay = Math.min(
      Math.max(0, estimatedDelay),
      ROOM_RESULT_WINDOW_MS +
        ROOM_COUNTDOWN_MS +
        ROOM_RESULT_SYNC_GRACE_MS,
    )
    this.resultDeadlineTimeout = window.setTimeout(() => {
      void this.handleRoomResultDeadline(room)
    }, delay)
  }

  private scheduleRoomResultFinalizationRetry(
    room: StartedRoom,
  ): void {
    if (this.resultDeadlineTimeout !== null) {
      window.clearTimeout(this.resultDeadlineTimeout)
    }
    this.resultDeadlineTimeout = window.setTimeout(() => {
      void this.handleRoomResultDeadline(room)
    }, RESULT_FINALIZATION_RETRY_MS)
  }

  private clearRoomResultDeadline(): void {
    if (this.resultDeadlineTimeout !== null) {
      window.clearTimeout(this.resultDeadlineTimeout)
      this.resultDeadlineTimeout = null
    }
    if (this.resultDeadlineInterval !== null) {
      window.clearInterval(this.resultDeadlineInterval)
      this.resultDeadlineInterval = null
    }
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
    const deadlineReached =
      Date.now() >= flow.room.start.resultDeadlineAt

    this.screenRoot.innerHTML = `
      <div
        class="app-screen results-waiting-screen"
        data-testid="room-results-waiting"
      >
        <header class="results-heading">
          <img
            class="screen-chef-cat waiting-chef-cat"
            src="${chefCatImageUrl}"
            alt=""
            aria-hidden="true"
          />
          <p class="eyebrow">DINNER TABLE READY</p>
          <h1>친구들의 한 끼를 차리는 중</h1>
          <p>모두의 메뉴가 도착하면 함께 공개해요.</p>
          <p class="result-deadline-copy">
            약속한 시간이 되면 도착한 메뉴부터 먼저 열어볼 수 있어요.
            <strong data-testid="result-deadline-countdown">${formatResultDeadlineRemaining(
              flow.room.start.resultDeadlineAt,
            )}</strong>
          </p>
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
        state.textContent = submitted
          ? '제출 완료'
          : deadlineReached
            ? '서버 마감 확인 중'
            : '플레이 중'
        state.className = submitted
          ? 'is-submitted'
          : deadlineReached
            ? 'is-finalizing'
            : ''
        item.append(name, state)
        return item
      }),
    )

    const submitStatus = this.query<HTMLElement>(
      '[data-testid="result-submit-status"]',
    )
    submitStatus.textContent = flow.submissionError
      ? flow.submissionError
      : flow.submission === null && deadlineReached
        ? '서버에서 결과 마감을 확인하고 있어요.'
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
    retrySubmit.hidden =
      flow.submission === null || flow.submissionError === null
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
    summary: Readonly<FinalRoomResultsSummary>,
  ): void {
    this.clearRoomResultDeadline()
    const mealLabel = room.mealTime === 'lunch' ? '점심' : '저녁'
    const winnerPickHeading =
      summary.winners.length === 0
        ? '완주자 없음'
        : summary.winners.length === 1
          ? `1등의 ${mealLabel} PICK`
          : `공동 1등의 ${mealLabel} PICK`
    const completedStandings = summary.standings.filter(
      (standing) => !standing.didNotFinish,
    )
    const menuCandidates = resolveRoomMenuCandidates(summary)
    const exactOverlaps =
      menuCandidates.kind === 'exact-menu' ? menuCandidates.overlaps : []
    const categoryAffinities =
      menuCandidates.kind === 'category-affinity'
        ? menuCandidates.affinities
        : []
    const individualPicks =
      menuCandidates.kind === 'individual-picks' ? menuCandidates.picks : []
    const overlapMaxCount = exactOverlaps[0]?.captureCount ?? 0
    const categoryMatchCount = categoryAffinities[0]?.matchCount ?? 0
    const matchEyebrow =
      menuCandidates.kind === 'exact-menu'
        ? 'MATCHED PICKS'
        : menuCandidates.kind === 'category-affinity'
          ? 'TASTE MATCH'
          : 'TODAY CANDIDATES'
    const matchHeading =
      menuCandidates.kind === 'exact-menu'
        ? '정확히 겹친 오늘의 메뉴'
        : menuCandidates.kind === 'category-affinity'
          ? '가까운 취향으로 고른 후보'
          : menuCandidates.kind === 'individual-picks'
            ? '각자의 PICK에서 고르기'
            : '오늘의 메뉴 후보'
    const matchCountLabel =
      menuCandidates.kind === 'exact-menu'
        ? String(overlapMaxCount) + '회 선택'
        : menuCandidates.kind === 'category-affinity'
          ? String(categoryMatchCount) + '명 일치'
          : menuCandidates.kind === 'individual-picks'
            ? String(individualPicks.length) + '명 후보'
            : '후보 없음'
    const personalBest = this.personalBestStore.read({
      mode: 'room',
      mealTime: room.mealTime,
      contentVersion: CONTENT_VERSION,
    })
    this.screenRoot.innerHTML = `
      <div
        class="app-screen room-results-screen"
        data-testid="room-results-summary"
      >
        <header class="results-heading results-heading-complete">
          <p class="eyebrow">ROOM ${room.code} · MENU FINAL</p>
          <h1>오늘의 메뉴 챔피언</h1>
          <p>오늘 마음이 가장 끌린 한 끼를 함께 만나보세요.</p>
        </header>

        <section
          class="result-celebration"
          data-testid="result-celebration"
        >
          <span class="result-confetti confetti-one" aria-hidden="true"></span>
          <span class="result-confetti confetti-two" aria-hidden="true"></span>
          <span class="result-confetti confetti-three" aria-hidden="true"></span>
          <span class="result-confetti confetti-four" aria-hidden="true"></span>
          <span class="result-confetti confetti-five" aria-hidden="true"></span>
          <span class="result-confetti confetti-six" aria-hidden="true"></span>
          <img
            class="screen-chef-cat result-chef-cat"
            src="${chefCatImageUrl}"
            alt=""
            aria-hidden="true"
          />
          <div class="result-celebration-copy">
            <span>MENU CHAMPION</span>
            <h2 data-testid="result-celebration-title"></h2>
            <strong data-testid="result-celebration-score"></strong>
            <p>오늘의 메뉴 선택이 완성됐어요!</p>
          </div>
        </section>

        <section class="result-section winner-section result-winner-showcase">
          <div class="result-section-heading">
            <div>
              <span>WINNER PICKS</span>
              <h2 data-testid="winner-pick-heading">${winnerPickHeading}</h2>
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
              <span>${matchEyebrow}</span>
              <h2 data-testid="overlap-heading">${matchHeading}</h2>
            </div>
            <small data-testid="overlap-max-count">${matchCountLabel}</small>
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

        <section
          class="result-personal-best"
          data-testid="result-personal-best"
        >
          <span>이 기기 최고 기록</span>
          <strong>${personalBest ? `${formatScore(personalBest.score)}점` : '첫 기록 대기 중'}</strong>
          <small>모드와 식사 시간별로 이 기기에만 저장돼요.</small>
        </section>

        <section class="result-section standings-section">
          <div class="result-section-heading">
            <div>
              <span>DETAIL RANKING</span>
              <h2>상세 순위</h2>
            </div>
            <small>${summary.standings.length}명</small>
          </div>
          <ol
            class="result-standings"
            data-testid="result-standings"
          ></ol>
        </section>

        <div class="result-actions">
          <button
            class="button button-accent"
            type="button"
            data-testid="result-new-menu"
          >새 메뉴 고르기</button>
          <button
            class="button button-ghost result-home-button"
            type="button"
            data-testid="result-home"
          >홈으로</button>
        </div>
      </div>
    `

    const heroTitle = this.query<HTMLElement>(
      '[data-testid="result-celebration-title"]',
    )
    const heroScore = this.query<HTMLElement>(
      '[data-testid="result-celebration-score"]',
    )
    const winner = summary.winners[0]

    if (winner === undefined) {
      heroTitle.textContent = '오늘의 도전 완료!'
      heroScore.textContent = '다음 판의 메뉴 챔피언을 기다려요'
    } else if (summary.winners.length === 1) {
      heroTitle.textContent = `${winner.displayName} 우승!`
      heroScore.textContent = `${formatScore(winner.score)}점`
    } else {
      heroTitle.textContent = '공동 메뉴 챔피언!'
      heroScore.textContent =
        `${summary.winners.length}명 · ${formatScore(winner.score)}점`
    }

    const standings = this.query<HTMLOListElement>(
      '[data-testid="result-standings"]',
    )
    standings.replaceChildren(
      ...summary.standings.map((standing) => {
        const item = document.createElement('li')
        item.className = 'result-standing'
        item.dataset.testid = 'result-standing'
        if (standing.rank === 1 && !standing.didNotFinish) {
          item.classList.add('is-winner')
        }
        if (standing.didNotFinish) {
          item.classList.add('is-dnf')
        }

        const rank = document.createElement('strong')
        rank.className = 'result-rank'
        rank.textContent = standing.didNotFinish
          ? '미완주'
          : standing.isScoreTied
          ? `공동 ${standing.rank}위`
          : `${standing.rank}위`

        const player = document.createElement('div')
        player.className = 'result-player'
        const name = document.createElement('strong')
        const score = document.createElement('span')
        name.textContent = standing.displayName
        score.textContent = standing.didNotFinish
          ? '미완주 · 0점'
          : `${formatScore(standing.score)}점`
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
    if (summary.winners.length === 0) {
      const emptyWinner = document.createElement('p')
      emptyWinner.className = 'result-empty-copy'
      emptyWinner.textContent = '결과 마감 전 완주한 참가자가 없어요.'
      winnerPicks.append(emptyWinner)
    }

    const overlapSummary = this.query<HTMLElement>(
      '[data-testid="overlap-summary"]',
    )
    if (menuCandidates.kind !== 'exact-menu') {
      if (categoryAffinities.length > 0) {
        const nameByPlayerId = new Map(
          summary.standings.map((standing) => [
            standing.playerId,
            standing.displayName,
          ]),
        )

        overlapSummary.append(
          ...categoryAffinities.map((affinity) => {
            const card = document.createElement('article')
            card.className = 'overlap-card category-affinity-card'
            card.dataset.testid = 'category-affinity'
            card.dataset.category = affinity.category

            const icon = document.createElement('div')
            icon.className = 'category-affinity-icon'
            icon.setAttribute('aria-hidden', 'true')
            icon.textContent = affinity.emoji

            const copy = document.createElement('div')
            copy.className = 'category-affinity-copy'
            const count = document.createElement('strong')
            const recommendation = document.createElement('small')
            const selections = document.createElement('span')
            const everyFinisherMatched =
              affinity.matchCount === completedStandings.length
            const matchSubject = everyFinisherMatched
              ? affinity.matchCount === 2
                ? '둘 다'
                : String(affinity.matchCount) + '명 모두'
              : String(affinity.matchCount) + '명이'
            count.textContent = matchSubject + ' ' + affinity.labelKo
            recommendation.className = 'category-affinity-recommendation'
            recommendation.textContent = affinity.recommendationKo
            selections.className = 'category-affinity-selections'
            selections.textContent = affinity.selections
              .map((selection) => {
                const playerName =
                  nameByPlayerId.get(selection.playerId) ?? selection.playerId
                const menuNames = selection.menuIds.map(
                  (menuId) => MENU_BY_ID.get(menuId)?.nameKo ?? menuId,
                )
                return playerName + ': ' + menuNames.join(' · ')
              })
              .join(' / ')
            copy.append(count, recommendation, selections)
            card.append(icon, copy)
            return card
          }),
        )
      } else if (individualPicks.length > 0) {
        overlapSummary.append(
          ...individualPicks.map((pick) => {
            const card = document.createElement('article')
            card.className = 'overlap-card individual-pick-card'
            card.dataset.testid = 'individual-pick'

            const copy = document.createElement('div')
            const heading = document.createElement('strong')
            const hint = document.createElement('span')
            heading.textContent = `${pick.displayName}의 PICK`
            hint.textContent = '정확히 겹치지 않아도 각자 고른 메뉴를 후보로 남겼어요.'
            copy.append(heading, hint)

            const slots = document.createElement('div')
            slots.className = 'result-capture-slots'
            slots.append(
              ...pick.menuIds.map((menuId) =>
                this.createResultMenuSlot(menuId),
              ),
            )
            card.append(slots, copy)
            return card
          }),
        )
      } else {
        const empty = document.createElement('p')
        empty.className = 'result-empty-copy'
        empty.textContent =
          '포획한 메뉴가 아직 없어요. 상세 순위를 참고해 한 끼를 함께 골라보세요.'
        overlapSummary.append(empty)
      }
    } else {
      const nameByPlayerId = new Map(
        summary.standings.map((standing) => [
          standing.playerId,
          standing.displayName,
        ]),
      )

      overlapSummary.append(
        ...exactOverlaps.map((overlap) => {
          const card = document.createElement('article')
          card.className = 'overlap-card'
          card.dataset.testid = 'overlapped-menu'
          const menu = this.createResultMenuSlot(overlap.menuId)
          const copy = document.createElement('div')
          const count = document.createElement('strong')
          const capturers = document.createElement('span')
          count.textContent = `${overlap.captureCount}회 선택`
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

    if (summary.winners.length === 0) {
      outcomeTitle.textContent = '전원 미완주 · 내기 없음'
      outcomeCopy.textContent = '완주자가 없어 이번 식사 내기는 성립하지 않아요.'
    } else if (soleWinner && soleLastPlace) {
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
      '[data-testid="result-new-menu"]',
    ).addEventListener('click', () => {
      this.returnHome()
    })
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
    this.clearRoomResultDeadline()
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
    this.markSplashEntered()
    this.gameProgressStore.clearForPlayer(this.playerId)
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    window.history.replaceState({}, '', url)
    this.renderHome()
  }

  private cleanupRoomFlow(): void {
    this.stopQrScanner()
    this.cleanupLobbySync()
    this.cleanupResultSubscription()
    this.clearRoomResultDeadline()
    this.clearCountdown()
    this.activeRoomResultFlow = null
    this.currentRoom = null
    this.scheduledRoomKey = null
    this.roomPreparationKey = null
    this.roomPreparationTask = null
    this.roomReadyAckKey = null
    this.roomReadyAckPending = false
    this.roomFinalizeKey = null
    this.roomFinalizePending = false
    this.roomSyncLastEventAt = null
  }

  private cleanupResultSubscription(): void {
    this.unsubscribeResults?.()
    this.unsubscribeResults = null
  }

  private cleanupLobbySync(): void {
    this.clearLobbyReconciliation()
    this.dropRoomSubscription()
    this.clearRoomSyncRetryTimeout()
    this.cleanupLobbyRecoveryTriggers()
    this.roomSyncRefreshTask = null
    this.roomStartPending = false
    this.roomSyncPhase = 'idle'
    this.roomSyncRetryCount = 0
    this.roomSyncErrorCode = null
  }

  private cleanupRoomSubscription(): void {
    this.dropRoomSubscription()
  }

  private dropRoomSubscription(): void {
    this.roomSyncConnectionToken += 1
    this.roomSyncServerConnectionToken = null
    this.roomSyncNeedsReconnect = false
    this.unsubscribeRoom?.()
    this.unsubscribeRoom = null
    this.clearRoomSyncWatchdog()
  }

  private clearRoomSyncWatchdog(): void {
    if (this.roomSyncWatchdogTimeout !== null) {
      window.clearTimeout(this.roomSyncWatchdogTimeout)
      this.roomSyncWatchdogTimeout = null
    }
  }

  private clearRoomSyncRetryTimeout(): void {
    if (this.roomSyncRetryTimeout !== null) {
      window.clearTimeout(this.roomSyncRetryTimeout)
      this.roomSyncRetryTimeout = null
    }
  }

  private clearLobbyReconciliation(): void {
    if (this.roomSyncReconciliationTimeout !== null) {
      window.clearTimeout(this.roomSyncReconciliationTimeout)
      this.roomSyncReconciliationTimeout = null
    }
  }

  private cleanupLobbyRecoveryTriggers(): void {
    if (this.lobbyVisibilityHandler) {
      document.removeEventListener(
        'visibilitychange',
        this.lobbyVisibilityHandler,
      )
      this.lobbyVisibilityHandler = null
    }
    if (this.lobbyOnlineHandler) {
      window.removeEventListener('online', this.lobbyOnlineHandler)
      this.lobbyOnlineHandler = null
    }
    if (this.lobbyFocusHandler) {
      window.removeEventListener('focus', this.lobbyFocusHandler)
      this.lobbyFocusHandler = null
    }
    if (this.lobbyPageShowHandler) {
      window.removeEventListener('pageshow', this.lobbyPageShowHandler)
      this.lobbyPageShowHandler = null
    }
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
    this.persistNickname(nickname)
    return nickname
  }

  private readStoredNickname(): string {
    const storageNames: readonly ('localStorage' | 'sessionStorage')[] =
      this.backend === 'firebase'
        ? ['localStorage', 'sessionStorage']
        : ['sessionStorage']

    for (const storageName of storageNames) {
      const storedNickname = this.readNicknameStorage(storageName)
      if (!storedNickname) {
        continue
      }

      try {
        const nickname = normalizeNickname(storedNickname)
        this.persistNickname(nickname)
        return nickname
      } catch {
        // Ignore stale or invalid saved values and let the user enter a name.
      }
    }

    return ''
  }

  private persistNickname(nickname: string): void {
    this.writeNicknameStorage('sessionStorage', nickname)
    if (this.backend === 'firebase') {
      this.writeNicknameStorage('localStorage', nickname)
    }
  }

  private readNicknameStorage(
    storageName: 'localStorage' | 'sessionStorage',
  ): string | null {
    try {
      return window[storageName].getItem(NICKNAME_STORAGE_KEY)
    } catch {
      return null
    }
  }

  private writeNicknameStorage(
    storageName: 'localStorage' | 'sessionStorage',
    nickname: string,
  ): void {
    try {
      window[storageName].setItem(NICKNAME_STORAGE_KEY, nickname)
    } catch {
      // Storage can be unavailable in privacy modes; joining must still work.
    }
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
        '[data-testid="tutorial-start"]',
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

function sameRoomStart(left: StartedRoom, right: StartedRoom): boolean {
  return (
    left.code === right.code &&
    left.start.startId === right.start.startId &&
    left.start.deckSeed === right.start.deckSeed &&
    left.start.contentVersion === right.start.contentVersion &&
    left.start.startAt === right.start.startAt &&
    left.start.resultDeadlineAt === right.start.resultDeadlineAt &&
    left.start.roster.length === right.start.roster.length &&
    left.start.roster.every((player, index) => {
      const other = right.start.roster[index]
      return (
        other !== undefined &&
        player.playerId === other.playerId &&
        player.rosterOrder === other.rosterOrder
      )
    })
  )
}

function createRoomPreparationKey(
  room: PreparingRoom | StartedRoom,
): string {
  return `${room.code}:${room.start.startId}`
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

function createDeckSeed(prefix: string): string {
  return `${prefix}-${Date.now()}-${createRandomUuid()}`
}

function toUserMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

function formatResultDeadlineRemaining(resultDeadlineAt: number): string {
  const rawRemainingSeconds = Math.ceil(
    (resultDeadlineAt - Date.now()) / 1_000,
  )
  if (rawRemainingSeconds <= 0) {
    return '서버 마감 확인 중'
  }
  const remainingSeconds = rawRemainingSeconds
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = String(remainingSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
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

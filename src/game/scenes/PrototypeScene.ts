import Phaser from 'phaser'
import {
  NOOP_SENSORY_FEEDBACK,
  type SensoryCue,
  type SensoryFeedback,
  type SensoryFeedbackDebugState,
} from '../../feedback/SensoryFeedback'
import { type Circle, type Point } from '../../domain/geometry'
import {
  classifyGesture,
  type SliceGestureDecision,
} from '../../domain/gestureClassifier'
import {
  MAX_CAPTURES,
  calculatePlayerScore,
  createWeightedMenuDeck,
  getRoundFallDurationMs,
  type RoundAction,
  type RoundResult,
} from '../../domain/gameRules'
import {
  createSeededRandom,
  toWeightedMenuPool,
  type WeightedMenuCatalogEntry,
} from '../../data/menus'
import {
  calculateContainedSize,
  getMenuVisual,
  getPreloadedMenuImage,
} from '../../data/menuVisuals'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../createGame'
import {
  createPlayerGameResultReporter,
  DEFAULT_GAME_LAUNCH_OPTIONS,
  type GameLaunchOptions,
  type PlayerGameResultHandler,
} from '../gameTypes'
import type { RoomGameProgressStore } from '../gameProgress'
import {
  getDisplayedSliceAccuracy,
  getSliceFeedback,
  type SliceFeedback,
} from '../gameFeedback'

const TOTAL_ROUNDS = 20
const JUDGEMENT_RADIUS = 64
const TOKEN_START_Y = 190
const MISS_LINE_Y = 704
const PATH_SAMPLE_DISTANCE = 5
const MAX_PATH_POINTS = 192
const MAX_GESTURE_DURATION_MS = 2_000
const CAPTURE_HOLD_DURATION_MS = 320
const CAPTURE_HIT_RADIUS = JUDGEMENT_RADIUS + 16
const CAPTURE_DRAG_THRESHOLD = 14
const TOKEN_VISUAL_MAX_WIDTH = 128
const TOKEN_VISUAL_MAX_HEIGHT = 112
const SLICE_EFFECT_DURATION_MS = 440
const CAPTURE_EFFECT_DURATION_MS = 480
const INTRO_AUTO_DISMISS_MS = 2_300
const MISS_WARNING_DISTANCE = 128
const FINAL_SPRINT_ROUND_INDEX = 15
const FINAL_SPRINT_BANNER_MS = 760
const HUD_SCORE_CENTER_X = 170
const ACCURACY_POPUP_MIN_Y = 232
const ROOM_SOUND_SCALE = 0.86
const SLICE_SENSORY_CUE = Object.freeze({
  'needs-practice': 'slice-low',
  good: 'slice-good',
  great: 'slice-great',
  perfect: 'slice-perfect',
} satisfies Record<SliceFeedback['level'], SensoryCue>)

interface TokenVisual {
  readonly children: Phaser.GameObjects.GameObject[]
  readonly hasVisual: boolean
  readonly renderBounds: {
    readonly width: number
    readonly height: number
  }
}

interface ActiveToken {
  readonly menu: WeightedMenuCatalogEntry
  readonly container: Phaser.GameObjects.Container
  readonly tween: Phaser.Tweens.Tween
  readonly fallDurationMs: number
  readonly hasVisual: boolean
  readonly renderBounds: TokenVisual['renderBounds']
  missWarningShown: boolean
}

interface HoldCaptureState {
  readonly token: ActiveToken
  readonly pointerId: number
  readonly anchor: Point
  readonly graphics: Phaser.GameObjects.Graphics
  readonly progress: { value: number }
  readonly tween: Phaser.Tweens.Tween
}

interface CaptureSlot {
  readonly center: Point
  readonly numberLabel: Phaser.GameObjects.Text
  filled: boolean
}

const TOKEN_X_SEQUENCE = [
  196, 126, 264, 166, 236, 102, 284, 146, 250, 190, 116, 274, 154, 230, 96,
  288, 176, 218, 132, 258,
] as const

export class PrototypeScene extends Phaser.Scene {
  private reportGameResult!: ReturnType<
    typeof createPlayerGameResultReporter
  >
  private trail!: Phaser.GameObjects.Graphics
  private progressText!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text
  private captureText!: Phaser.GameObjects.Text
  private feedbackText!: Phaser.GameObjects.Text
  private missWarningLine: Phaser.GameObjects.Rectangle | null = null
  private introOverlay: Phaser.GameObjects.Container | null = null
  private introTimer: Phaser.Time.TimerEvent | null = null
  private activeToken: ActiveToken | null = null
  private holdCapture: HoldCaptureState | null = null
  private activeCaptureEffect: Phaser.GameObjects.Container | null = null
  private captureSlots: CaptureSlot[] = []
  private filledCaptureSlotCount = 0
  private lastSliceAngleDegrees: number | null = null
  private lastSliceSource: SliceGestureDecision['source'] | null = null
  private activeSlicePieceCount = 0
  private cleanedSlicePieceCount = 0
  private gestureTimeout: Phaser.Time.TimerEvent | null = null
  private activePointerId: number | null = null
  private path: Point[] = []
  private localPath: Point[] = []
  private rounds: RoundResult[] = []
  private deck: readonly WeightedMenuCatalogEntry[] = []
  private isDrawing = false
  private isSlicing = false
  private isFinished = false
  private missWarningActive = false
  private finalSprintAnnounced = false

  constructor(
    private readonly launchOptions: GameLaunchOptions =
      DEFAULT_GAME_LAUNCH_OPTIONS,
    private readonly onGameResult?: PlayerGameResultHandler,
    private readonly progressStore?: RoomGameProgressStore,
    private readonly sensoryFeedback: SensoryFeedback =
      NOOP_SENSORY_FEEDBACK,
  ) {
    super('prototype')
  }

  init(): void {
    this.resetRunState()
    this.deck = createWeightedMenuDeck(
      toWeightedMenuPool(this.launchOptions.mealTime),
      {
        size: TOTAL_ROUNDS,
        rng: createSeededRandom(this.launchOptions.deckSeed),
      },
    )

    const progressIdentity = this.launchOptions.progressIdentity
    if (progressIdentity && this.progressStore) {
      this.rounds = [
        ...this.progressStore.load(
          progressIdentity,
          this.deck.map((menu) => menu.id),
        ),
      ]
    }
  }

  create(): void {
    this.reportGameResult = createPlayerGameResultReporter(
      this.launchOptions,
      this.onGameResult,
    )

    this.registerMenuTextures()
    this.drawArena()
    this.createHud()
    this.restoreCapturedMenus()

    this.trail = this.add.graphics().setDepth(20)

    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      this.handlePointerDown,
      this,
    )
    this.input.on(
      Phaser.Input.Events.POINTER_MOVE,
      this.handlePointerMove,
      this,
    )
    this.input.on(
      Phaser.Input.Events.POINTER_UP,
      this.handlePointerUp,
      this,
    )
    this.input.on(
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      this.cancelGesture,
      this,
    )
    this.input.on(
      Phaser.Input.Events.GAME_OUT,
      this.cancelGesture,
      this,
    )
    this.game.events.on(
      Phaser.Core.Events.BLUR,
      this.cancelGesture,
      this,
    )
    this.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      this.teardownInput,
      this,
    )

    this.updateHud()
    if (this.launchOptions.mode === 'solo' && this.rounds.length === 0) {
      this.showIntroGuide()
    } else {
      this.time.delayedCall(500, () => this.spawnRound())
    }
  }

  private resetRunState(): void {
    this.gestureTimeout?.remove(false)
    this.holdCapture?.tween.stop()
    this.holdCapture?.graphics.destroy()
    this.introTimer?.remove(false)
    this.introOverlay?.destroy(true)
    this.activeToken = null
    this.activeCaptureEffect = null
    this.holdCapture = null
    this.introOverlay = null
    this.introTimer = null
    this.missWarningLine = null
    this.captureSlots = []
    this.filledCaptureSlotCount = 0
    this.lastSliceAngleDegrees = null
    this.lastSliceSource = null
    this.activeSlicePieceCount = 0
    this.cleanedSlicePieceCount = 0
    this.gestureTimeout = null
    this.activePointerId = null
    this.path = []
    this.localPath = []
    this.rounds = []
    this.deck = []
    this.isDrawing = false
    this.isSlicing = false
    this.isFinished = false
    this.missWarningActive = false
    this.finalSprintAnnounced = false
  }

  getDebugState(): {
    readonly activeToken: {
      readonly x: number
      readonly y: number
      readonly menuId: string
      readonly fallDurationMs: number
      readonly judgement: {
        readonly kind: 'circle'
        readonly radius: number
      }
      readonly visual: {
        readonly hasVisual: boolean
        readonly width: number
        readonly height: number
      }
    } | null
    readonly captureEffectY: number | null
    readonly completedRounds: number
    readonly captureCount: number
    readonly filledCaptureSlotCount: number
    readonly pathPointCount: number
    readonly localPathPointCount: number
    readonly lastSliceAngleDegrees: number | null
    readonly lastSliceSource: SliceGestureDecision['source'] | null
    readonly inputMode: 'idle' | 'hold' | 'slice'
    readonly activeSlicePieceCount: number
    readonly cleanedSlicePieceCount: number
    readonly lastAction: RoundAction['type'] | null
    readonly feedback: string
    readonly mealTime: GameLaunchOptions['mealTime']
    readonly deckSeed: GameLaunchOptions['deckSeed']
    readonly deckMenuIds: readonly string[]
    readonly introVisible: boolean
    readonly missWarningActive: boolean
    readonly finalSprintAnnounced: boolean
    readonly sensoryFeedback: Readonly<SensoryFeedbackDebugState>
  } {
    return {
      activeToken: this.activeToken
        ? {
            x: this.activeToken.container.x,
            y: this.activeToken.container.y,
            menuId: this.activeToken.menu.id,
            fallDurationMs: this.activeToken.fallDurationMs,
            judgement: {
              kind: 'circle',
              radius: JUDGEMENT_RADIUS,
            },
            visual: {
              hasVisual: this.activeToken.hasVisual,
              width: this.activeToken.renderBounds.width,
              height: this.activeToken.renderBounds.height,
            },
          }
        : null,
      captureEffectY: this.activeCaptureEffect?.y ?? null,
      completedRounds: this.rounds.length,
      captureCount: this.rounds.filter(
        (round) => round.action.type === 'capture',
      ).length,
      filledCaptureSlotCount: this.filledCaptureSlotCount,
      pathPointCount: this.path.length,
      localPathPointCount: this.localPath.length,
      lastSliceAngleDegrees: this.lastSliceAngleDegrees,
      lastSliceSource: this.lastSliceSource,
      inputMode: this.holdCapture
        ? 'hold'
        : this.isSlicing
          ? 'slice'
          : 'idle',
      activeSlicePieceCount: this.activeSlicePieceCount,
      cleanedSlicePieceCount: this.cleanedSlicePieceCount,
      lastAction: this.rounds.at(-1)?.action.type ?? null,
      feedback: this.feedbackText?.text ?? '',
      mealTime: this.launchOptions.mealTime,
      deckSeed: this.launchOptions.deckSeed,
      deckMenuIds: this.deck.map((menu) => menu.id),
      introVisible: this.introOverlay !== null,
      missWarningActive: this.missWarningActive,
      finalSprintAnnounced: this.finalSprintAnnounced,
      sensoryFeedback: this.sensoryFeedback.getDebugState(),
    }
  }

  private registerMenuTextures(): void {
    for (const menu of this.deck) {
      const visual = getMenuVisual(menu.id)
      const image = getPreloadedMenuImage(menu.id)

      if (
        visual &&
        image &&
        !this.textures.exists(visual.textureKey)
      ) {
        this.textures.addImage(visual.textureKey, image)
      }
    }
  }

  private drawArena(): void {
    const background = this.add.graphics()
    background.fillStyle(0x101821, 1)
    background.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)

    background.fillStyle(0x65483f, 0.78)
    background.fillRoundedRect(12, 84, LOGICAL_WIDTH - 24, 744, 34)

    background.fillStyle(0x17212d, 1)
    background.fillRoundedRect(28, 138, LOGICAL_WIDTH - 56, 620, 28)

    background.lineStyle(2, 0xffd76a, 0.65)
    background.strokeRoundedRect(28, 138, LOGICAL_WIDTH - 56, 620, 28)

    background.fillStyle(0xfff0ca, 0.13)
    background.fillCircle(20, 226, 35)
    background.fillCircle(LOGICAL_WIDTH - 17, 592, 42)
    background.fillRoundedRect(310, 98, 68, 22, 7)
    background.fillRoundedRect(13, 706, 82, 18, 7)

    background.lineStyle(3, 0xffd76a, 0.9)
    background.beginPath()
    background.moveTo(42, MISS_LINE_Y)
    background.lineTo(LOGICAL_WIDTH - 42, MISS_LINE_Y)
    background.strokePath()

    this.missWarningLine = this.add
      .rectangle(
        LOGICAL_WIDTH / 2,
        MISS_LINE_Y,
        LOGICAL_WIDTH - 84,
        5,
        0xff795f,
        1,
      )
      .setAlpha(0)
      .setDepth(4)

    this.add
      .text(LOGICAL_WIDTH / 2, 44, '오늘 뭐 썰?', {
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(LOGICAL_WIDTH / 2, 786, '0.3초 꾹 누르면 포획 · 드래그하면 베기', {
        color: '#b9c5d3',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '15px',
      })
      .setOrigin(0.5)
  }

  private createHud(): void {
    this.progressText = this.add.text(46, 103, '', {
      color: '#fff8e7',
      fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
    })

    this.scoreText = this.add
      .text(HUD_SCORE_CENTER_X, 103, '', {
        color: '#55e6d1',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)

    this.captureText = this.add
      .text(296, 103, '', {
        color: '#ffd76a',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)

    this.captureSlots = Array.from({ length: MAX_CAPTURES }, (_, index) => {
      const center = { x: 322 + index * 32, y: 113 }
      this.add
        .circle(center.x, center.y, 13, 0x17212d, 0.92)
        .setStrokeStyle(2, 0xffd76a, 0.7)
        .setDepth(11)
      const numberLabel = this.add
        .text(center.x, center.y, `${index + 1}`, {
          color: '#7f91a4',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(12)

      return { center, numberLabel, filled: false }
    })

    this.feedbackText = this.add
      .text(LOGICAL_WIDTH / 2, 742, '첫 메뉴를 준비 중!', {
        align: 'center',
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.createSensoryControls()
  }

  private createSensoryControls(): void {
    const hapticsSupported = this.sensoryFeedback.hapticsSupported
    const soundX = hapticsSupported ? 317 : 365
    const buttonY = 44

    const createToggle = (
      x: number,
      label: string,
      getEnabled: () => boolean,
      onToggle: () => void,
    ): (() => void) => {
      const panel = this.add
        .rectangle(x, buttonY, 44, 44, 0x1a2634, 0.94)
        .setStrokeStyle(2, 0x52677d, 0.9)
        .setDepth(14)
        .setInteractive({ useHandCursor: true })
      const copy = this.add
        .text(x, buttonY, label, {
          color: '#91a2b4',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: label.length > 1 ? '10px' : '21px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(15)

      const sync = (): void => {
        const enabled = getEnabled()
        panel
          .setFillStyle(enabled ? 0x1e4647 : 0x1a2634, 0.94)
          .setStrokeStyle(2, enabled ? 0x55e6d1 : 0x52677d, 0.9)
        copy.setColor(enabled ? '#7ef0df' : '#91a2b4')
        panel.setAlpha(enabled ? 1 : 0.7)
        copy.setAlpha(enabled ? 1 : 0.7)
      }
      const stopPropagation = (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ): void => {
        event.stopPropagation()
      }
      panel.on(Phaser.Input.Events.POINTER_DOWN, stopPropagation)
      panel.on(
        Phaser.Input.Events.POINTER_UP,
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation()
          onToggle()
          sync()
        },
      )
      sync()
      return sync
    }

    createToggle(
      soundX,
      '♪',
      () => this.sensoryFeedback.soundEnabled,
      () => {
        const enabled = !this.sensoryFeedback.soundEnabled
        this.sensoryFeedback.setSoundEnabled(enabled)
        this.feedbackText
          .setColor(enabled ? '#55e6d1' : '#b9c5d3')
          .setText(`효과음 ${enabled ? '켜짐' : '꺼짐'}`)
        if (enabled) {
          void this.sensoryFeedback.unlock().then((unlocked) => {
            if (unlocked) {
              this.triggerSensory('ui-confirm')
            }
          })
        }
      },
    )

    if (hapticsSupported) {
      createToggle(
        365,
        'VIB',
        () => this.sensoryFeedback.hapticsEnabled,
        () => {
          const enabled = !this.sensoryFeedback.hapticsEnabled
          this.sensoryFeedback.setHapticsEnabled(enabled)
          this.feedbackText
            .setColor(enabled ? '#55e6d1' : '#b9c5d3')
            .setText(`진동 ${enabled ? '켜짐' : '꺼짐'}`)
        },
      )
    }
  }

  private triggerSensory(cue: SensoryCue): void {
    this.sensoryFeedback.trigger(
      cue,
      this.launchOptions.mode === 'room' ? ROOM_SOUND_SCALE : 1,
    )
  }

  private showIntroGuide(): void {
    if (this.introOverlay || this.isFinished) {
      return
    }

    this.feedbackText
      .setColor('#fff8e7')
      .setText('두 가지 조작만 기억하세요!')

    const shade = this.add
      .rectangle(
        LOGICAL_WIDTH / 2,
        LOGICAL_HEIGHT / 2,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
        0x080d13,
        0.72,
      )
      .setInteractive({ useHandCursor: true })
    const panel = this.add
      .rectangle(LOGICAL_WIDTH / 2, 418, 336, 420, 0x243244, 1)
      .setStrokeStyle(3, 0xffd76a, 0.9)
    const kicker = this.add
      .text(LOGICAL_WIDTH / 2, 240, 'HOW TO PLAY', {
        color: '#55e6d1',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
    const title = this.add
      .text(LOGICAL_WIDTH / 2, 276, '썰거나, 포획하거나!', {
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '25px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    const sliceCard = this.add
      .rectangle(LOGICAL_WIDTH / 2, 356, 286, 82, 0x17212d, 0.96)
      .setStrokeStyle(2, 0x55e6d1, 0.72)
    const sliceGuide = this.add
      .text(
        LOGICAL_WIDTH / 2,
        356,
        '드래그해서 반으로 썰기\n가운데를 지날수록 높은 점수',
        {
          align: 'center',
          color: '#fff8e7',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '17px',
          fontStyle: 'bold',
          lineSpacing: 7,
        },
      )
      .setOrigin(0.5)
    const captureCard = this.add
      .rectangle(LOGICAL_WIDTH / 2, 465, 286, 82, 0x17212d, 0.96)
      .setStrokeStyle(2, 0xffd76a, 0.72)
    const captureGuide = this.add
      .text(
        LOGICAL_WIDTH / 2,
        465,
        '먹고 싶으면 0.3초 꾹\n포획은 최대 2회',
        {
          align: 'center',
          color: '#fff8e7',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '17px',
          fontStyle: 'bold',
          lineSpacing: 7,
        },
      )
      .setOrigin(0.5)
    const scoreRule = this.add
      .text(
        LOGICAL_WIDTH / 2,
        535,
        '놓치면 0점 · 포획 메뉴는 평균에서 제외',
        {
          color: '#c8d2df',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '13px',
        },
      )
      .setOrigin(0.5)
    const skip = this.add
      .text(LOGICAL_WIDTH / 2, 585, '화면을 누르면 바로 시작', {
        color: '#ffd76a',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    const overlay = this.add
      .container(0, 0, [
        shade,
        panel,
        kicker,
        title,
        sliceCard,
        sliceGuide,
        captureCard,
        captureGuide,
        scoreRule,
        skip,
      ])
      .setDepth(40)
      .setAlpha(0)

    this.introOverlay = overlay
    shade.once(Phaser.Input.Events.POINTER_UP, () => {
      this.dismissIntroGuide()
    })
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 160,
      ease: 'Quad.Out',
    })
    this.introTimer = this.time.delayedCall(
      INTRO_AUTO_DISMISS_MS,
      () => this.dismissIntroGuide(),
    )
  }

  private dismissIntroGuide(startRound = true): void {
    const overlay = this.introOverlay
    if (!overlay) {
      return
    }

    this.introOverlay = null
    this.introTimer?.remove(false)
    this.introTimer = null

    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 140,
      ease: 'Quad.Out',
      onComplete: () => {
        overlay.destroy(true)
        if (startRound && !this.isFinished) {
          this.time.delayedCall(80, () => this.spawnRound())
        }
      },
    })
  }

  private announceFinalSprint(): void {
    this.triggerSensory('final-five')
    this.feedbackText
      .setColor('#ffd76a')
      .setText('마지막 5개 · 속도가 빨라져요!')

    const panel = this.add
      .rectangle(LOGICAL_WIDTH / 2, 252, 250, 92, 0x101821, 0.96)
      .setStrokeStyle(3, 0xff795f, 0.95)
    const title = this.add
      .text(LOGICAL_WIDTH / 2, 238, 'FINAL 5', {
        color: '#ffd76a',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '29px',
        fontStyle: 'bold',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
    const copy = this.add
      .text(LOGICAL_WIDTH / 2, 274, '마지막 스퍼트!', {
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    const banner = this.add
      .container(0, 0, [panel, title, copy])
      .setDepth(28)
      .setAlpha(0)
      .setScale(0.84)

    this.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1,
      duration: 180,
      ease: 'Back.Out',
    })
    this.time.delayedCall(FINAL_SPRINT_BANNER_MS - 220, () => {
      this.tweens.add({
        targets: banner,
        y: -24,
        alpha: 0,
        duration: 220,
        ease: 'Quad.In',
        onComplete: () => banner.destroy(true),
      })
    })
    this.time.delayedCall(FINAL_SPRINT_BANNER_MS, () => this.spawnRound())
  }

  private startMissWarning(): void {
    const line = this.missWarningLine
    if (!line || this.missWarningActive) {
      return
    }

    this.missWarningActive = true
    this.tweens.killTweensOf(line)
    line.setAlpha(0.95)
    this.tweens.add({
      targets: line,
      alpha: 0.22,
      duration: 140,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut',
      onComplete: () => {
        if (this.missWarningActive) {
          line.setAlpha(0.55)
        }
      },
    })

    if (!this.isDrawing) {
      this.triggerSensory('miss-warning')
      this.feedbackText
        .setColor('#ff9b7c')
        .setText('놓치기 직전! 지금 썰거나 포획하세요')
    }
  }

  private clearMissWarning(): void {
    const line = this.missWarningLine
    this.missWarningActive = false
    if (!line) {
      return
    }

    this.tweens.killTweensOf(line)
    line.setAlpha(0)
  }

  private getRoundInstruction(
    menuName: string,
    roundIndex: number,
  ): string {
    if (roundIndex === 0) {
      return menuName + ' · 화면을 가로질러 드래그해 보세요!'
    }
    if (roundIndex === 1) {
      return menuName + ' · 먹고 싶으면 움직이지 말고 0.3초 꾹!'
    }
    if (roundIndex === 2) {
      return '포획은 선택 · ' + menuName + '을 정확히 반으로 썰어보세요'
    }
    return menuName + ' · 꾹 눌러 포획 · 드래그해 베기'
  }

  private spawnRound(): void {
    if (this.isFinished || this.activeToken) {
      return
    }

    const roundIndex = this.rounds.length
    if (roundIndex >= TOTAL_ROUNDS) {
      this.showResults()
      return
    }

    if (
      roundIndex === FINAL_SPRINT_ROUND_INDEX &&
      !this.finalSprintAnnounced
    ) {
      this.finalSprintAnnounced = true
      this.announceFinalSprint()
      return
    }

    const menu = this.deck[roundIndex]
    const x = TOKEN_X_SEQUENCE[roundIndex]

    if (!menu || x === undefined) {
      throw new Error(`프로토타입 라운드 ${roundIndex} 데이터가 없습니다.`)
    }

    const tokenVisual = this.createTokenVisual(menu)
    const fallDurationMs = getRoundFallDurationMs(roundIndex)

    const container = this.add
      .container(x, TOKEN_START_Y, tokenVisual.children)
      .setDepth(5)

    const tween = this.tweens.add({
      targets: container,
      y: MISS_LINE_Y + JUDGEMENT_RADIUS,
      duration: fallDurationMs,
      ease: 'Linear',
      onUpdate: () => {
        const activeToken = this.activeToken
        if (
          activeToken?.container === container &&
          !activeToken.missWarningShown &&
          container.y >= MISS_LINE_Y - MISS_WARNING_DISTANCE
        ) {
          activeToken.missWarningShown = true
          this.startMissWarning()
        }
      },
      onComplete: () => {
        if (this.activeToken?.container === container) {
          this.resolveRound({ type: 'miss' })
        }
      },
    })

    this.activeToken = {
      menu,
      container,
      tween,
      fallDurationMs,
      hasVisual: tokenVisual.hasVisual,
      renderBounds: tokenVisual.renderBounds,
      missWarningShown: false,
    }
    this.feedbackText.setColor('#fff8e7')
    this.feedbackText.setText(
      this.getRoundInstruction(menu.nameKo, roundIndex),
    )
    this.updateHud()
  }

  private createTokenVisual(menu: WeightedMenuCatalogEntry): TokenVisual {
    const placeholderColor = Number.parseInt(
      menu.placeholderColor.slice(1),
      16,
    )
    const visual = getMenuVisual(menu.id)
    const preloadedImage = getPreloadedMenuImage(menu.id)

    if (
      visual &&
      preloadedImage &&
      this.textures.exists(visual.textureKey)
    ) {
      const renderBounds = calculateContainedSize(
        preloadedImage.naturalWidth,
        preloadedImage.naturalHeight,
        TOKEN_VISUAL_MAX_WIDTH,
        TOKEN_VISUAL_MAX_HEIGHT,
      )
      const shadow = this.add.ellipse(
        5,
        renderBounds.height * 0.24 + 9,
        renderBounds.width * 0.72,
        Math.max(18, renderBounds.height * 0.28),
        0x05090d,
        0.38,
      )
      const silhouetteGlow = this.add.ellipse(
        0,
        -6,
        renderBounds.width + 8,
        renderBounds.height + 8,
        placeholderColor,
        0.16,
      )
      const foodImage = this.add
        .image(0, -7, visual.textureKey)
        .setDisplaySize(renderBounds.width, renderBounds.height)
      const labelPlate = this.add
        .rectangle(0, 53, 104, 25, 0x101821, 0.9)
        .setStrokeStyle(2, 0xfff8e7, 0.8)
      const label = this.add
        .text(0, 53, menu.nameKo, {
          align: 'center',
          color: '#fff8e7',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)

      return {
        children: [
          shadow,
          silhouetteGlow,
          foodImage,
          labelPlate,
          label,
        ],
        hasVisual: true,
        renderBounds,
      }
    }

    const renderBounds = this.getPlaceholderRenderBounds(menu)
    const shadow = this.createPlaceholderSurface(
      menu,
      renderBounds,
      0x05090d,
      0.36,
      5,
      8,
    )
    const food = this.createPlaceholderSurface(
      menu,
      renderBounds,
      placeholderColor,
      1,
    )
    const shine = this.add.ellipse(
      -renderBounds.width * 0.2,
      -renderBounds.height * 0.24,
      renderBounds.width * 0.22,
      renderBounds.height * 0.2,
      0xffffff,
      0.22,
    )
    const label = this.add
      .text(0, 1, menu.nameKo, {
        align: 'center',
        color: '#18212b',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        wordWrap: { width: renderBounds.width * 0.78 },
      })
      .setOrigin(0.5)

    return {
      children: [shadow, food, shine, label],
      hasVisual: false,
      renderBounds,
    }
  }

  private getPlaceholderRenderBounds(
    menu: WeightedMenuCatalogEntry,
  ): TokenVisual['renderBounds'] {
    switch (menu.category) {
      case 'rice-meal':
        return { width: 108, height: 108 }
      case 'quick-meal':
        return { width: 118, height: 82 }
      case 'meat-grill':
        return { width: 124, height: 90 }
      case 'shared-dish':
        return { width: 122, height: 96 }
      case 'soup-stew':
      case 'noodle':
        return { width: 120, height: 88 }
    }
  }

  private createPlaceholderSurface(
    menu: WeightedMenuCatalogEntry,
    bounds: TokenVisual['renderBounds'],
    color: number,
    alpha: number,
    offsetX = 0,
    offsetY = 0,
  ): Phaser.GameObjects.Graphics {
    const graphic = this.add.graphics().setPosition(offsetX, offsetY)
    graphic.fillStyle(color, alpha)

    if (menu.category === 'quick-meal') {
      graphic.fillRoundedRect(
        -bounds.width / 2,
        -bounds.height / 2,
        bounds.width,
        bounds.height,
        22,
      )
    } else if (menu.category === 'meat-grill') {
      const halfWidth = bounds.width / 2
      const halfHeight = bounds.height / 2
      graphic.beginPath()
      graphic.moveTo(-halfWidth, -halfHeight * 0.18)
      graphic.lineTo(-halfWidth * 0.54, -halfHeight)
      graphic.lineTo(halfWidth * 0.28, -halfHeight * 0.86)
      graphic.lineTo(halfWidth, -halfHeight * 0.2)
      graphic.lineTo(halfWidth * 0.7, halfHeight * 0.82)
      graphic.lineTo(-halfWidth * 0.28, halfHeight)
      graphic.closePath()
      graphic.fillPath()
    } else {
      graphic.fillEllipse(
        0,
        0,
        bounds.width,
        bounds.height,
      )
    }

    return graphic
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const token = this.activeToken
    if (this.isFinished || !token || this.activePointerId !== null) {
      return
    }

    const startPoint = this.toPoint(pointer)
    const localStartPoint = this.toTokenLocalPoint(startPoint, token)
    const captureCount = this.rounds.filter(
      (round) => round.action.type === 'capture',
    ).length
    const startsOnCaptureTarget =
      Math.hypot(localStartPoint.x, localStartPoint.y) <= CAPTURE_HIT_RADIUS

    this.activePointerId = pointer.id
    this.isDrawing = true
    this.isSlicing = !startsOnCaptureTarget
    this.path = [startPoint]
    this.localPath = [localStartPoint]
    this.trail.clear()

    if (startsOnCaptureTarget && captureCount < MAX_CAPTURES) {
      this.startHoldCapture(token, pointer.id, startPoint)
    } else if (startsOnCaptureTarget) {
      this.feedbackText.setText('포획 2/2 완료 · 드래그하면 바로 베어요!')
    }

    this.clearGestureTimeout()
    this.gestureTimeout = this.time.delayedCall(
      MAX_GESTURE_DURATION_MS,
      () => this.cancelGesture(),
    )
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (
      !this.isDrawing ||
      pointer.id !== this.activePointerId ||
      !pointer.isDown ||
      !this.activeToken
    ) {
      return
    }

    const next = this.toPoint(pointer)
    const localNext = this.toTokenLocalPoint(next, this.activeToken)
    const appended = this.appendPathPoint(next, localNext)
    const start = this.path[0]
    const dragDistance = start
      ? Phaser.Math.Distance.BetweenPoints(start, next)
      : 0

    if (!this.isSlicing && dragDistance > CAPTURE_DRAG_THRESHOLD) {
      this.cancelHoldCapture()
      this.isSlicing = true
      this.feedbackText.setText('휙 드래그! 그대로 베기')
    }

    if (this.isSlicing && appended) {
      this.drawTrail()
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.isDrawing || pointer.id !== this.activePointerId) {
      return
    }

    if (pointer.wasCanceled) {
      this.cancelGesture()
      return
    }

    const token = this.activeToken
    const wasSlicing = this.isSlicing
    const releasedHoldEarly = this.holdCapture !== null
    this.clearGestureTimeout()
    this.cancelHoldCapture()
    this.isDrawing = false
    this.isSlicing = false
    this.activePointerId = null

    if (!token || this.activeToken?.container !== token.container) {
      this.path = []
      this.localPath = []
      this.trail.clear()
      return
    }

    if (wasSlicing) {
      const finalPoint = this.toPoint(pointer)
      const localFinalPoint = this.toTokenLocalPoint(finalPoint, token)
      this.appendPathPoint(finalPoint, localFinalPoint, 1)
      this.drawTrail()
      this.evaluateGesture()
    } else if (releasedHoldEarly) {
      this.feedbackText.setText('포획하려면 음식 위를 0.3초만 꾹 눌러주세요!')
    }

    if (this.activeToken?.container === token.container) {
      this.path = []
      this.localPath = []
    }

    this.time.delayedCall(180, () => {
      this.trail.clear()
    })
  }

  private appendPathPoint(
    point: Point,
    localPoint: Point,
    minimumDistance = PATH_SAMPLE_DISTANCE,
  ): boolean {
    const previous = this.path.at(-1)
    if (
      previous &&
      Phaser.Math.Distance.BetweenPoints(previous, point) < minimumDistance
    ) {
      return false
    }

    if (this.path.length >= MAX_PATH_POINTS) {
      const lastPoint = this.path.at(-1)
      const lastLocalPoint = this.localPath.at(-1)
      this.path = this.path.filter((_, index) => index % 2 === 0)
      this.localPath = this.localPath.filter((_, index) => index % 2 === 0)
      if (
        lastPoint &&
        lastLocalPoint &&
        this.path.at(-1) !== lastPoint
      ) {
        this.path.push(lastPoint)
        this.localPath.push(lastLocalPoint)
      }
    }

    this.path.push(point)
    this.localPath.push(localPoint)
    return true
  }

  private cancelGesture(): void {
    const wasDrawing = this.isDrawing
    const wasHolding = this.holdCapture !== null
    this.clearGestureTimeout()
    this.cancelHoldCapture()
    this.isDrawing = false
    this.isSlicing = false
    this.activePointerId = null
    this.path = []
    this.localPath = []
    this.trail.clear()

    if (wasDrawing && this.activeToken) {
      this.feedbackText.setText(
        wasHolding
          ? '포획이 취소됐어요 · 다시 음식 위를 꾹 눌러주세요!'
          : '베기가 취소됐어요 · 다시 드래그해 주세요!',
      )
    }
  }

  private clearGestureTimeout(): void {
    this.gestureTimeout?.remove(false)
    this.gestureTimeout = null
  }

  private teardownInput(): void {
    this.sensoryFeedback.stopAll()
    this.clearGestureTimeout()
    this.cancelHoldCapture()
    this.introTimer?.remove(false)
    this.introTimer = null
    this.introOverlay?.destroy(true)
    this.introOverlay = null
    this.clearMissWarning()
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this)
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this)
    this.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this)
    this.input.off(
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      this.cancelGesture,
      this,
    )
    this.input.off(Phaser.Input.Events.GAME_OUT, this.cancelGesture, this)
    this.game.events.off(Phaser.Core.Events.BLUR, this.cancelGesture, this)
  }

  private startHoldCapture(
    token: ActiveToken,
    pointerId: number,
    anchor: Point,
  ): void {
    const graphics = this.add.graphics().setDepth(23)
    const progress = { value: 0 }
    let state: HoldCaptureState | null = null
    const tween = this.tweens.add({
      targets: progress,
      value: 1,
      duration: CAPTURE_HOLD_DURATION_MS,
      ease: 'Linear',
      onUpdate: () => {
        if (state) {
          this.drawHoldCapture(state)
        }
      },
      onComplete: () => {
        if (state) {
          this.completeHoldCapture(state)
        }
      },
    })

    state = { token, pointerId, anchor, graphics, progress, tween }
    this.holdCapture = state
    this.drawHoldCapture(state)
    this.feedbackText.setText('그대로 꾹! 포획 게이지가 차면 성공!')
  }

  private drawHoldCapture(state: HoldCaptureState): void {
    const { x, y } = state.token.container
    const radius = JUDGEMENT_RADIUS + 11
    const endAngle = -Math.PI / 2 + Math.PI * 2 * state.progress.value

    state.graphics.clear()
    state.graphics.lineStyle(3, 0x55e6d1, 0.35)
    state.graphics.lineBetween(state.anchor.x, state.anchor.y, x, y)
    state.graphics.lineStyle(5, 0x394b61, 0.9)
    state.graphics.strokeCircle(x, y, radius)
    state.graphics.lineStyle(7, 0xffd76a, 1)
    state.graphics.beginPath()
    state.graphics.arc(x, y, radius, -Math.PI / 2, endAngle, false)
    state.graphics.strokePath()
    state.graphics.fillStyle(0xffd76a, 1)
    state.graphics.fillCircle(state.anchor.x, state.anchor.y, 5)
  }

  private completeHoldCapture(state: HoldCaptureState): void {
    const captureCount = this.rounds.filter(
      (round) => round.action.type === 'capture',
    ).length
    if (
      this.holdCapture !== state ||
      this.activePointerId !== state.pointerId ||
      !this.isDrawing ||
      this.isSlicing ||
      this.activeToken?.container !== state.token.container ||
      captureCount >= MAX_CAPTURES
    ) {
      this.cancelHoldCapture()
      return
    }

    this.holdCapture = null
    this.tweens.add({
      targets: state.graphics,
      alpha: 0,
      duration: 160,
      onComplete: () => state.graphics.destroy(),
    })
    this.resolveRound({ type: 'capture' })
  }

  private cancelHoldCapture(): void {
    const state = this.holdCapture
    this.holdCapture = null
    if (!state) {
      return
    }

    state.tween.stop()
    state.graphics.destroy()
  }

  private toTokenLocalPoint(point: Point, token: ActiveToken): Point {
    return {
      x: point.x - token.container.x,
      y: point.y - token.container.y,
    }
  }

  private evaluateGesture(): void {
    const token = this.activeToken
    if (!token || this.localPath.length < 2) {
      return
    }

    const circle: Circle = {
      center: { x: 0, y: 0 },
      radius: JUDGEMENT_RADIUS,
    }
    const decision = classifyGesture(this.localPath, circle, {
      intentPath: this.path,
    })

    if (import.meta.env.DEV) {
      console.debug('[gesture-classification]', {
        decision,
        circle,
      })
    }

    if (decision.kind === 'slice') {
      const worldDecision: SliceGestureDecision = {
        ...decision,
        chord: {
          entryPoint: {
            x: decision.chord.entryPoint.x + token.container.x,
            y: decision.chord.entryPoint.y + token.container.y,
          },
          exitPoint: {
            x: decision.chord.exitPoint.x + token.container.x,
            y: decision.chord.exitPoint.y + token.container.y,
          },
        },
      }
      this.lastSliceSource = decision.source
      this.resolveRound(
        {
          type: 'slice',
          accuracy: decision.result.accuracyScore,
        },
        worldDecision,
      )
    } else if (decision.reason === 'closed-invalid') {
      this.feedbackText.setText('포획은 원 대신 음식 위를 꾹 눌러주세요!')
    } else if (decision.reason === 'too-short') {
      this.feedbackText.setText('조금 더 길게 드래그하면 베어져요!')
    } else {
      this.feedbackText.setText('음식 안쪽을 스치도록 드래그해 보세요!')
    }
  }

  private resolveRound(
    action: RoundAction,
    decision?: SliceGestureDecision,
  ): void {
    const token = this.activeToken
    if (!token) {
      return
    }

    this.clearGestureTimeout()
    this.cancelHoldCapture()
    this.isDrawing = false
    this.isSlicing = false
    this.activePointerId = null
    this.path = []
    this.localPath = []
    if (action.type === 'miss') {
      this.trail.clear()
    }

    this.activeToken = null
    token.tween.stop()
    this.clearMissWarning()

    const roundIndex = this.rounds.length
    this.rounds.push({
      roundIndex,
      menuId: token.menu.id,
      action,
    })
    this.persistCompletedRounds()

    this.updateHud()

    if (action.type === 'capture') {
      this.feedbackText
        .setColor('#ffd76a')
        .setText(
          token.menu.nameKo +
            ' 포획! ' +
            (this.filledCaptureSlotCount + 1) +
            '/' +
            MAX_CAPTURES,
        )
      this.triggerSensory('capture')
      this.playCaptureResolution(token)
    } else if (action.type === 'slice') {
      if (!decision || decision.kind !== 'slice') {
        throw new Error('베기 연출에는 베기 제스처 결정이 필요합니다.')
      }
      const roundedScore = getDisplayedSliceAccuracy(action.accuracy)
      const sliceFeedback = getSliceFeedback(action.accuracy)
      this.triggerSensory(SLICE_SENSORY_CUE[sliceFeedback.level])
      this.feedbackText
        .setColor(sliceFeedback.cssColor)
        .setText(
          sliceFeedback.label + ' ' + roundedScore.toFixed(1) + '%',
        )
      this.playSliceResolution(
        token,
        decision,
        roundedScore,
        sliceFeedback,
      )
    } else {
      this.triggerSensory('miss')
      this.feedbackText
        .setColor('#ff9b7c')
        .setText(token.menu.nameKo + ' 놓침 · 0점')
      this.showMissPopup(token.container.x, MISS_LINE_Y - 18)
      this.cameras.main.flash(120, 255, 86, 72, false)
      this.cameras.main.shake(80, 0.0025)
      this.tweens.add({
        targets: token.container,
        alpha: 0,
        duration: 180,
        onComplete: () => token.container.destroy(),
      })
    }

    const nextRoundDelay =
      action.type === 'capture'
        ? CAPTURE_EFFECT_DURATION_MS + 60
        : action.type === 'slice'
          ? SLICE_EFFECT_DURATION_MS + 60
          : 260
    this.time.delayedCall(nextRoundDelay, () => this.spawnRound())
  }

  private persistCompletedRounds(): void {
    const progressIdentity = this.launchOptions.progressIdentity
    if (!progressIdentity || !this.progressStore) {
      return
    }

    this.progressStore.save(
      progressIdentity,
      this.rounds,
      this.deck.map((menu) => menu.id),
    )
  }

  private restoreCapturedMenus(): void {
    const capturedMenuIds = this.rounds
      .filter((round) => round.action.type === 'capture')
      .map((round) => round.menuId)

    capturedMenuIds.forEach((menuId, captureIndex) => {
      const slot = this.captureSlots[captureIndex]
      const menu = this.deck.find((entry) => entry.id === menuId)
      if (slot && menu) {
        this.populateCaptureSlot(slot, menu)
      }
    })
  }

  private playCaptureResolution(token: ActiveToken): void {
    this.drawCaptureBurst({ x: token.container.x, y: token.container.y })
    this.cameras.main.shake(70, 0.002)

    const captureIndex =
      this.rounds.filter((round) => round.action.type === 'capture').length - 1
    const slot = this.captureSlots[captureIndex]
    const target = slot?.center ?? { x: LOGICAL_WIDTH - 42, y: 113 }

    this.activeCaptureEffect = token.container
    this.tweens.add({
      targets: token.container,
      x: target.x,
      y: target.y,
      angle: 360,
      scale: 0.2,
      alpha: 0.9,
      duration: CAPTURE_EFFECT_DURATION_MS,
      ease: 'Cubic.Out',
      onComplete: () => {
        if (this.activeCaptureEffect === token.container) {
          this.activeCaptureEffect = null
        }
        token.container.destroy()
        if (slot) {
          this.populateCaptureSlot(slot, token.menu)
        }
      },
    })
  }

  private drawCaptureBurst(center: Point): void {
    const ring = this.add
      .circle(center.x, center.y, JUDGEMENT_RADIUS + 10, 0x55e6d1, 0.08)
      .setStrokeStyle(8, 0xffd76a, 1)
      .setDepth(22)

    this.tweens.add({
      targets: ring,
      scale: 1.45,
      alpha: 0,
      duration: 240,
      ease: 'Back.Out',
      onComplete: () => ring.destroy(),
    })
  }

  private populateCaptureSlot(
    slot: CaptureSlot,
    menu: WeightedMenuCatalogEntry,
  ): void {
    if (slot.filled) {
      return
    }

    slot.filled = true
    slot.numberLabel.destroy()
    this.add
      .circle(
        slot.center.x,
        slot.center.y,
        11,
        Number.parseInt(menu.placeholderColor.slice(1), 16),
        0.72,
      )
      .setDepth(12)

    const visual = getMenuVisual(menu.id)
    const image = getPreloadedMenuImage(menu.id)
    if (visual && image && this.textures.exists(visual.textureKey)) {
      const size = calculateContainedSize(
        image.naturalWidth,
        image.naturalHeight,
        22,
        22,
      )
      this.add
        .image(slot.center.x, slot.center.y, visual.textureKey)
        .setDisplaySize(size.width, size.height)
        .setDepth(13)
    } else {
      this.add
        .text(slot.center.x, slot.center.y, menu.nameKo.slice(0, 1), {
          color: '#fff8e7',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(13)
    }

    this.filledCaptureSlotCount += 1
  }

  private playSliceResolution(
    token: ActiveToken,
    decision: SliceGestureDecision,
    roundedScore: number,
    feedback: Readonly<SliceFeedback>,
  ): void {
    const { entryPoint, exitPoint } = decision.chord
    const deltaX = exitPoint.x - entryPoint.x
    const deltaY = exitPoint.y - entryPoint.y
    const length = Math.hypot(deltaX, deltaY)
    const tangent = { x: deltaX / length, y: deltaY / length }
    const normal = { x: -tangent.y, y: tangent.x }
    this.lastSliceAngleDegrees = Phaser.Math.RadToDeg(
      Math.atan2(deltaY, deltaX),
    )

    const firstVisual = this.createTokenVisual(token.menu)
    const secondVisual = this.createTokenVisual(token.menu)
    const firstPiece = this.add
      .container(token.container.x, token.container.y, firstVisual.children)
      .setDepth(7)
    const secondPiece = this.add
      .container(token.container.x, token.container.y, secondVisual.children)
      .setDepth(7)
    const maskOrigin = {
      x: token.container.x,
      y: token.container.y,
    }
    const firstMaskGraphic = this.createHalfPlaneMask(
      entryPoint,
      exitPoint,
      1,
      maskOrigin,
    )
    const secondMaskGraphic = this.createHalfPlaneMask(
      entryPoint,
      exitPoint,
      -1,
      maskOrigin,
    )
    const firstMask = this.attachSliceMask(firstPiece, firstMaskGraphic)
    const secondMask = this.attachSliceMask(secondPiece, secondMaskGraphic)
    this.children.remove(firstMaskGraphic)
    this.children.remove(secondMaskGraphic)
    token.container.destroy()

    this.drawCutFlash(entryPoint, exitPoint)
    this.showAccuracyPopup(
      (entryPoint.x + exitPoint.x) / 2,
      (entryPoint.y + exitPoint.y) / 2,
      roundedScore,
      feedback,
    )
    this.cameras.main.shake(85, 0.0035)

    this.animateSlicePiece(
      firstPiece,
      firstMaskGraphic,
      firstMask,
      normal,
      1,
    )
    this.animateSlicePiece(
      secondPiece,
      secondMaskGraphic,
      secondMask,
      normal,
      -1,
    )
  }

  private attachSliceMask(
    piece: Phaser.GameObjects.Container,
    maskGraphic: Phaser.GameObjects.Graphics,
  ): Phaser.Filters.Mask | null {
    piece.enableFilters()
    const filterList = piece.filters?.external

    if (filterList) {
      return filterList.addMask(
        maskGraphic,
        false,
        this.cameras.main,
        'world',
      )
    }

    piece.setMask(maskGraphic.createGeometryMask())
    return null
  }

  private createHalfPlaneMask(
    lineStart: Point,
    lineEnd: Point,
    side: 1 | -1,
    origin: Point,
  ): Phaser.GameObjects.Graphics {
    const deltaX = lineEnd.x - lineStart.x
    const deltaY = lineEnd.y - lineStart.y
    const length = Math.hypot(deltaX, deltaY)
    if (length <= 0) {
      throw new RangeError('절단 마스크에는 서로 다른 두 점이 필요합니다.')
    }

    const tangent = { x: deltaX / length, y: deltaY / length }
    const normal = { x: -tangent.y * side, y: tangent.x * side }
    const midpoint = {
      x: (lineStart.x + lineEnd.x) / 2,
      y: (lineStart.y + lineEnd.y) / 2,
    }
    const extent = LOGICAL_WIDTH + LOGICAL_HEIGHT
    const baseStart = {
      x: midpoint.x - tangent.x * extent,
      y: midpoint.y - tangent.y * extent,
    }
    const baseEnd = {
      x: midpoint.x + tangent.x * extent,
      y: midpoint.y + tangent.y * extent,
    }
    const outerEnd = {
      x: baseEnd.x + normal.x * extent,
      y: baseEnd.y + normal.y * extent,
    }
    const outerStart = {
      x: baseStart.x + normal.x * extent,
      y: baseStart.y + normal.y * extent,
    }

    const maskGraphic = this.add
      .graphics()
      .setPosition(origin.x, origin.y)
      .setDepth(-100)
    maskGraphic.fillStyle(0xffffff, 1)
    maskGraphic.beginPath()
    maskGraphic.moveTo(baseStart.x - origin.x, baseStart.y - origin.y)
    maskGraphic.lineTo(baseEnd.x - origin.x, baseEnd.y - origin.y)
    maskGraphic.lineTo(outerEnd.x - origin.x, outerEnd.y - origin.y)
    maskGraphic.lineTo(outerStart.x - origin.x, outerStart.y - origin.y)
    maskGraphic.closePath()
    maskGraphic.fillPath()
    return maskGraphic
  }

  private animateSlicePiece(
    piece: Phaser.GameObjects.Container,
    maskGraphic: Phaser.GameObjects.Graphics,
    maskFilter: Phaser.Filters.Mask | null,
    normal: Point,
    side: 1 | -1,
  ): void {
    const effectState = {
      x: piece.x,
      y: piece.y,
      angle: piece.angle,
      alpha: piece.alpha,
    }
    this.activeSlicePieceCount += 1

    this.tweens.add({
      targets: effectState,
      x: piece.x + normal.x * side * 34,
      y: piece.y + normal.y * side * 34 + 18,
      angle: side * 9,
      alpha: 0,
      duration: SLICE_EFFECT_DURATION_MS,
      ease: 'Quad.Out',
      onUpdate: () => {
        piece
          .setPosition(effectState.x, effectState.y)
          .setAngle(effectState.angle)
          .setAlpha(effectState.alpha)
        maskGraphic
          .setPosition(effectState.x, effectState.y)
          .setAngle(effectState.angle)
      },
      onComplete: () => {
        if (maskFilter) {
          piece.filters?.external.remove(maskFilter, true)
        } else {
          piece.clearMask(true)
        }
        piece.destroy()
        maskGraphic.destroy()
        this.activeSlicePieceCount -= 1
        this.cleanedSlicePieceCount += 1
      },
    })
  }

  private drawCutFlash(lineStart: Point, lineEnd: Point): void {
    const flash = this.add.graphics().setDepth(24)
    flash.lineStyle(15, 0x55e6d1, 0.25)
    flash.beginPath()
    flash.moveTo(lineStart.x, lineStart.y)
    flash.lineTo(lineEnd.x, lineEnd.y)
    flash.strokePath()
    flash.lineStyle(4, 0xffffff, 1)
    flash.beginPath()
    flash.moveTo(lineStart.x, lineStart.y)
    flash.lineTo(lineEnd.x, lineEnd.y)
    flash.strokePath()

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 190,
      ease: 'Quad.Out',
      onComplete: () => flash.destroy(),
    })
  }

  private showAccuracyPopup(
    x: number,
    y: number,
    score: number,
    feedback: Readonly<SliceFeedback>,
  ): void {
    const popupStartY = Math.max(y - 26, ACCURACY_POPUP_MIN_Y)
    const popup = this.add
      .text(
        x,
        popupStartY,
        feedback.label + '\n' + score.toFixed(1) + '%',
        {
          align: 'center',
          color: feedback.cssColor,
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '27px',
          fontStyle: 'bold',
          lineSpacing: 2,
          stroke: '#101821',
          strokeThickness: 6,
        },
      )
      .setOrigin(0.5)
      .setDepth(25)

    this.tweens.add({
      targets: popup,
      y: popup.y - 50,
      scale: feedback.level === 'perfect' ? 1.12 : 1,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.Out',
      onComplete: () => popup.destroy(),
    })
  }

  private showMissPopup(x: number, y: number): void {
    const popup = this.add
      .text(x, y, 'MISS\n0점', {
        align: 'center',
        color: '#ff795f',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        lineSpacing: 2,
        stroke: '#101821',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(25)

    this.tweens.add({
      targets: popup,
      y: popup.y - 42,
      alpha: 0,
      duration: 560,
      ease: 'Cubic.Out',
      onComplete: () => popup.destroy(),
    })
  }

  private updateHud(): void {
    const completed = this.rounds.length
    const captures = this.rounds.filter(
      (round) => round.action.type === 'capture',
    ).length
    const nonCaptured = this.rounds.filter(
      (round) => round.action.type !== 'capture',
    )
    const accuracyTotal = nonCaptured.reduce((total, round) => {
      return (
        total +
        (round.action.type === 'slice' ? round.action.accuracy : 0)
      )
    }, 0)
    const average =
      nonCaptured.length > 0 ? accuracyTotal / nonCaptured.length : 0

    this.progressText.setText(
      `${Math.min(completed + 1, TOTAL_ROUNDS)}/${TOTAL_ROUNDS}`,
    )
    this.scoreText.setText(
      nonCaptured.length > 0
        ? '현재 평균 ' + average.toFixed(1)
        : '현재 평균 —',
    )
    this.captureText.setText(`포획 ${captures}/${MAX_CAPTURES}`)
  }

  private showResults(): void {
    this.isFinished = true
    if (this.launchOptions.mode === 'solo') {
      this.triggerSensory('results')
    }
    this.progressText.setText(`${TOTAL_ROUNDS}/${TOTAL_ROUNDS}`)

    const summary = calculatePlayerScore(this.rounds)
    this.reportGameResult(summary)
    const capturedNames = summary.capturedMenuIds
      .map((menuId) => {
        return this.deck.find((menu) => menu.id === menuId)?.nameKo
      })
      .filter((name): name is string => Boolean(name))

    const shade = this.add
      .rectangle(
        LOGICAL_WIDTH / 2,
        LOGICAL_HEIGHT / 2,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
        0x080d13,
        0.78,
      )
      .setDepth(30)

    const panel = this.add
      .rectangle(
        LOGICAL_WIDTH / 2,
        LOGICAL_HEIGHT / 2,
        326,
        466,
        0x243244,
        1,
      )
      .setStrokeStyle(3, 0xffd76a, 0.9)
      .setDepth(31)

    this.add
      .text(LOGICAL_WIDTH / 2, 244, '프로토타입 결과', {
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(32)

    this.add
      .text(LOGICAL_WIDTH / 2, 313, `${summary.score.toFixed(1)}점`, {
        color: '#55e6d1',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '48px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(32)

    this.add
      .text(
        LOGICAL_WIDTH / 2,
        373,
        `비포획 ${summary.denominator}개 평균\n놓침 ${summary.missCount}개`,
        {
          align: 'center',
          color: '#c8d2df',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '17px',
          lineSpacing: 8,
        },
      )
      .setOrigin(0.5)
      .setDepth(32)

    this.add
      .text(
        LOGICAL_WIDTH / 2,
        462,
        `포획 메뉴\n${capturedNames.length > 0 ? capturedNames.join(' · ') : '포획 없음'}`,
        {
          align: 'center',
          color: '#ffd76a',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '18px',
          fontStyle: 'bold',
          lineSpacing: 9,
          wordWrap: { width: 280 },
        },
      )
      .setOrigin(0.5)
      .setDepth(32)

    const retryButton = this.add
      .rectangle(LOGICAL_WIDTH / 2, 552, 230, 54, 0xff795f, 1)
      .setDepth(32)
      .setInteractive({ useHandCursor: true })

    this.add
      .text(LOGICAL_WIDTH / 2, 552, '다시 해보기', {
        color: '#181f27',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(33)

    const homeButton = this.add
      .rectangle(LOGICAL_WIDTH / 2, 622, 230, 48, 0x394b61, 1)
      .setStrokeStyle(2, 0x8fa4bb, 0.8)
      .setDepth(32)
      .setInteractive({ useHandCursor: true })

    this.add
      .text(LOGICAL_WIDTH / 2, 622, '홈으로', {
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(33)

    retryButton.on(Phaser.Input.Events.POINTER_UP, () => {
      this.scene.restart()
    })

    homeButton.on(Phaser.Input.Events.POINTER_UP, () => {
      this.game.events.emit('return-home')
    })

    shade.setInteractive()
    panel.setInteractive()
    this.feedbackText.setText('포획은 선택, 점수는 비포획 평균!')
  }

  private drawTrail(): void {
    this.trail.clear()
    if (this.path.length < 2) {
      return
    }

    const first = this.path[0]
    if (!first) {
      return
    }

    for (const style of [
      { width: 15, color: 0x55e6d1, alpha: 0.2 },
      { width: 5, color: 0xfff8e7, alpha: 0.95 },
    ]) {
      this.trail.lineStyle(style.width, style.color, style.alpha)
      this.trail.beginPath()
      this.trail.moveTo(first.x, first.y)

      for (let index = 1; index < this.path.length; index += 1) {
        const point = this.path[index]!
        this.trail.lineTo(point.x, point.y)
      }

      this.trail.strokePath()
    }

    const finalPoint = this.path.at(-1)!
    this.trail.fillStyle(0xfff8e7, 1)
    this.trail.fillCircle(first.x, first.y, 4)
    this.trail.fillCircle(finalPoint.x, finalPoint.y, 4)
  }

  private toPoint(pointer: Phaser.Input.Pointer): Point {
    return {
      x: pointer.worldX,
      y: pointer.worldY,
    }
  }
}

import Phaser from 'phaser'
import chefCatImageUrl from '../../assets/title/chef-cat-v1.webp'
import {
  NOOP_SENSORY_FEEDBACK,
  type SensoryCue,
  type SensoryFeedback,
  type SensoryFeedbackDebugState,
} from '../../feedback/SensoryFeedback'
import { getRoundMusicIntensity } from '../../feedback/arcadeBgm'
import type { NarrationPreference } from '../../feedback/narrationPreference'
import type { PlacedSilhouette } from '../../domain/alphaSilhouette'
import { type Circle, type Point } from '../../domain/geometry'
import {
  classifyGesture,
  type GestureMetrics,
  type SliceGestureDecision,
} from '../../domain/gestureClassifier'
import { classifySilhouetteGesture } from '../../domain/silhouetteGestureClassifier'
import {
  transformLocalPointToWorld,
  transformWorldPointToLocal,
} from '../../domain/rigidTransform'
import {
  DEFAULT_DECK_SIZE,
  MAX_CAPTURES,
  calculatePlayerScore,
  getRoundFallDurationMs,
  type RoundAction,
  type RoundResult,
} from '../../domain/gameRules'
import type { WeightedMenuCatalogEntry } from '../../data/menus'
import { getMenuNarration } from '../../data/menuNarrations'
import {
  calculateContainedSize,
  getCanonicalMenuGameplayGeometry,
  getMenuVisual,
  getPreloadedMenuImage,
} from '../../data/menuVisuals'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../createGame'
import { createGameMenuDeck } from '../gameDeck'
import {
  getRoundHorizontalMotion,
  getRoundRotationMotion,
} from '../roundMotion'
import {
  createPlayerGameResultReporter,
  DEFAULT_GAME_LAUNCH_OPTIONS,
  resolvePersonalBestPresentation,
  TUTORIAL_COMPLETE_EVENT,
  type GameLaunchOptions,
  type PersonalBestPresentation,
  type PlayerGameResultHandler,
} from '../gameTypes'
import type { RoomGameProgressStore } from '../gameProgress'
import {
  getDisplayedSliceAccuracy,
  getSliceFeedback,
  type SliceFeedback,
} from '../gameFeedback'
import {
  getSliceImpactProfile,
  type SliceImpactProfile,
} from '../sliceImpactProfile'

const TOTAL_ROUNDS = DEFAULT_DECK_SIZE
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
const CAPTURE_EFFECT_DURATION_MS = 480
const SLICE_ROUND_TRANSITION_MS = 500
const INTRO_AUTO_DISMISS_MS = 2_300
const PRACTICE_FALL_DURATION_MS = 7_000
const SLICE_STREAK_MILESTONES = [3, 5, 8] as const
const MISS_WARNING_DISTANCE = 128
const FINAL_SPRINT_ROUND_INDEX = 15
const FINAL_SPRINT_BANNER_MS = 760
const FINAL_TWO_ROUND_INDEX = 18
const TOKEN_LABEL_HALF_WIDTH = 64
const TOKEN_HORIZONTAL_EDGE_PADDING = 18
const HUD_SCORE_CENTER_X = 170
const ACCURACY_POPUP_MIN_Y = 232
const ROOM_SOUND_SCALE = 0.86
const NARRATION_CAPTION_VISIBLE_MS = 1_400
const NARRATION_CAPTION_FADE_MS = 180
const TRAIL_RECENT_POINT_LIMIT = 30
const CHEF_CAT_TEXTURE_KEY = 'title-chef-cat'
const SLICE_SENSORY_CUE = Object.freeze({
  'needs-practice': 'slice-low',
  good: 'slice-good',
  great: 'slice-great',
  perfect: 'slice-perfect',
} satisfies Record<SliceFeedback['level'], SensoryCue>)

interface GameplaySliceDecision {
  readonly kind: 'slice'
  readonly chord: {
    readonly entryPoint: Point
    readonly exitPoint: Point
  }
  readonly result: { readonly accuracyScore: number }
  readonly source: SliceGestureDecision['source']
  readonly metrics: GestureMetrics
}

interface TokenVisual {
  readonly children: Phaser.GameObjects.GameObject[]
  readonly rotatingArtwork: Phaser.GameObjects.Container
  readonly hasVisual: boolean
  readonly shadowKind: 'alpha-shadow' | 'none' | 'shape-fallback'
  readonly silhouette: PlacedSilhouette | null
  readonly captureCenter: Point
  readonly horizontalSafetyRadius: number
  readonly renderBounds: {
    readonly width: number
    readonly height: number
  }
}

interface ActiveToken {
  readonly menu: WeightedMenuCatalogEntry
  readonly container: Phaser.GameObjects.Container
  readonly tween: Phaser.Tweens.Tween
  readonly rotatingArtwork: Phaser.GameObjects.Container
  readonly rotationTween: Phaser.Tweens.Tween | null
  readonly rotationTargetDegrees: number
  readonly rotationDirection: -1 | 0 | 1
  readonly horizontalBaseX: number
  readonly horizontalRequestedAmplitude: number
  readonly horizontalAmplitude: number
  readonly horizontalCycles: number
  readonly horizontalDirection: -1 | 0 | 1
  readonly fallDurationMs: number
  readonly hasVisual: boolean
  readonly shadowKind: TokenVisual['shadowKind']
  readonly silhouette: PlacedSilhouette | null
  readonly captureCenter: Point
  readonly horizontalSafetyRadius: number
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

type PracticeStage = 'slice' | 'capture' | 'complete'
type CompletedPracticeAction = Exclude<PracticeStage, 'complete'>

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
  private narrationCaption: Phaser.GameObjects.Container | null = null
  private narrationCaptionText: Phaser.GameObjects.Text | null = null
  private chefMascot: Phaser.GameObjects.Image | null = null
  private narrationCaptionTimer: Phaser.Time.TimerEvent | null = null
  private narrationPreferenceUnsubscribe: (() => void) | null = null
  private narrationControlSync: (() => void) | null = null
  private narrationCaptionGeneration = 0
  private narrationMenuId: string | null = null
  private narrationText: string | null = null
  private narrationAudioStarted = false
  private activeToken: ActiveToken | null = null
  private holdCapture: HoldCaptureState | null = null
  private activeCaptureEffect: Phaser.GameObjects.Container | null = null
  private captureSlots: CaptureSlot[] = []
  private filledCaptureSlotCount = 0
  private lastSliceAngleDegrees: number | null = null
  private lastSliceSource: SliceGestureDecision['source'] | null = null
  private lastSliceFxTier: SliceFeedback['level'] | null = null
  private lastSliceFxProfile: Readonly<SliceImpactProfile> | null = null
  private activeSlicePieceCount = 0
  private cleanedSlicePieceCount = 0
  private activeSliceFxObjectCount = 0
  private cleanedSliceFxObjectCount = 0
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
  private reducedMotion = false
  private practiceStage: PracticeStage = 'complete'
  private tutorialComplete = false
  private completedPracticeActions: CompletedPracticeAction[] = []
  private currentSliceStreak = 0
  private lastAnnouncedSliceStreak: number | null = null
  private activeSliceStreakBanner: number | null = null
  private personalBestScoreBeforeRun: number | undefined
  private lastPersonalBestPresentation: Readonly<PersonalBestPresentation> | null =
    null

  constructor(
    private readonly launchOptions: GameLaunchOptions =
      DEFAULT_GAME_LAUNCH_OPTIONS,
    private readonly onGameResult?: PlayerGameResultHandler,
    private readonly progressStore?: RoomGameProgressStore,
    private readonly sensoryFeedback: SensoryFeedback =
      NOOP_SENSORY_FEEDBACK,
    private readonly narrationPreference?: NarrationPreference,
  ) {
    super('prototype')
    this.personalBestScoreBeforeRun =
      launchOptions.previousPersonalBestScore
  }

  init(): void {
    this.resetRunState()
    this.reducedMotion = this.detectReducedMotion()
    this.deck = createGameMenuDeck(this.launchOptions)

    const isTutorial = this.launchOptions.launchMode === 'tutorial'
    const progressIdentity = this.launchOptions.progressIdentity
    if (!isTutorial && progressIdentity && this.progressStore) {
      this.rounds = [
        ...this.progressStore.load(
          progressIdentity,
          this.deck.map((menu) => menu.id),
        ),
      ]
    }

    if (isTutorial) {
      this.practiceStage = 'slice'
    } else {
      this.practiceStage = 'complete'
    }
    this.currentSliceStreak = this.rounds.reduce((streak, round) => {
      if (round.action.type === 'miss') {
        return 0
      }
      return round.action.type === 'slice' ? streak + 1 : streak
    }, 0)
  }

  create(): void {
    this.reportGameResult = createPlayerGameResultReporter(
      this.launchOptions,
      this.onGameResult,
    )

    this.registerMenuTextures()
    this.drawArena()
    this.createHud()
    this.createChefMascot()
    this.createNarrationCaption()
    this.bindNarrationPreference()
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
    if (this.practiceStage !== 'complete') {
      this.sensoryFeedback.startMusic(getRoundMusicIntensity(0))
      this.showIntroGuide()
    } else {
      this.time.delayedCall(500, () => this.spawnRound())
    }
  }

  private resetRunState(): void {
    this.gestureTimeout?.remove(false)
    this.narrationCaptionTimer?.remove(false)
    this.narrationPreferenceUnsubscribe?.()
    this.holdCapture?.tween.stop()
    this.holdCapture?.graphics.destroy()
    this.introTimer?.remove(false)
    this.introOverlay?.destroy(true)
    this.activeToken = null
    this.activeCaptureEffect = null
    this.holdCapture = null
    this.introOverlay = null
    this.introTimer = null
    this.narrationCaption = null
    this.narrationCaptionText = null
    this.chefMascot = null
    this.narrationCaptionTimer = null
    this.narrationPreferenceUnsubscribe = null
    this.narrationControlSync = null
    this.narrationCaptionGeneration = 0
    this.narrationMenuId = null
    this.narrationText = null
    this.narrationAudioStarted = false
    this.missWarningLine = null
    this.captureSlots = []
    this.filledCaptureSlotCount = 0
    this.lastSliceAngleDegrees = null
    this.lastSliceSource = null
    this.lastSliceFxTier = null
    this.lastSliceFxProfile = null
    this.activeSlicePieceCount = 0
    this.cleanedSlicePieceCount = 0
    this.activeSliceFxObjectCount = 0
    this.cleanedSliceFxObjectCount = 0
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
    this.reducedMotion = false
    this.practiceStage = 'complete'
    this.tutorialComplete = false
    this.completedPracticeActions = []
    this.currentSliceStreak = 0
    this.lastAnnouncedSliceStreak = null
    this.activeSliceStreakBanner = null
    this.lastPersonalBestPresentation = null
  }

  getDebugState(): {
    readonly activeToken: {
      readonly x: number
      readonly y: number
      readonly menuId: string
      readonly fallDurationMs: number
      readonly captureCenter: Point
      readonly currentCaptureCenter: Point
      readonly rotation: {
        readonly enabled: boolean
        readonly direction: -1 | 0 | 1
        readonly turns: number
        readonly targetDegrees: number
        readonly currentDegrees: number
        readonly labelDegrees: 0
      }
      readonly horizontal: {
        readonly enabled: boolean
        readonly direction: -1 | 0 | 1
        readonly requestedAmplitude: number
        readonly amplitude: number
        readonly cycles: number
        readonly baseX: number
        readonly currentOffset: number
      }
      readonly judgement:
        | {
            readonly kind: 'alpha-mask'
            readonly radius: number
            readonly width: number
            readonly height: number
            readonly opaquePixelCount: number
            readonly alphaThreshold: number
            readonly centerX: number
            readonly centerY: number
          }
        | {
            readonly kind: 'circle-fallback'
            readonly radius: number
          }
      readonly visual: {
        readonly hasVisual: boolean
        readonly shadowKind: TokenVisual['shadowKind']
        readonly width: number
        readonly height: number
        readonly horizontalSafetyRadius: number
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
    readonly lastSliceFxTier: SliceFeedback['level'] | null
    readonly lastSliceFxProfile: Readonly<SliceImpactProfile> | null
    readonly reducedMotion: boolean
    readonly inputMode: 'idle' | 'hold' | 'slice'
    readonly activeSlicePieceCount: number
    readonly cleanedSlicePieceCount: number
    readonly activeSliceFxObjectCount: number
    readonly cleanedSliceFxObjectCount: number
    readonly lastAction: RoundAction['type'] | null
    readonly feedback: string
    readonly mealTime: GameLaunchOptions['mealTime']
    readonly deckSeed: GameLaunchOptions['deckSeed']
    readonly deckMenuIds: readonly string[]
    readonly introVisible: boolean
    readonly practiceStage: PracticeStage
    readonly tutorialComplete: boolean
    readonly completedPracticeActions: readonly CompletedPracticeAction[]
    readonly currentSliceStreak: number
    readonly lastAnnouncedSliceStreak: number | null
    readonly activeSliceStreakBanner: number | null
    readonly personalBestPresentation: Readonly<PersonalBestPresentation> | null
    readonly missWarningActive: boolean
    readonly finalSprintAnnounced: boolean
    readonly narration: {
      readonly menuId: string | null
      readonly text: string | null
      readonly captionVisible: boolean
      readonly requestedEnabled: boolean
      readonly effectiveEnabled: boolean
      readonly audioStarted: boolean
    }
    readonly sensoryFeedback: Readonly<SensoryFeedbackDebugState>
  } {
    const narrationState = this.narrationPreference?.getState() ?? {
      requestedEnabled: false,
      effectiveEnabled: false,
    }
    return {
      activeToken: this.activeToken
        ? {
            x: this.activeToken.container.x,
            y: this.activeToken.container.y,
            menuId: this.activeToken.menu.id,
            fallDurationMs: this.activeToken.fallDurationMs,
            captureCenter: this.activeToken.captureCenter,
            currentCaptureCenter: this.getCurrentCaptureCenter(
              this.activeToken,
            ),
            rotation: {
              enabled: this.activeToken.rotationTargetDegrees !== 0,
              direction: this.activeToken.rotationDirection,
              turns:
                Math.abs(this.activeToken.rotationTargetDegrees) / 360,
              targetDegrees: this.activeToken.rotationTargetDegrees,
              currentDegrees: Phaser.Math.RadToDeg(
                this.activeToken.rotatingArtwork.rotation,
              ),
              labelDegrees: 0,
            },
            horizontal: {
              enabled: this.activeToken.horizontalAmplitude > 0,
              direction: this.activeToken.horizontalDirection,
              requestedAmplitude:
                this.activeToken.horizontalRequestedAmplitude,
              amplitude: this.activeToken.horizontalAmplitude,
              cycles: this.activeToken.horizontalCycles,
              baseX: this.activeToken.horizontalBaseX,
              currentOffset:
                this.activeToken.container.x -
                this.activeToken.horizontalBaseX,
            },
            judgement: this.activeToken.silhouette
              ? {
                  kind: 'alpha-mask',
                  radius: JUDGEMENT_RADIUS,
                  width: this.activeToken.silhouette.mask.width,
                  height: this.activeToken.silhouette.mask.height,
                  opaquePixelCount:
                    this.activeToken.silhouette.mask.opaquePixelCount,
                  alphaThreshold:
                    this.activeToken.silhouette.mask.alphaThreshold,
                  centerX: this.activeToken.silhouette.center.x,
                  centerY: this.activeToken.silhouette.center.y,
                }
              : {
                  kind: 'circle-fallback',
                  radius: JUDGEMENT_RADIUS,
                },
            visual: {
              hasVisual: this.activeToken.hasVisual,
              shadowKind: this.activeToken.shadowKind,
              width: this.activeToken.renderBounds.width,
              height: this.activeToken.renderBounds.height,
              horizontalSafetyRadius:
                this.activeToken.horizontalSafetyRadius,
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
      lastSliceFxTier: this.lastSliceFxTier,
      lastSliceFxProfile: this.lastSliceFxProfile,
      reducedMotion: this.reducedMotion,
      inputMode: this.holdCapture
        ? 'hold'
        : this.isSlicing
          ? 'slice'
          : 'idle',
      activeSlicePieceCount: this.activeSlicePieceCount,
      cleanedSlicePieceCount: this.cleanedSlicePieceCount,
      activeSliceFxObjectCount: this.activeSliceFxObjectCount,
      cleanedSliceFxObjectCount: this.cleanedSliceFxObjectCount,
      lastAction: this.rounds.at(-1)?.action.type ?? null,
      feedback: this.feedbackText?.text ?? '',
      mealTime: this.launchOptions.mealTime,
      deckSeed: this.launchOptions.deckSeed,
      deckMenuIds: this.deck.map((menu) => menu.id),
      introVisible: this.introOverlay !== null,
      practiceStage: this.practiceStage,
      tutorialComplete: this.tutorialComplete,
      completedPracticeActions: [...this.completedPracticeActions],
      currentSliceStreak: this.currentSliceStreak,
      lastAnnouncedSliceStreak: this.lastAnnouncedSliceStreak,
      activeSliceStreakBanner: this.activeSliceStreakBanner,
      personalBestPresentation: this.lastPersonalBestPresentation,
      missWarningActive: this.missWarningActive,
      finalSprintAnnounced: this.finalSprintAnnounced,
      narration: {
        menuId: this.narrationMenuId,
        text: this.narrationText,
        captionVisible: Boolean(
          this.narrationCaption?.visible && this.narrationCaption.alpha > 0,
        ),
        requestedEnabled: narrationState.requestedEnabled,
        effectiveEnabled: narrationState.effectiveEnabled,
        audioStarted: this.narrationAudioStarted,
      },
      sensoryFeedback: this.sensoryFeedback.getDebugState(),
    }
  }

  skipPracticeForTest(): void {
    if (
      !import.meta.env.DEV ||
      this.launchOptions.launchMode !== 'tutorial' ||
      this.practiceStage === 'complete'
    ) {
      return
    }

    this.dismissIntroGuide(false)
    this.clearGestureTimeout()
    this.cancelHoldCapture()
    this.isDrawing = false
    this.isSlicing = false
    this.activePointerId = null
    this.path = []
    this.localPath = []
    this.trail?.clear()

    const token = this.activeToken
    this.activeToken = null
    token?.tween.stop()
    token?.rotationTween?.stop()
    token?.container.destroy()
    this.clearMissWarning()

    this.practiceStage = 'complete'
    this.completedPracticeActions = ['slice', 'capture']
    this.updateHud()
    this.time.delayedCall(0, () => this.showTutorialComplete())
  }

  private detectReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  private getEffectiveSliceImpactProfile(
    level: SliceFeedback['level'],
  ): Readonly<SliceImpactProfile> {
    const profile = getSliceImpactProfile(level)
    if (!this.reducedMotion) {
      return profile
    }

    return Object.freeze({
      ...profile,
      hitStopMs: 0,
      shakeDurationMs: 0,
      shakeIntensity: 0,
      particleCount: 0,
    })
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

    background.fillStyle(0x5a403a, 0.92)
    background.fillRoundedRect(10, 84, LOGICAL_WIDTH - 20, 744, 36)

    background.fillStyle(0x151f2b, 1)
    background.fillRoundedRect(25, 136, LOGICAL_WIDTH - 50, 624, 30)

    background.lineStyle(3, 0xffd76a, 0.76)
    background.strokeRoundedRect(25, 136, LOGICAL_WIDTH - 50, 624, 30)
    background.lineStyle(1, 0x55e6d1, 0.24)
    background.strokeRoundedRect(32, 143, LOGICAL_WIDTH - 64, 610, 25)

    background.fillStyle(0x55e6d1, 0.035)
    background.fillEllipse(LOGICAL_WIDTH / 2, 405, 302, 500)
    background.fillStyle(0xffd76a, 0.035)
    background.fillEllipse(LOGICAL_WIDTH / 2, 372, 220, 366)
    background.lineStyle(1, 0x55e6d1, 0.1)
    background.strokeEllipse(LOGICAL_WIDTH / 2, 396, 264, 444)
    background.lineStyle(1, 0xffd76a, 0.09)
    background.strokeEllipse(LOGICAL_WIDTH / 2, 396, 188, 330)

    background.fillStyle(0x55e6d1, 0.45)
    for (const [x, y, radius] of [
      [48, 188, 2],
      [336, 224, 2],
      [57, 418, 1.5],
      [326, 492, 1.5],
      [82, 632, 2],
      [305, 652, 2],
    ] as const) {
      background.fillCircle(x, y, radius)
    }

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
      .text(137, 44, '오늘 뭐 썰?', {
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '25px',
        fontStyle: 'bold',
        stroke: '#101821',
        strokeThickness: 3,
      })
      .setOrigin(0.5)

    this.add
      .rectangle(LOGICAL_WIDTH / 2, 786, 326, 36, 0x0c141f, 0.82)
      .setStrokeStyle(1, 0x55e6d1, 0.34)

    this.add
      .text(LOGICAL_WIDTH / 2, 786, '꾹 눌러 찜하기  ·  휙 그어 썰기', {
        color: '#dce8ef',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
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
        lineSpacing: 2,
        maxLines: 2,
        wordWrap: { width: 336, useAdvancedWrap: true },
      })
      .setOrigin(0.5)

    this.createSensoryControls()
  }

  private createChefMascot(): void {
    this.add
      .circle(29, 49, 27, 0x223245, 0.98)
      .setStrokeStyle(2, 0xffd76a, 0.82)
      .setDepth(14)
    this.add.circle(29, 49, 22, 0x55e6d1, 0.1).setDepth(14)

    if (this.textures.exists(CHEF_CAT_TEXTURE_KEY)) {
      this.mountChefMascot()
      return
    }

    this.load.once(
      Phaser.Loader.Events.COMPLETE,
      () => {
        if (this.sys.isActive() && this.textures.exists(CHEF_CAT_TEXTURE_KEY)) {
          this.mountChefMascot()
        }
      },
    )
    this.load.image(CHEF_CAT_TEXTURE_KEY, chefCatImageUrl)
    this.load.start()
  }

  private mountChefMascot(): void {
    if (this.chefMascot) {
      return
    }

    this.chefMascot = this.add
      .image(29, 52, CHEF_CAT_TEXTURE_KEY)
      .setDisplaySize(48, 60)
      .setDepth(16)

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: this.chefMascot,
        y: 55,
        duration: 920,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
      })
    }
  }

  private createNarrationCaption(): void {
    const bubble = this.add
      .rectangle(177, 84, 246, 42, 0x243244, 0.97)
      .setStrokeStyle(2, 0x55e6d1, 0.9)
    const tail = this.add.triangle(
      49,
      84,
      0,
      0,
      11,
      -7,
      11,
      7,
      0x243244,
      0.97,
    )
    this.narrationCaptionText = this.add
      .text(177, 84, '', {
        align: 'center',
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        lineSpacing: 1,
        maxLines: 2,
        wordWrap: { width: 216, useAdvancedWrap: true },
      })
      .setOrigin(0.5)

    this.narrationCaption = this.add
      .container(0, 0, [tail, bubble, this.narrationCaptionText])
      .setDepth(18)
      .setAlpha(0)
      .setVisible(false)
  }

  private bindNarrationPreference(): void {
    this.narrationPreferenceUnsubscribe?.()
    this.narrationPreferenceUnsubscribe =
      this.narrationPreference?.subscribe((state) => {
        if (!state.effectiveEnabled) {
          this.sensoryFeedback.stopNarration()
          this.narrationAudioStarted = false
        }
        this.narrationControlSync?.()
      }) ?? null
  }

  private presentMenuNarration(menuId: string): void {
    const narration = getMenuNarration(menuId)
    if (!narration) {
      this.sensoryFeedback.stopNarration()
      this.hideNarrationCaption()
      this.narrationMenuId = null
      this.narrationText = null
      this.narrationAudioStarted = false
      return
    }

    this.narrationMenuId = menuId
    this.narrationText = narration.text
    this.showNarrationCaption(narration.text)

    if (this.narrationPreference?.effectiveEnabled) {
      this.narrationAudioStarted =
        this.sensoryFeedback.playNarration(menuId)
    } else {
      this.sensoryFeedback.stopNarration()
      this.narrationAudioStarted = false
    }
  }

  private showNarrationCaption(text: string): void {
    const caption = this.narrationCaption
    const captionText = this.narrationCaptionText
    if (!caption || !captionText) {
      return
    }

    const generation = ++this.narrationCaptionGeneration
    this.narrationCaptionTimer?.remove(false)
    this.narrationCaptionTimer = null
    this.tweens.killTweensOf(caption)
    captionText.setText(text)
    caption.setVisible(true).setAlpha(0).setY(-7)
    this.tweens.add({
      targets: caption,
      alpha: 1,
      y: 0,
      duration: 150,
      ease: 'Back.Out',
    })

    this.narrationCaptionTimer = this.time.delayedCall(
      NARRATION_CAPTION_VISIBLE_MS,
      () => {
        if (
          generation !== this.narrationCaptionGeneration ||
          this.narrationCaption !== caption
        ) {
          return
        }
        this.narrationCaptionTimer = null
        this.tweens.add({
          targets: caption,
          alpha: 0,
          y: -5,
          duration: NARRATION_CAPTION_FADE_MS,
          ease: 'Quad.In',
          onComplete: () => {
            if (generation === this.narrationCaptionGeneration) {
              caption.setVisible(false).setY(0)
            }
          },
        })
      },
    )
  }

  private hideNarrationCaption(): void {
    this.narrationCaptionGeneration += 1
    this.narrationCaptionTimer?.remove(false)
    this.narrationCaptionTimer = null
    const caption = this.narrationCaption
    if (!caption) {
      return
    }
    this.tweens.killTweensOf(caption)
    caption.setAlpha(0).setVisible(false).setY(0)
  }
  private createSensoryControls(): void {
    const hapticsSupported = this.sensoryFeedback.hapticsSupported
    const hasNarrationControl = this.narrationPreference !== undefined
    const narrationX = hapticsSupported ? 269 : 317
    const soundX = hapticsSupported ? 317 : 365
    const buttonY = 44

    const createToggle = (
      x: number,
      label: string,
      getEnabled: () => boolean,
      onToggle: () => void,
      getMuted: () => boolean = () => false,
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
        const muted = enabled && getMuted()
        panel
          .setFillStyle(
            muted ? 0x443a26 : enabled ? 0x1e4647 : 0x1a2634,
            0.94,
          )
          .setStrokeStyle(
            2,
            muted ? 0xffd76a : enabled ? 0x55e6d1 : 0x52677d,
            0.9,
          )
        copy
          .setText(muted ? `${label}\nMUTE` : label)
          .setFontSize(muted ? 8 : label.length > 1 ? 10 : 21)
          .setColor(muted ? '#ffd76a' : enabled ? '#7ef0df' : '#91a2b4')
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

    if (hasNarrationControl) {
      this.narrationControlSync = createToggle(
        narrationX,
        'VOX',
        () => this.narrationPreference?.requestedEnabled ?? false,
        () => {
          const enabled = this.narrationPreference?.toggle() ?? false
          if (!this.narrationPreference?.effectiveEnabled) {
            this.sensoryFeedback.stopNarration()
            this.narrationAudioStarted = false
          }
          this.feedbackText
            .setColor(enabled ? '#55e6d1' : '#b9c5d3')
            .setText(`나레이션 ${enabled ? '켜짐' : '꺼짐'}`)
        },
        () =>
          Boolean(
            this.narrationPreference?.requestedEnabled &&
              !this.narrationPreference.effectiveEnabled,
          ),
      )
    }

    createToggle(
      soundX,
      '♪',
      () => this.sensoryFeedback.soundEnabled,
      () => {
        const enabled = !this.sensoryFeedback.soundEnabled
        this.sensoryFeedback.setSoundEnabled(enabled)
        this.narrationControlSync?.()
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
      .setText('점수 없는 연습부터 시작해요!')

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
      .text(LOGICAL_WIDTH / 2, 240, 'PRACTICE · 0점', {
        color: '#55e6d1',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
    const title = this.add
      .text(LOGICAL_WIDTH / 2, 276, '베기 1번 · 포획 1번', {
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
        '1. 먼저 드래그해서 반으로 베기\n이 연습은 점수에 들어가지 않아요',
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
        '2. 다음 음식 위를 0.3초 꾹\n베기와 따로 포획을 연습해요',
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
        '연습 완료 후 홈에서 원하는 게임을 시작해요',
        {
          color: '#c8d2df',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '13px',
        },
      )
      .setOrigin(0.5)
    const skip = this.add
      .text(LOGICAL_WIDTH / 2, 585, '화면을 누르면 베기 연습 시작', {
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
      .setText('마지막 5개 · 속도와 회전이 빨라져요!')

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
      .text(LOGICAL_WIDTH / 2, 274, '속도 · 회전 모두 최고!', {
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
    if (roundIndex === 5) {
      return '회전 메뉴 시작! · ' + menuName + '의 방향을 보고 베어보세요'
    }
    if (roundIndex === FINAL_TWO_ROUND_INDEX) {
      return 'FINAL 2 · 좌우 이동 시작! · ' + menuName + '을 노려보세요'
    }
    return menuName + ' · 꾹 눌러 포획 · 드래그해 베기'
  }

  private spawnRound(): void {
    if (this.isFinished || this.activeToken) {
      return
    }

    if (
      this.launchOptions.launchMode === 'tutorial' &&
      this.practiceStage === 'complete'
    ) {
      this.showTutorialComplete()
      return
    }

    const isPractice = this.practiceStage !== 'complete'
    const roundIndex = this.rounds.length
    if (!isPractice && roundIndex >= TOTAL_ROUNDS) {
      this.showResults()
      return
    }

    if (!isPractice) {
      this.sensoryFeedback.startMusic(getRoundMusicIntensity(roundIndex))
    }

    if (
      !isPractice &&
      roundIndex === FINAL_SPRINT_ROUND_INDEX &&
      !this.finalSprintAnnounced
    ) {
      this.finalSprintAnnounced = true
      this.announceFinalSprint()
      return
    }

    const menuIndex =
      this.practiceStage === 'capture'
        ? Math.min(1, this.deck.length - 1)
        : roundIndex
    const menu = this.deck[menuIndex]
    const sequenceX = isPractice
      ? LOGICAL_WIDTH / 2
      : TOKEN_X_SEQUENCE[roundIndex]

    if (!menu || sequenceX === undefined) {
      throw new Error(`프로토타입 라운드 ${roundIndex} 데이터가 없습니다.`)
    }

    const tokenVisual = this.createTokenVisual(menu)
    const fallDurationMs = isPractice
      ? PRACTICE_FALL_DURATION_MS
      : getRoundFallDurationMs(roundIndex)
    const motionRoundIndex = isPractice ? 0 : roundIndex
    const rotationMotion = getRoundRotationMotion(
      this.launchOptions.deckSeed,
      motionRoundIndex,
    )
    const horizontalMotion = getRoundHorizontalMotion(
      this.launchOptions.deckSeed,
      motionRoundIndex,
    )
    const requestedHorizontalBaseX =
      isPractice
        ? LOGICAL_WIDTH / 2
        : roundIndex >= FINAL_TWO_ROUND_INDEX
        ? LOGICAL_WIDTH / 2
        : sequenceX
    const horizontalBaseX = Phaser.Math.Clamp(
      requestedHorizontalBaseX,
      TOKEN_HORIZONTAL_EDGE_PADDING + tokenVisual.horizontalSafetyRadius,
      LOGICAL_WIDTH -
        TOKEN_HORIZONTAL_EDGE_PADDING -
        tokenVisual.horizontalSafetyRadius,
    )
    const horizontalAmplitude = this.getSafeHorizontalAmplitude(
      horizontalBaseX,
      tokenVisual.horizontalSafetyRadius,
      horizontalMotion.amplitude,
    )

    const container = this.add
      .container(horizontalBaseX, TOKEN_START_Y, tokenVisual.children)
      .setDepth(5)

    const tween = this.tweens.add({
      targets: container,
      y: MISS_LINE_Y + JUDGEMENT_RADIUS,
      duration: fallDurationMs,
      ease: 'Linear',
      onUpdate: (fallTween: Phaser.Tweens.Tween) => {
        if (horizontalAmplitude > 0) {
          const phase =
            Math.PI *
            2 *
            horizontalMotion.cycles *
            fallTween.progress
          container.x =
            horizontalBaseX +
            horizontalMotion.direction *
              horizontalAmplitude *
              Math.sin(phase)
        }

        const activeToken = this.activeToken
        if (
          activeToken?.container === container &&
          !activeToken.missWarningShown &&
          !isPractice &&
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

    const rotationTween =
      rotationMotion.targetAngleDegrees === 0
        ? null
        : this.tweens.add({
            targets: tokenVisual.rotatingArtwork,
            rotation: Phaser.Math.DegToRad(
              rotationMotion.targetAngleDegrees,
            ),
            duration: fallDurationMs,
            ease: 'Linear',
          })

    this.activeToken = {
      menu,
      container,
      tween,
      rotatingArtwork: tokenVisual.rotatingArtwork,
      rotationTween,
      rotationTargetDegrees: rotationMotion.targetAngleDegrees,
      rotationDirection:
        rotationMotion.targetAngleDegrees === 0
          ? 0
          : rotationMotion.direction,
      horizontalBaseX,
      horizontalRequestedAmplitude: horizontalMotion.amplitude,
      horizontalAmplitude,
      horizontalCycles: horizontalMotion.cycles,
      horizontalDirection:
        horizontalAmplitude === 0 ? 0 : horizontalMotion.direction,
      fallDurationMs,
      hasVisual: tokenVisual.hasVisual,
      shadowKind: tokenVisual.shadowKind,
      silhouette: tokenVisual.silhouette,
      captureCenter: tokenVisual.captureCenter,
      horizontalSafetyRadius: tokenVisual.horizontalSafetyRadius,
      renderBounds: tokenVisual.renderBounds,
      missWarningShown: false,
    }
    if (!isPractice) {
      this.presentMenuNarration(menu.id)
    }
    this.feedbackText.setColor(
      isPractice
        ? this.practiceStage === 'slice'
          ? '#55e6d1'
          : '#ffd76a'
        : roundIndex === 5
        ? '#ffd76a'
        : roundIndex === FINAL_TWO_ROUND_INDEX
          ? '#55e6d1'
          : '#fff8e7',
    )
    this.feedbackText.setText(
      this.practiceStage === 'slice'
        ? '연습 1/2 · 음식 한가운데를 가로질러 드래그!'
        : this.practiceStage === 'capture'
          ? '연습 2/2 · 움직이지 말고 음식 위를 0.3초 꾹!'
          : this.getRoundInstruction(menu.nameKo, roundIndex),
    )
    this.updateHud()
  }

  private getSafeHorizontalAmplitude(
    baseX: number,
    horizontalSafetyRadius: number,
    requestedAmplitude: number,
  ): number {
    if (requestedAmplitude <= 0) {
      return 0
    }

    const availableTravel = Math.min(
      baseX - TOKEN_HORIZONTAL_EDGE_PADDING - horizontalSafetyRadius,
      LOGICAL_WIDTH -
        TOKEN_HORIZONTAL_EDGE_PADDING -
        horizontalSafetyRadius -
        baseX,
    )

    return Math.max(0, Math.min(requestedAmplitude, availableTravel))
  }

  private createTokenVisual(
    menu: WeightedMenuCatalogEntry,
    initialArtworkAngleDegrees = 0,
  ): TokenVisual {
    const placeholderColor = Number.parseInt(
      menu.placeholderColor.slice(1),
      16,
    )
    const visual = getMenuVisual(menu.id)
    const preloadedImage = getPreloadedMenuImage(menu.id)
    const canonicalGeometry = getCanonicalMenuGameplayGeometry(
      menu.id,
      TOKEN_VISUAL_MAX_WIDTH,
      TOKEN_VISUAL_MAX_HEIGHT,
    )
    const renderBounds =
      canonicalGeometry?.renderBounds ??
      this.getPlaceholderRenderBounds(menu)
    const visualCenter =
      canonicalGeometry?.artworkCenter ?? { x: 0, y: 0 }
    const captureCenter =
      canonicalGeometry?.captureCenter ?? { x: 0, y: 0 }
    const silhouette = canonicalGeometry
      ? {
          mask: canonicalGeometry.alphaMask,
          center: visualCenter,
          displayWidth: renderBounds.width,
          displayHeight: renderBounds.height,
        }
      : null
    const horizontalSafetyRadius =
      this.getTokenHorizontalSafetyRadius(renderBounds, visualCenter)

    if (
      visual &&
      preloadedImage &&
      this.textures.exists(visual.textureKey)
    ) {
      const alphaShadowVisible = this.game.renderer.type === Phaser.WEBGL
      const shadowOuter = this.add
        .image(visualCenter.x, visualCenter.y, visual.textureKey)
        .setDisplaySize(renderBounds.width * 1.07, renderBounds.height * 1.07)
        .setTint(0xfff0ca)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(0.82)
        .setVisible(alphaShadowVisible)
      const shadowCore = this.add
        .image(visualCenter.x + 5, visualCenter.y + 8, visual.textureKey)
        .setDisplaySize(renderBounds.width * 1.04, renderBounds.height * 1.04)
        .setTint(0x05090d)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(0.32)
        .setVisible(alphaShadowVisible)
      const foodImage = this.add
        .image(visualCenter.x, visualCenter.y, visual.textureKey)
        .setDisplaySize(renderBounds.width, renderBounds.height)
      const rotatingArtwork = this.add
        .container(0, 0, [shadowCore, shadowOuter, foodImage])
        .setAngle(initialArtworkAngleDegrees)
      const labelY = Math.max(
        58,
        visualCenter.y + renderBounds.height / 2 + 10,
      )
      const labelWidth = Phaser.Math.Clamp(86 + menu.nameKo.length * 8, 110, 128)
      const labelPlate = this.add
        .rectangle(0, labelY, labelWidth, 30, 0x243244, 0.96)
        .setStrokeStyle(2, 0x55e6d1, 0.82)
      const label = this.add
        .text(0, labelY, menu.nameKo, {
          align: 'center',
          color: '#fff8e7',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)

      return {
        children: [rotatingArtwork, labelPlate, label],
        rotatingArtwork,
        hasVisual: true,
        shadowKind: alphaShadowVisible ? 'alpha-shadow' : 'none',
        captureCenter,
        horizontalSafetyRadius,
        silhouette,
        renderBounds,
      }
    }

    const shadow = this.createPlaceholderSurface(
      menu,
      renderBounds,
      0x05090d,
      0.36,
      visualCenter.x + 5,
      visualCenter.y + 8,
    )
    const food = this.createPlaceholderSurface(
      menu,
      renderBounds,
      placeholderColor,
      1,
      visualCenter.x,
      visualCenter.y,
    )
    const shine = this.add.ellipse(
      visualCenter.x - renderBounds.width * 0.2,
      visualCenter.y - renderBounds.height * 0.24,
      renderBounds.width * 0.22,
      renderBounds.height * 0.2,
      0xffffff,
      0.22,
    )
    const label = this.add
      .text(visualCenter.x, visualCenter.y + 1, menu.nameKo, {
        align: 'center',
        color: '#18212b',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        wordWrap: { width: renderBounds.width * 0.78 },
      })
      .setOrigin(0.5)
    const rotatingArtwork = this.add
      .container(0, 0, [shadow, food, shine])
      .setAngle(initialArtworkAngleDegrees)

    return {
      children: [rotatingArtwork, label],
      rotatingArtwork,
      hasVisual: false,
      shadowKind: 'shape-fallback',
      silhouette,
      captureCenter,
      horizontalSafetyRadius,
      renderBounds,
    }
  }

  private getTokenHorizontalSafetyRadius(
    renderBounds: TokenVisual['renderBounds'],
    visualCenter: Point,
  ): number {
    return Math.max(
      TOKEN_LABEL_HALF_WIDTH,
      Math.hypot(visualCenter.x, visualCenter.y) +
        Math.hypot(renderBounds.width, renderBounds.height) / 2,
      Math.hypot(visualCenter.x, visualCenter.y) +
        Math.hypot(
          renderBounds.width * 1.07,
          renderBounds.height * 1.07,
        ) /
          2,
      Math.hypot(visualCenter.x + 5, visualCenter.y + 8) +
        Math.hypot(
          renderBounds.width * 1.04,
          renderBounds.height * 1.04,
        ) /
          2,
    )
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
    const currentCaptureCenter = this.getCurrentCaptureCenter(token)
    const startsOnCaptureTarget =
      Math.hypot(
        localStartPoint.x - currentCaptureCenter.x,
        localStartPoint.y - currentCaptureCenter.y,
      ) <= CAPTURE_HIT_RADIUS

    if (this.practiceStage === 'capture' && !startsOnCaptureTarget) {
      this.feedbackText
        .setColor('#ffd76a')
        .setText('지금은 포획 연습 · 음식 위를 움직이지 말고 꾹!')
      return
    }

    const forceSlicePractice = this.practiceStage === 'slice'
    this.activePointerId = pointer.id
    this.isDrawing = true
    this.isSlicing = forceSlicePractice || !startsOnCaptureTarget
    this.path = [startPoint]
    this.localPath = [localStartPoint]
    this.trail.clear()

    if (
      !forceSlicePractice &&
      startsOnCaptureTarget &&
      captureCount < MAX_CAPTURES
    ) {
      this.startHoldCapture(token, pointer.id, startPoint)
    } else if (!forceSlicePractice && startsOnCaptureTarget) {
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
    this.hideNarrationCaption()
    this.narrationPreferenceUnsubscribe?.()
    this.narrationPreferenceUnsubscribe = null
    this.narrationControlSync = null
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
    const captureCenter = this.getCurrentCaptureCenter(state.token)
    const x = state.token.container.x + captureCenter.x
    const y = state.token.container.y + captureCenter.y
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

  private getCurrentCaptureCenter(token: ActiveToken): Point {
    return transformLocalPointToWorld(token.captureCenter, {
      pivot: { x: 0, y: 0 },
      translation: { x: 0, y: 0 },
      angleRadians: token.rotatingArtwork.rotation,
    })
  }

  private evaluateGesture(): void {
    const token = this.activeToken
    if (!token || this.localPath.length < 2) {
      return
    }

    const localArtworkTransform = {
      pivot: { x: 0, y: 0 },
      translation: { x: 0, y: 0 },
      angleRadians: token.rotatingArtwork.rotation,
    }
    const worldArtworkTransform = {
      ...localArtworkTransform,
      translation: {
        x: token.container.x,
        y: token.container.y,
      },
    }
    const canonicalPath = this.localPath.map((point) =>
      transformWorldPointToLocal(point, localArtworkTransform),
    )
    const canonicalIntentPath = this.path.map((point) =>
      transformWorldPointToLocal(point, worldArtworkTransform),
    )
    const circle: Circle = {
      center: { x: 0, y: 0 },
      radius: JUDGEMENT_RADIUS,
    }
    const decision: GameplaySliceDecision | ReturnType<typeof classifyGesture> =
      token.silhouette
        ? classifySilhouetteGesture(canonicalPath, token.silhouette, {
            intentPath: canonicalIntentPath,
          })
        : classifyGesture(canonicalPath, circle, {
            intentPath: canonicalIntentPath,
          })

    if (import.meta.env.DEV) {
      console.debug('[gesture-classification]', {
        decision,
        judgement: token.silhouette ? 'alpha-mask' : 'circle-fallback',
      })
    }

    if (this.practiceStage === 'capture') {
      this.feedbackText
        .setColor('#ffd76a')
        .setText(
          decision.kind === 'slice'
            ? '베기는 성공! 지금은 음식 위를 움직이지 말고 꾹 눌러요'
            : '지금은 포획 연습 · 드래그하지 말고 음식 위를 꾹!',
        )
      return
    }

    if (decision.kind === 'slice') {
      const worldDecision: GameplaySliceDecision = {
        ...decision,
        chord: {
          ...decision.chord,
          entryPoint: transformLocalPointToWorld(
            decision.chord.entryPoint,
            worldArtworkTransform,
          ),
          exitPoint: transformLocalPointToWorld(
            decision.chord.exitPoint,
            worldArtworkTransform,
          ),
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
    decision?: GameplaySliceDecision,
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
    token.rotationTween?.stop()
    this.clearMissWarning()

    if (this.practiceStage !== 'complete') {
      this.resolvePracticeRound(token, action, decision)
      return
    }

    const roundIndex = this.rounds.length
    this.rounds.push({
      roundIndex,
      menuId: token.menu.id,
      action,
    })
    this.persistCompletedRounds()

    if (action.type === 'slice') {
      this.currentSliceStreak += 1
    } else if (action.type === 'miss') {
      this.currentSliceStreak = 0
    }
    const reachedSliceStreakMilestone =
      action.type === 'slice' &&
      SLICE_STREAK_MILESTONES.some(
        (milestone) => milestone === this.currentSliceStreak,
      )

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
      this.showChefReaction('오늘은 이거!', 0xffd76a)
      this.playCaptureResolution(token)
    } else if (action.type === 'slice') {
      if (!decision || decision.kind !== 'slice') {
        throw new Error('베기 연출에는 베기 제스처 결정이 필요합니다.')
      }
      const roundedScore = getDisplayedSliceAccuracy(action.accuracy)
      const sliceFeedback = getSliceFeedback(action.accuracy)
      const sliceProfile = this.getEffectiveSliceImpactProfile(
        sliceFeedback.level,
      )
      this.lastSliceFxTier = sliceFeedback.level
      this.lastSliceFxProfile = sliceProfile
      this.triggerSensory(SLICE_SENSORY_CUE[sliceFeedback.level])
      this.feedbackText
        .setColor(sliceFeedback.cssColor)
        .setText(
          sliceFeedback.label + ' ' + roundedScore.toFixed(1) + '%',
        )
      this.showChefReaction(sliceFeedback.label, sliceProfile.flashColor)
      this.playSliceResolution(
        token,
        decision,
        roundedScore,
        sliceFeedback,
        sliceProfile,
      )
      if (reachedSliceStreakMilestone) {
        this.showSliceStreak(this.currentSliceStreak)
      }
    } else {
      this.triggerSensory('miss')
      this.feedbackText
        .setColor('#ff9b7c')
        .setText(token.menu.nameKo + ' 놓침 · 0점')
      this.showChefReaction('다음 메뉴!', 0xff795f, true)
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
          ? SLICE_ROUND_TRANSITION_MS
          : 260
    this.time.delayedCall(nextRoundDelay, () => this.spawnRound())
  }

  private resolvePracticeRound(
    token: ActiveToken,
    action: RoundAction,
    decision?: GameplaySliceDecision,
  ): void {
    const stage = this.practiceStage
    const expectedAction = stage === 'slice' ? 'slice' : 'capture'

    if (action.type !== expectedAction) {
      this.feedbackText
        .setColor(stage === 'slice' ? '#55e6d1' : '#ffd76a')
        .setText(
          action.type === 'miss'
            ? stage === 'slice'
              ? '괜찮아요 · 점수는 그대로 0점! 다시 드래그해 봐요'
              : '괜찮아요 · 점수는 그대로 0점! 다음 음식을 꾹 눌러요'
            : stage === 'slice'
              ? '먼저 베기 연습 · 음식 한가운데를 가로질러 드래그!'
              : '지금은 포획 연습 · 음식 위를 움직이지 말고 꾹!',
        )
      this.tweens.add({
        targets: token.container,
        alpha: 0,
        duration: 140,
        onComplete: () => token.container.destroy(),
      })
      this.updateHud()
      this.time.delayedCall(220, () => this.spawnRound())
      return
    }

    if (stage === 'slice') {
      if (
        action.type !== 'slice' ||
        !decision ||
        decision.kind !== 'slice'
      ) {
        throw new Error('베기 연습 성공에는 베기 제스처 결정이 필요합니다.')
      }

      const roundedScore = getDisplayedSliceAccuracy(action.accuracy)
      const sliceFeedback = getSliceFeedback(action.accuracy)
      const sliceProfile = this.getEffectiveSliceImpactProfile(
        sliceFeedback.level,
      )
      this.practiceStage = 'capture'
      this.completedPracticeActions.push('slice')
      this.lastSliceFxTier = sliceFeedback.level
      this.lastSliceFxProfile = sliceProfile
      this.triggerSensory(SLICE_SENSORY_CUE[sliceFeedback.level])
      this.feedbackText
        .setColor('#55e6d1')
        .setText('베기 연습 성공! 다음은 새 음식을 0.3초 꾹')
      this.showChefReaction('베기 연습 완료!', 0x55e6d1)
      this.playSliceResolution(
        token,
        decision,
        roundedScore,
        sliceFeedback,
        sliceProfile,
      )
      this.updateHud()
      this.time.delayedCall(SLICE_ROUND_TRANSITION_MS, () => this.spawnRound())
      return
    }

    this.practiceStage = 'complete'
    this.completedPracticeActions.push('capture')
    this.triggerSensory('capture')
    this.feedbackText
      .setColor('#ffd76a')
      .setText('포획 연습 성공! 연습을 모두 마쳤어요')
    this.showChefReaction('포획 연습 완료!', 0xffd76a)
    this.playPracticeCaptureResolution(token)
    this.updateHud()
    this.time.delayedCall(
      CAPTURE_EFFECT_DURATION_MS + 80,
      () => this.showTutorialComplete(),
    )
  }

  private persistCompletedRounds(): void {
    if (this.launchOptions.launchMode === 'tutorial') {
      return
    }

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

  private playPracticeCaptureResolution(token: ActiveToken): void {
    this.drawCaptureBurst({ x: token.container.x, y: token.container.y })
    this.cameras.main.shake(70, 0.002)
    this.activeCaptureEffect = token.container
    this.tweens.add({
      targets: token.container,
      y: token.container.y - 48,
      angle: 360,
      scale: 0.2,
      alpha: 0,
      duration: CAPTURE_EFFECT_DURATION_MS,
      ease: 'Cubic.Out',
      onComplete: () => {
        if (this.activeCaptureEffect === token.container) {
          this.activeCaptureEffect = null
        }
        token.container.destroy()
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

  private showSliceStreak(streak: number): void {
    this.lastAnnouncedSliceStreak = streak
    this.activeSliceStreakBanner = streak
    const accentColor =
      streak >= 8 ? 0xff795f : streak >= 5 ? 0xffd76a : 0x55e6d1
    const panel = this.add
      .rectangle(0, 0, 202, 46, 0x101821, 0.96)
      .setStrokeStyle(3, accentColor, 0.95)
    const copy = this.add
      .text(0, 0, `${streak}연속 베기!`, {
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        stroke: '#101821',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
    const banner = this.add
      .container(LOGICAL_WIDTH / 2, 216, [panel, copy])
      .setDepth(28)

    const clearActiveBanner = (): void => {
      if (this.activeSliceStreakBanner === streak) {
        this.activeSliceStreakBanner = null
      }
      banner.destroy(true)
    }

    if (this.reducedMotion) {
      banner.setAlpha(1)
      this.time.delayedCall(320, () => {
        this.tweens.add({
          targets: banner,
          alpha: 0,
          duration: 160,
          onComplete: clearActiveBanner,
        })
      })
      return
    }

    banner.setScale(0.78).setAlpha(0)
    this.tweens.add({
      targets: banner,
      scale: 1,
      alpha: 1,
      duration: 130,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: banner,
          y: banner.y - 12,
          alpha: 0,
          delay: 180,
          duration: 180,
          ease: 'Quad.In',
          onComplete: clearActiveBanner,
        })
      },
    })
    this.tweens.add({
      targets: this.scoreText,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 90,
      ease: 'Sine.Out',
      yoyo: true,
    })
  }

  private showChefReaction(
    label: string,
    color: number,
    isMiss = false,
  ): void {
    const ring = this.add
      .circle(29, 49, 31, color, 0.12)
      .setStrokeStyle(5, color, 0.88)
      .setDepth(15)
    const badge = this.add
      .text(52, 137, label, {
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        backgroundColor: '#101821',
        padding: { x: 11, y: 6 },
        stroke: '#101821',
        strokeThickness: 2,
      })
      .setOrigin(0, 0.5)
      .setDepth(27)

    this.tweens.add({
      targets: ring,
      scale: 1.48,
      alpha: 0,
      duration: this.reducedMotion ? 150 : 280,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    })

    if (this.chefMascot && !this.reducedMotion) {
      const mascot = this.chefMascot
      const scaleMultiplier = isMiss ? 0.96 : 1.08
      this.tweens.add({
        targets: mascot,
        scaleX: mascot.scaleX * scaleMultiplier,
        scaleY: mascot.scaleY * scaleMultiplier,
        angle: isMiss ? -8 : 7,
        duration: 90,
        ease: 'Sine.Out',
        yoyo: true,
      })
    }

    this.tweens.add({
      targets: badge,
      y: 124,
      alpha: 0,
      delay: this.reducedMotion ? 100 : 220,
      duration: 230,
      ease: 'Cubic.In',
      onComplete: () => badge.destroy(),
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
    decision: GameplaySliceDecision,
    roundedScore: number,
    feedback: Readonly<SliceFeedback>,
    profile: Readonly<SliceImpactProfile>,
  ): void {
    const { entryPoint, exitPoint } = decision.chord
    const deltaX = exitPoint.x - entryPoint.x
    const deltaY = exitPoint.y - entryPoint.y
    const length = Math.hypot(deltaX, deltaY)
    const tangent = { x: deltaX / length, y: deltaY / length }
    const normal = { x: -tangent.y, y: tangent.x }
    const midpoint = {
      x: (entryPoint.x + exitPoint.x) / 2,
      y: (entryPoint.y + exitPoint.y) / 2,
    }
    this.lastSliceAngleDegrees = Phaser.Math.RadToDeg(
      Math.atan2(deltaY, deltaX),
    )

    const artworkAngleDegrees = Phaser.Math.RadToDeg(
      token.rotatingArtwork.rotation,
    )
    const firstVisual = this.createTokenVisual(
      token.menu,
      artworkAngleDegrees,
    )
    const secondVisual = this.createTokenVisual(
      token.menu,
      artworkAngleDegrees,
    )
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

    this.drawCutFlash(entryPoint, exitPoint, profile)
    this.drawSliceParticles(midpoint, tangent, normal, profile)
    this.showAccuracyPopup(
      midpoint.x,
      midpoint.y,
      roundedScore,
      feedback,
    )
    if (profile.shakeDurationMs > 0 && profile.shakeIntensity > 0) {
      this.cameras.main.shake(
        profile.shakeDurationMs,
        profile.shakeIntensity,
      )
    }

    this.animateSlicePiece(
      firstPiece,
      firstMaskGraphic,
      firstMask,
      normal,
      1,
      profile,
    )
    this.animateSlicePiece(
      secondPiece,
      secondMaskGraphic,
      secondMask,
      normal,
      -1,
      profile,
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
    profile: Readonly<SliceImpactProfile>,
  ): void {
    const startX = piece.x
    const startY = piece.y
    const fastDistance = profile.separationDistance * 0.72
    const phaseOneDurationMs = Math.min(
      110,
      Math.max(78, Math.round(profile.splitDurationMs * 0.27)),
    )
    const phaseTwoDurationMs =
      profile.splitDurationMs - phaseOneDurationMs
    const effectState = {
      x: startX,
      y: startY,
      angle: piece.angle,
      alpha: piece.alpha,
    }
    let cleaned = false

    const applyState = () => {
      piece
        .setPosition(effectState.x, effectState.y)
        .setAngle(effectState.angle)
        .setAlpha(effectState.alpha)
      maskGraphic
        .setPosition(effectState.x, effectState.y)
        .setAngle(effectState.angle)
    }
    const cleanup = () => {
      if (cleaned) {
        return
      }
      cleaned = true
      if (maskFilter) {
        piece.filters?.external.remove(maskFilter, true)
      } else {
        piece.clearMask(true)
      }
      piece.destroy()
      maskGraphic.destroy()
      this.activeSlicePieceCount = Math.max(
        0,
        this.activeSlicePieceCount - 1,
      )
      this.cleanedSlicePieceCount += 1
      this.completeSliceFxObject()
    }

    this.activeSlicePieceCount += 1
    this.registerSliceFxObject()
    this.tweens.add({
      targets: effectState,
      x: startX + normal.x * side * fastDistance,
      y: startY + normal.y * side * fastDistance + 3,
      angle: side * profile.rotationDegrees * 0.35,
      delay: profile.hitStopMs,
      duration: phaseOneDurationMs,
      ease: 'Cubic.Out',
      onUpdate: applyState,
      onComplete: () => {
        this.tweens.add({
          targets: effectState,
          x:
            startX +
            normal.x * side * profile.separationDistance,
          y:
            startY +
            normal.y * side * profile.separationDistance +
            24,
          angle: side * profile.rotationDegrees,
          alpha: 0,
          duration: phaseTwoDurationMs,
          ease: 'Quad.In',
          onUpdate: applyState,
          onComplete: cleanup,
        })
      },
    })
  }

  private drawCutFlash(
    lineStart: Point,
    lineEnd: Point,
    profile: Readonly<SliceImpactProfile>,
  ): void {
    const deltaX = lineEnd.x - lineStart.x
    const deltaY = lineEnd.y - lineStart.y
    const length = Math.hypot(deltaX, deltaY)
    const tangent = { x: deltaX / length, y: deltaY / length }
    const extension = 8 + profile.flashWidth
    const extendedStart = {
      x: lineStart.x - tangent.x * extension,
      y: lineStart.y - tangent.y * extension,
    }
    const extendedEnd = {
      x: lineEnd.x + tangent.x * extension,
      y: lineEnd.y + tangent.y * extension,
    }
    const midpoint = {
      x: (lineStart.x + lineEnd.x) / 2,
      y: (lineStart.y + lineEnd.y) / 2,
    }
    const flash = this.add.graphics().setDepth(24)
    flash.lineStyle(
      profile.flashWidth + 12,
      profile.flashColor,
      0.2,
    )
    flash.lineBetween(
      extendedStart.x,
      extendedStart.y,
      extendedEnd.x,
      extendedEnd.y,
    )
    flash.lineStyle(
      profile.flashWidth,
      profile.flashColor,
      0.95,
    )
    flash.lineBetween(
      extendedStart.x,
      extendedStart.y,
      extendedEnd.x,
      extendedEnd.y,
    )
    flash.lineStyle(2, 0xffffff, 1)
    flash.lineBetween(
      extendedStart.x,
      extendedStart.y,
      extendedEnd.x,
      extendedEnd.y,
    )
    flash.fillStyle(0xffffff, 1)
    flash.fillCircle(midpoint.x, midpoint.y, 2.5)

    this.registerSliceFxObject()
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: Math.min(220, 130 + profile.flashWidth * 10),
      ease: 'Quad.Out',
      onComplete: () => {
        flash.destroy()
        this.completeSliceFxObject()
      },
    })
  }

  private drawSliceParticles(
    center: Point,
    tangent: Point,
    normal: Point,
    profile: Readonly<SliceImpactProfile>,
  ): void {
    if (profile.particleCount <= 0) {
      return
    }

    const particles = this.add.graphics().setDepth(23)
    const state = { progress: 0 }
    const palette = [
      profile.flashColor,
      0xfff8e7,
      0xffd76a,
    ] as const

    this.registerSliceFxObject()
    this.tweens.add({
      targets: state,
      progress: 1,
      duration: Math.min(290, 200 + profile.particleCount * 8),
      ease: 'Quad.Out',
      onUpdate: () => {
        const progress = state.progress
        const alpha = Math.max(0, 1 - progress)
        particles.clear()

        for (let index = 0; index < profile.particleCount; index += 1) {
          const side = index % 2 === 0 ? 1 : -1
          const normalDistance =
            side *
            (16 + (index % 4) * 5 + profile.separationDistance * 0.3) *
            progress
          const tangentDistance =
            ((index % 5) - 2) * 7 * progress
          const gravity = 15 * progress * progress
          const x =
            center.x +
            normal.x * normalDistance +
            tangent.x * tangentDistance
          const y =
            center.y +
            normal.y * normalDistance +
            tangent.y * tangentDistance +
            gravity
          const radius =
            (index % 3 === 0 ? 3 : 2) * (1 - progress * 0.4)

          particles.fillStyle(
            palette[index % palette.length]!,
            alpha,
          )
          particles.fillCircle(x, y, radius)
        }
      },
      onComplete: () => {
        particles.destroy()
        this.completeSliceFxObject()
      },
    })
  }

  private registerSliceFxObject(): void {
    this.activeSliceFxObjectCount += 1
  }

  private completeSliceFxObject(): void {
    this.activeSliceFxObjectCount = Math.max(
      0,
      this.activeSliceFxObjectCount - 1,
    )
    this.cleanedSliceFxObjectCount += 1
  }

  private showAccuracyPopup(
    x: number,
    y: number,
    score: number,
    feedback: Readonly<SliceFeedback>,
  ): void {
    const popupStartY = Math.max(y - 26, ACCURACY_POPUP_MIN_Y)
    const peakScale =
      feedback.level === 'perfect'
        ? 1.2
        : feedback.level === 'great'
          ? 1.1
          : feedback.level === 'good'
            ? 1.04
            : 0.98
    const popup = this.add
      .text(
        x,
        popupStartY,
        feedback.label + '\n' + score.toFixed(1) + '%',
        {
          align: 'center',
          color: feedback.cssColor,
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: feedback.level === 'perfect' ? '32px' : '29px',
          fontStyle: 'bold',
          lineSpacing: 1,
          backgroundColor: '#101821',
          padding: { x: 12, y: 7 },
          stroke: '#101821',
          strokeThickness: 4,
        },
      )
      .setOrigin(0.5)
      .setDepth(25)
      .setScale(0.55)
      .setAlpha(0)
      .setAngle(feedback.level === 'perfect' ? -3 : 2)

    this.tweens.add({
      targets: popup,
      y: popupStartY - 8,
      scale: peakScale,
      alpha: 1,
      duration: 90,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: popup,
          y: popupStartY - 42,
          scale: peakScale * 0.96,
          alpha: 0,
          delay: 40,
          duration: 280,
          ease: 'Cubic.In',
          onComplete: () => popup.destroy(),
        })
      },
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
    if (this.launchOptions.launchMode === 'tutorial') {
      this.progressText.setText(
        this.practiceStage === 'slice'
          ? '연습 1/2'
          : this.practiceStage === 'capture'
            ? '연습 2/2'
            : '연습 완료',
      )
      this.scoreText.setText('점수 미포함')
      this.captureText.setText('포획권 미사용')
      return
    }

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

  private showTutorialComplete(): void {
    if (
      this.launchOptions.launchMode !== 'tutorial' ||
      this.tutorialComplete ||
      this.isFinished
    ) {
      return
    }

    this.sensoryFeedback.stopNarration()
    this.sensoryFeedback.stopMusic()
    this.hideNarrationCaption()
    this.narrationAudioStarted = false
    this.tutorialComplete = true
    this.isFinished = true
    this.updateHud()
    this.game.events.emit(TUTORIAL_COMPLETE_EVENT)

    this.add
      .rectangle(
        LOGICAL_WIDTH / 2,
        LOGICAL_HEIGHT / 2,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
        0x080d13,
        0.86,
      )
      .setDepth(30)
      .setInteractive()

    this.add
      .rectangle(LOGICAL_WIDTH / 2, 420, 330, 420, 0x223143, 1)
      .setStrokeStyle(3, 0x55e6d1, 0.94)
      .setDepth(31)
      .setInteractive()

    this.add
      .text(LOGICAL_WIDTH / 2, 262, '연습 완료!', {
        color: '#7ef0df',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        stroke: '#101821',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(33)

    this.add
      .image(LOGICAL_WIDTH / 2, 360, CHEF_CAT_TEXTURE_KEY)
      .setDisplaySize(92, 116)
      .setDepth(33)

    this.add
      .text(
        LOGICAL_WIDTH / 2,
        440,
        '베기 1회와 포획 1회를 익혔어요!\n점수·포획권·게임 기록에는 포함되지 않아요.',
        {
          align: 'center',
          color: '#fff8e7',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '16px',
          fontStyle: 'bold',
          lineSpacing: 7,
          wordWrap: { width: 286 },
        },
      )
      .setOrigin(0.5)
      .setDepth(33)

    const retryButton = this.add
      .rectangle(LOGICAL_WIDTH / 2, 528, 252, 54, 0xff795f, 1)
      .setName('tutorial-retry')
      .setDepth(32)
      .setInteractive({ useHandCursor: true })

    this.add
      .text(LOGICAL_WIDTH / 2, 528, '다시 연습', {
        color: '#181f27',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(33)

    const homeButton = this.add
      .rectangle(LOGICAL_WIDTH / 2, 594, 252, 48, 0x394b61, 1)
      .setName('tutorial-home')
      .setStrokeStyle(2, 0x8fa4bb, 0.8)
      .setDepth(32)
      .setInteractive({ useHandCursor: true })

    this.add
      .text(LOGICAL_WIDTH / 2, 594, '홈으로', {
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

    this.feedbackText.setText('연습 완료 · 준비되면 게임을 시작해 보세요!')
  }

  private showResults(): void {
    this.sensoryFeedback.stopNarration()
    this.sensoryFeedback.stopMusic()
    this.hideNarrationCaption()
    this.narrationAudioStarted = false
    this.isFinished = true
    if (this.launchOptions.mode === 'solo') {
      this.triggerSensory('results')
    }
    this.progressText.setText(`${TOTAL_ROUNDS}/${TOTAL_ROUNDS}`)

    const summary = calculatePlayerScore(this.rounds)
    const personalBestPresentation =
      this.launchOptions.mode === 'solo'
        ? resolvePersonalBestPresentation(
            summary.score,
            this.personalBestScoreBeforeRun,
          )
        : null
    this.lastPersonalBestPresentation = personalBestPresentation
    if (personalBestPresentation) {
      this.personalBestScoreBeforeRun = personalBestPresentation.bestScore
    }
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
        0.86,
      )
      .setDepth(30)

    const panel = this.add
      .rectangle(
        LOGICAL_WIDTH / 2,
        422,
        348,
        568,
        0x223143,
        1,
      )
      .setStrokeStyle(3, 0xffd76a, 0.94)
      .setDepth(31)
      .setScale(0.96)
      .setAlpha(0.86)

    this.add
      .circle(94, 313, 86, 0xffd76a, 0.07)
      .setStrokeStyle(2, 0xffd76a, 0.35)
      .setDepth(32)
    this.add.circle(94, 313, 64, 0x55e6d1, 0.06).setDepth(32)

    const confetti = [
      [44, 181, 0xff795f, -18],
      [83, 162, 0x55e6d1, 22],
      [318, 178, 0xffd76a, 16],
      [345, 219, 0xff795f, -25],
      [53, 534, 0x55e6d1, 32],
      [333, 520, 0xffd76a, -12],
    ].map(([x, y, color, angle]) =>
      this.add
        .rectangle(x, y, 7, 15, color, 0.9)
        .setAngle(angle)
        .setDepth(32),
    )

    this.add
      .text(LOGICAL_WIDTH / 2, 169, "TODAY'S MENU SCORE", {
        color: '#7ef0df',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(33)

    this.add
      .text(LOGICAL_WIDTH / 2, 205, '오늘의 입맛 점수', {
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '27px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(33)

    const resultChef = this.add
      .image(92, 316, CHEF_CAT_TEXTURE_KEY)
      .setDisplaySize(108, 136)
      .setAngle(-6)
      .setDepth(33)
    const resultChefScaleX = resultChef.scaleX
    const resultChefScaleY = resultChef.scaleY
    const scoreCopy = this.add
      .text(264, 305, `${summary.score.toFixed(1)}점`, {
        color: '#55e6d1',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '48px',
        fontStyle: 'bold',
        stroke: '#101821',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(34)
    this.add
      .text(264, 348, '오늘의 칼각 지수', {
        color: '#c8d8df',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(33)

    if (personalBestPresentation) {
      const statusCopy =
        personalBestPresentation.status === 'first'
          ? ' · 첫 기록'
          : personalBestPresentation.status === 'new'
            ? ' · NEW'
            : ''
      const personalBestColor =
        personalBestPresentation.status === 'new' ? 0xffd76a : 0x55e6d1
      this.add
        .rectangle(LOGICAL_WIDTH / 2, 374, 252, 26, 0x17212d, 0.94)
        .setStrokeStyle(1, personalBestColor, 0.72)
        .setDepth(32)
      this.add
        .text(
          LOGICAL_WIDTH / 2,
          374,
          `이 기기 최고 기록 ${personalBestPresentation.bestScore.toFixed(1)}점${statusCopy}`,
          {
            color:
              personalBestPresentation.status === 'new'
                ? '#ffd76a'
                : '#7ef0df',
            fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
            fontSize: '13px',
            fontStyle: 'bold',
          },
        )
        .setOrigin(0.5)
        .setDepth(33)
    }

    this.add
      .rectangle(113, 410, 142, 44, 0x17212d, 0.96)
      .setStrokeStyle(1, 0x55e6d1, 0.55)
      .setDepth(32)
    this.add
      .rectangle(277, 410, 142, 44, 0x17212d, 0.96)
      .setStrokeStyle(1, 0xffd76a, 0.55)
      .setDepth(32)
    this.add
      .text(113, 410, `${TOTAL_ROUNDS}개 메뉴 완주`, {
        color: '#7ef0df',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(33)
    this.add
      .text(277, 410, `놓친 메뉴 ${summary.missCount}개`, {
        color: '#ffd76a',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(33)

    this.add
      .rectangle(LOGICAL_WIDTH / 2, 501, 302, 92, 0x151f2b, 0.94)
      .setStrokeStyle(1, 0x55e6d1, 0.38)
      .setDepth(32)
    this.add
      .text(LOGICAL_WIDTH / 2, 468, '오늘의 찜 메뉴', {
        color: '#ffd76a',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(33)
    this.add
      .text(
        LOGICAL_WIDTH / 2,
        510,
        capturedNames.length > 0
          ? capturedNames.join(' · ')
          : '아직 찜한 메뉴가 없어요',
        {
          align: 'center',
          color: '#fff8e7',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
          fontSize: '17px',
          fontStyle: 'bold',
          lineSpacing: 5,
          wordWrap: { width: 270 },
        },
      )
      .setOrigin(0.5)
      .setDepth(33)

    const retryButton = this.add
      .rectangle(LOGICAL_WIDTH / 2, 594, 252, 56, 0xff795f, 1)
      .setDepth(32)
      .setInteractive({ useHandCursor: true })

    this.add
      .text(LOGICAL_WIDTH / 2, 594, '같은 메뉴로 한 판 더', {
        color: '#181f27',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(33)

    const homeButton = this.add
      .rectangle(LOGICAL_WIDTH / 2, 658, 252, 46, 0x394b61, 1)
      .setStrokeStyle(2, 0x8fa4bb, 0.8)
      .setDepth(32)
      .setInteractive({ useHandCursor: true })

    this.add
      .text(LOGICAL_WIDTH / 2, 658, '새 메뉴 고르기', {
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(33)

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: panel,
        scale: 1,
        alpha: 1,
        duration: 230,
        ease: 'Back.Out',
      })
      resultChef.setScale(resultChefScaleX * 0.72, resultChefScaleY * 0.72)
      scoreCopy.setScale(0.72)
      this.tweens.add({
        targets: resultChef,
        scaleX: resultChefScaleX,
        scaleY: resultChefScaleY,
        duration: 320,
        ease: 'Back.Out',
      })
      this.tweens.add({
        targets: scoreCopy,
        scale: 1,
        duration: 320,
        ease: 'Back.Out',
      })
      this.tweens.add({
        targets: confetti,
        y: '+=18',
        alpha: 0.25,
        duration: 760,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
      })
    } else {
      panel.setScale(1).setAlpha(1)
    }

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
    const pointLimit = this.reducedMotion
      ? Math.min(18, TRAIL_RECENT_POINT_LIMIT)
      : TRAIL_RECENT_POINT_LIMIT
    const recentPath = this.path.slice(-pointLimit)
    if (recentPath.length < 2) {
      return
    }

    const first = recentPath[0]!
    this.trail.lineStyle(
      this.reducedMotion ? 9 : 13,
      0x55e6d1,
      this.reducedMotion ? 0.12 : 0.2,
    )
    this.trail.beginPath()
    this.trail.moveTo(first.x, first.y)
    for (let index = 1; index < recentPath.length; index += 1) {
      const point = recentPath[index]!
      this.trail.lineTo(point.x, point.y)
    }
    this.trail.strokePath()

    for (let index = 1; index < recentPath.length; index += 1) {
      const previous = recentPath[index - 1]!
      const point = recentPath[index]!
      const recency = index / (recentPath.length - 1)
      const sampleDistance = Phaser.Math.Distance.BetweenPoints(
        previous,
        point,
      )
      const speedFactor = Phaser.Math.Clamp(sampleDistance / 24, 0, 1)
      const width =
        1.5 +
        recency * (this.reducedMotion ? 2 : 2.8) +
        speedFactor * (this.reducedMotion ? 0.6 : 1.2)

      this.trail.lineStyle(
        width,
        0xfff8e7,
        0.55 + recency * 0.4,
      )
      this.trail.lineBetween(
        previous.x,
        previous.y,
        point.x,
        point.y,
      )
    }

    const finalPoint = recentPath.at(-1)!
    this.trail.fillStyle(0xffffff, 1)
    this.trail.fillCircle(
      finalPoint.x,
      finalPoint.y,
      this.reducedMotion ? 3 : 4.5,
    )
  }

  private toPoint(pointer: Phaser.Input.Pointer): Point {
    return {
      x: pointer.worldX,
      y: pointer.worldY,
    }
  }
}

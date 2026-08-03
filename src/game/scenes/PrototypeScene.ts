import Phaser from 'phaser'
import {
  isPathClosed,
  type Circle,
  type Point,
} from '../../domain/geometry'
import {
  calculatePathLength,
  classifyGesture,
  type CaptureGestureDecision,
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

const TOTAL_ROUNDS = 20
const JUDGEMENT_RADIUS = 64
const TOKEN_START_Y = 190
const MISS_LINE_Y = 704
const PATH_SAMPLE_DISTANCE = 5
const CAPTURE_CLOSURE_TOLERANCE = 34
const MAX_PATH_POINTS = 192
const MAX_GESTURE_DURATION_MS = 2_000
const GESTURE_PAUSE_BUDGET_MS = 1_100
const TOKEN_VISUAL_MAX_WIDTH = 128
const TOKEN_VISUAL_MAX_HEIGHT = 112
const SLICE_EFFECT_DURATION_MS = 440
const CAPTURE_EFFECT_DURATION_MS = 480

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
  pauseRemainingMs: number
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
  private activeToken: ActiveToken | null = null
  private pausedToken: ActiveToken | null = null
  private captureSlots: CaptureSlot[] = []
  private filledCaptureSlotCount = 0
  private pauseBudgetTimer: Phaser.Time.TimerEvent | null = null
  private pauseStartedAt: number | null = null
  private lastSliceAngleDegrees: number | null = null
  private activeSlicePieceCount = 0
  private cleanedSlicePieceCount = 0
  private gestureTimeout: Phaser.Time.TimerEvent | null = null
  private activePointerId: number | null = null
  private path: Point[] = []
  private rounds: RoundResult[] = []
  private deck: readonly WeightedMenuCatalogEntry[] = []
  private isDrawing = false
  private isFinished = false

  constructor(
    private readonly launchOptions: GameLaunchOptions =
      DEFAULT_GAME_LAUNCH_OPTIONS,
    private readonly onGameResult?: PlayerGameResultHandler,
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
  }

  create(): void {
    this.reportGameResult = createPlayerGameResultReporter(
      this.launchOptions,
      this.onGameResult,
    )

    this.registerMenuTextures()
    this.drawArena()
    this.createHud()

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
    this.time.delayedCall(500, () => this.spawnRound())
  }

  private resetRunState(): void {
    this.gestureTimeout?.remove(false)
    this.pauseBudgetTimer?.remove(false)
    this.activeToken = null
    this.pausedToken = null
    this.captureSlots = []
    this.filledCaptureSlotCount = 0
    this.pauseBudgetTimer = null
    this.pauseStartedAt = null
    this.lastSliceAngleDegrees = null
    this.activeSlicePieceCount = 0
    this.cleanedSlicePieceCount = 0
    this.gestureTimeout = null
    this.activePointerId = null
    this.path = []
    this.rounds = []
    this.deck = []
    this.isDrawing = false
    this.isFinished = false
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
    readonly completedRounds: number
    readonly captureCount: number
    readonly filledCaptureSlotCount: number
    readonly pathPointCount: number
    readonly lastSliceAngleDegrees: number | null
    readonly activeSlicePieceCount: number
    readonly cleanedSlicePieceCount: number
    readonly lastAction: RoundAction['type'] | null
    readonly feedback: string
    readonly mealTime: GameLaunchOptions['mealTime']
    readonly deckSeed: GameLaunchOptions['deckSeed']
    readonly deckMenuIds: readonly string[]
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
      completedRounds: this.rounds.length,
      captureCount: this.rounds.filter(
        (round) => round.action.type === 'capture',
      ).length,
      filledCaptureSlotCount: this.filledCaptureSlotCount,
      pathPointCount: this.path.length,
      lastSliceAngleDegrees: this.lastSliceAngleDegrees,
      activeSlicePieceCount: this.activeSlicePieceCount,
      cleanedSlicePieceCount: this.cleanedSlicePieceCount,
      lastAction: this.rounds.at(-1)?.action.type ?? null,
      feedback: this.feedbackText?.text ?? '',
      mealTime: this.launchOptions.mealTime,
      deckSeed: this.launchOptions.deckSeed,
      deckMenuIds: this.deck.map((menu) => menu.id),
    }
  }

  pauseActiveTokenForTest(): void {
    if (import.meta.env.DEV && this.activeToken) {
      this.activeToken.tween.pause()
      this.pauseBudgetTimer?.remove(false)
      this.pauseBudgetTimer = null
      this.pauseStartedAt = null
      this.pausedToken = this.activeToken
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

    this.add
      .text(LOGICAL_WIDTH / 2, 44, '오늘 뭐 썰?', {
        color: '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(LOGICAL_WIDTH / 2, 786, '원을 그리면 포획 · 가로지르면 베기', {
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
      .text(LOGICAL_WIDTH / 2, 103, '', {
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
      pauseRemainingMs: GESTURE_PAUSE_BUDGET_MS,
    }
    this.feedbackText.setColor('#fff8e7')
    this.feedbackText.setText(`${menu.nameKo} — 포획할까, 반으로 썰까?`)
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

    this.activePointerId = pointer.id
    const startPoint = this.toPoint(pointer)
    this.isDrawing = true
    this.path = [startPoint]
    this.drawTrail()

    const tokenCenter = {
      x: token.container.x,
      y: token.container.y,
    }
    if (Phaser.Math.Distance.BetweenPoints(startPoint, tokenCenter) <=
      JUDGEMENT_RADIUS * 2.5) {
      this.pauseTokenForGesture(token)
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
    if (this.appendPathPoint(next)) {
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

    this.clearGestureTimeout()
    this.isDrawing = false
    this.activePointerId = null

    if (!this.activeToken) {
      this.path = []
      this.trail.clear()
      this.resumePausedToken()
      return
    }

    const finalPoint = this.toPoint(pointer)
    const previous = this.path.at(-1)

    if (!previous || Phaser.Math.Distance.BetweenPoints(previous, finalPoint) > 1) {
      this.appendPathPoint(finalPoint, 1)
    }

    this.drawTrail()
    this.evaluateGesture()
    this.resumePausedToken()

    this.time.delayedCall(180, () => {
      this.trail.clear()
    })
  }

  private appendPathPoint(
    point: Point,
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
      this.path = this.path.filter((_, index) => index % 2 === 0)
      if (lastPoint && this.path.at(-1) !== lastPoint) {
        this.path.push(lastPoint)
      }
    }

    this.path.push(point)
    return true
  }

  private cancelGesture(): void {
    const wasDrawing = this.isDrawing
    this.clearGestureTimeout()
    this.isDrawing = false
    this.activePointerId = null
    this.path = []
    this.trail.clear()

    if (wasDrawing && this.activeToken) {
      this.feedbackText.setText('한 번에 그려주세요! 다시 시도할 수 있어요.')
    }

    this.resumePausedToken()
  }

  private clearGestureTimeout(): void {
    this.gestureTimeout?.remove(false)
    this.gestureTimeout = null
  }

  private teardownInput(): void {
    this.clearGestureTimeout()
    this.pauseBudgetTimer?.remove(false)
    this.pauseBudgetTimer = null
    this.pauseStartedAt = null
    this.pausedToken = null
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

  private pauseTokenForGesture(token: ActiveToken): void {
    if (
      this.pausedToken === token ||
      token.pauseRemainingMs <= 0 ||
      this.activeToken?.container !== token.container
    ) {
      return
    }

    token.tween.pause()
    this.pausedToken = token
    this.pauseStartedAt = this.time.now
    this.pauseBudgetTimer = this.time.delayedCall(
      token.pauseRemainingMs,
      () => this.resumePausedToken(),
    )
  }

  private resumePausedToken(): void {
    const token = this.pausedToken
    const pauseStartedAt = this.pauseStartedAt
    this.pauseBudgetTimer?.remove(false)
    this.pauseBudgetTimer = null
    this.pauseStartedAt = null
    this.pausedToken = null

    if (token && pauseStartedAt !== null) {
      token.pauseRemainingMs = Math.max(
        0,
        token.pauseRemainingMs - (this.time.now - pauseStartedAt),
      )
    }

    if (token && this.activeToken?.container === token.container) {
      token.tween.resume()
    }
  }

  private evaluateGesture(): void {
    const token = this.activeToken
    if (!token || this.path.length < 2) {
      return
    }

    const circle: Circle = {
      center: {
        x: token.container.x,
        y: token.container.y,
      },
      radius: JUDGEMENT_RADIUS,
    }
    const captureCount = this.rounds.filter(
      (round) => round.action.type === 'capture',
    ).length
    const decision = classifyGesture(this.path, circle, {
      captureAvailable: captureCount < MAX_CAPTURES,
      closureTolerance: CAPTURE_CLOSURE_TOLERANCE,
    })

    if (import.meta.env.DEV) {
      console.debug('[gesture-classification]', {
        decision,
        circle,
      })
    }

    if (decision.kind === 'capture') {
      this.resolveRound({ type: 'capture' }, decision)
    } else if (decision.kind === 'slice') {
      this.resolveRound(
        {
        type: 'slice',
          accuracy: decision.result.accuracyScore,
        },
        decision,
      )
    } else if (decision.reason === 'capture-limit') {
      this.feedbackText.setText('포획 2/2 완료 · 이제 열린 선으로 베어주세요!')
    } else if (decision.reason === 'closed-invalid') {
      this.feedbackText.setText('음식 전체를 감싸고 시작점으로 돌아와 주세요!')
    } else if (decision.reason === 'too-short') {
      this.feedbackText.setText('조금 더 길게 한 번에 그려주세요!')
    } else {
      this.feedbackText.setText('양쪽 바깥까지 가로질러 썰어보세요!')
    }
  }

  private resolveRound(
    action: RoundAction,
    decision?: SliceGestureDecision | CaptureGestureDecision,
  ): void {
    const token = this.activeToken
    if (!token) {
      return
    }

    this.clearGestureTimeout()
    this.isDrawing = false
    this.activePointerId = null
    this.path = []
    this.pauseBudgetTimer?.remove(false)
    this.pauseBudgetTimer = null
    this.pauseStartedAt = null
    this.pausedToken = null
    if (action.type === 'miss') {
      this.trail.clear()
    }

    this.activeToken = null
    token.tween.stop()

    const roundIndex = this.rounds.length
    this.rounds.push({
      roundIndex,
      menuId: token.menu.id,
      action,
    })

    this.updateHud()

    if (action.type === 'capture') {
      if (!decision || decision.kind !== 'capture') {
        throw new Error('포획 연출에는 포획 제스처 결정이 필요합니다.')
      }
      this.feedbackText.setText(`${token.menu.nameKo} 포획!`)
      this.playCaptureResolution(token, decision)
    } else if (action.type === 'slice') {
      if (!decision || decision.kind !== 'slice') {
        throw new Error('베기 연출에는 베기 제스처 결정이 필요합니다.')
      }
      const roundedScore = Math.round(action.accuracy * 10) / 10
      const rating = roundedScore >= 95 ? '칼각!' : '정확도'
      this.feedbackText.setText(`${rating} ${roundedScore.toFixed(1)}%`)
      this.playSliceResolution(token, decision, roundedScore)
    } else {
      this.feedbackText.setText(`${token.menu.nameKo} 놓침 · 0점`)
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

  private playCaptureResolution(
    token: ActiveToken,
    decision: CaptureGestureDecision,
  ): void {
    this.drawCaptureRing(decision.path)
    this.cameras.main.shake(70, 0.002)

    const captureIndex =
      this.rounds.filter((round) => round.action.type === 'capture').length - 1
    const slot = this.captureSlots[captureIndex]
    const target = slot?.center ?? { x: LOGICAL_WIDTH - 42, y: 113 }

    this.tweens.add({
      targets: token.container,
      x: target.x,
      y: target.y,
      angle: 360,
      scale: 0.2,
      alpha: 0.9,
      duration: CAPTURE_EFFECT_DURATION_MS,
      ease: 'Back.In',
      onComplete: () => {
        token.container.destroy()
        if (slot) {
          this.populateCaptureSlot(slot, token.menu)
        }
      },
    })
  }

  private drawCaptureRing(path: readonly Point[]): void {
    const firstPoint = path[0]
    if (!firstPoint) {
      return
    }

    const ring = this.add.graphics().setDepth(22)
    for (const style of [
      { width: 15, color: 0x55e6d1, alpha: 0.2 },
      { width: 5, color: 0xfff8e7, alpha: 0.95 },
    ]) {
      ring.lineStyle(style.width, style.color, style.alpha)
      ring.beginPath()
      ring.moveTo(firstPoint.x, firstPoint.y)
      for (let index = 1; index < path.length; index += 1) {
        const point = path[index]!
        ring.lineTo(point.x, point.y)
      }
      ring.strokePath()
    }

    this.tweens.add({
      targets: ring,
      alpha: 0,
      duration: CAPTURE_EFFECT_DURATION_MS,
      ease: 'Quad.Out',
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

  private showAccuracyPopup(x: number, y: number, score: number): void {
    const popup = this.add
      .text(x, y - 18, `${score.toFixed(1)}%`, {
        color: score >= 95 ? '#ffd76a' : '#fff8e7',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        stroke: '#101821',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(25)

    this.tweens.add({
      targets: popup,
      y: popup.y - 48,
      alpha: 0,
      duration: 650,
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
    this.scoreText.setText(`평균 ${average.toFixed(1)}`)
    this.captureText.setText(`포획 ${captures}/${MAX_CAPTURES}`)
  }

  private showResults(): void {
    this.isFinished = true
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

    const isClosingCapture =
      calculatePathLength(this.path) >= JUDGEMENT_RADIUS * 3 &&
      isPathClosed(this.path, CAPTURE_CLOSURE_TOLERANCE)
    const coreColor = isClosingCapture ? 0xffd76a : 0xfff8e7

    for (const style of [
      { width: 15, color: 0x55e6d1, alpha: 0.2 },
      { width: 5, color: coreColor, alpha: 0.95 },
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
    this.trail.fillStyle(coreColor, 1)
    this.trail.fillCircle(first.x, first.y, isClosingCapture ? 7 : 4)
    this.trail.fillCircle(finalPoint.x, finalPoint.y, isClosingCapture ? 7 : 4)
    if (isClosingCapture) {
      this.trail.lineStyle(3, 0xffd76a, 0.85)
      this.trail.strokeCircle(first.x, first.y, 13)
    }
  }

  private toPoint(pointer: Phaser.Input.Pointer): Point {
    return {
      x: pointer.worldX,
      y: pointer.worldY,
    }
  }
}

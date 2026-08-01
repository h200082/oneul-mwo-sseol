import Phaser from 'phaser'
import {
  calculateAbsoluteClosedPathArea,
  calculateCircleSliceResult,
  doesPathContainCircleCenter,
  findFirstCircleCrossingChord,
  isPathClosed,
  isSimpleClosedPath,
  type Circle,
  type Point,
} from '../../domain/geometry'
import {
  MAX_CAPTURES,
  calculatePlayerScore,
  canCapture,
  createWeightedMenuDeck,
  type RoundAction,
  type RoundResult,
} from '../../domain/gameRules'
import {
  createSeededRandom,
  toWeightedMenuPool,
  type WeightedMenuCatalogEntry,
} from '../../data/menus'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../createGame'
import {
  createPlayerGameResultReporter,
  DEFAULT_GAME_LAUNCH_OPTIONS,
  type GameLaunchOptions,
  type PlayerGameResultHandler,
} from '../gameTypes'

const TOTAL_ROUNDS = 20
const TOKEN_RADIUS = 64
const TOKEN_START_Y = 190
const MISS_LINE_Y = 704
const FALL_DURATION_MS = 2_250
const NEXT_ROUND_DELAY_MS = 320
const PATH_SAMPLE_DISTANCE = 5
const CAPTURE_CLOSURE_TOLERANCE = 34
const MIN_CAPTURE_PATH_LENGTH = TOKEN_RADIUS * 3
const MAX_GESTURE_DURATION_MS = 2_000
const MIN_CAPTURE_AREA =
  Math.PI * TOKEN_RADIUS * TOKEN_RADIUS * 0.45

interface ActiveToken {
  readonly menu: WeightedMenuCatalogEntry
  readonly container: Phaser.GameObjects.Container
  readonly tween: Phaser.Tweens.Tween
  pauseAvailable: boolean
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

  create(): void {
    this.reportGameResult = createPlayerGameResultReporter(
      this.launchOptions,
      this.onGameResult,
    )
    this.resetRunState()
    this.deck = createWeightedMenuDeck(
      toWeightedMenuPool(this.launchOptions.mealTime),
      {
        size: TOTAL_ROUNDS,
        rng: createSeededRandom(this.launchOptions.deckSeed),
      },
    )

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

    this.updateHud()
    this.time.delayedCall(500, () => this.spawnRound())
  }

  private resetRunState(): void {
    this.gestureTimeout?.remove(false)
    this.activeToken = null
    this.pausedToken = null
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
      readonly radius: number
    } | null
    readonly completedRounds: number
    readonly captureCount: number
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
            radius: TOKEN_RADIUS,
          }
        : null,
      completedRounds: this.rounds.length,
      captureCount: this.rounds.filter(
        (round) => round.action.type === 'capture',
      ).length,
      lastAction: this.rounds.at(-1)?.action.type ?? null,
      feedback: this.feedbackText.text,
      mealTime: this.launchOptions.mealTime,
      deckSeed: this.launchOptions.deckSeed,
      deckMenuIds: this.deck.map((menu) => menu.id),
    }
  }

  pauseActiveTokenForTest(): void {
    if (import.meta.env.DEV && this.activeToken) {
      this.activeToken.tween.pause()
      this.pausedToken = this.activeToken
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
      .text(LOGICAL_WIDTH - 46, 103, '', {
        color: '#ffd76a',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)

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

    const shadow = this.add.circle(5, 8, TOKEN_RADIUS + 5, 0x05090d, 0.35)
    const sticker = this.add.circle(0, 0, TOKEN_RADIUS, 0xfff8e7)
    const food = this.add.circle(
      0,
      0,
      TOKEN_RADIUS - 8,
      Number.parseInt(menu.placeholderColor.slice(1), 16),
    )
    const shine = this.add.circle(-21, -24, 15, 0xffffff, 0.22)
    const label = this.add
      .text(0, 1, menu.nameKo, {
        align: 'center',
        color: '#18212b',
        fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        wordWrap: { width: TOKEN_RADIUS * 1.55 },
      })
      .setOrigin(0.5)

    const container = this.add
      .container(x, TOKEN_START_Y, [shadow, sticker, food, shine, label])
      .setDepth(5)

    const tween = this.tweens.add({
      targets: container,
      y: MISS_LINE_Y + TOKEN_RADIUS,
      duration: FALL_DURATION_MS,
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
      pauseAvailable: true,
    }
    this.feedbackText.setText(`${menu.nameKo} — 포획할까, 반으로 썰까?`)
    this.updateHud()
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
    if (
      token.pauseAvailable &&
      Phaser.Math.Distance.BetweenPoints(startPoint, tokenCenter) <=
      TOKEN_RADIUS * 2.5
    ) {
      token.pauseAvailable = false
      token.tween.pause()
      this.pausedToken = token
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
    const previous = this.path.at(-1)

    if (
      !previous ||
      Phaser.Math.Distance.BetweenPoints(previous, next) >=
        PATH_SAMPLE_DISTANCE
    ) {
      this.path.push(next)
      this.drawTrail()
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.isDrawing || pointer.id !== this.activePointerId) {
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
      this.path.push(finalPoint)
    }

    this.drawTrail()
    this.evaluateGesture()
    this.resumePausedToken()

    this.time.delayedCall(180, () => {
      this.trail.clear()
    })
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

  private resumePausedToken(): void {
    const token = this.pausedToken
    this.pausedToken = null

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
      radius: TOKEN_RADIUS,
    }
    const pathLength = this.calculatePathLength(this.path)
    const pathClosed = isPathClosed(
      this.path,
      CAPTURE_CLOSURE_TOLERANCE,
    )
    const containsTokenCenter =
      pathClosed &&
      doesPathContainCircleCenter(
        this.path,
        circle,
        CAPTURE_CLOSURE_TOLERANCE,
      )
    const captureArea = pathClosed
      ? calculateAbsoluteClosedPathArea(
          this.path,
          CAPTURE_CLOSURE_TOLERANCE,
        )
      : 0
    const isSimpleCapturePath =
      pathClosed &&
      isSimpleClosedPath(
        this.path,
        CAPTURE_CLOSURE_TOLERANCE,
      )
    const isCaptureGesture =
      pathLength >= MIN_CAPTURE_PATH_LENGTH &&
      pathClosed &&
      containsTokenCenter &&
      isSimpleCapturePath &&
      captureArea >= MIN_CAPTURE_AREA

    if (import.meta.env.DEV) {
      console.debug('[gesture-classification]', {
        pathLength,
        pathClosed,
        containsTokenCenter,
        isCaptureGesture,
        isSimpleCapturePath,
        captureArea,
        pathPoints: this.path.length,
        circle,
      })
    }

    if (isCaptureGesture) {
      if (canCapture(this.rounds)) {
        this.resolveRound({ type: 'capture' })
      } else {
        this.feedbackText.setText('포획 2개 완료! 이 메뉴는 베어주세요.')
      }
      return
    }

    const chord = findFirstCircleCrossingChord(this.path, circle)

    if (!chord) {
      this.feedbackText.setText('토큰의 양쪽 끝까지 가로질러 썰어보세요!')
      return
    }

    const slice = calculateCircleSliceResult(
      chord.entryPoint,
      chord.exitPoint,
      circle,
    )

    if (import.meta.env.DEV) {
      console.debug('[gesture-debug]', {
        chord,
        circle,
        pathPoints: this.path.length,
        slice,
      })
    }

    if (slice.crossesCircle) {
      this.resolveRound({
        type: 'slice',
        accuracy: slice.accuracyScore,
      })
    } else {
      this.feedbackText.setText('토큰의 양쪽 끝까지 가로질러 썰어보세요!')
    }
  }

  private resolveRound(action: RoundAction): void {
    const token = this.activeToken
    if (!token) {
      return
    }

    this.clearGestureTimeout()
    this.isDrawing = false
    this.activePointerId = null
    this.path = []
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

    if (action.type === 'capture') {
      this.feedbackText.setText(`${token.menu.nameKo} 포획!`)
      this.tweens.add({
        targets: token.container,
        x: LOGICAL_WIDTH - 58,
        y: 111,
        angle: 360,
        scale: 0.24,
        alpha: 0.85,
        duration: 420,
        ease: 'Back.In',
        onComplete: () => token.container.destroy(),
      })
    } else if (action.type === 'slice') {
      const roundedScore = Math.round(action.accuracy * 10) / 10
      const rating = roundedScore >= 95 ? '칼각!' : '정확도'
      this.feedbackText.setText(`${rating} ${roundedScore.toFixed(1)}%`)
      this.tweens.add({
        targets: token.container,
        scaleX: 1.18,
        scaleY: 0.82,
        alpha: 0,
        angle: 8,
        duration: 300,
        ease: 'Quad.Out',
        onComplete: () => token.container.destroy(),
      })
    } else {
      this.feedbackText.setText(`${token.menu.nameKo} 놓침 · 0점`)
      this.tweens.add({
        targets: token.container,
        alpha: 0,
        duration: 180,
        onComplete: () => token.container.destroy(),
      })
    }

    this.updateHud()
    this.time.delayedCall(NEXT_ROUND_DELAY_MS, () => this.spawnRound())
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

    this.trail.lineStyle(8, 0x55e6d1, 0.9)
    this.trail.beginPath()
    this.trail.moveTo(first.x, first.y)

    for (let index = 1; index < this.path.length; index += 1) {
      const point = this.path[index]
      if (point) {
        this.trail.lineTo(point.x, point.y)
      }
    }

    this.trail.strokePath()
  }

  private calculatePathLength(path: readonly Point[]): number {
    let length = 0

    for (let index = 1; index < path.length; index += 1) {
      const previous = path[index - 1]
      const current = path[index]
      if (previous && current) {
        length += Phaser.Math.Distance.BetweenPoints(previous, current)
      }
    }

    return length
  }

  private toPoint(pointer: Phaser.Input.Pointer): Point {
    return {
      x: pointer.worldX,
      y: pointer.worldY,
    }
  }
}

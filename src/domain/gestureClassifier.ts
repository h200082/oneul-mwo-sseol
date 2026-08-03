import {
  calculateAbsoluteClosedPathArea,
  calculateCircleSliceResult,
  doesClosedPathContainCircle,
  findFirstCircleCrossingChord,
  isPathClosed,
  isSimpleClosedPath,
  type Circle,
  type CircleCrossingChord,
  type CircleSliceResult,
  type Point,
} from './geometry'

export type GestureInvalidReason =
  | 'too-short'
  | 'open-no-crossing'
  | 'closed-invalid'
  | 'capture-limit'

export interface GestureMetrics {
  readonly pathLength: number
  readonly pathClosed: boolean
  readonly pathPoints: number
  readonly captureArea: number
  readonly containsJudgementCircle: boolean
  readonly isSimpleCapturePath: boolean
}

export interface SliceGestureDecision {
  readonly kind: 'slice'
  readonly chord: CircleCrossingChord
  readonly result: CircleSliceResult
  readonly metrics: GestureMetrics
}

export interface CaptureGestureDecision {
  readonly kind: 'capture'
  readonly path: readonly Point[]
  readonly metrics: GestureMetrics
}

export interface InvalidGestureDecision {
  readonly kind: 'invalid'
  readonly reason: GestureInvalidReason
  readonly metrics: GestureMetrics
}

export type GestureDecision =
  | SliceGestureDecision
  | CaptureGestureDecision
  | InvalidGestureDecision

export interface GestureClassifierOptions {
  readonly captureAvailable?: boolean
  readonly closureTolerance?: number
  readonly minimumCaptureArea?: number
  readonly minimumCapturePathLength?: number
}

export function calculatePathLength(path: readonly Point[]): number {
  let length = 0

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]!
    const current = path[index]!
    length += Math.hypot(current.x - previous.x, current.y - previous.y)
  }

  return length
}

/**
 * Classifies a sampled pointer trajectory without depending on Phaser.
 *
 * Visual artwork is intentionally absent from this contract. The MVP keeps a
 * shared circular judgement mask so changing a transparent food silhouette or
 * its aspect ratio cannot change multiplayer difficulty. Closed paths are
 * capture attempts only; an invalid loop never falls through into a slice.
 */
export function classifyGesture(
  path: readonly Point[],
  judgementCircle: Circle,
  options: GestureClassifierOptions = {},
): GestureDecision {
  const closureTolerance = options.closureTolerance ?? 34
  const minimumCapturePathLength =
    options.minimumCapturePathLength ?? judgementCircle.radius * 3
  const minimumCaptureArea =
    options.minimumCaptureArea ??
    Math.PI * judgementCircle.radius * judgementCircle.radius * 0.9

  assertNonNegativeFinite(
    minimumCapturePathLength,
    'minimumCapturePathLength',
  )
  assertNonNegativeFinite(minimumCaptureArea, 'minimumCaptureArea')

  const pathLength = calculatePathLength(path)
  const pathClosed = isPathClosed(path, closureTolerance)
  const captureArea = pathClosed
    ? calculateAbsoluteClosedPathArea(path, closureTolerance)
    : 0
  const isSimpleCapturePath =
    pathClosed && isSimpleClosedPath(path, closureTolerance)
  const containsJudgementCircle =
    isSimpleCapturePath &&
    doesClosedPathContainCircle(
      path,
      judgementCircle,
      closureTolerance,
    )
  const metrics: GestureMetrics = {
    pathLength,
    pathClosed,
    pathPoints: path.length,
    captureArea,
    containsJudgementCircle,
    isSimpleCapturePath,
  }

  if (path.length < 2 || pathLength <= 0) {
    return { kind: 'invalid', reason: 'too-short', metrics }
  }

  if (pathClosed) {
    const isCapture =
      pathLength >= minimumCapturePathLength &&
      captureArea >= minimumCaptureArea &&
      containsJudgementCircle

    if (!isCapture) {
      return { kind: 'invalid', reason: 'closed-invalid', metrics }
    }

    if (options.captureAvailable === false) {
      return { kind: 'invalid', reason: 'capture-limit', metrics }
    }

    return { kind: 'capture', path: [...path], metrics }
  }

  const chord = findFirstCircleCrossingChord(path, judgementCircle)
  if (!chord) {
    return { kind: 'invalid', reason: 'open-no-crossing', metrics }
  }

  const result = calculateCircleSliceResult(
    chord.entryPoint,
    chord.exitPoint,
    judgementCircle,
  )

  return result.crossesCircle
    ? { kind: 'slice', chord, result, metrics }
    : { kind: 'invalid', reason: 'open-no-crossing', metrics }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number.`)
  }
}

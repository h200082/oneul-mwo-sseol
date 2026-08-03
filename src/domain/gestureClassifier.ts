import {
  calculateCircleSliceResult,
  calculateDistanceFromPointToSegment,
  extendLineToCircleChord,
  findFirstCircleCrossingChord,
  extendSegmentToCircleChord,
  isPathClosed,
  type Circle,
  type CircleCrossingChord,
  type CircleSliceResult,
  type Point,
} from './geometry'

export type GestureInvalidReason =
  | 'too-short'
  | 'open-no-crossing'
  | 'closed-invalid'

export interface GestureMetrics {
  readonly pathLength: number
  readonly pathSpan: number
  readonly pathStraightness: number
  readonly pathClosed: boolean
  readonly pathPoints: number
  readonly minimumDistanceToTarget: number
}

export interface SliceGestureDecision {
  readonly kind: 'slice'
  readonly chord: CircleCrossingChord
  readonly result: CircleSliceResult
  readonly source: 'strict' | 'extended'
  readonly metrics: GestureMetrics
}

export interface InvalidGestureDecision {
  readonly kind: 'invalid'
  readonly reason: GestureInvalidReason
  readonly metrics: GestureMetrics
}

export type GestureDecision =
  | SliceGestureDecision
  | InvalidGestureDecision

export interface GestureClassifierOptions {
  readonly closureTolerance?: number
  readonly minimumSlicePathLength?: number
  readonly minimumSliceSpan?: number
  readonly minimumSliceStraightness?: number
  readonly sliceHitSlop?: number
  readonly sliceTangentInset?: number
  readonly sliceEndpointExtension?: number
  /**
   * Optional path in screen/world coordinates. The moving-target path still
   * decides whether the food was hit, while this path supplies the direction
   * the player visibly drew for the split and score line.
   */
  readonly intentPath?: readonly Point[]
}

interface PathSpan {
  readonly start: Point
  readonly end: Point
  readonly length: number
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

function findMaximumPathSpan(path: readonly Point[]): PathSpan {
  const fallback = path[0] ?? { x: 0, y: 0 }
  let best: PathSpan = { start: fallback, end: fallback, length: 0 }

  for (let startIndex = 0; startIndex < path.length; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex < path.length; endIndex += 1) {
      const start = path[startIndex]!
      const end = path[endIndex]!
      const length = Math.hypot(end.x - start.x, end.y - start.y)

      if (length > best.length) {
        best = { start, end, length }
      }
    }
  }

  return best
}

function calculateMinimumPathDistance(
  path: readonly Point[],
  target: Point,
): number {
  if (path.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  if (path.length === 1) {
    return Math.hypot(path[0]!.x - target.x, path[0]!.y - target.y)
  }

  let minimumDistance = Number.POSITIVE_INFINITY
  for (let index = 1; index < path.length; index += 1) {
    minimumDistance = Math.min(
      minimumDistance,
      calculateDistanceFromPointToSegment(
        target,
        path[index - 1]!,
        path[index]!,
      ),
    )
  }
  return minimumDistance
}

/**
 * Classifies a sampled pointer trajectory without depending on Phaser.
 *
 * Capture is intentionally not part of drag classification. The live game
 * uses a stationary hold for capture, so a loop can never be mistaken for a
 * capture or a slice. A strict boundary-to-boundary chord remains preferred;
 * a deliberate, straight swipe near the target may instead use an extended
 * intent line so players can begin or release inside the artwork.
 */
export function classifyGesture(
  path: readonly Point[],
  judgementCircle: Circle,
  options: GestureClassifierOptions = {},
): GestureDecision {
  const closureTolerance = options.closureTolerance ?? 34
  const minimumSlicePathLength =
    options.minimumSlicePathLength ?? judgementCircle.radius * 0.55
  const minimumSliceSpan =
    options.minimumSliceSpan ?? judgementCircle.radius * 0.45
  const minimumSliceStraightness =
    options.minimumSliceStraightness ?? 0.6
  const sliceHitSlop =
    options.sliceHitSlop ??
    Math.min(14, Math.max(8, judgementCircle.radius * 0.18))
  const sliceTangentInset =
    options.sliceTangentInset ?? Math.max(2, judgementCircle.radius * 0.03)
  const sliceEndpointExtension =
    options.sliceEndpointExtension ??
    Math.min(32, judgementCircle.radius * 0.65)

  assertNonNegativeFinite(closureTolerance, 'closureTolerance')
  assertNonNegativeFinite(minimumSlicePathLength, 'minimumSlicePathLength')
  assertNonNegativeFinite(minimumSliceSpan, 'minimumSliceSpan')
  assertUnitInterval(minimumSliceStraightness, 'minimumSliceStraightness')
  assertNonNegativeFinite(sliceHitSlop, 'sliceHitSlop')
  assertNonNegativeFinite(sliceTangentInset, 'sliceTangentInset')
  assertNonNegativeFinite(sliceEndpointExtension, 'sliceEndpointExtension')

  const pathLength = calculatePathLength(path)
  const span = findMaximumPathSpan(path)
  const pathStraightness = pathLength > 0 ? span.length / pathLength : 0
  const pathClosed =
    pathLength >= judgementCircle.radius * 2.4 &&
    isPathClosed(path, closureTolerance)
  const minimumDistanceToTarget = calculateMinimumPathDistance(
    path,
    judgementCircle.center,
  )
  const metrics: GestureMetrics = {
    pathLength,
    pathSpan: span.length,
    pathStraightness,
    pathClosed,
    pathPoints: path.length,
    minimumDistanceToTarget,
  }

  if (
    path.length < 2 ||
    pathLength < minimumSlicePathLength ||
    span.length < minimumSliceSpan
  ) {
    return { kind: 'invalid', reason: 'too-short', metrics }
  }

  if (pathClosed) {
    return { kind: 'invalid', reason: 'closed-invalid', metrics }
  }

  const strictChord = findFirstCircleCrossingChord(path, judgementCircle)
  if (strictChord) {
    return createSliceDecision(
      strictChord,
      judgementCircle,
      metrics,
      'strict',
      options.intentPath,
      sliceTangentInset,
    )
  }

  if (
    pathStraightness < minimumSliceStraightness ||
    minimumDistanceToTarget > judgementCircle.radius + sliceHitSlop
  ) {
    return { kind: 'invalid', reason: 'open-no-crossing', metrics }
  }

  const extendedChord = extendSegmentToCircleChord(
    span.start,
    span.end,
    judgementCircle,
    sliceEndpointExtension,
    sliceTangentInset,
  )
  if (!extendedChord) {
    return { kind: 'invalid', reason: 'open-no-crossing', metrics }
  }

  return createSliceDecision(
    extendedChord,
    judgementCircle,
    metrics,
    'extended',
    options.intentPath,
    sliceTangentInset,
  )
}

function createSliceDecision(
  chord: CircleCrossingChord,
  judgementCircle: Circle,
  metrics: GestureMetrics,
  source: SliceGestureDecision['source'],
  intentPath?: readonly Point[],
  tangentInset = 0,
): GestureDecision {
  const resolvedChord = alignChordToIntent(
    chord,
    judgementCircle,
    intentPath,
    tangentInset,
  )
  const result = calculateCircleSliceResult(
    resolvedChord.entryPoint,
    resolvedChord.exitPoint,
    judgementCircle,
  )

  return result.crossesCircle
    ? { kind: 'slice', chord: resolvedChord, result, source, metrics }
    : { kind: 'invalid', reason: 'open-no-crossing', metrics }
}

function alignChordToIntent(
  chord: CircleCrossingChord,
  judgementCircle: Circle,
  intentPath: readonly Point[] | undefined,
  tangentInset: number,
): CircleCrossingChord {
  if (!intentPath || intentPath.length < 2) {
    return chord
  }

  const intentSpan = findMaximumPathSpan(intentPath)
  if (intentSpan.length <= Number.EPSILON) {
    return chord
  }

  const unit = {
    x: (intentSpan.end.x - intentSpan.start.x) / intentSpan.length,
    y: (intentSpan.end.y - intentSpan.start.y) / intentSpan.length,
  }
  const normal = { x: -unit.y, y: unit.x }
  const chordMidpoint = {
    x: (chord.entryPoint.x + chord.exitPoint.x) / 2,
    y: (chord.entryPoint.y + chord.exitPoint.y) / 2,
  }
  const offset =
    (chordMidpoint.x - judgementCircle.center.x) * normal.x +
    (chordMidpoint.y - judgementCircle.center.y) * normal.y
  const anchor = {
    x: judgementCircle.center.x + normal.x * offset,
    y: judgementCircle.center.y + normal.y * offset,
  }
  const extension = judgementCircle.radius * 2

  return (
    extendLineToCircleChord(
      {
        x: anchor.x - unit.x * extension,
        y: anchor.y - unit.y * extension,
      },
      {
        x: anchor.x + unit.x * extension,
        y: anchor.y + unit.y * extension,
      },
      judgementCircle,
      tangentInset,
    ) ?? chord
  )
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number.`)
  }
}

function assertUnitInterval(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite number from zero to one.`)
  }
}

import {
  calculateAlphaSilhouetteSliceResult,
  calculatePlacedSilhouetteCentroid,
  type AlphaSilhouetteSliceResult,
  type PlacedSilhouette,
  type SilhouetteLineExtent,
} from './alphaSilhouette'
import {
  calculateDistanceFromPointToSegment,
  isPathClosed,
  type Point,
} from './geometry'
import {
  calculatePathLength,
  type GestureMetrics,
  type InvalidGestureDecision,
} from './gestureClassifier'

export interface SilhouetteSliceGestureDecision {
  readonly kind: 'slice'
  readonly chord: SilhouetteLineExtent
  readonly result: AlphaSilhouetteSliceResult
  readonly source: 'strict' | 'extended'
  readonly metrics: GestureMetrics
}

export type SilhouetteGestureDecision =
  | SilhouetteSliceGestureDecision
  | InvalidGestureDecision

export interface SilhouetteGestureClassifierOptions {
  readonly closureTolerance?: number
  readonly minimumSlicePathLength?: number
  readonly minimumSliceSpan?: number
  readonly minimumSliceStraightness?: number
  readonly sliceHitSlop?: number
  readonly sliceEndpointExtension?: number
  readonly minimumPieceRatio?: number
  readonly minimumContactLength?: number
  /** The token-local path anchors the cut; this path supplies visible direction. */
  readonly intentPath?: readonly Point[]
}

interface PathSpan {
  readonly start: Point
  readonly end: Point
  readonly length: number
}

/**
 * Classifies a swipe against the food artwork's opaque silhouette.
 * Transparent canvas corners and gaps between food pieces never count.
 */
export function classifySilhouetteGesture(
  path: readonly Point[],
  silhouette: Readonly<PlacedSilhouette>,
  options: SilhouetteGestureClassifierOptions = {},
): SilhouetteGestureDecision {
  const effectiveRadius = Math.max(
    silhouette.displayWidth,
    silhouette.displayHeight,
  ) / 2
  const closureTolerance = options.closureTolerance ?? 34
  const minimumSlicePathLength =
    options.minimumSlicePathLength ?? effectiveRadius * 0.55
  const minimumSliceSpan = options.minimumSliceSpan ?? effectiveRadius * 0.45
  const minimumSliceStraightness = options.minimumSliceStraightness ?? 0.6
  const sliceHitSlop = options.sliceHitSlop ?? 3.5
  const sliceEndpointExtension = options.sliceEndpointExtension ?? 32
  const minimumPieceRatio = options.minimumPieceRatio ?? 0.01
  const minimumContactLength = options.minimumContactLength ?? 2

  assertNonNegativeFinite(closureTolerance, 'closureTolerance')
  assertNonNegativeFinite(minimumSlicePathLength, 'minimumSlicePathLength')
  assertNonNegativeFinite(minimumSliceSpan, 'minimumSliceSpan')
  assertUnitInterval(minimumSliceStraightness, 'minimumSliceStraightness')
  assertNonNegativeFinite(sliceHitSlop, 'sliceHitSlop')
  assertNonNegativeFinite(sliceEndpointExtension, 'sliceEndpointExtension')
  assertPieceRatio(minimumPieceRatio)
  assertNonNegativeFinite(minimumContactLength, 'minimumContactLength')
  assertFinitePath(path, 'path')
  if (options.intentPath) {
    assertFinitePath(options.intentPath, 'intentPath')
  }

  const pathLength = calculatePathLength(path)
  const span = findMaximumPathSpan(path)
  const pathStraightness = pathLength > 0 ? span.length / pathLength : 0
  const pathClosed =
    pathLength >= effectiveRadius * 2.4 && isPathClosed(path, closureTolerance)
  const centroid = calculatePlacedSilhouetteCentroid(silhouette)
  const minimumDistanceToTarget = calculateMinimumPathDistance(path, centroid)
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
  if (pathStraightness < minimumSliceStraightness) {
    return { kind: 'invalid', reason: 'open-no-crossing', metrics }
  }

  const directionSpan =
    options.intentPath && options.intentPath.length >= 2
      ? findMaximumPathSpan(options.intentPath)
      : span
  if (directionSpan.length <= Number.EPSILON) {
    return { kind: 'invalid', reason: 'too-short', metrics }
  }

  const tangent = {
    x: (directionSpan.end.x - directionSpan.start.x) / directionSpan.length,
    y: (directionSpan.end.y - directionSpan.start.y) / directionSpan.length,
  }
  const anchor = findClosestPointOnPath(path, centroid)
  const projectionRange = findPathProjectionRange(path, anchor, tangent)
  const lineEnd = { x: anchor.x + tangent.x, y: anchor.y + tangent.y }
  const strictStart = addScaled(anchor, tangent, projectionRange.minimum)
  const strictEnd = addScaled(anchor, tangent, projectionRange.maximum)
  const resultOptions = {
    hitTolerance: sliceHitSlop,
    minimumPieceRatio,
    minimumContactLength,
  }

  const strictResult = calculateAlphaSilhouetteSliceResult(
    silhouette,
    anchor,
    lineEnd,
    strictStart,
    strictEnd,
    resultOptions,
  )
  if (
    strictResult.crossesSilhouette &&
    strictResult.chord &&
    doesSegmentCoverChord(
      strictStart,
      strictEnd,
      strictResult.chord,
      sliceHitSlop,
    )
  ) {
    return {
      kind: 'slice',
      chord: strictResult.chord,
      result: strictResult,
      source: 'strict',
      metrics,
    }
  }

  const extendedStart = addScaled(
    anchor,
    tangent,
    projectionRange.minimum - sliceEndpointExtension,
  )
  const extendedEnd = addScaled(
    anchor,
    tangent,
    projectionRange.maximum + sliceEndpointExtension,
  )
  const extendedResult = calculateAlphaSilhouetteSliceResult(
    silhouette,
    anchor,
    lineEnd,
    extendedStart,
    extendedEnd,
    resultOptions,
  )
  if (
    extendedResult.crossesSilhouette &&
    extendedResult.chord &&
    doesSegmentCoverChord(
      extendedStart,
      extendedEnd,
      extendedResult.chord,
      sliceHitSlop,
    )
  ) {
    return {
      kind: 'slice',
      chord: extendedResult.chord,
      result: extendedResult,
      source: 'extended',
      metrics,
    }
  }

  return { kind: 'invalid', reason: 'open-no-crossing', metrics }
}

function findMaximumPathSpan(path: readonly Point[]): PathSpan {
  const fallback = path[0] ?? { x: 0, y: 0 }
  let best: PathSpan = { start: fallback, end: fallback, length: 0 }
  for (let startIndex = 0; startIndex < path.length; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex < path.length; endIndex += 1) {
      const start = path[startIndex]!
      const end = path[endIndex]!
      const length = Math.hypot(end.x - start.x, end.y - start.y)
      if (length > best.length) best = { start, end, length }
    }
  }
  return best
}

function calculateMinimumPathDistance(path: readonly Point[], target: Point): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY
  if (path.length === 1) {
    return Math.hypot(path[0]!.x - target.x, path[0]!.y - target.y)
  }
  let minimumDistance = Number.POSITIVE_INFINITY
  for (let index = 1; index < path.length; index += 1) {
    minimumDistance = Math.min(
      minimumDistance,
      calculateDistanceFromPointToSegment(target, path[index - 1]!, path[index]!),
    )
  }
  return minimumDistance
}

function findClosestPointOnPath(path: readonly Point[], target: Point): Point {
  let closest = path[0] ?? target
  let closestDistance = Number.POSITIVE_INFINITY
  for (let index = 1; index < path.length; index += 1) {
    const candidate = projectPointOntoSegment(target, path[index - 1]!, path[index]!)
    const distance = Math.hypot(candidate.x - target.x, candidate.y - target.y)
    if (distance < closestDistance) {
      closest = candidate
      closestDistance = distance
    }
  }
  return closest
}

function projectPointOntoSegment(point: Point, start: Point, end: Point): Point {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  if (lengthSquared <= Number.EPSILON) return start
  const parameter = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
        lengthSquared,
    ),
  )
  return { x: start.x + deltaX * parameter, y: start.y + deltaY * parameter }
}

function findPathProjectionRange(
  path: readonly Point[],
  anchor: Point,
  tangent: Point,
): { readonly minimum: number; readonly maximum: number } {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  for (const point of path) {
    const projection =
      (point.x - anchor.x) * tangent.x + (point.y - anchor.y) * tangent.y
    minimum = Math.min(minimum, projection)
    maximum = Math.max(maximum, projection)
  }
  return { minimum, maximum }
}

function doesSegmentCoverChord(
  segmentStart: Point,
  segmentEnd: Point,
  chord: SilhouetteLineExtent,
  tolerance: number,
): boolean {
  const deltaX = chord.exitPoint.x - chord.entryPoint.x
  const deltaY = chord.exitPoint.y - chord.entryPoint.y
  const chordLength = Math.hypot(deltaX, deltaY)
  if (chordLength <= Number.EPSILON) {
    return false
  }

  const tangent = { x: deltaX / chordLength, y: deltaY / chordLength }
  const project = (point: Point) =>
    (point.x - chord.entryPoint.x) * tangent.x +
    (point.y - chord.entryPoint.y) * tangent.y
  const startProjection = project(segmentStart)
  const endProjection = project(segmentEnd)
  const minimum = Math.min(startProjection, endProjection)
  const maximum = Math.max(startProjection, endProjection)

  return minimum <= tolerance && maximum >= chordLength - tolerance
}

function addScaled(origin: Point, direction: Point, scale: number): Point {
  return { x: origin.x + direction.x * scale, y: origin.y + direction.y * scale }
}

function assertFinitePath(path: readonly Point[], name: string): void {
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index]!
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new TypeError(`${name}[${index}] must contain finite coordinates.`)
    }
  }
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

function assertPieceRatio(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 0.5) {
    throw new RangeError('minimumPieceRatio must be from zero to 0.5.')
  }
}

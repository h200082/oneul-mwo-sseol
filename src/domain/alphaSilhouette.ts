import {
  calculateSliceAccuracyScore,
  type Point,
} from './geometry'

export const DEFAULT_ALPHA_THRESHOLD = 32

const GEOMETRY_EPSILON = 1e-9
const LINE_TIE_EPSILON = 1e-7

export interface AlphaSilhouetteMask {
  readonly width: number
  readonly height: number
  readonly weights: Uint8Array
  readonly totalWeight: number
  readonly opaquePixelCount: number
  readonly alphaThreshold: number
  readonly centroid: Point
  readonly opaqueBounds: {
    readonly left: number
    readonly top: number
    readonly right: number
    readonly bottom: number
  } | null
}

export interface PlacedSilhouette {
  readonly mask: Readonly<AlphaSilhouetteMask>
  readonly center: Point
  readonly displayWidth: number
  readonly displayHeight: number
}

export interface SilhouetteLineExtent {
  readonly entryPoint: Point
  readonly exitPoint: Point
  readonly length: number
}

export interface SilhouetteAreaSplit {
  readonly sideAWeight: number
  readonly sideBWeight: number
  readonly totalWeight: number
  readonly smallerAreaRatio: number
  readonly largerAreaRatio: number
}

export interface AlphaSilhouetteSliceResult extends SilhouetteAreaSplit {
  readonly crossesSilhouette: boolean
  readonly hitOpaque: boolean
  readonly accuracyScore: number
  readonly contactLength: number
  readonly chord: SilhouetteLineExtent | null
}

export interface AlphaSilhouetteSliceOptions {
  readonly hitTolerance?: number
  readonly minimumPieceRatio?: number
  readonly minimumContactLength?: number
}

export function createAlphaSilhouetteMask(
  width: number,
  height: number,
  alpha: ArrayLike<number>,
  alphaThreshold = DEFAULT_ALPHA_THRESHOLD,
): AlphaSilhouetteMask {
  assertPositiveInteger(width, 'width')
  assertPositiveInteger(height, 'height')
  assertAlphaThreshold(alphaThreshold)

  const pixelCount = width * height
  if (alpha.length !== pixelCount) {
    throw new RangeError(
      `alpha length must equal width * height (${pixelCount}); received ${alpha.length}.`,
    )
  }

  const weights = new Uint8Array(pixelCount)
  let totalWeight = 0
  let opaquePixelCount = 0
  let weightedX = 0
  let weightedY = 0
  let left = width
  let top = height
  let right = 0
  let bottom = 0

  for (let index = 0; index < pixelCount; index += 1) {
    const rawAlpha = alpha[index]
    if (!Number.isFinite(rawAlpha) || rawAlpha! < 0 || rawAlpha! > 255) {
      throw new RangeError(`alpha[${index}] must be a finite value from 0 to 255.`)
    }

    const roundedAlpha = Math.round(rawAlpha!)
    if (roundedAlpha < alphaThreshold) {
      continue
    }

    weights[index] = roundedAlpha
    totalWeight += roundedAlpha
    opaquePixelCount += 1

    const column = index % width
    const row = Math.floor(index / width)
    weightedX += (column + 0.5) * roundedAlpha
    weightedY += (row + 0.5) * roundedAlpha
    left = Math.min(left, column)
    top = Math.min(top, row)
    right = Math.max(right, column + 1)
    bottom = Math.max(bottom, row + 1)
  }

  return {
    width,
    height,
    weights,
    totalWeight,
    opaquePixelCount,
    alphaThreshold,
    centroid:
      totalWeight > 0
        ? { x: weightedX / totalWeight, y: weightedY / totalWeight }
        : { x: width / 2, y: height / 2 },
    opaqueBounds:
      opaquePixelCount > 0 ? { left, top, right, bottom } : null,
  }
}

export function calculatePlacedSilhouetteCentroid(
  silhouette: Readonly<PlacedSilhouette>,
): Point {
  assertPlacedSilhouette(silhouette)

  return mapMaskPointToPlacement(
    silhouette.mask.centroid,
    silhouette,
  )
}

export function splitSilhouetteByLine(
  silhouette: Readonly<PlacedSilhouette>,
  lineStart: Point,
  lineEnd: Point,
): SilhouetteAreaSplit {
  assertPlacedSilhouette(silhouette)
  const frame = createLineFrame(lineStart, lineEnd)
  let sideAWeight = 0
  let sideBWeight = 0

  visitOpaqueCells(silhouette, (cell) => {
    const signedDistance =
      (cell.center.x - lineStart.x) * frame.normal.x +
      (cell.center.y - lineStart.y) * frame.normal.y

    if (Math.abs(signedDistance) <= LINE_TIE_EPSILON) {
      sideAWeight += cell.weight / 2
      sideBWeight += cell.weight / 2
    } else if (signedDistance > 0) {
      sideAWeight += cell.weight
    } else {
      sideBWeight += cell.weight
    }
  })

  const totalWeight = sideAWeight + sideBWeight
  const smallerWeight = Math.min(sideAWeight, sideBWeight)
  const smallerAreaRatio = totalWeight > 0 ? smallerWeight / totalWeight : 0

  return {
    sideAWeight,
    sideBWeight,
    totalWeight,
    smallerAreaRatio,
    largerAreaRatio: totalWeight > 0 ? 1 - smallerAreaRatio : 1,
  }
}

export function doesSegmentHitSilhouette(
  silhouette: Readonly<PlacedSilhouette>,
  segmentStart: Point,
  segmentEnd: Point,
  tolerance = 0,
): boolean {
  assertPlacedSilhouette(silhouette)
  assertFinitePoint(segmentStart, 'segmentStart')
  assertFinitePoint(segmentEnd, 'segmentEnd')
  assertNonNegativeFinite(tolerance, 'tolerance')

  let hit = false
  visitOpaqueCells(silhouette, (cell) => {
    if (
      !hit &&
      doesSegmentIntersectRectangle(
        segmentStart,
        segmentEnd,
        cell.center.x - cell.halfWidth - tolerance,
        cell.center.y - cell.halfHeight - tolerance,
        cell.center.x + cell.halfWidth + tolerance,
        cell.center.y + cell.halfHeight + tolerance,
      )
    ) {
      hit = true
    }
  })
  return hit
}

export function findSilhouetteLineExtent(
  silhouette: Readonly<PlacedSilhouette>,
  lineStart: Point,
  lineEnd: Point,
): SilhouetteLineExtent | null {
  assertPlacedSilhouette(silhouette)
  const frame = createLineFrame(lineStart, lineEnd)
  let minimumProjection = Number.POSITIVE_INFINITY
  let maximumProjection = Number.NEGATIVE_INFINITY

  visitOpaqueCells(silhouette, (cell) => {
    const relativeX = cell.center.x - lineStart.x
    const relativeY = cell.center.y - lineStart.y
    const perpendicularDistance = Math.abs(
      relativeX * frame.normal.x + relativeY * frame.normal.y,
    )
    const perpendicularRadius =
      Math.abs(frame.normal.x) * cell.halfWidth +
      Math.abs(frame.normal.y) * cell.halfHeight

    if (perpendicularDistance > perpendicularRadius + GEOMETRY_EPSILON) {
      return
    }

    const centerProjection =
      relativeX * frame.tangent.x + relativeY * frame.tangent.y
    const tangentRadius =
      Math.abs(frame.tangent.x) * cell.halfWidth +
      Math.abs(frame.tangent.y) * cell.halfHeight
    minimumProjection = Math.min(
      minimumProjection,
      centerProjection - tangentRadius,
    )
    maximumProjection = Math.max(
      maximumProjection,
      centerProjection + tangentRadius,
    )
  })

  if (
    !Number.isFinite(minimumProjection) ||
    !Number.isFinite(maximumProjection) ||
    maximumProjection - minimumProjection <= GEOMETRY_EPSILON
  ) {
    return null
  }

  return {
    entryPoint: {
      x: lineStart.x + frame.tangent.x * minimumProjection,
      y: lineStart.y + frame.tangent.y * minimumProjection,
    },
    exitPoint: {
      x: lineStart.x + frame.tangent.x * maximumProjection,
      y: lineStart.y + frame.tangent.y * maximumProjection,
    },
    length: maximumProjection - minimumProjection,
  }
}

export function calculateAlphaSilhouetteSliceResult(
  silhouette: Readonly<PlacedSilhouette>,
  lineStart: Point,
  lineEnd: Point,
  hitSegmentStart: Point,
  hitSegmentEnd: Point,
  options: AlphaSilhouetteSliceOptions = {},
): AlphaSilhouetteSliceResult {
  const hitTolerance = options.hitTolerance ?? 0
  const minimumPieceRatio = options.minimumPieceRatio ?? 0.01
  const minimumContactLength = options.minimumContactLength ?? 2
  assertNonNegativeFinite(hitTolerance, 'hitTolerance')
  assertRatio(minimumPieceRatio, 'minimumPieceRatio')
  assertNonNegativeFinite(minimumContactLength, 'minimumContactLength')

  const split = splitSilhouetteByLine(silhouette, lineStart, lineEnd)
  const hitOpaque = doesSegmentHitSilhouette(
    silhouette,
    hitSegmentStart,
    hitSegmentEnd,
    hitTolerance,
  )
  const chord = findSilhouetteLineExtent(silhouette, lineStart, lineEnd)
  const contactLength = chord?.length ?? 0
  const crossesSilhouette =
    hitOpaque &&
    chord !== null &&
    contactLength >= minimumContactLength &&
    split.smallerAreaRatio >= minimumPieceRatio

  return {
    ...split,
    crossesSilhouette,
    hitOpaque,
    accuracyScore: crossesSilhouette
      ? calculateSliceAccuracyScore(split.smallerAreaRatio)
      : 0,
    contactLength,
    chord: crossesSilhouette ? chord : null,
  }
}

interface OpaqueCell {
  readonly center: Point
  readonly halfWidth: number
  readonly halfHeight: number
  readonly weight: number
}

function visitOpaqueCells(
  silhouette: Readonly<PlacedSilhouette>,
  visitor: (cell: Readonly<OpaqueCell>) => void,
): void {
  const { mask } = silhouette
  const cellWidth = silhouette.displayWidth / mask.width
  const cellHeight = silhouette.displayHeight / mask.height
  const left = silhouette.center.x - silhouette.displayWidth / 2
  const top = silhouette.center.y - silhouette.displayHeight / 2

  for (let index = 0; index < mask.weights.length; index += 1) {
    const weight = mask.weights[index]!
    if (weight === 0) {
      continue
    }

    const column = index % mask.width
    const row = Math.floor(index / mask.width)
    visitor({
      center: {
        x: left + (column + 0.5) * cellWidth,
        y: top + (row + 0.5) * cellHeight,
      },
      halfWidth: cellWidth / 2,
      halfHeight: cellHeight / 2,
      weight,
    })
  }
}

function mapMaskPointToPlacement(
  maskPoint: Point,
  silhouette: Readonly<PlacedSilhouette>,
): Point {
  return {
    x:
      silhouette.center.x +
      (maskPoint.x / silhouette.mask.width - 0.5) *
        silhouette.displayWidth,
    y:
      silhouette.center.y +
      (maskPoint.y / silhouette.mask.height - 0.5) *
        silhouette.displayHeight,
  }
}

function createLineFrame(lineStart: Point, lineEnd: Point): {
  readonly tangent: Point
  readonly normal: Point
} {
  assertFinitePoint(lineStart, 'lineStart')
  assertFinitePoint(lineEnd, 'lineEnd')
  const deltaX = lineEnd.x - lineStart.x
  const deltaY = lineEnd.y - lineStart.y
  const length = Math.hypot(deltaX, deltaY)
  if (length <= GEOMETRY_EPSILON) {
    throw new RangeError('A silhouette slice line requires two distinct points.')
  }

  const tangent = { x: deltaX / length, y: deltaY / length }
  return {
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
  }
}

function doesSegmentIntersectRectangle(
  start: Point,
  end: Point,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  let minimumParameter = 0
  let maximumParameter = 1

  for (const [origin, delta, minimum, maximum] of [
    [start.x, deltaX, left, right],
    [start.y, deltaY, top, bottom],
  ] as const) {
    if (Math.abs(delta) <= GEOMETRY_EPSILON) {
      if (origin < minimum || origin > maximum) {
        return false
      }
      continue
    }

    let first = (minimum - origin) / delta
    let second = (maximum - origin) / delta
    if (first > second) {
      const temporary = first
      first = second
      second = temporary
    }
    minimumParameter = Math.max(minimumParameter, first)
    maximumParameter = Math.min(maximumParameter, second)
    if (minimumParameter > maximumParameter + GEOMETRY_EPSILON) {
      return false
    }
  }

  return true
}

function assertPlacedSilhouette(
  silhouette: Readonly<PlacedSilhouette>,
): void {
  assertFinitePoint(silhouette.center, 'silhouette.center')
  assertPositiveFinite(silhouette.displayWidth, 'silhouette.displayWidth')
  assertPositiveFinite(silhouette.displayHeight, 'silhouette.displayHeight')
  assertPositiveInteger(silhouette.mask.width, 'silhouette.mask.width')
  assertPositiveInteger(silhouette.mask.height, 'silhouette.mask.height')
  if (
    silhouette.mask.weights.length !==
    silhouette.mask.width * silhouette.mask.height
  ) {
    throw new RangeError('silhouette mask weights have an invalid length.')
  }
}

function assertFinitePoint(point: Point, name: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${name} must contain finite x and y coordinates.`)
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`)
  }
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`)
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number.`)
  }
}

function assertRatio(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 0.5) {
    throw new RangeError(`${name} must be a finite number from 0 to 0.5.`)
  }
}

function assertAlphaThreshold(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 255) {
    throw new RangeError('alphaThreshold must be an integer from 1 to 255.')
  }
}

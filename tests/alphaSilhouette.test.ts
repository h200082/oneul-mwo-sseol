import { describe, expect, it } from 'vitest'

import {
  calculateAlphaSilhouetteSliceResult,
  calculatePlacedSilhouetteCentroid,
  createAlphaSilhouetteMask,
  doesSegmentHitSilhouette,
  splitSilhouetteByLine,
  type AlphaSilhouetteMask,
  type PlacedSilhouette,
} from '../src/domain/alphaSilhouette'

function maskFromRows(
  rows: readonly string[],
  alphaThreshold = 32,
): AlphaSilhouetteMask {
  const width = rows[0]?.length ?? 0
  if (rows.some((row) => row.length !== width)) {
    throw new Error('Every fixture row must have the same width.')
  }

  return createAlphaSilhouetteMask(
    width,
    rows.length,
    rows.flatMap((row) =>
      [...row].map((cell) => (cell === '#' ? 255 : 0)),
    ),
    alphaThreshold,
  )
}

function placeMask(
  mask: AlphaSilhouetteMask,
  center = { x: mask.width / 2, y: mask.height / 2 },
  displayWidth = mask.width,
  displayHeight = mask.height,
): PlacedSilhouette {
  return { mask, center, displayWidth, displayHeight }
}

const FULL_FOUR_BY_FOUR = maskFromRows([
  '####',
  '####',
  '####',
  '####',
])

describe('createAlphaSilhouetteMask', () => {
  it('keeps alpha weights at and above the inclusive threshold', () => {
    const mask = createAlphaSilhouetteMask(
      2,
      2,
      [255, 31, 32, 0],
      32,
    )

    expect([...mask.weights]).toEqual([255, 0, 32, 0])
    expect(mask.totalWeight).toBe(287)
    expect(mask.opaquePixelCount).toBe(2)
    expect(mask.opaqueBounds).toEqual({
      left: 0,
      top: 0,
      right: 1,
      bottom: 2,
    })
    expect(mask.centroid.x).toBeCloseTo(0.5, 12)
    expect(mask.centroid.y).toBeCloseTo((0.5 * 255 + 1.5 * 32) / 287, 12)
  })

  it('uses the image center and null bounds for an empty mask', () => {
    const mask = createAlphaSilhouetteMask(4, 2, new Uint8Array(8))

    expect(mask.totalWeight).toBe(0)
    expect(mask.opaquePixelCount).toBe(0)
    expect(mask.centroid).toEqual({ x: 2, y: 1 })
    expect(mask.opaqueBounds).toBeNull()
  })

  it('maps the alpha-weighted centroid through placement scale and offset', () => {
    const mask = createAlphaSilhouetteMask(2, 1, [255, 0])
    const silhouette = placeMask(mask, { x: 10, y: -6 }, 8, 4)

    expect(calculatePlacedSilhouetteCentroid(silhouette)).toEqual({
      x: 8,
      y: -6,
    })
  })

  it('rejects malformed dimensions, alpha data, and thresholds', () => {
    expect(() => createAlphaSilhouetteMask(0, 1, [])).toThrow(RangeError)
    expect(() => createAlphaSilhouetteMask(2, 2, [0, 0, 0])).toThrow(
      RangeError,
    )
    expect(() => createAlphaSilhouetteMask(1, 1, [256])).toThrow(RangeError)
    expect(() => createAlphaSilhouetteMask(1, 1, [255], 0)).toThrow(
      RangeError,
    )
  })
})

describe('splitSilhouetteByLine', () => {
  it('calculates an exact 50:50 split through a rectangle', () => {
    const split = splitSilhouetteByLine(
      placeMask(FULL_FOUR_BY_FOUR),
      { x: 2, y: -1 },
      { x: 2, y: 5 },
    )

    expect(split.sideAWeight).toBe(8 * 255)
    expect(split.sideBWeight).toBe(8 * 255)
    expect(split.totalWeight).toBe(16 * 255)
    expect(split.smallerAreaRatio).toBe(0.5)
    expect(split.largerAreaRatio).toBe(0.5)
  })

  it('uses silhouette area rather than the render bounds for an off-center cut', () => {
    const split = splitSilhouetteByLine(
      placeMask(FULL_FOUR_BY_FOUR),
      { x: 1, y: -1 },
      { x: 1, y: 5 },
    )

    expect([split.sideAWeight, split.sideBWeight].sort((a, b) => a - b)).toEqual([
      4 * 255,
      12 * 255,
    ])
    expect(split.smallerAreaRatio).toBe(0.25)
  })

  it('counts a concave L silhouette without filling its transparent corner', () => {
    const silhouette = placeMask(maskFromRows([
      '##..',
      '##..',
      '####',
      '####',
    ]))
    const split = splitSilhouetteByLine(
      silhouette,
      { x: 2, y: -1 },
      { x: 2, y: 5 },
    )

    expect([split.sideAWeight, split.sideBWeight].sort((a, b) => a - b)).toEqual([
      4 * 255,
      8 * 255,
    ])
    expect(split.smallerAreaRatio).toBeCloseTo(1 / 3, 12)
  })

  it('splits a line-center pixel equally between both sides', () => {
    const silhouette = placeMask(maskFromRows(['###']))
    const forward = splitSilhouetteByLine(
      silhouette,
      { x: 1.5, y: -1 },
      { x: 1.5, y: 2 },
    )
    const reverse = splitSilhouetteByLine(
      silhouette,
      { x: 1.5, y: 2 },
      { x: 1.5, y: -1 },
    )

    expect(forward.sideAWeight).toBe(1.5 * 255)
    expect(forward.sideBWeight).toBe(1.5 * 255)
    expect(forward.smallerAreaRatio).toBe(0.5)
    expect(reverse).toEqual(forward)
  })

  it('retains fractional alpha weights when calculating balance', () => {
    const mask = createAlphaSilhouetteMask(2, 2, [255, 31, 32, 0], 32)
    const split = splitSilhouetteByLine(
      placeMask(mask),
      { x: -1, y: 1 },
      { x: 3, y: 1 },
    )

    expect([split.sideAWeight, split.sideBWeight].sort((a, b) => a - b)).toEqual([
      32,
      255,
    ])
    expect(split.smallerAreaRatio).toBeCloseTo(32 / 287, 12)
  })

  it('is invariant when placement and cut line are translated together', () => {
    const base = splitSilhouetteByLine(
      placeMask(FULL_FOUR_BY_FOUR),
      { x: 1, y: -1 },
      { x: 1, y: 5 },
    )
    const shifted = splitSilhouetteByLine(
      placeMask(FULL_FOUR_BY_FOUR, { x: 102, y: 51 }),
      { x: 101, y: 49 },
      { x: 101, y: 55 },
    )

    expect(shifted).toEqual(base)
  })
})

describe('silhouette hit testing and slice scoring', () => {
  it('awards 100 for a valid exact-half cut and 50 for a valid 25:75 cut', () => {
    const silhouette = placeMask(FULL_FOUR_BY_FOUR)
    const perfect = calculateAlphaSilhouetteSliceResult(
      silhouette,
      { x: 2, y: -1 },
      { x: 2, y: 5 },
      { x: 2, y: -1 },
      { x: 2, y: 5 },
    )
    const offCenter = calculateAlphaSilhouetteSliceResult(
      silhouette,
      { x: 1, y: -1 },
      { x: 1, y: 5 },
      { x: 1, y: -1 },
      { x: 1, y: 5 },
    )

    expect(perfect).toMatchObject({
      crossesSilhouette: true,
      hitOpaque: true,
      smallerAreaRatio: 0.5,
      accuracyScore: 100,
      contactLength: 4,
    })
    expect(perfect.chord).toEqual({
      entryPoint: { x: 2, y: 0 },
      exitPoint: { x: 2, y: 4 },
      length: 4,
    })
    expect(offCenter.crossesSilhouette).toBe(true)
    expect(offCenter.accuracyScore).toBe(50)
  })

  it('rejects a mathematically balanced line through a disconnected transparent gap', () => {
    const silhouette = placeMask(maskFromRows([
      '##..##',
      '##..##',
      '##..##',
      '##..##',
    ]))
    const throughGap = calculateAlphaSilhouetteSliceResult(
      silhouette,
      { x: 3, y: -1 },
      { x: 3, y: 5 },
      { x: 3, y: -1 },
      { x: 3, y: 5 },
    )
    const throughFood = calculateAlphaSilhouetteSliceResult(
      silhouette,
      { x: -1, y: 2 },
      { x: 7, y: 2 },
      { x: -1, y: 2 },
      { x: 7, y: 2 },
    )

    expect(throughGap).toMatchObject({
      crossesSilhouette: false,
      hitOpaque: false,
      smallerAreaRatio: 0.5,
      accuracyScore: 0,
      contactLength: 0,
      chord: null,
    })
    expect(throughFood).toMatchObject({
      crossesSilhouette: true,
      hitOpaque: true,
      smallerAreaRatio: 0.5,
      accuracyScore: 100,
      contactLength: 6,
    })
  })

  it('scores a cut through a thin appendage from its actual area', () => {
    const mask = maskFromRows([
      '####....',
      '########',
      '####....',
      '####....',
    ])
    const silhouette = placeMask(mask, { x: 40, y: 20 }, 80, 40)
    const result = calculateAlphaSilhouetteSliceResult(
      silhouette,
      { x: 57.5, y: -10 },
      { x: 57.5, y: 50 },
      { x: 57.5, y: -10 },
      { x: 57.5, y: 50 },
    )

    expect(result.crossesSilhouette).toBe(true)
    expect([result.sideAWeight, result.sideBWeight].sort((a, b) => a - b)).toEqual([
      2 * 255,
      18 * 255,
    ])
    expect(result.smallerAreaRatio).toBeCloseTo(0.1, 12)
    expect(result.accuracyScore).toBeCloseTo(20, 12)
    expect(result.contactLength).toBe(10)
  })

  it('includes the exact hit-tolerance boundary without inventing a piece', () => {
    const silhouette = placeMask(FULL_FOUR_BY_FOUR)
    const hitStart = { x: 2, y: -2 }
    const hitEnd = { x: 2, y: -0.5 }

    expect(doesSegmentHitSilhouette(silhouette, hitStart, hitEnd, 0.49)).toBe(
      false,
    )
    expect(doesSegmentHitSilhouette(silhouette, hitStart, hitEnd, 0.5)).toBe(
      true,
    )

    const justOutside = calculateAlphaSilhouetteSliceResult(
      silhouette,
      { x: 2, y: -1 },
      { x: 2, y: 5 },
      hitStart,
      hitEnd,
      { hitTolerance: 0.49 },
    )
    const exactBoundary = calculateAlphaSilhouetteSliceResult(
      silhouette,
      { x: 2, y: -1 },
      { x: 2, y: 5 },
      hitStart,
      hitEnd,
      { hitTolerance: 0.5 },
    )
    const outsideSilhouette = calculateAlphaSilhouetteSliceResult(
      silhouette,
      { x: 4.25, y: -1 },
      { x: 4.25, y: 5 },
      { x: 4.25, y: -1 },
      { x: 4.25, y: 5 },
      { hitTolerance: 0.25 },
    )

    expect(justOutside.accuracyScore).toBe(0)
    expect(exactBoundary).toMatchObject({
      crossesSilhouette: true,
      accuracyScore: 100,
    })
    expect(outsideSilhouette).toMatchObject({
      crossesSilhouette: false,
      hitOpaque: true,
      smallerAreaRatio: 0,
      accuracyScore: 0,
    })
  })

  it('preserves scores under render scale and image-center offset', () => {
    const silhouette = placeMask(
      FULL_FOUR_BY_FOUR,
      { x: 10, y: -6 },
      8,
      8,
    )
    const perfect = calculateAlphaSilhouetteSliceResult(
      silhouette,
      { x: 10, y: -12 },
      { x: 10, y: 0 },
      { x: 10, y: -12 },
      { x: 10, y: 0 },
    )
    const offCenter = calculateAlphaSilhouetteSliceResult(
      silhouette,
      { x: 8, y: -12 },
      { x: 8, y: 0 },
      { x: 8, y: -12 },
      { x: 8, y: 0 },
    )
    const forgotOffset = calculateAlphaSilhouetteSliceResult(
      silhouette,
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    )

    expect(perfect).toMatchObject({
      crossesSilhouette: true,
      accuracyScore: 100,
      contactLength: 8,
    })
    expect(offCenter).toMatchObject({
      crossesSilhouette: true,
      accuracyScore: 50,
    })
    expect(forgotOffset).toMatchObject({
      crossesSilhouette: false,
      hitOpaque: false,
      accuracyScore: 0,
    })
  })

  it('rejects zero-length lines and invalid placement dimensions', () => {
    const silhouette = placeMask(FULL_FOUR_BY_FOUR)

    expect(() =>
      splitSilhouetteByLine(
        silhouette,
        { x: 2, y: 2 },
        { x: 2, y: 2 },
      ),
    ).toThrow(RangeError)
    expect(() =>
      splitSilhouetteByLine(
        { ...silhouette, displayWidth: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ),
    ).toThrow(RangeError)
  })
})

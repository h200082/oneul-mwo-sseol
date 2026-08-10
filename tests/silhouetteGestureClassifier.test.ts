import { describe, expect, it } from 'vitest'

import {
  createAlphaSilhouetteMask,
  type AlphaSilhouetteMask,
  type PlacedSilhouette,
} from '../src/domain/alphaSilhouette'
import { type Point } from '../src/domain/geometry'
import { classifySilhouetteGesture } from '../src/domain/silhouetteGestureClassifier'

function maskFromRows(rows: readonly string[]): AlphaSilhouetteMask {
  const width = rows[0]?.length ?? 0
  return createAlphaSilhouetteMask(
    width,
    rows.length,
    rows.flatMap((row) =>
      [...row].map((cell) => (cell === '#' ? 255 : 0)),
    ),
  )
}

function placeMask(
  mask: AlphaSilhouetteMask,
  center = { x: 0, y: 0 },
  displayWidth = 100,
  displayHeight = 100,
): PlacedSilhouette {
  return { mask, center, displayWidth, displayHeight }
}

function createLoop(radius: number, pointCount = 24): Point[] {
  return Array.from({ length: pointCount + 1 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / pointCount
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    }
  })
}

const FULL_SILHOUETTE = placeMask(maskFromRows([
  '####',
  '####',
  '####',
  '####',
]))

describe('classifySilhouetteGesture', () => {
  it('classifies a full opaque crossing as a strict 50:50 slice', () => {
    const decision = classifySilhouetteGesture(
      [
        { x: -80, y: 0 },
        { x: 80, y: 0 },
      ],
      FULL_SILHOUETTE,
    )

    expect(decision.kind).toBe('slice')
    if (decision.kind === 'slice') {
      expect(decision.source).toBe('strict')
      expect(decision.result).toMatchObject({
        crossesSilhouette: true,
        hitOpaque: true,
        smallerAreaRatio: 0.5,
        accuracyScore: 100,
        contactLength: 100,
      })
      expect(decision.chord).toEqual({
        entryPoint: { x: -50, y: 0 },
        exitPoint: { x: 50, y: 0 },
        length: 100,
      })
    }
  })

  it('uses endpoint extension when a deliberate swipe stops before the far edge', () => {
    const decision = classifySilhouetteGesture(
      [
        { x: -82, y: 0 },
        { x: 18, y: 0 },
      ],
      FULL_SILHOUETTE,
    )

    expect(decision).toMatchObject({
      kind: 'slice',
      source: 'extended',
    })
    if (decision.kind === 'slice') {
      expect(decision.result.accuracyScore).toBe(100)
    }
  })

  it('does not use lateral hit slop to invent a chord through empty space', () => {
    const path = [
      { x: -90, y: -54 },
      { x: 90, y: -54 },
    ] as const

    expect(
      classifySilhouetteGesture(path, FULL_SILHOUETTE, {
        sliceHitSlop: 3.99,
        sliceEndpointExtension: 0,
      }),
    ).toMatchObject({ kind: 'invalid', reason: 'open-no-crossing' })
    expect(
      classifySilhouetteGesture(path, FULL_SILHOUETTE, {
        sliceHitSlop: 4,
        sliceEndpointExtension: 0,
      }),
    ).toMatchObject({ kind: 'invalid', reason: 'open-no-crossing' })
  })

  it('does not turn a same-side inside stroke into a whole-food cut', () => {
    const decision = classifySilhouetteGesture(
      [
        { x: 10, y: 0 },
        { x: 42, y: 0 },
      ],
      FULL_SILHOUETTE,
    )

    expect(decision).toMatchObject({
      kind: 'invalid',
      reason: 'open-no-crossing',
    })
  })

  it('scores a concave L from opaque area rather than its rectangular bounds', () => {
    const silhouette = placeMask(maskFromRows([
      '##..',
      '##..',
      '####',
      '####',
    ]))
    const decision = classifySilhouetteGesture(
      [
        { x: 0, y: -70 },
        { x: 0, y: 70 },
      ],
      silhouette,
    )

    expect(decision.kind).toBe('slice')
    if (decision.kind === 'slice') {
      expect(decision.result.smallerAreaRatio).toBeCloseTo(1 / 3, 12)
      expect(decision.result.accuracyScore).toBeCloseTo(200 / 3, 12)
    }
  })

  it('rejects a 50:50 swipe through the transparent gap between disconnected pieces', () => {
    const silhouette = placeMask(
      maskFromRows([
        '##..##',
        '##..##',
        '##..##',
        '##..##',
      ]),
      { x: 0, y: 0 },
      120,
      80,
    )
    const decision = classifySilhouetteGesture(
      [
        { x: 0, y: -60 },
        { x: 0, y: 60 },
      ],
      silhouette,
    )

    expect(decision).toMatchObject({
      kind: 'invalid',
      reason: 'open-no-crossing',
    })
  })

  it('accepts a center-distant thin appendage and scores its true small piece', () => {
    const silhouette = placeMask(
      maskFromRows([
        '####....',
        '########',
        '####....',
        '####....',
      ]),
      { x: 0, y: 0 },
      80,
      40,
    )
    const decision = classifySilhouetteGesture(
      [
        { x: 17.5, y: -30 },
        { x: 17.5, y: 30 },
      ],
      silhouette,
    )

    expect(decision.kind).toBe('slice')
    if (decision.kind === 'slice') {
      expect(decision.result.smallerAreaRatio).toBeCloseTo(0.1, 12)
      expect(decision.result.accuracyScore).toBeCloseTo(20, 12)
      expect(decision.result.contactLength).toBe(10)
    }
  })

  it('uses visible intent direction while retaining token-local contact', () => {
    const decision = classifySilhouetteGesture(
      [
        { x: -35, y: 0 },
        { x: 35, y: -18 },
      ],
      FULL_SILHOUETTE,
      {
        intentPath: [
          { x: 220, y: 410 },
          { x: 290, y: 410 },
        ],
      },
    )

    expect(decision.kind).toBe('slice')
    if (decision.kind === 'slice') {
      expect(decision.chord.entryPoint.y).toBeCloseTo(
        decision.chord.exitPoint.y,
        12,
      )
      expect(decision.chord.entryPoint.x).toBeLessThan(0)
      expect(decision.chord.exitPoint.x).toBeGreaterThan(0)
      expect(decision.result.accuracyScore).toBe(100)
    }
  })

  it('preserves normalized scoring under display scale and image-center offset', () => {
    const mask = maskFromRows([
      '####',
      '####',
      '####',
      '####',
    ])
    const large = classifySilhouetteGesture(
      [
        { x: -60, y: -6 },
        { x: 80, y: -6 },
      ],
      placeMask(mask, { x: 10, y: -6 }, 80, 80),
    )
    const small = classifySilhouetteGesture(
      [
        { x: -30, y: -6 },
        { x: 50, y: -6 },
      ],
      placeMask(mask, { x: 10, y: -6 }, 40, 40),
    )

    expect(large.kind).toBe('slice')
    expect(small.kind).toBe('slice')
    if (large.kind === 'slice' && small.kind === 'slice') {
      expect(large.result.accuracyScore).toBe(100)
      expect(small.result.accuracyScore).toBe(100)
      expect(large.chord.length).toBe(80)
      expect(small.chord.length).toBe(40)
    }
  })

  it('rejects a short scratch, winding stroke, and closed loop', () => {
    expect(
      classifySilhouetteGesture(
        [
          { x: -5, y: 0 },
          { x: 5, y: 0 },
        ],
        FULL_SILHOUETTE,
      ),
    ).toMatchObject({ kind: 'invalid', reason: 'too-short' })

    expect(
      classifySilhouetteGesture(
        [
          { x: -35, y: 0 },
          { x: -10, y: 45 },
          { x: 10, y: -45 },
          { x: 35, y: 0 },
        ],
        FULL_SILHOUETTE,
      ),
    ).toMatchObject({ kind: 'invalid', reason: 'open-no-crossing' })

    expect(
      classifySilhouetteGesture(createLoop(72), FULL_SILHOUETTE),
    ).toMatchObject({ kind: 'invalid', reason: 'closed-invalid' })
  })

  it('validates paths and classifier options', () => {
    expect(() =>
      classifySilhouetteGesture(
        [
          { x: Number.NaN, y: 0 },
          { x: 1, y: 0 },
        ],
        FULL_SILHOUETTE,
      ),
    ).toThrow(TypeError)
    expect(() =>
      classifySilhouetteGesture([], FULL_SILHOUETTE, {
        sliceHitSlop: -1,
      }),
    ).toThrow(RangeError)
    expect(() =>
      classifySilhouetteGesture([], FULL_SILHOUETTE, {
        minimumPieceRatio: 0.51,
      }),
    ).toThrow(RangeError)
  })
})

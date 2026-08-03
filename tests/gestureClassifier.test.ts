import { describe, expect, it } from 'vitest'

import {
  calculatePathLength,
  classifyGesture,
} from '../src/domain/gestureClassifier'
import type { Circle, Point } from '../src/domain/geometry'

const JUDGEMENT_CIRCLE: Circle = {
  center: { x: 0, y: 0 },
  radius: 50,
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

describe('calculatePathLength', () => {
  it('adds every sampled segment', () => {
    expect(
      calculatePathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 6, y: 8 },
      ]),
    ).toBe(10)
  })
})

describe('classifyGesture', () => {
  it('keeps a full boundary crossing as a strict perfect slice', () => {
    const decision = classifyGesture(
      [
        { x: -80, y: 0 },
        { x: 80, y: 0 },
      ],
      JUDGEMENT_CIRCLE,
    )

    expect(decision.kind).toBe('slice')
    if (decision.kind === 'slice') {
      expect(decision.source).toBe('strict')
      expect(decision.result.accuracyScore).toBeCloseTo(100, 12)
      expect(decision.chord).toEqual({
        entryPoint: { x: -50, y: 0 },
        exitPoint: { x: 50, y: 0 },
      })
    }
  })

  it('extends an outside-to-inside swipe through the full judgement circle', () => {
    const decision = classifyGesture(
      [
        { x: -80, y: 0 },
        { x: 25, y: 0 },
      ],
      JUDGEMENT_CIRCLE,
    )

    expect(decision).toMatchObject({ kind: 'slice', source: 'extended' })
    if (decision.kind === 'slice') {
      expect(decision.chord.entryPoint.x).toBeCloseTo(-50, 12)
      expect(decision.chord.entryPoint.y).toBeCloseTo(0, 12)
      expect(decision.chord.exitPoint.x).toBeCloseTo(50, 12)
      expect(decision.chord.exitPoint.y).toBeCloseTo(0, 12)
    }
  })

  it('accepts a deliberate swipe whose endpoints both remain inside', () => {
    const decision = classifyGesture(
      [
        { x: -20, y: 0 },
        { x: 20, y: 0 },
      ],
      JUDGEMENT_CIRCLE,
    )

    expect(decision).toMatchObject({
      kind: 'slice',
      source: 'extended',
    })
    if (decision.kind === 'slice') {
      expect(decision.result.accuracyScore).toBeCloseTo(100, 12)
    }
  })

  it('scores an extended offset swipe with the existing area formula', () => {
    const decision = classifyGesture(
      [
        { x: -20, y: 25 },
        { x: 20, y: 25 },
      ],
      JUDGEMENT_CIRCLE,
    )
    const expectedRatio =
      (Math.acos(0.5) - 0.5 * Math.sqrt(1 - 0.5 ** 2)) / Math.PI

    expect(decision.kind).toBe('slice')
    if (decision.kind === 'slice') {
      expect(decision.source).toBe('extended')
      expect(decision.result.smallerAreaRatio).toBeCloseTo(expectedRatio, 12)
    }
  })

  it('accepts a swipe released just before the opposite circumference', () => {
    expect(
      classifyGesture(
        [
          { x: -100, y: 0 },
          { x: 42, y: 0 },
        ],
        JUDGEMENT_CIRCLE,
      ),
    ).toMatchObject({ kind: 'slice', source: 'extended' })
  })

  it('rejects a swipe that starts at one edge and only moves outward', () => {
    expect(
      classifyGesture(
        [
          { x: 50, y: 0 },
          { x: 86, y: 0 },
        ],
        JUDGEMENT_CIRCLE,
      ),
    ).toMatchObject({ kind: 'invalid', reason: 'open-no-crossing' })
  })

  it('rejects a same-side inside swipe that cannot reach both edges', () => {
    expect(
      classifyGesture(
        [
          { x: 10, y: 0 },
          { x: 42, y: 0 },
        ],
        JUDGEMENT_CIRCLE,
      ),
    ).toMatchObject({ kind: 'invalid', reason: 'open-no-crossing' })
  })

  it('rejects a collinear swipe that remains outside the hit slop', () => {
    expect(
      classifyGesture(
        [
          { x: -100, y: 0 },
          { x: -60, y: 0 },
        ],
        JUDGEMENT_CIRCLE,
      ),
    ).toMatchObject({ kind: 'invalid', reason: 'open-no-crossing' })
  })

  it('rejects a short scratch inside the food', () => {
    expect(
      classifyGesture(
        [
          { x: -5, y: 0 },
          { x: 5, y: 0 },
        ],
        JUDGEMENT_CIRCLE,
      ),
    ).toMatchObject({ kind: 'invalid', reason: 'too-short' })
  })

  it('rejects a nearly tangent swipe', () => {
    expect(
      classifyGesture(
        [
          { x: -40, y: 50 },
          { x: 40, y: 50 },
        ],
        JUDGEMENT_CIRCLE,
      ),
    ).toMatchObject({ kind: 'invalid', reason: 'open-no-crossing' })
  })

  it('rejects a winding stroke whose maximum span is not straight enough', () => {
    const windingPath: Point[] = [
      { x: -35, y: 0 },
      { x: -10, y: 45 },
      { x: 10, y: -45 },
      { x: 35, y: 0 },
    ]

    expect(
      classifyGesture(windingPath, JUDGEMENT_CIRCLE),
    ).toMatchObject({ kind: 'invalid', reason: 'open-no-crossing' })
  })

  it('treats a drawn loop as invalid instead of capture or slice', () => {
    const decision = classifyGesture(createLoop(72), JUDGEMENT_CIRCLE)

    expect(decision).toMatchObject({
      kind: 'invalid',
      reason: 'closed-invalid',
    })
  })

  it('preserves swipe direction in the inferred chord', () => {
    const decision = classifyGesture(
      [
        { x: 20, y: 0 },
        { x: -20, y: 0 },
      ],
      JUDGEMENT_CIRCLE,
    )

    expect(decision).toMatchObject({
      kind: 'slice',
      chord: {
        entryPoint: { x: 50, y: 0 },
        exitPoint: { x: -50, y: 0 },
      },
    })
  })

  it('uses the visible pointer direction while retaining moving-target contact', () => {
    const decision = classifyGesture(
      [
        { x: -35, y: 0 },
        { x: 35, y: -18 },
      ],
      JUDGEMENT_CIRCLE,
      {
        intentPath: [
          { x: 220, y: 410 },
          { x: 290, y: 410 },
        ],
      },
    )

    expect(decision.kind).toBe('slice')
    if (decision.kind === 'slice') {
      expect(decision.chord.exitPoint.y).toBeCloseTo(
        decision.chord.entryPoint.y,
      )
      expect(decision.chord.entryPoint.x).toBeLessThan(0)
      expect(decision.chord.exitPoint.x).toBeGreaterThan(0)
    }
  })

  it('reports a distant open miss', () => {
    expect(
      classifyGesture(
        [
          { x: -80, y: 70 },
          { x: 80, y: 70 },
        ],
        JUDGEMENT_CIRCLE,
      ),
    ).toMatchObject({
      kind: 'invalid',
      reason: 'open-no-crossing',
    })
  })

  it('rejects a stationary gesture', () => {
    expect(
      classifyGesture(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        JUDGEMENT_CIRCLE,
      ),
    ).toMatchObject({ kind: 'invalid', reason: 'too-short' })
  })
})

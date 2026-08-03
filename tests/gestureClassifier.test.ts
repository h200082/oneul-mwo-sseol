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
  it('classifies an open center crossing as a perfect slice', () => {
    const decision = classifyGesture(
      [
        { x: -80, y: 0 },
        { x: 80, y: 0 },
      ],
      JUDGEMENT_CIRCLE,
    )

    expect(decision.kind).toBe('slice')
    if (decision.kind === 'slice') {
      expect(decision.result.accuracyScore).toBeCloseTo(100, 12)
      expect(decision.chord).toEqual({
        entryPoint: { x: -50, y: 0 },
        exitPoint: { x: 50, y: 0 },
      })
    }
  })

  it('classifies a simple loop around the full judgement circle as capture', () => {
    const decision = classifyGesture(
      createLoop(72),
      JUDGEMENT_CIRCLE,
    )

    expect(decision.kind).toBe('capture')
    expect(decision.metrics.containsJudgementCircle).toBe(true)
  })

  it('reports a capture-limit attempt without consuming it as a slice', () => {
    const decision = classifyGesture(
      createLoop(72),
      JUDGEMENT_CIRCLE,
      { captureAvailable: false },
    )

    expect(decision).toMatchObject({
      kind: 'invalid',
      reason: 'capture-limit',
    })
  })

  it('rejects a closed path that contains only the center', () => {
    const narrowLoop: Point[] = [
      { x: -70, y: -12 },
      { x: 70, y: -12 },
      { x: 70, y: 12 },
      { x: -70, y: 12 },
      { x: -70, y: -12 },
    ]

    const decision = classifyGesture(
      narrowLoop,
      JUDGEMENT_CIRCLE,
      {
        minimumCaptureArea: 0,
        minimumCapturePathLength: 0,
      },
    )

    expect(decision).toMatchObject({
      kind: 'invalid',
      reason: 'closed-invalid',
    })
    expect(decision.metrics.containsJudgementCircle).toBe(false)
  })

  it('never reclassifies an invalid closed loop as a slice', () => {
    const crossingLoop: Point[] = [
      { x: -80, y: 0 },
      { x: 0, y: 18 },
      { x: 80, y: 0 },
      { x: 0, y: -18 },
      { x: -80, y: 0 },
    ]

    expect(
      classifyGesture(crossingLoop, JUDGEMENT_CIRCLE),
    ).toMatchObject({
      kind: 'invalid',
      reason: 'closed-invalid',
    })
  })

  it('rejects a self-intersecting capture path', () => {
    const figureEight: Point[] = [
      { x: -80, y: -60 },
      { x: 80, y: 60 },
      { x: -80, y: 60 },
      { x: 80, y: -60 },
      { x: -80, y: -60 },
    ]

    const decision = classifyGesture(figureEight, JUDGEMENT_CIRCLE)

    expect(decision).toMatchObject({
      kind: 'invalid',
      reason: 'closed-invalid',
    })
    expect(decision.metrics.isSimpleCapturePath).toBe(false)
  })

  it('reports an open miss separately from an invalid loop', () => {
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

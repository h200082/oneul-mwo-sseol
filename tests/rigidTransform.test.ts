import { describe, expect, it } from 'vitest'

import {
  createAlphaSilhouetteMask,
  type PlacedSilhouette,
} from '../src/domain/alphaSilhouette'
import type { Point } from '../src/domain/geometry'
import {
  transformLocalPathToWorld,
  transformLocalPointToWorld,
  transformWorldPathToLocal,
  transformWorldPointToLocal,
  type RigidTransform2D,
} from '../src/domain/rigidTransform'
import { classifySilhouetteGesture } from '../src/domain/silhouetteGestureClassifier'

const FULL_RECTANGLE: PlacedSilhouette = {
  mask: createAlphaSilhouetteMask(4, 2, new Uint8Array(8).fill(255)),
  center: { x: 6, y: -7 },
  displayWidth: 80,
  displayHeight: 40,
}

function expectPointClose(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 12)
  expect(actual.y).toBeCloseTo(expected.y, 12)
}

function classifyLocalPath(path: readonly Point[]) {
  return classifySilhouetteGesture(path, FULL_RECTANGLE, {
    sliceEndpointExtension: 0,
  })
}

describe('rigid transform point mapping', () => {
  it('round-trips a 90-degree rotation around a non-origin pivot plus translation', () => {
    const transform: RigidTransform2D = {
      pivot: { x: 1, y: 1 },
      translation: { x: 10, y: -5 },
      angleRadians: Math.PI / 2,
    }
    const local = { x: 3, y: 1 }
    const world = transformLocalPointToWorld(local, transform)

    expectPointClose(world, { x: 11, y: -2 })
    expectPointClose(transformWorldPointToLocal(world, transform), local)
  })

  it('round-trips a 45-degree rotation with image and container offsets', () => {
    const transform: RigidTransform2D = {
      pivot: { x: 2, y: -3 },
      translation: { x: 10, y: 20 },
      angleRadians: Math.PI / 4,
    }
    const local = { x: 2 + Math.SQRT2, y: -3 }
    const world = transformLocalPointToWorld(local, transform)

    expectPointClose(world, { x: 13, y: 18 })
    expectPointClose(transformWorldPointToLocal(world, transform), local)
  })

  it('rejects non-finite points and transform values', () => {
    const validTransform: RigidTransform2D = {
      pivot: { x: 0, y: 0 },
      translation: { x: 0, y: 0 },
      angleRadians: 0,
    }

    expect(() =>
      transformWorldPointToLocal(
        { x: Number.NaN, y: 0 },
        validTransform,
      ),
    ).toThrow(TypeError)
    expect(() =>
      transformWorldPointToLocal(
        { x: 0, y: 0 },
        { ...validTransform, angleRadians: Number.POSITIVE_INFINITY },
      ),
    ).toThrow(TypeError)
  })
})

describe('rotated silhouette gesture normalization', () => {
  const localPath = [
    { x: -14, y: -50 },
    { x: -14, y: 50 },
  ] as const

  it.each([
    ['90 degrees', Math.PI / 2],
    ['45 degrees', Math.PI / 4],
  ])(
    'preserves alpha-silhouette score after a %s rotation and world offset',
    (_label, angleRadians) => {
      const transform: RigidTransform2D = {
        pivot: { x: 0, y: 0 },
        translation: { x: 173, y: 281 },
        angleRadians,
      }
      const worldPath = transformLocalPathToWorld(localPath, transform)
      const normalized = transformWorldPathToLocal(worldPath, transform)
      const baseline = classifyLocalPath(localPath)
      const rotated = classifyLocalPath(normalized)

      expect(baseline.kind).toBe('slice')
      expect(rotated.kind).toBe('slice')
      if (baseline.kind === 'slice' && rotated.kind === 'slice') {
        expect(rotated.result.crossesSilhouette).toBe(true)
        expect(rotated.result.accuracyScore).toBeCloseTo(
          baseline.result.accuracyScore,
          12,
        )
        expect(rotated.result.smallerAreaRatio).toBeCloseTo(
          baseline.result.smallerAreaRatio,
          12,
        )
        expect(rotated.result.contactLength).toBeCloseTo(
          baseline.result.contactLength,
          12,
        )
      }
    },
  )

  it('preserves slice validity and score when swipe direction is reversed', () => {
    const transform: RigidTransform2D = {
      pivot: { x: 0, y: 0 },
      translation: { x: 120, y: 340 },
      angleRadians: Math.PI / 4,
    }
    const forwardWorldPath = transformLocalPathToWorld(localPath, transform)
    const reverseWorldPath = [...forwardWorldPath].reverse()
    const forward = classifyLocalPath(
      transformWorldPathToLocal(forwardWorldPath, transform),
    )
    const reverse = classifyLocalPath(
      transformWorldPathToLocal(reverseWorldPath, transform),
    )

    expect(forward.kind).toBe('slice')
    expect(reverse.kind).toBe('slice')
    if (forward.kind === 'slice' && reverse.kind === 'slice') {
      expect(reverse.result.crossesSilhouette).toBe(true)
      expect(reverse.result.accuracyScore).toBeCloseTo(
        forward.result.accuracyScore,
        12,
      )
      expect(reverse.result.smallerAreaRatio).toBeCloseTo(
        forward.result.smallerAreaRatio,
        12,
      )
      expectPointClose(reverse.chord.entryPoint, forward.chord.exitPoint)
      expectPointClose(reverse.chord.exitPoint, forward.chord.entryPoint)
    }
  })

  it('does not mutate or reorder source paths', () => {
    const transform: RigidTransform2D = {
      pivot: { x: 3, y: -2 },
      translation: { x: 80, y: 90 },
      angleRadians: Math.PI / 3,
    }
    const source = localPath.map((point) => ({ ...point }))
    const snapshot = source.map((point) => ({ ...point }))
    const world = transformLocalPathToWorld(source, transform)
    const local = transformWorldPathToLocal(world, transform)

    expect(source).toEqual(snapshot)
    local.forEach((point, index) => expectPointClose(point, source[index]!))
  })
})

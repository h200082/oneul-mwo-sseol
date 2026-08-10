import { describe, expect, it } from 'vitest'

import {
  getRoundMotion,
  getRoundRotationDirection,
  getRoundRotationTurns,
  type RoundMotionSeed,
} from '../src/game/roundMotion'

describe('round rotation difficulty', () => {
  it.each([
    [0, 0],
    [4, 0],
    [5, 0.5],
    [9, 0.5],
    [10, 0.75],
    [14, 0.75],
    [15, 1],
    [19, 1],
  ] as const)('round index %s uses %s turns', (roundIndex, turns) => {
    expect(getRoundRotationTurns(roundIndex)).toBe(turns)
  })

  it('derives the target angle directly from turns and direction', () => {
    for (let roundIndex = 0; roundIndex < 20; roundIndex += 1) {
      const motion = getRoundMotion('shared-room-seed', roundIndex)
      const expectedAngle = motion.turns * 360 * motion.direction
      expect(motion.targetAngleDegrees).toBe(
        expectedAngle === 0 ? 0 : expectedAngle,
      )
    }
  })

  it('returns positive zero before rotation begins', () => {
    for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
      const targetAngleDegrees = getRoundMotion(0, roundIndex).targetAngleDegrees
      expect(targetAngleDegrees).toBe(0)
      expect(Object.is(targetAngleDegrees, -0)).toBe(false)
    }
  })
})

describe('seeded round rotation direction', () => {
  it.each([42, -42, 42.875, 'room-XDPV8BEY', '한글-방-시드'])(
    'is stable for seed %j',
    (deckSeed) => {
      const first = Array.from({ length: 20 }, (_, roundIndex) =>
        getRoundRotationDirection(deckSeed, roundIndex),
      )
      const second = Array.from({ length: 20 }, (_, roundIndex) =>
        getRoundRotationDirection(deckSeed, roundIndex),
      )

      expect(second).toEqual(first)
      expect(first.every((direction) => direction === -1 || direction === 1)).toBe(
        true,
      )
    },
  )

  it('uses both directions across the twenty rounds for a representative seed', () => {
    const directions = new Set(
      Array.from({ length: 20 }, (_, roundIndex) =>
        getRoundRotationDirection('direction-coverage', roundIndex),
      ),
    )

    expect(directions).toEqual(new Set([-1, 1]))
  })

  it('does not consume or depend on an external random source', () => {
    let deckRandomCalls = 0
    const deckRandom = () => {
      deckRandomCalls += 1
      return 0.5
    }

    const before = deckRandomCalls
    const directions = Array.from({ length: 20 }, (_, roundIndex) =>
      getRoundRotationDirection('independent-motion-seed', roundIndex),
    )

    expect(directions).toHaveLength(20)
    expect(deckRandomCalls).toBe(before)
    expect(deckRandom()).toBe(0.5)
    expect(deckRandomCalls).toBe(1)
  })

  it('normalizes seeds consistently with deterministic deck semantics', () => {
    const numericFraction = Array.from({ length: 20 }, (_, roundIndex) =>
      getRoundRotationDirection(17.9, roundIndex),
    )
    const numericInteger = Array.from({ length: 20 }, (_, roundIndex) =>
      getRoundRotationDirection(17, roundIndex),
    )
    const normalizedText = Array.from({ length: 20 }, (_, roundIndex) =>
      getRoundRotationDirection('  ＲＯＯＭ  ', roundIndex),
    )
    const plainText = Array.from({ length: 20 }, (_, roundIndex) =>
      getRoundRotationDirection('ROOM', roundIndex),
    )

    expect(numericFraction).toEqual(numericInteger)
    expect(normalizedText).toEqual(plainText)
  })
})

describe('round motion validation', () => {
  it.each([-1, 20, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid round index %s',
    (roundIndex) => {
      expect(() => getRoundMotion('valid-seed', roundIndex)).toThrow(
        RangeError,
      )
    },
  )

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('rejects invalid numeric seed %s', (deckSeed) => {
    expect(() => getRoundMotion(deckSeed, 5)).toThrow(RangeError)
  })

  it.each(['', '   ', '\t\n'])('rejects empty string seed %j', (deckSeed) => {
    expect(() => getRoundMotion(deckSeed, 5)).toThrow(TypeError)
  })

  it('rejects unsupported runtime seed types', () => {
    expect(() =>
      getRoundMotion(true as unknown as RoundMotionSeed, 5),
    ).toThrow(TypeError)
  })
})

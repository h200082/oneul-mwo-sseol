import { describe, expect, it } from 'vitest'

import {
  getRoundHorizontalMotion,
  type RoundMotionSeed,
} from '../src/game/roundMotion'

describe('final-two horizontal motion difficulty', () => {
  it.each(Array.from({ length: 18 }, (_, roundIndex) => roundIndex))(
    'keeps round index %s horizontally still',
    (roundIndex) => {
      const motion = getRoundHorizontalMotion('shared-room-seed', roundIndex)

      expect(motion.amplitude).toBe(0)
      expect(motion.cycles).toBe(0)
      expect([-1, 1]).toContain(motion.direction)
    },
  )

  it('uses one 32px cycle on round index 18', () => {
    expect(getRoundHorizontalMotion('shared-room-seed', 18)).toMatchObject({
      amplitude: 32,
      cycles: 1,
    })
  })

  it('uses one-and-a-half 46px cycles on round index 19', () => {
    expect(getRoundHorizontalMotion('shared-room-seed', 19)).toMatchObject({
      amplitude: 46,
      cycles: 1.5,
    })
  })
})

describe('seeded final-two horizontal direction', () => {
  it.each([42, -42, 42.875, 'room-XDPV8BEY', '공유-시드'])('is stable for seed %j', (deckSeed) => {
    const first = [18, 19].map((roundIndex) =>
      getRoundHorizontalMotion(deckSeed, roundIndex),
    )
    const second = [18, 19].map((roundIndex) =>
      getRoundHorizontalMotion(deckSeed, roundIndex),
    )

    expect(second).toEqual(first)
    expect(first.every(({ direction }) => direction === -1 || direction === 1)).toBe(
      true,
    )
  })

  it('uses only the shared seed and round index, without an external random source', () => {
    let randomCalls = 0
    const random = () => {
      randomCalls += 1
      return 0.5
    }

    const before = randomCalls
    const motion = getRoundHorizontalMotion('independent-horizontal-seed', 19)

    expect([-1, 1]).toContain(motion.direction)
    expect(randomCalls).toBe(before)
    expect(random()).toBe(0.5)
    expect(randomCalls).toBe(1)
  })
})

describe('horizontal round motion validation', () => {
  it.each([-1, 20, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid round index %s',
    (roundIndex) => {
      expect(() =>
        getRoundHorizontalMotion('valid-seed', roundIndex),
      ).toThrow(RangeError)
    },
  )

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid numeric seed %s',
    (deckSeed) => {
      expect(() => getRoundHorizontalMotion(deckSeed, 18)).toThrow(RangeError)
    },
  )

  it.each(['', '   ', '\t\n'])('rejects empty string seed %j', (deckSeed) => {
    expect(() => getRoundHorizontalMotion(deckSeed, 18)).toThrow(TypeError)
  })

  it('rejects unsupported runtime seed types', () => {
    expect(() =>
      getRoundHorizontalMotion(true as unknown as RoundMotionSeed, 18),
    ).toThrow(TypeError)
  })
})

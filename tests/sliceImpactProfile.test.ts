import { describe, expect, it } from 'vitest'

import type { SliceFeedbackLevel } from '../src/game/gameFeedback'
import {
  getSliceImpactProfile,
  MAX_SLICE_EFFECT_DURATION_MS,
  MAX_SLICE_PARTICLE_COUNT,
  MAX_SLICE_SHAKE_DURATION_MS,
  MAX_SLICE_SHAKE_INTENSITY,
} from '../src/game/sliceImpactProfile'

const LEVELS: readonly SliceFeedbackLevel[] = [
  'needs-practice',
  'good',
  'great',
  'perfect',
]

describe('getSliceImpactProfile', () => {
  it.each([
    ['needs-practice', 0, 18, 8, 55, 0.0015, 3, 0xff795f, 4, 380],
    ['good', 16, 25, 12, 65, 0.0022, 4, 0xfff8e7, 5, 400],
    ['great', 24, 34, 17, 75, 0.0032, 6, 0x55e6d1, 6, 418],
    ['perfect', 32, 44, 22, 90, 0.004, 8, 0xffd76a, 8, 428],
  ] as const)(
    '%s 등급에 맞는 베기 연출 수치를 반환한다',
    (
      level,
      hitStopMs,
      separationDistance,
      rotationDegrees,
      shakeDurationMs,
      shakeIntensity,
      particleCount,
      flashColor,
      flashWidth,
      splitDurationMs,
    ) => {
      expect(getSliceImpactProfile(level)).toEqual({
        hitStopMs,
        separationDistance,
        rotationDegrees,
        shakeDurationMs,
        shakeIntensity,
        particleCount,
        flashColor,
        flashWidth,
        splitDurationMs,
      })
    },
  )

  it('모든 등급이 모바일 효과 예산을 지킨다', () => {
    for (const level of LEVELS) {
      const profile = getSliceImpactProfile(level)

      expect(profile.hitStopMs + profile.splitDurationMs).toBeLessThanOrEqual(
        MAX_SLICE_EFFECT_DURATION_MS,
      )
      expect(profile.particleCount).toBeLessThanOrEqual(
        MAX_SLICE_PARTICLE_COUNT,
      )
      expect(profile.shakeDurationMs).toBeLessThanOrEqual(
        MAX_SLICE_SHAKE_DURATION_MS,
      )
      expect(profile.shakeIntensity).toBeLessThanOrEqual(
        MAX_SLICE_SHAKE_INTENSITY,
      )
    }
  })

  it('점수가 좋아질수록 주요 타격감 수치가 약해지지 않는다', () => {
    const profiles = LEVELS.map(getSliceImpactProfile)

    for (let index = 1; index < profiles.length; index += 1) {
      const previous = profiles[index - 1]!
      const current = profiles[index]!

      expect(current.hitStopMs).toBeGreaterThanOrEqual(previous.hitStopMs)
      expect(current.separationDistance).toBeGreaterThan(previous.separationDistance)
      expect(current.rotationDegrees).toBeGreaterThan(previous.rotationDegrees)
      expect(current.shakeDurationMs).toBeGreaterThan(previous.shakeDurationMs)
      expect(current.shakeIntensity).toBeGreaterThan(previous.shakeIntensity)
      expect(current.particleCount).toBeGreaterThan(previous.particleCount)
      expect(current.flashWidth).toBeGreaterThan(previous.flashWidth)
    }
  })

  it('프로필을 공유 가능한 불변 객체로 제공한다', () => {
    for (const level of LEVELS) {
      const first = getSliceImpactProfile(level)

      expect(Object.isFrozen(first)).toBe(true)
      expect(getSliceImpactProfile(level)).toBe(first)
    }
  })
})

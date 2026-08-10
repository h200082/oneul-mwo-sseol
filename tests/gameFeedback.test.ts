import { describe, expect, it } from 'vitest'

import {
  getDisplayedSliceAccuracy,
  getSliceFeedback,
} from '../src/game/gameFeedback'

describe('getSliceFeedback', () => {
  it.each([
    [0, 'needs-practice', '아쉬워요', '#ff795f', 0xff795f],
    [59.9, 'needs-practice', '아쉬워요', '#ff795f', 0xff795f],
    [60, 'good', '좋아요!', '#fff8e7', 0xfff8e7],
    [79.9, 'good', '좋아요!', '#fff8e7', 0xfff8e7],
    [80, 'great', '훌륭해요!', '#55e6d1', 0x55e6d1],
    [94.9, 'great', '훌륭해요!', '#55e6d1', 0x55e6d1],
    [95, 'perfect', '칼각!', '#ffd76a', 0xffd76a],
    [100, 'perfect', '칼각!', '#ffd76a', 0xffd76a],
  ] as const)(
    '%s점에 알맞은 판정과 UI 색상을 반환한다',
    (accuracy, level, label, cssColor, phaserColor) => {
      expect(getSliceFeedback(accuracy)).toEqual({
        level,
        label,
        cssColor,
        phaserColor,
      })
    },
  )

  it.each([
    [59.94, 59.9, 'needs-practice'],
    [59.96, 60, 'good'],
    [79.96, 80, 'great'],
    [94.96, 95, 'perfect'],
  ] as const)(
    '%s점은 화면의 %s점과 같은 등급 %s를 사용한다',
    (accuracy, displayedAccuracy, level) => {
      expect(getDisplayedSliceAccuracy(accuracy)).toBe(displayedAccuracy)
      expect(getSliceFeedback(accuracy).level).toBe(level)
    },
  )

  it.each([-0.1, 100.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    '유효하지 않은 정확도 %s를 거부한다',
    (accuracy) => {
      expect(() => getSliceFeedback(accuracy)).toThrow(RangeError)
    },
  )
})

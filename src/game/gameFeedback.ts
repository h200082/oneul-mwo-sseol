export type SliceFeedbackLevel =
  | 'needs-practice'
  | 'good'
  | 'great'
  | 'perfect'

export interface SliceFeedback {
  readonly level: SliceFeedbackLevel
  readonly label: '아쉬워요' | '좋아요!' | '훌륭해요!' | '칼각!'
  /** CSS color for Phaser text styles. */
  readonly cssColor: `#${string}`
  /** Numeric color for Phaser graphics and particles. */
  readonly phaserColor: number
}

const SLICE_FEEDBACK = Object.freeze({
  needsPractice: Object.freeze({
    level: 'needs-practice',
    label: '아쉬워요',
    cssColor: '#ff795f',
    phaserColor: 0xff795f,
  }),
  good: Object.freeze({
    level: 'good',
    label: '좋아요!',
    cssColor: '#fff8e7',
    phaserColor: 0xfff8e7,
  }),
  great: Object.freeze({
    level: 'great',
    label: '훌륭해요!',
    cssColor: '#55e6d1',
    phaserColor: 0x55e6d1,
  }),
  perfect: Object.freeze({
    level: 'perfect',
    label: '칼각!',
    cssColor: '#ffd76a',
    phaserColor: 0xffd76a,
  }),
} satisfies Record<string, Readonly<SliceFeedback>>)

function validateSliceAccuracy(accuracy: number): void {
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
    throw new RangeError(
      `Slice accuracy must be a finite number from 0 through 100; received ${String(accuracy)}.`,
    )
  }
}

/** Returns the exact one-decimal value shown to the player. */
export function getDisplayedSliceAccuracy(accuracy: number): number {
  validateSliceAccuracy(accuracy)
  return Math.round(accuracy * 10) / 10
}

/**
 * Maps a slice accuracy to stable presentation data.
 *
 * Feedback thresholds use the same one-decimal value shown on screen so a
 * displayed 95.0% can never be paired with the lower-tier message.
 */
export function getSliceFeedback(accuracy: number): Readonly<SliceFeedback> {
  const displayedAccuracy = getDisplayedSliceAccuracy(accuracy)

  if (displayedAccuracy >= 95) {
    return SLICE_FEEDBACK.perfect
  }
  if (displayedAccuracy >= 80) {
    return SLICE_FEEDBACK.great
  }
  if (displayedAccuracy >= 60) {
    return SLICE_FEEDBACK.good
  }
  return SLICE_FEEDBACK.needsPractice
}

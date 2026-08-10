import type { SliceFeedbackLevel } from './gameFeedback'

/** Upper bounds that keep one slice affordable on mobile devices. */
export const MAX_SLICE_EFFECT_DURATION_MS = 460
export const MAX_SLICE_PARTICLE_COUNT = 10
export const MAX_SLICE_SHAKE_DURATION_MS = 90
export const MAX_SLICE_SHAKE_INTENSITY = 0.004

/**
 * Score-tiered values used to choreograph one slice resolution.
 *
 * `splitDurationMs` starts after `hitStopMs`, so their sum is the complete
 * lifetime budget for the two sliced pieces. Distances and widths are in
 * Phaser canvas pixels; rotation is expressed in degrees.
 */
export interface SliceImpactProfile {
  readonly hitStopMs: number
  readonly separationDistance: number
  readonly rotationDegrees: number
  readonly shakeDurationMs: number
  readonly shakeIntensity: number
  readonly particleCount: number
  readonly flashColor: number
  readonly flashWidth: number
  readonly splitDurationMs: number
}

const SLICE_IMPACT_PROFILES = Object.freeze({
  'needs-practice': Object.freeze({
    hitStopMs: 0,
    separationDistance: 18,
    rotationDegrees: 8,
    shakeDurationMs: 55,
    shakeIntensity: 0.0015,
    particleCount: 3,
    flashColor: 0xff795f,
    flashWidth: 4,
    splitDurationMs: 380,
  }),
  good: Object.freeze({
    hitStopMs: 16,
    separationDistance: 25,
    rotationDegrees: 12,
    shakeDurationMs: 65,
    shakeIntensity: 0.0022,
    particleCount: 4,
    flashColor: 0xfff8e7,
    flashWidth: 5,
    splitDurationMs: 400,
  }),
  great: Object.freeze({
    hitStopMs: 24,
    separationDistance: 34,
    rotationDegrees: 17,
    shakeDurationMs: 75,
    shakeIntensity: 0.0032,
    particleCount: 6,
    flashColor: 0x55e6d1,
    flashWidth: 6,
    splitDurationMs: 418,
  }),
  perfect: Object.freeze({
    hitStopMs: 32,
    separationDistance: 44,
    rotationDegrees: 22,
    shakeDurationMs: 90,
    shakeIntensity: 0.004,
    particleCount: 8,
    flashColor: 0xffd76a,
    flashWidth: 8,
    splitDurationMs: 428,
  }),
} satisfies Readonly<
  Record<SliceFeedbackLevel, Readonly<SliceImpactProfile>>
>)

/** Returns the immutable visual-impact choreography for a feedback tier. */
export function getSliceImpactProfile(
  level: SliceFeedbackLevel,
): Readonly<SliceImpactProfile> {
  return SLICE_IMPACT_PROFILES[level]
}

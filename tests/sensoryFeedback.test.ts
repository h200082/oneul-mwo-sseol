import { describe, expect, it, vi } from 'vitest'

import {
  SensoryFeedbackController,
  getSensoryCueSpec,
  type SensoryAudioState,
  type SensoryCue,
  type SensoryFeedbackOutput,
  type SensoryTone,
} from '../src/feedback/SensoryFeedback'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length(): number {
    return this.values.size
  }
  clear(): void {
    this.values.clear()
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.values.delete(key)
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

class FakeOutput implements SensoryFeedbackOutput {
  audioState: SensoryAudioState = 'running'
  hapticsSupported = true
  unlockResult = true
  playResult = true
  vibrateResult = true
  readonly primeForGesture = vi.fn()
  readonly releaseGesture = vi.fn()
  readonly cancelPrimedGesture = vi.fn()
  readonly unlock = vi.fn(async () => this.unlockResult)
  readonly play = vi.fn(
    (_tones: readonly Readonly<SensoryTone>[], _soundScale: number) =>
      this.playResult,
  )
  readonly vibrate = vi.fn((_pattern: readonly number[]) =>
    this.vibrateResult,
  )
  readonly stopSound = vi.fn()
  readonly cancelVibration = vi.fn()
  readonly destroy = vi.fn()
}

const ALL_CUES: readonly SensoryCue[] = [
  'ui-confirm',
  'countdown',
  'start',
  'slice-low',
  'slice-good',
  'slice-great',
  'slice-perfect',
  'capture',
  'miss-warning',
  'miss',
  'final-five',
  'results',
]

describe('sensory cue definitions', () => {
  it.each(ALL_CUES)('%s has safe short procedural audio values', (cue) => {
    const spec = getSensoryCueSpec(cue)
    expect(spec.tones.length).toBeGreaterThan(0)
    for (const tone of spec.tones) {
      expect(Number.isFinite(tone.frequency)).toBe(true)
      expect(Number.isFinite(tone.endFrequency)).toBe(true)
      expect(tone.frequency).toBeGreaterThan(0)
      expect(tone.endFrequency).toBeGreaterThan(0)
      expect(tone.startMs).toBeGreaterThanOrEqual(0)
      expect(tone.durationMs).toBeGreaterThan(0)
      expect(tone.startMs + tone.durationMs).toBeLessThanOrEqual(400)
      expect(tone.gain).toBeGreaterThan(0)
      expect(tone.gain).toBeLessThanOrEqual(0.06)
    }
  })

  it('keeps warning and countdown vibration-free', () => {
    expect(getSensoryCueSpec('miss-warning').vibration).toEqual([])
    expect(getSensoryCueSpec('countdown').vibration).toEqual([])
  })

  it('keeps action haptics perceptible, bounded, and easy to retune', () => {
    const actionCues: readonly SensoryCue[] = [
      'slice-perfect',
      'capture',
      'miss',
      'final-five',
      'results',
    ]

    for (const cue of actionCues) {
      const pattern = getSensoryCueSpec(cue).vibration
      expect(pattern.length).toBeGreaterThan(0)
      expect(pattern.length).toBeLessThanOrEqual(5)
      expect(pattern.every((duration) => duration >= 0 && duration <= 80))
        .toBe(true)
      expect(pattern.reduce((total, duration) => total + duration, 0))
        .toBeLessThanOrEqual(180)
    }

    expect(getSensoryCueSpec('slice-perfect').vibration.length)
      .toBeGreaterThan(getSensoryCueSpec('slice-good').vibration.length)
    expect(getSensoryCueSpec('capture').vibration.length).toBeGreaterThan(1)
    expect(getSensoryCueSpec('miss').vibration).toHaveLength(1)
  })
})

describe('SensoryFeedbackController', () => {
  it('emits sound and supported haptics once per semantic cue', () => {
    const output = new FakeOutput()
    const feedback = new SensoryFeedbackController(
      output,
      new MemoryStorage(),
    )

    feedback.trigger('capture', 0.72)

    expect(output.play).toHaveBeenCalledOnce()
    expect(output.play).toHaveBeenCalledWith(
      getSensoryCueSpec('capture').tones,
      0.72,
    )
    expect(output.vibrate).toHaveBeenCalledOnce()
    expect(output.vibrate).toHaveBeenCalledWith([22, 42, 38])
    expect(feedback.getDebugState()).toMatchObject({
      lastCue: 'capture',
      triggerCount: 1,
      soundOutputCount: 1,
      hapticOutputCount: 1,
    })
  })

  it('persists and independently suppresses sound and haptics', () => {
    const storage = new MemoryStorage()
    const output = new FakeOutput()
    const feedback = new SensoryFeedbackController(output, storage)

    feedback.setSoundEnabled(false)
    feedback.trigger('slice-perfect')
    expect(output.play).not.toHaveBeenCalled()
    expect(output.vibrate).toHaveBeenCalledOnce()
    expect(output.stopSound).toHaveBeenCalledOnce()

    feedback.setHapticsEnabled(false)
    feedback.setSoundEnabled(true)
    feedback.trigger('capture')
    expect(output.play).toHaveBeenCalledOnce()
    expect(output.vibrate).toHaveBeenCalledOnce()
    expect(output.cancelVibration).toHaveBeenCalledOnce()

    const restored = new SensoryFeedbackController(
      new FakeOutput(),
      storage,
    )
    expect(restored.soundEnabled).toBe(true)
    expect(restored.hapticsEnabled).toBe(false)
  })

  it('does not call vibration when the browser API is unsupported', () => {
    const output = new FakeOutput()
    output.hapticsSupported = false
    const feedback = new SensoryFeedbackController(output, null)

    feedback.trigger('miss')

    expect(output.play).toHaveBeenCalledOnce()
    expect(output.vibrate).not.toHaveBeenCalled()
    expect(feedback.getDebugState().hapticsSupported).toBe(false)
  })

  it('drops locked sound without delaying or throwing', () => {
    const output = new FakeOutput()
    output.audioState = 'locked'
    output.playResult = false
    const feedback = new SensoryFeedbackController(output, null)

    expect(() => feedback.trigger('slice-good')).not.toThrow()
    expect(feedback.getDebugState()).toMatchObject({
      lastCue: 'slice-good',
      soundOutputCount: 0,
      hapticOutputCount: 1,
    })
  })

  it('absorbs unlock failures and clamps invalid sound scale', async () => {
    const output = new FakeOutput()
    output.unlock.mockRejectedValueOnce(new Error('blocked'))
    const feedback = new SensoryFeedbackController(output, null)

    await expect(feedback.unlock()).resolves.toBe(false)
    feedback.trigger('slice-low', Number.NaN)
    feedback.trigger('slice-good', 4)
    feedback.trigger('slice-great', -2)

    expect(output.play.mock.calls.map((call) => call[1])).toEqual([1, 1])
  })

  it('stops outputs and ignores triggers after idempotent destroy', () => {
    const output = new FakeOutput()
    const feedback = new SensoryFeedbackController(output, null)

    feedback.stopAll()
    expect(output.cancelPrimedGesture).toHaveBeenCalledOnce()
    feedback.destroy()
    feedback.destroy()
    feedback.trigger('results')

    expect(output.stopSound).toHaveBeenCalledOnce()
    expect(output.cancelVibration).toHaveBeenCalledOnce()
    expect(output.destroy).toHaveBeenCalledOnce()
    expect(output.play).not.toHaveBeenCalled()
    expect(output.vibrate).not.toHaveBeenCalled()
  })
})

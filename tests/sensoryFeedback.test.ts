import { describe, expect, it, vi } from 'vitest'

import {
  SensoryFeedbackController,
  getSensoryCueSpec,
  type SensoryAudioState,
  type SensoryCue,
  type SensoryFeedbackOutput,
  type SensoryTone,
} from '../src/feedback/SensoryFeedback'
import type { MusicIntensity } from '../src/feedback/arcadeBgm'

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
  musicPlaying = false
  musicStartCount = 0
  musicIntensity: MusicIntensity | null = null
  narrationPreparedCount = 0
  narrationPlaying = false
  musicDucked = false
  unlockResult = true
  playResult = true
  startMusicResult = true
  playNarrationResult = true
  vibrateResult = true
  readonly primeForGesture = vi.fn()
  readonly releaseGesture = vi.fn()
  readonly cancelPrimedGesture = vi.fn()
  readonly unlock = vi.fn(async () => {
    if (this.unlockResult) this.audioState = 'running'
    return this.unlockResult
  })
  readonly play = vi.fn(
    (_tones: readonly Readonly<SensoryTone>[], _soundScale: number) =>
      this.playResult,
  )
  readonly startMusic = vi.fn((intensity: MusicIntensity) => {
    if (!this.startMusicResult || this.audioState !== 'running') return false
    if (!this.musicPlaying) this.musicStartCount += 1
    this.musicPlaying = true
    this.musicIntensity = intensity
    return true
  })
  readonly stopMusic = vi.fn(() => {
    this.musicPlaying = false
    this.musicIntensity = null
  })
  readonly prepareNarrations = vi.fn(async (assets: readonly unknown[]) => {
    this.narrationPreparedCount += assets.length
  })
  readonly playNarration = vi.fn((_id: string) => {
    this.narrationPlaying = this.playNarrationResult
    this.musicDucked = false
    return this.playNarrationResult
  })
  readonly stopNarration = vi.fn(() => {
    this.narrationPlaying = false
    this.musicDucked = false
  })
  readonly vibrate = vi.fn((_pattern: readonly number[]) => this.vibrateResult)
  readonly stopSound = vi.fn(() => {
    this.stopNarration()
    this.musicPlaying = false
    this.musicIntensity = null
  })
  readonly cancelVibration = vi.fn()
  readonly destroy = vi.fn(() => {
    this.stopNarration()
    this.musicPlaying = false
    this.musicIntensity = null
    this.audioState = 'closed'
  })
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

  it('layers slice wind, board impact, and score sparkle with safe headroom', () => {
    const sliceCues = [
      'slice-low',
      'slice-good',
      'slice-great',
      'slice-perfect',
    ] as const
    const energy = sliceCues.map((cue) => {
      const tones = getSensoryCueSpec(cue).tones
      expect(tones.length).toBeGreaterThanOrEqual(3)
      expect(tones[0]?.startMs).toBe(0)
      expect(tones[1]?.startMs).toBeLessThanOrEqual(30)
      expect(tones[2]?.startMs).toBeGreaterThanOrEqual(60)

      const totalGain = tones.reduce((total, tone) => total + tone.gain, 0)
      expect(totalGain).toBeLessThanOrEqual(0.12)

      let peakConcurrentGain = 0
      for (let timeMs = 0; timeMs <= 400; timeMs += 1) {
        const concurrentGain = tones
          .filter(
            (tone) =>
              tone.startMs <= timeMs &&
              timeMs < tone.startMs + tone.durationMs,
          )
          .reduce((total, tone) => total + tone.gain, 0)
        peakConcurrentGain = Math.max(peakConcurrentGain, concurrentGain)
      }
      expect(peakConcurrentGain).toBeLessThanOrEqual(0.095)
      return totalGain
    })

    expect(energy[0]).toBeLessThan(energy[1] ?? 0)
    expect(energy[1]).toBeLessThan(energy[2] ?? 0)
    expect(energy[2]).toBeLessThan(energy[3] ?? 0)
  })

  it('keeps action haptics perceptible, bounded, and easy to retune', () => {
    const actionCues: readonly SensoryCue[] = [
      'start',
      'slice-low',
      'slice-good',
      'slice-great',
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

    expect(getSensoryCueSpec('slice-low').vibration).toEqual([28])
    expect(getSensoryCueSpec('slice-good').vibration).toEqual([38])
    expect(getSensoryCueSpec('slice-great').vibration).toEqual([50])
    expect(getSensoryCueSpec('slice-perfect').vibration).toEqual([40, 22, 58])
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
    expect(output.vibrate).toHaveBeenCalledWith([42, 30, 62])
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

  it('remembers locked music and starts it once after audio unlock', async () => {
    const output = new FakeOutput()
    output.audioState = 'locked'
    output.startMusicResult = false
    const feedback = new SensoryFeedbackController(output, null)

    feedback.startMusic('opening')

    expect(feedback.getDebugState()).toMatchObject({
      musicRequested: true,
      musicPlaying: false,
      musicIntensity: 'opening',
      musicStartCount: 0,
    })
    expect(output.startMusic).toHaveBeenCalledOnce()

    output.startMusicResult = true
    await expect(feedback.unlock()).resolves.toBe(true)

    expect(output.startMusic).toHaveBeenCalledTimes(2)
    expect(output.startMusic).toHaveBeenLastCalledWith('opening')
    expect(feedback.getDebugState()).toMatchObject({
      musicRequested: true,
      musicPlaying: true,
      musicIntensity: 'opening',
      musicStartCount: 1,
    })
  })

  it('keeps repeated starts and intensity changes in one music session', () => {
    const output = new FakeOutput()
    const feedback = new SensoryFeedbackController(output, null)

    feedback.startMusic('opening')
    feedback.startMusic('opening')
    feedback.startMusic('rotation')
    feedback.startMusic('rotation')
    feedback.startMusic('final-five')
    feedback.startMusic('final-two')

    expect(output.startMusic.mock.calls.map(([intensity]) => intensity)).toEqual([
      'opening',
      'opening',
      'rotation',
      'rotation',
      'final-five',
      'final-two',
    ])
    expect(feedback.getDebugState()).toMatchObject({
      musicRequested: true,
      musicPlaying: true,
      musicIntensity: 'final-two',
      musicStartCount: 1,
    })
  })

  it('retains the requested intensity while sound is off and resumes once', async () => {
    const output = new FakeOutput()
    const feedback = new SensoryFeedbackController(output, null)
    feedback.startMusic('final-five')

    feedback.setSoundEnabled(false)

    expect(output.stopSound).toHaveBeenCalledOnce()
    expect(feedback.getDebugState()).toMatchObject({
      soundEnabled: false,
      musicRequested: true,
      musicPlaying: false,
      musicIntensity: 'final-five',
      musicStartCount: 1,
    })

    feedback.setSoundEnabled(true)
    expect(feedback.getDebugState()).toMatchObject({
      soundEnabled: true,
      musicRequested: true,
      musicPlaying: true,
      musicIntensity: 'final-five',
      musicStartCount: 2,
    })

    await expect(feedback.unlock()).resolves.toBe(true)
    expect(feedback.getDebugState().musicStartCount).toBe(2)
  })

  it('clears music requests without suppressing later result effects', async () => {
    const output = new FakeOutput()
    const feedback = new SensoryFeedbackController(output, null)
    feedback.startMusic('rotation')

    feedback.stopMusic()

    expect(output.stopMusic).toHaveBeenCalledOnce()
    expect(feedback.getDebugState()).toMatchObject({
      musicRequested: false,
      musicPlaying: false,
      musicIntensity: null,
      musicStartCount: 1,
    })
    await expect(feedback.unlock()).resolves.toBe(true)
    expect(output.startMusic).toHaveBeenCalledOnce()

    feedback.startMusic('final-two')
    feedback.stopAll()
    feedback.trigger('results')

    expect(output.stopSound).toHaveBeenCalledOnce()
    expect(output.play).toHaveBeenCalledOnce()
    expect(output.play).toHaveBeenLastCalledWith(
      getSensoryCueSpec('results').tones,
      1,
    )
    expect(feedback.getDebugState()).toMatchObject({
      lastCue: 'results',
      soundOutputCount: 1,
      musicRequested: false,
      musicPlaying: false,
      musicIntensity: null,
      musicStartCount: 2,
    })
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
  it('prepares optional narrations and gates playback with the master sound setting', async () => {
    const output = new FakeOutput()
    const feedback = new SensoryFeedbackController(output, null)
    const assets = [
      { id: 'ramyeon', url: '/ramyeon.mp3' },
      { id: 'pasta', url: '/pasta.mp3' },
    ] as const

    await expect(feedback.prepareNarrations(assets)).resolves.toBeUndefined()
    expect(output.prepareNarrations).toHaveBeenCalledWith(assets)
    expect(feedback.playNarration('ramyeon')).toBe(true)
    expect(feedback.getDebugState()).toMatchObject({
      narrationPreparedCount: 2,
      lastNarrationId: 'ramyeon',
      narrationRequestCount: 1,
      narrationPlayCount: 1,
      narrationPlaying: true,
    })

    feedback.setSoundEnabled(false)
    expect(output.stopNarration).toHaveBeenCalled()
    expect(feedback.playNarration('pasta')).toBe(false)
    expect(output.playNarration).toHaveBeenCalledOnce()
    expect(feedback.getDebugState()).toMatchObject({
      lastNarrationId: 'pasta',
      narrationRequestCount: 2,
      narrationPlayCount: 1,
      narrationPlaying: false,
      musicDucked: false,
    })
  })
})

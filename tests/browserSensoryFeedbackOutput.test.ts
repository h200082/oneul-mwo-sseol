import { describe, expect, it, vi } from 'vitest'

import {
  BrowserSensoryFeedbackOutput,
  MUSIC_BUS_GAIN,
  MUSIC_DUCKED_BUS_GAIN,
  MUSIC_EFFECT_DUCKED_BUS_GAIN,
  NARRATION_BUS_GAIN,
  SENSORY_EFFECT_GAIN,
  NARRATION_CACHE_MAX_ENTRIES,
  NARRATION_PRELOAD_CONCURRENCY,
  type SensoryTone,
} from '../src/feedback/SensoryFeedback'

const FIRST_TONE: Readonly<SensoryTone> = Object.freeze({
  wave: 'sine',
  frequency: 440,
  endFrequency: 520,
  startMs: 0,
  durationMs: 80,
  gain: 0.03,
})

const LATEST_TONES: readonly Readonly<SensoryTone>[] = Object.freeze([
  Object.freeze({
    ...FIRST_TONE,
    frequency: 880,
    endFrequency: 960,
  }),
  Object.freeze({
    ...FIRST_TONE,
    frequency: 990,
    endFrequency: 1_100,
    startMs: 30,
  }),
])

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T | PromiseLike<T>) => void
  readonly reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve']
  let reject!: Deferred<T>['reject']
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

class FakeDocument {
  hidden = false
  private readonly listeners = new Set<
    EventListenerOrEventListenerObject
  >()
  readonly addEventListener = vi.fn(
    (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
    ) => {
      if (type === 'visibilitychange' && listener) {
        this.listeners.add(listener)
      }
    },
  )
  readonly removeEventListener = vi.fn(
    (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
    ) => {
      if (type === 'visibilitychange' && listener) {
        this.listeners.delete(listener)
      }
    },
  )

  setHidden(hidden: boolean): void {
    this.hidden = hidden
    const event = { type: 'visibilitychange' } as Event
    for (const listener of this.listeners) {
      if (typeof listener === 'function') {
        listener(event)
      } else {
        listener.handleEvent(event)
      }
    }
  }
}

class FakeAudioParam {
  value = 1
  readonly cancelScheduledValues = vi.fn((_startTime: number) => this)
  readonly setValueAtTime = vi.fn((value: number, _startTime: number) => {
    this.value = value
    return this
  })
  readonly linearRampToValueAtTime = vi.fn((value: number, _endTime: number) => {
    this.value = value
    return this
  })
  readonly exponentialRampToValueAtTime = vi.fn(
    (value: number, _endTime: number) => {
      this.value = value
      return this
    },
  )
}

class FakeGainNode {
  readonly gain = new FakeAudioParam()
  readonly connect = vi.fn((_destination: unknown) => this)
  readonly disconnect = vi.fn()
}

interface FakeOscillatorOptions {
  readonly startThrows?: boolean
  readonly scheduledStopThrows?: boolean
  readonly cleanupStopThrows?: boolean
}

class FakeOscillatorNode {
  private ended = false
  readonly frequency = new FakeAudioParam()
  type: OscillatorType = 'sine'
  onended: (() => void) | null = null
  readonly connect = vi.fn((_destination: unknown) => this)
  readonly disconnect = vi.fn()
  readonly start = vi.fn((_when?: number) => {
    if (this.options.startThrows) {
      throw new Error('start failed')
    }
  })
  readonly stop = vi.fn((when?: number) => {
    if (when === undefined && this.options.cleanupStopThrows) {
      throw new Error('cleanup stop failed')
    }
    if (when !== undefined && this.options.scheduledStopThrows) {
      throw new Error('scheduled stop failed')
    }
    if (when === undefined) {
      queueMicrotask(() => this.finish())
    }
  })

  finish(): void {
    if (this.ended) return
    this.ended = true
    this.onended?.()
  }

  constructor(private readonly options: FakeOscillatorOptions) {}
}

interface FakeAudioBufferSourceOptions {
  readonly startThrows?: boolean
}

class FakeAudioBufferSourceNode {
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
  readonly connect = vi.fn((_destination: unknown) => this)
  readonly disconnect = vi.fn()
  readonly start = vi.fn((_when?: number) => {
    if (this.options.startThrows) {
      throw new Error('buffer source start failed')
    }
  })
  readonly stop = vi.fn(() => undefined)

  finish(): void {
    this.onended?.()
  }

  constructor(private readonly options: FakeAudioBufferSourceOptions = {}) {}
}

interface FakeAudioContextOptions {
  readonly resume?: () => Promise<void>
  readonly oscillator?: FakeOscillatorOptions
  readonly bufferSource?: FakeAudioBufferSourceOptions
  readonly decodeRejects?: boolean
  readonly masterGainThrows?: boolean
}

class FakeAudioContext {
  state: AudioContextState = 'suspended'
  currentTime = 0
  readonly destination = {}
  readonly gains: FakeGainNode[] = []
  readonly oscillators: FakeOscillatorNode[] = []
  readonly bufferSources: FakeAudioBufferSourceNode[] = []
  readonly createGain = vi.fn(() => {
    if (this.options.masterGainThrows && this.gains.length === 0) {
      throw new Error('master gain failed')
    }
    const gain = new FakeGainNode()
    this.gains.push(gain)
    return gain
  })
  readonly createOscillator = vi.fn(() => {
    const oscillator = new FakeOscillatorNode(
      this.options.oscillator ?? {},
    )
    this.oscillators.push(oscillator)
    return oscillator
  })
  readonly createBufferSource = vi.fn(() => {
    const source = new FakeAudioBufferSourceNode(this.options.bufferSource)
    this.bufferSources.push(source)
    return source
  })
  readonly decodeAudioData = vi.fn(async (_bytes: ArrayBuffer) => {
    if (this.options.decodeRejects) {
      throw new Error('decode failed')
    }
    return { duration: 1 } as AudioBuffer
  })
  readonly resume = vi.fn(async () => {
    await this.options.resume?.()
    if (this.state !== 'closed') {
      this.state = 'running'
    }
  })
  readonly suspend = vi.fn(async () => {
    if (this.state !== 'closed') {
      this.state = 'suspended'
    }
  })
  readonly close = vi.fn(async () => {
    this.state = 'closed'
  })

  constructor(private readonly options: FakeAudioContextOptions) {}
}

function createAudioHarness(options: FakeAudioContextOptions = {}) {
  const contexts: FakeAudioContext[] = []
  class HarnessAudioContext extends FakeAudioContext {
    constructor() {
      super(options)
      contexts.push(this)
    }
  }

  return {
    contexts,
    windowObject: {
      AudioContext: HarnessAudioContext,
      webkitAudioContext: HarnessAudioContext,
    } as unknown as Window,
  }
}

function createNavigator(
  vibrate?: (pattern: VibratePattern) => boolean,
): Navigator {
  return (vibrate ? { vibrate } : {}) as unknown as Navigator
}

function createOutput(
  options: FakeAudioContextOptions = {},
  navigatorObject: Navigator = createNavigator(),
  narrationLoader?: (url: string) => Promise<ArrayBuffer>,
) {
  const documentObject = new FakeDocument()
  const harness = createAudioHarness(options)
  const output = new BrowserSensoryFeedbackOutput(
    harness.windowObject,
    documentObject as unknown as Document,
    navigatorObject,
    narrationLoader,
  )
  return { documentObject, harness, output }
}

describe('BrowserSensoryFeedbackOutput', () => {
  it('degrades cleanly when neither AudioContext constructor exists', async () => {
    const documentObject = new FakeDocument()
    const output = new BrowserSensoryFeedbackOutput(
      {} as Window,
      documentObject as unknown as Document,
      createNavigator(),
    )

    expect(output.audioState).toBe('unavailable')
    await expect(output.unlock()).resolves.toBe(false)
    expect(output.play([FIRST_TONE], 1)).toBe(false)
    expect(() => output.destroy()).not.toThrow()
    expect(documentObject.removeEventListener).toHaveBeenCalledOnce()
  })

  it('closes a context whose master gain cannot be initialized', async () => {
    const { harness, output } = createOutput({ masterGainThrows: true })

    await expect(output.unlock()).resolves.toBe(false)
    expect(harness.contexts).toHaveLength(1)
    expect(harness.contexts[0]!.close).toHaveBeenCalledOnce()
    expect(output.audioState).toBe('locked')
  })
  it('absorbs resume rejection, clears the pending cue, and retries on the same context', async () => {
    const resume = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('autoplay blocked'))
      .mockResolvedValue(undefined)
    const { harness, output } = createOutput({ resume })

    const firstUnlock = output.unlock()
    expect(output.play([FIRST_TONE], 0.8)).toBe(true)
    await expect(firstUnlock).resolves.toBe(false)
    expect(harness.contexts).toHaveLength(1)
    expect(harness.contexts[0]!.oscillators).toHaveLength(0)

    await expect(output.unlock()).resolves.toBe(true)
    expect(harness.contexts).toHaveLength(1)
    expect(resume).toHaveBeenCalledTimes(2)
    expect(harness.contexts[0]!.oscillators).toHaveLength(0)
  })

  it('holds a first long-press cue until pointer release and audio unlock', async () => {
    const resume = createDeferred<void>()
    const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)
    const { harness, output } = createOutput(
      { resume: () => resume.promise },
      createNavigator(vibrate),
    )

    output.primeForGesture()
    expect(output.play([FIRST_TONE], 0.8)).toBe(true)
    expect(output.vibrate([22, 42, 38])).toBe(true)
    expect(vibrate).not.toHaveBeenCalled()

    const unlocking = output.unlock()
    output.releaseGesture()
    expect(vibrate).toHaveBeenCalledOnce()
    expect(vibrate).toHaveBeenCalledWith([22, 42, 38])
    expect(harness.contexts[0]!.oscillators).toHaveLength(0)

    resume.resolve()
    await expect(unlocking).resolves.toBe(true)
    expect(harness.contexts[0]!.oscillators).toHaveLength(1)
    output.destroy()
  })

  it('does not queue unrelated cues after the primed pointer was released', () => {
    const { output } = createOutput()

    output.primeForGesture()
    output.releaseGesture()

    expect(output.play([FIRST_TONE], 1)).toBe(false)
    output.destroy()
  })
  it('discards primed sound and haptics on pointer cancellation', async () => {
    const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)
    const { harness, output } = createOutput(
      {},
      createNavigator(vibrate),
    )

    output.primeForGesture()
    expect(output.play([FIRST_TONE], 1)).toBe(true)
    expect(output.vibrate([18, 24, 18])).toBe(true)
    output.cancelPrimedGesture()
    output.releaseGesture()
    await expect(output.unlock()).resolves.toBe(true)

    expect(harness.contexts[0]!.oscillators).toHaveLength(0)
    expect(vibrate).not.toHaveBeenCalled()
    output.destroy()
  })

  it('expires an unreleased primed cue after the safety window', async () => {
    vi.useFakeTimers()
    const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)
    const { harness, output } = createOutput(
      {},
      createNavigator(vibrate),
    )

    try {
      output.primeForGesture()
      expect(output.play([FIRST_TONE], 1)).toBe(true)
      expect(output.vibrate([14, 36, 14])).toBe(true)
      await vi.advanceTimersByTimeAsync(2_501)

      output.releaseGesture()
      await expect(output.unlock()).resolves.toBe(true)
      expect(harness.contexts[0]!.oscillators).toHaveLength(0)
      expect(vibrate).not.toHaveBeenCalled()
    } finally {
      output.destroy()
      vi.useRealTimers()
    }
  })
  it('flushes only the newest cue after an in-flight unlock succeeds', async () => {
    const resume = createDeferred<void>()
    const { harness, output } = createOutput({
      resume: () => resume.promise,
    })

    const unlocking = output.unlock()
    expect(output.play([FIRST_TONE], 0.4)).toBe(true)
    expect(output.play(LATEST_TONES, 0.8)).toBe(true)

    resume.resolve()
    await expect(unlocking).resolves.toBe(true)

    const context = harness.contexts[0]!
    expect(context.oscillators).toHaveLength(LATEST_TONES.length)
    expect(
      context.oscillators.map(
        (oscillator) =>
          oscillator.frequency.setValueAtTime.mock.calls[0]?.[0],
      ),
    ).toEqual(LATEST_TONES.map((tone) => tone.frequency))
    expect(context.oscillators.every((oscillator) =>
      oscillator.start.mock.calls.length === 1,
    )).toBe(true)
  })

  it('does not flush a cue when the page hides during unlock and suspends the resumed context', async () => {
    const resume = createDeferred<void>()
    const { documentObject, harness, output } = createOutput({
      resume: () => resume.promise,
    })

    const unlocking = output.unlock()
    expect(output.play([FIRST_TONE], 1)).toBe(true)
    documentObject.setHidden(true)
    expect(output.play([FIRST_TONE], 1)).toBe(false)
    await expect(output.unlock()).resolves.toBe(false)

    resume.resolve()
    await expect(unlocking).resolves.toBe(false)

    const context = harness.contexts[0]!
    expect(context.oscillators).toHaveLength(0)
    expect(context.suspend).toHaveBeenCalledOnce()
    expect(context.state).toBe('suspended')

    documentObject.setHidden(false)
    await expect(output.unlock()).resolves.toBe(true)
    expect(context.resume).toHaveBeenCalledTimes(2)
    expect(context.state).toBe('running')
  })

  it('closes an in-flight context on destroy without flushing its pending cue', async () => {
    const resume = createDeferred<void>()
    const { documentObject, harness, output } = createOutput({
      resume: () => resume.promise,
    })

    const unlocking = output.unlock()
    expect(output.play([FIRST_TONE], 1)).toBe(true)
    output.destroy()
    resume.resolve()

    await expect(unlocking).resolves.toBe(false)
    const context = harness.contexts[0]!
    expect(context.close).toHaveBeenCalledOnce()
    expect(context.oscillators).toHaveLength(0)
    expect(output.audioState).toBe('closed')
    expect(documentObject.removeEventListener).toHaveBeenCalledOnce()
  })

  it('reuses one context across repeated unlock and resume cycles', async () => {
    const { harness, output } = createOutput()

    await expect(output.unlock()).resolves.toBe(true)
    await expect(output.unlock()).resolves.toBe(true)
    const context = harness.contexts[0]!
    context.state = 'suspended'
    await expect(output.unlock()).resolves.toBe(true)
    context.state = 'interrupted' as AudioContextState
    await expect(output.unlock()).resolves.toBe(true)

    expect(harness.contexts).toHaveLength(1)
    expect(context.gains[0]!.gain.setValueAtTime).toHaveBeenCalledWith(
      0.78,
      context.currentTime,
    )
    expect(context.resume).toHaveBeenCalledTimes(3)
  })

  it('uses one scheduler for repeated starts and live intensity changes', async () => {
    vi.useFakeTimers()
    const { harness, output } = createOutput()

    try {
      await expect(output.unlock()).resolves.toBe(true)
      expect(output.startMusic('opening')).toBe(true)
      const context = harness.contexts[0]!
      const firstSourceCount = context.oscillators.length
      expect(firstSourceCount).toBeGreaterThan(0)
      expect(output.musicPlaying).toBe(true)
      expect(output.musicStartCount).toBe(1)
      expect(vi.getTimerCount()).toBe(1)

      expect(output.startMusic('opening')).toBe(true)
      expect(output.startMusic('rotation')).toBe(true)
      expect(output.startMusic('final-five')).toBe(true)
      expect(output.startMusic('final-two')).toBe(true)

      expect(harness.contexts).toHaveLength(1)
      expect(context.oscillators).toHaveLength(firstSourceCount)
      expect(output.musicStartCount).toBe(1)
      expect(vi.getTimerCount()).toBe(1)

      output.stopMusic()
      expect(output.musicPlaying).toBe(false)
      expect(vi.getTimerCount()).toBe(0)

      expect(output.startMusic('final-two')).toBe(true)
      expect(output.musicStartCount).toBe(2)
      expect(vi.getTimerCount()).toBe(1)
      expect(context.oscillators.length).toBeGreaterThan(firstSourceCount)
    } finally {
      output.destroy()
      vi.useRealTimers()
    }
  })

  it('sidechains music under effects and extends the release for a newer cue', async () => {
    vi.useFakeTimers()
    const { harness, output } = createOutput()

    try {
      await expect(output.unlock()).resolves.toBe(true)
      expect(output.startMusic('opening')).toBe(true)
      const context = harness.contexts[0]!
      const musicGain = context.gains[1]!

      expect(output.play([FIRST_TONE], 1)).toBe(true)
      expect(musicGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        MUSIC_EFFECT_DUCKED_BUS_GAIN,
        context.currentTime + 0.008,
      )
      const firstDuckHold =
        musicGain.gain.setValueAtTime.mock.calls.at(-1)
      expect(firstDuckHold?.[0]).toBe(MUSIC_EFFECT_DUCKED_BUS_GAIN)
      expect(firstDuckHold?.[1]).toBeCloseTo(
        context.currentTime + 0.12,
        12,
      )
      const firstDuckRelease =
        musicGain.gain.linearRampToValueAtTime.mock.calls.at(-1)
      expect(firstDuckRelease?.[0]).toBe(MUSIC_BUS_GAIN)
      expect(firstDuckRelease?.[1]).toBeCloseTo(
        context.currentTime + 0.32,
        12,
      )
      const firstEffectGain = context.gains.at(-1)!
      expect(firstEffectGain.gain.linearRampToValueAtTime)
        .toHaveBeenCalledWith(FIRST_TONE.gain * SENSORY_EFFECT_GAIN, 0.017)

      context.currentTime = 0.04
      expect(output.play(LATEST_TONES, 1)).toBe(true)
      const extendedDuckHold =
        musicGain.gain.setValueAtTime.mock.calls.at(-1)
      expect(extendedDuckHold?.[0]).toBe(MUSIC_EFFECT_DUCKED_BUS_GAIN)
      expect(extendedDuckHold?.[1]).toBeCloseTo(0.19, 12)
      const extendedDuckRelease =
        musicGain.gain.linearRampToValueAtTime.mock.calls.at(-1)
      expect(extendedDuckRelease?.[0]).toBe(MUSIC_BUS_GAIN)
      expect(extendedDuckRelease?.[1]).toBeCloseTo(0.39, 12)
    } finally {
      output.destroy()
      vi.useRealTimers()
    }
  })

  it('stops only music while leaving an active sound effect intact', async () => {
    vi.useFakeTimers()
    const { harness, output } = createOutput()

    try {
      await expect(output.unlock()).resolves.toBe(true)
      expect(output.startMusic('opening')).toBe(true)
      const context = harness.contexts[0]!
      const musicSources = [...context.oscillators]
      expect(musicSources.length).toBeGreaterThan(0)

      expect(output.play([FIRST_TONE], 1)).toBe(true)
      const effectSource = context.oscillators.at(-1)!
      expect(musicSources).not.toContain(effectSource)
      expect(effectSource.stop).toHaveBeenCalledOnce()

      output.stopMusic()

      expect(output.musicPlaying).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
      for (const source of musicSources) {
        expect(source.stop).toHaveBeenCalledTimes(2)
        expect(source.stop.mock.calls.at(-1)?.[0]).toBeUndefined()
        expect(source.disconnect).toHaveBeenCalledOnce()
      }
      expect(effectSource.stop).toHaveBeenCalledOnce()
      expect(effectSource.disconnect).not.toHaveBeenCalled()

      output.stopSound()
      await Promise.resolve()
      expect(effectSource.stop).toHaveBeenCalledTimes(2)
      expect(effectSource.disconnect).toHaveBeenCalledOnce()
    } finally {
      output.destroy()
      vi.useRealTimers()
    }
  })

  it('pauses music while hidden and resumes the requested intensity once visible', async () => {
    vi.useFakeTimers()
    const { documentObject, harness, output } = createOutput()

    try {
      await expect(output.unlock()).resolves.toBe(true)
      expect(output.startMusic('final-five')).toBe(true)
      const context = harness.contexts[0]!
      const firstSessionSources = context.oscillators.length
      expect(output.musicStartCount).toBe(1)

      documentObject.setHidden(true)
      await Promise.resolve()

      expect(output.musicPlaying).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
      expect(context.suspend).toHaveBeenCalledOnce()
      expect(context.state).toBe('suspended')

      documentObject.setHidden(false)
      await Promise.resolve()
      await Promise.resolve()

      expect(context.resume).toHaveBeenCalledTimes(2)
      expect(context.state).toBe('running')
      expect(output.musicPlaying).toBe(true)
      expect(output.musicStartCount).toBe(2)
      expect(vi.getTimerCount()).toBe(1)
      expect(context.oscillators.length).toBeGreaterThan(firstSessionSources)
    } finally {
      output.destroy()
      vi.useRealTimers()
    }
  })

  it('clears scheduler, sources, gains, and context on destroy', async () => {
    vi.useFakeTimers()
    const { harness, output } = createOutput()

    try {
      await expect(output.unlock()).resolves.toBe(true)
      expect(output.startMusic('final-two')).toBe(true)
      expect(output.play([FIRST_TONE], 1)).toBe(true)
      const context = harness.contexts[0]!
      const sourceCount = context.oscillators.length
      expect(vi.getTimerCount()).toBe(1)

      output.destroy()
      await Promise.resolve()

      expect(output.audioState).toBe('closed')
      expect(output.musicPlaying).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
      expect(context.close).toHaveBeenCalledOnce()
      expect(
        context.oscillators.every(
          (source) => source.stop.mock.calls.length >= 2,
        ),
      ).toBe(true)
      expect(
        context.oscillators.every(
          (source) => source.disconnect.mock.calls.length === 1,
        ),
      ).toBe(true)
      expect(
        context.gains.every((gain) => gain.disconnect.mock.calls.length === 1),
      ).toBe(true)

      await vi.advanceTimersByTimeAsync(1_000)
      expect(context.oscillators).toHaveLength(sourceCount)
    } finally {
      output.destroy()
      vi.useRealTimers()
    }
  })
  it('returns false instead of throwing when vibration fails or is rejected', () => {
    const vibrate = vi
      .fn<(pattern: VibratePattern) => boolean>()
      .mockReturnValueOnce(false)
      .mockImplementationOnce(() => {
        throw new Error('vibration blocked')
      })
    const { output } = createOutput({}, createNavigator(vibrate))

    expect(output.hapticsSupported).toBe(true)
    expect(output.vibrate([12])).toBe(false)
    expect(output.vibrate([18, 24, 18])).toBe(false)
  })

  it('cleans up a partially constructed node when oscillator start throws', async () => {
    const { harness, output } = createOutput({
      oscillator: { startThrows: true },
    })
    await expect(output.unlock()).resolves.toBe(true)

    expect(output.play([FIRST_TONE], 1)).toBe(false)
    const context = harness.contexts[0]!
    const oscillator = context.oscillators[0]!
    const toneGain = context.gains[1]!
    expect(oscillator.stop).toHaveBeenCalledOnce()
    expect(oscillator.disconnect).toHaveBeenCalledOnce()
    expect(toneGain.disconnect).toHaveBeenCalledOnce()

    output.stopSound()
    expect(oscillator.stop).toHaveBeenCalledOnce()
  })

  it('finishes cleanup even when scheduled and fallback oscillator stops throw', async () => {
    const { harness, output } = createOutput({
      oscillator: {
        scheduledStopThrows: true,
        cleanupStopThrows: true,
      },
    })
    await expect(output.unlock()).resolves.toBe(true)

    let played: boolean | undefined
    expect(() => {
      played = output.play([FIRST_TONE], 1)
    }).not.toThrow()
    expect(played).toBe(false)
    const context = harness.contexts[0]!
    for (const oscillator of context.oscillators) {
      expect(oscillator.stop).toHaveBeenCalledTimes(2)
      expect(oscillator.disconnect).toHaveBeenCalledOnce()
    }
    for (const gain of context.gains.slice(1)) {
      expect(gain.disconnect).toHaveBeenCalledOnce()
    }

    output.stopSound()
    expect(
      context.oscillators.every(
        (oscillator) => oscillator.stop.mock.calls.length === 2,
      ),
    ).toBe(true)
  })
  it('keeps null or unprepared narrations silent without ducking music', async () => {
    vi.useFakeTimers()
    const { output } = createOutput()
    try {
      await expect(output.unlock()).resolves.toBe(true)
      expect(output.startMusic('opening')).toBe(true)

      expect(output.playNarration('ramyeon')).toBe(false)
      expect(output.narrationPreparedCount).toBe(0)
      expect(output.narrationPlaying).toBe(false)
      expect(output.musicDucked).toBe(false)
    } finally {
      output.destroy()
      vi.useRealTimers()
    }
  })

  it('keeps the newest narration URL when an older load resolves last', async () => {
    const firstLoad = createDeferred<ArrayBuffer>()
    const secondLoad = createDeferred<ArrayBuffer>()
    const narrationLoader = vi.fn((url: string) => {
      if (url === '/ramyeon-a.mp3') return firstLoad.promise
      if (url === '/ramyeon-b.mp3') return secondLoad.promise
      throw new Error(`Unexpected narration URL: ${url}`)
    })
    const { harness, output } = createOutput(
      {},
      createNavigator(),
      narrationLoader,
    )

    try {
      await expect(output.unlock()).resolves.toBe(true)
      const context = harness.contexts[0]!
      context.decodeAudioData.mockImplementation(async (bytes: ArrayBuffer) =>
        ({ duration: new Uint8Array(bytes)[0] ?? 0 }) as AudioBuffer,
      )

      const preparingA = output.prepareNarrations([
        { id: 'ramyeon', url: '/ramyeon-a.mp3' },
      ])
      await vi.waitFor(() => {
        expect(narrationLoader).toHaveBeenCalledOnce()
      })
      const preparingB = output.prepareNarrations([
        { id: 'ramyeon', url: '/ramyeon-b.mp3' },
      ])

      secondLoad.resolve(Uint8Array.of(2).buffer)
      await preparingB
      expect(output.narrationPreparedCount).toBe(1)
      firstLoad.resolve(Uint8Array.of(1).buffer)
      await preparingA

      expect(narrationLoader).toHaveBeenCalledTimes(2)
      expect(context.decodeAudioData).toHaveBeenCalledOnce()
      const decodedBytes = context.decodeAudioData.mock.calls[0]![0]
      expect(new Uint8Array(decodedBytes)[0]).toBe(2)
      expect(output.narrationPreparedCount).toBe(1)

      expect(output.playNarration('ramyeon')).toBe(true)
      expect(context.bufferSources).toHaveLength(1)
      expect(context.bufferSources[0]!.buffer).toEqual({ duration: 2 })
    } finally {
      output.destroy()
    }
  })

  it('deduplicates prepared clips, replaces the active voice, and guards BGM duck restoration', async () => {
    vi.useFakeTimers()
    const narrationLoader = vi.fn(async (_url: string) => new ArrayBuffer(12))
    const { harness, output } = createOutput(
      {},
      createNavigator(),
      narrationLoader,
    )

    try {
      await expect(output.unlock()).resolves.toBe(true)
      await expect(
        output.prepareNarrations([
          { id: 'ramyeon', url: '/ramyeon.mp3' },
          { id: 'ramyeon', url: '/ramyeon.mp3' },
        ]),
      ).resolves.toBeUndefined()
      expect(narrationLoader).toHaveBeenCalledOnce()
      expect(output.narrationPreparedCount).toBe(1)

      expect(output.startMusic('rotation')).toBe(true)
      const context = harness.contexts[0]!
      const musicGain = context.gains[1]!
      expect(output.playNarration('ramyeon')).toBe(true)
      expect(output.narrationPlaying).toBe(true)
      expect(output.musicDucked).toBe(true)
      const narrationGain = context.gains.at(-1)!
      expect(narrationGain.gain.setValueAtTime).toHaveBeenCalledWith(
        NARRATION_BUS_GAIN,
        context.currentTime,
      )
      expect(musicGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        MUSIC_DUCKED_BUS_GAIN,
        context.currentTime + 0.008,
      )

      const firstSource = context.bufferSources[0]!
      expect(output.playNarration('ramyeon')).toBe(true)
      expect(firstSource.stop).toHaveBeenCalledOnce()
      firstSource.finish()
      expect(output.musicDucked).toBe(true)

      const secondSource = context.bufferSources[1]!
      secondSource.finish()
      expect(output.narrationPlaying).toBe(false)
      expect(output.musicDucked).toBe(false)
      expect(musicGain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
        MUSIC_BUS_GAIN,
        context.currentTime + 0.12,
      )
    } finally {
      output.destroy()
      vi.useRealTimers()
    }
  })

  it('falls back without a queue when optional MP3 decoding fails', async () => {
    const narrationLoader = vi.fn(async (_url: string) => new ArrayBuffer(8))
    const { harness, output } = createOutput(
      { decodeRejects: true },
      createNavigator(),
      narrationLoader,
    )
    await expect(output.unlock()).resolves.toBe(true)
    await expect(
      output.prepareNarrations([{ id: 'pasta', url: '/pasta.mp3' }]),
    ).resolves.toBeUndefined()

    expect(harness.contexts[0]!.decodeAudioData).toHaveBeenCalledOnce()
    expect(output.narrationPreparedCount).toBe(0)
    expect(output.playNarration('pasta')).toBe(false)
    expect(output.narrationPlaying).toBe(false)
    expect(output.musicDucked).toBe(false)
    output.destroy()
  })
  it('drops an active narration on hide and resumes only requested BGM when visible', async () => {
    vi.useFakeTimers()
    const narrationLoader = vi.fn(async (_url: string) => new ArrayBuffer(10))
    const { documentObject, harness, output } = createOutput(
      {},
      createNavigator(),
      narrationLoader,
    )

    try {
      await expect(output.unlock()).resolves.toBe(true)
      await output.prepareNarrations([
        { id: 'shabu-shabu', url: '/shabu-shabu.mp3' },
      ])
      expect(output.startMusic('final-two')).toBe(true)
      expect(output.playNarration('shabu-shabu')).toBe(true)
      const narrationSource = harness.contexts[0]!.bufferSources[0]!

      documentObject.setHidden(true)
      await Promise.resolve()
      expect(narrationSource.stop).toHaveBeenCalledOnce()
      expect(output.narrationPlaying).toBe(false)
      expect(output.musicDucked).toBe(false)
      expect(output.musicPlaying).toBe(false)

      documentObject.setHidden(false)
      await Promise.resolve()
      await Promise.resolve()
      expect(output.musicPlaying).toBe(true)
      expect(output.narrationPlaying).toBe(false)
      expect(harness.contexts[0]!.bufferSources).toHaveLength(1)
    } finally {
      output.destroy()
      vi.useRealTimers()
    }
  })
  it('loads opening-round voices first with a global max-three queue and deduplicates repeated preparation', async () => {
    const pendingLoads = new Map<string, Deferred<ArrayBuffer>>()
    let activeLoads = 0
    let maximumActiveLoads = 0
    const narrationLoader = vi.fn((url: string) => {
      activeLoads += 1
      maximumActiveLoads = Math.max(maximumActiveLoads, activeLoads)
      const deferred = createDeferred<ArrayBuffer>()
      pendingLoads.set(url, deferred)
      return deferred.promise.finally(() => {
        activeLoads -= 1
      })
    })
    const { output } = createOutput({}, createNavigator(), narrationLoader)
    const assets = [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `background-${index + 1}`,
        url: `/background-${index + 1}.mp3`,
        preloadPriority: 'background' as const,
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `initial-${index + 1}`,
        url: `/initial-${index + 1}.mp3`,
        preloadPriority: 'initial-round' as const,
      })),
    ]

    try {
      const firstPreparation = output.prepareNarrations(assets)
      const repeatedPreparation = output.prepareNarrations(assets)

      await vi.waitFor(() => {
        expect(narrationLoader).toHaveBeenCalledTimes(
          NARRATION_PRELOAD_CONCURRENCY,
        )
      })
      expect(narrationLoader.mock.calls.map(([url]) => url)).toEqual([
        '/initial-1.mp3',
        '/initial-2.mp3',
        '/initial-3.mp3',
      ])

      for (const index of [1, 2, 3]) {
        pendingLoads.get(`/initial-${index}.mp3`)?.resolve(new ArrayBuffer(4))
      }
      await vi.waitFor(() => {
        expect(narrationLoader).toHaveBeenCalledTimes(5)
      })
      expect(narrationLoader.mock.calls.slice(0, 5).map(([url]) => url)).toEqual([
        '/initial-1.mp3',
        '/initial-2.mp3',
        '/initial-3.mp3',
        '/initial-4.mp3',
        '/initial-5.mp3',
      ])
      expect(
        narrationLoader.mock.calls.some(([url]) =>
          String(url).includes('background'),
        ),
      ).toBe(false)

      for (const index of [4, 5]) {
        pendingLoads.get(`/initial-${index}.mp3`)?.resolve(new ArrayBuffer(4))
      }
      await vi.waitFor(() => {
        expect(narrationLoader).toHaveBeenCalledTimes(8)
      })
      expect(
        narrationLoader.mock.calls.slice(5, 8).map(([url]) => url),
      ).toEqual([
        '/background-1.mp3',
        '/background-2.mp3',
        '/background-3.mp3',
      ])

      for (const index of [1, 2, 3]) {
        pendingLoads
          .get(`/background-${index}.mp3`)
          ?.resolve(new ArrayBuffer(4))
      }
      await vi.waitFor(() => {
        expect(narrationLoader).toHaveBeenCalledTimes(9)
      })
      pendingLoads.get('/background-4.mp3')?.resolve(new ArrayBuffer(4))
      await Promise.all([firstPreparation, repeatedPreparation])

      expect(maximumActiveLoads).toBeLessThanOrEqual(
        NARRATION_PRELOAD_CONCURRENCY,
      )
      expect(narrationLoader).toHaveBeenCalledTimes(assets.length)
    } finally {
      output.destroy()
    }
  })

  it('retains an active voice across a deck swap and evicts it after playback ends', async () => {
    const narrationLoader = vi.fn(async () => new ArrayBuffer(8))
    const { harness, output } = createOutput(
      {},
      createNavigator(),
      narrationLoader,
    )

    try {
      await expect(output.unlock()).resolves.toBe(true)
      await output.prepareNarrations([
        { id: 'active-a', url: '/active-a.mp3' },
        { id: 'inactive-a', url: '/inactive-a.mp3' },
      ])
      expect(output.narrationPreparedCount).toBe(2)
      expect(output.playNarration('active-a')).toBe(true)
      const activeSource = harness.contexts[0]!.bufferSources[0]!

      await output.prepareNarrations([
        { id: 'current-b', url: '/current-b.mp3' },
      ])
      expect(activeSource.stop).not.toHaveBeenCalled()
      expect(output.narrationPlaying).toBe(true)
      expect(output.narrationPreparedCount).toBe(2)

      activeSource.finish()
      expect(output.narrationPlaying).toBe(false)
      expect(output.narrationPreparedCount).toBe(1)
      expect(output.playNarration('active-a')).toBe(false)
      expect(output.playNarration('current-b')).toBe(true)
    } finally {
      output.destroy()
    }
  })

  it('bounds decoded narration retention even when an oversized scope is supplied', async () => {
    const narrationLoader = vi.fn(async () => new ArrayBuffer(8))
    const { output } = createOutput({}, createNavigator(), narrationLoader)
    const oversizedScope = Array.from(
      { length: NARRATION_CACHE_MAX_ENTRIES + 6 },
      (_, index) => ({
        id: `menu-${index}`,
        url: `/menu-${index}.mp3`,
      }),
    )

    try {
      await expect(output.unlock()).resolves.toBe(true)
      await output.prepareNarrations(oversizedScope)
      expect(output.narrationPreparedCount).toBe(
        NARRATION_CACHE_MAX_ENTRIES,
      )
      expect(output.playNarration('menu-0')).toBe(false)
      expect(
        output.playNarration(`menu-${oversizedScope.length - 1}`),
      ).toBe(true)

      await output.prepareNarrations([])
      expect(output.narrationPreparedCount).toBe(1)
      output.stopNarration()
      expect(output.narrationPreparedCount).toBe(0)
    } finally {
      output.destroy()
    }
  })
})

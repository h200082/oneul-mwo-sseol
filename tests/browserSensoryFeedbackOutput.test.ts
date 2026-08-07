import { describe, expect, it, vi } from 'vitest'

import {
  BrowserSensoryFeedbackOutput,
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
  readonly setValueAtTime = vi.fn(
    (_value: number, _startTime: number) => this,
  )
  readonly linearRampToValueAtTime = vi.fn(
    (_value: number, _endTime: number) => this,
  )
  readonly exponentialRampToValueAtTime = vi.fn(
    (_value: number, _endTime: number) => this,
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
  })

  constructor(private readonly options: FakeOscillatorOptions) {}
}

interface FakeAudioContextOptions {
  readonly resume?: () => Promise<void>
  readonly oscillator?: FakeOscillatorOptions
  readonly masterGainThrows?: boolean
}

class FakeAudioContext {
  state: AudioContextState = 'suspended'
  currentTime = 0
  readonly destination = {}
  readonly gains: FakeGainNode[] = []
  readonly oscillators: FakeOscillatorNode[] = []
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
) {
  const documentObject = new FakeDocument()
  const harness = createAudioHarness(options)
  const output = new BrowserSensoryFeedbackOutput(
    harness.windowObject,
    documentObject as unknown as Document,
    navigatorObject,
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
})

import {
  loadFeedbackSettings,
  saveFeedbackSettings,
  type FeedbackSettings,
  type FeedbackSettingsStorage,
} from './feedbackSettings'

export type SensoryCue =
  | 'ui-confirm'
  | 'countdown'
  | 'start'
  | 'slice-low'
  | 'slice-good'
  | 'slice-great'
  | 'slice-perfect'
  | 'capture'
  | 'miss-warning'
  | 'miss'
  | 'final-five'
  | 'results'

export interface SensoryTone {
  readonly wave: OscillatorType
  readonly frequency: number
  readonly endFrequency: number
  readonly startMs: number
  readonly durationMs: number
  readonly gain: number
}

export interface SensoryCueSpec {
  readonly tones: readonly Readonly<SensoryTone>[]
  readonly vibration: readonly number[]
}

export type SensoryAudioState =
  | 'unavailable'
  | 'locked'
  | 'running'
  | 'suspended'
  | 'closed'

export interface SensoryFeedbackDebugState {
  readonly soundEnabled: boolean
  readonly hapticsEnabled: boolean
  readonly hapticsSupported: boolean
  readonly audioState: SensoryAudioState
  readonly lastCue: SensoryCue | null
  readonly triggerCount: number
  readonly soundOutputCount: number
  readonly hapticOutputCount: number
}

export interface SensoryFeedback {
  readonly soundEnabled: boolean
  readonly hapticsEnabled: boolean
  readonly hapticsSupported: boolean
  primeForGesture(): void
  releaseGesture(): void
  cancelPrimedGesture(): void
  unlock(): Promise<boolean>
  trigger(cue: SensoryCue, soundScale?: number): void
  setSoundEnabled(enabled: boolean): void
  setHapticsEnabled(enabled: boolean): void
  stopAll(): void
  destroy(): void
  getDebugState(): Readonly<SensoryFeedbackDebugState>
}

export interface SensoryFeedbackOutput {
  readonly audioState: SensoryAudioState
  readonly hapticsSupported: boolean
  primeForGesture(): void
  releaseGesture(): void
  cancelPrimedGesture(): void
  unlock(): Promise<boolean>
  play(tones: readonly Readonly<SensoryTone>[], soundScale: number): boolean
  vibrate(pattern: readonly number[]): boolean
  stopSound(): void
  cancelVibration(): void
  destroy(): void
}

const CUE_SPECS: Readonly<Record<SensoryCue, SensoryCueSpec>> =
  Object.freeze({
    'ui-confirm': cue(
      [tone('sine', 620, 760, 0, 70, 0.025)],
      [],
    ),
    countdown: cue(
      [tone('sine', 480, 520, 0, 65, 0.025)],
      [],
    ),
    start: cue(
      [
        tone('square', 660, 760, 0, 70, 0.025),
        tone('square', 990, 1_180, 82, 95, 0.03),
      ],
      [26],
    ),
    'slice-low': cue(
      [tone('sawtooth', 270, 150, 0, 75, 0.024)],
      [24],
    ),
    'slice-good': cue(
      [tone('triangle', 430, 620, 0, 70, 0.027)],
      [30],
    ),
    'slice-great': cue(
      [
        tone('triangle', 610, 900, 0, 78, 0.03),
        tone('sine', 1_020, 1_260, 42, 72, 0.018),
      ],
      [38],
    ),
    'slice-perfect': cue(
      [
        tone('triangle', 760, 1_080, 0, 82, 0.035),
        tone('sine', 1_180, 1_520, 52, 105, 0.027),
        tone('sine', 1_620, 1_920, 118, 105, 0.02),
      ],
      [34, 24, 48],
    ),
    capture: cue(
      [
        tone('sine', 390, 520, 0, 90, 0.033),
        tone('sine', 560, 720, 72, 100, 0.037),
        tone('triangle', 760, 1_020, 150, 120, 0.035),
      ],
      [42, 30, 62],
    ),
    'miss-warning': cue(
      [tone('square', 190, 160, 0, 48, 0.015)],
      [],
    ),
    miss: cue(
      [tone('sawtooth', 210, 92, 0, 135, 0.032)],
      [48],
    ),
    'final-five': cue(
      [
        tone('square', 590, 660, 0, 88, 0.026),
        tone('square', 880, 1_020, 125, 105, 0.032),
      ],
      [28, 30, 40],
    ),
    results: cue(
      [
        tone('triangle', 520, 620, 0, 115, 0.028),
        tone('triangle', 660, 760, 92, 125, 0.032),
        tone('triangle', 790, 980, 190, 155, 0.036),
      ],
      [34, 36, 56],
    ),
  })

export function getSensoryCueSpec(
  cueName: SensoryCue,
): Readonly<SensoryCueSpec> {
  return CUE_SPECS[cueName]
}

export class SensoryFeedbackController implements SensoryFeedback {
  private settings: FeedbackSettings
  private destroyed = false
  private lastCue: SensoryCue | null = null
  private triggerCount = 0
  private soundOutputCount = 0
  private hapticOutputCount = 0

  constructor(
    private readonly output: SensoryFeedbackOutput,
    private readonly storage: FeedbackSettingsStorage | null,
  ) {
    this.settings = { ...loadFeedbackSettings(storage) }
  }

  get soundEnabled(): boolean {
    return this.settings.soundEnabled
  }

  get hapticsEnabled(): boolean {
    return this.settings.hapticsEnabled
  }

  get hapticsSupported(): boolean {
    return this.output.hapticsSupported
  }

  primeForGesture(): void {
    if (this.destroyed) {
      return
    }
    this.output.primeForGesture()
  }

  releaseGesture(): void {
    if (!this.destroyed) {
      this.output.releaseGesture()
    }
  }

  cancelPrimedGesture(): void {
    if (!this.destroyed) {
      this.output.cancelPrimedGesture()
    }
  }

  async unlock(): Promise<boolean> {
    if (this.destroyed || !this.soundEnabled) {
      return false
    }
    try {
      return await this.output.unlock()
    } catch {
      return false
    }
  }

  trigger(cueName: SensoryCue, soundScale = 1): void {
    if (this.destroyed) {
      return
    }

    const cueSpec = getSensoryCueSpec(cueName)
    const safeSoundScale = Number.isFinite(soundScale)
      ? Math.min(1, Math.max(0, soundScale))
      : 1

    this.lastCue = cueName
    this.triggerCount += 1

    if (
      this.soundEnabled &&
      safeSoundScale > 0 &&
      this.output.play(cueSpec.tones, safeSoundScale)
    ) {
      this.soundOutputCount += 1
    }

    if (
      this.hapticsEnabled &&
      this.hapticsSupported &&
      cueSpec.vibration.length > 0 &&
      this.output.vibrate(cueSpec.vibration)
    ) {
      this.hapticOutputCount += 1
    }
  }

  setSoundEnabled(enabled: boolean): void {
    if (this.destroyed || enabled === this.settings.soundEnabled) {
      return
    }

    this.settings = { ...this.settings, soundEnabled: enabled }
    this.persistSettings()
    if (!enabled) {
      this.output.stopSound()
    }
  }

  setHapticsEnabled(enabled: boolean): void {
    if (this.destroyed || enabled === this.settings.hapticsEnabled) {
      return
    }

    this.settings = { ...this.settings, hapticsEnabled: enabled }
    this.persistSettings()
    if (!enabled) {
      this.output.cancelVibration()
    }
  }

  stopAll(): void {
    if (this.destroyed) {
      return
    }
    this.output.cancelPrimedGesture()
    this.output.stopSound()
    this.output.cancelVibration()
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }
    this.destroyed = true
    this.output.destroy()
  }

  getDebugState(): Readonly<SensoryFeedbackDebugState> {
    return Object.freeze({
      soundEnabled: this.soundEnabled,
      hapticsEnabled: this.hapticsEnabled,
      hapticsSupported: this.hapticsSupported,
      audioState: this.output.audioState,
      lastCue: this.lastCue,
      triggerCount: this.triggerCount,
      soundOutputCount: this.soundOutputCount,
      hapticOutputCount: this.hapticOutputCount,
    })
  }

  private persistSettings(): void {
    saveFeedbackSettings(this.storage, this.settings)
  }
}

const PRIMED_GESTURE_MAX_MS = 2_500

type AudioContextConstructor = new () => AudioContext

interface AudioWindow extends Window {
  readonly AudioContext?: AudioContextConstructor
  readonly webkitAudioContext?: AudioContextConstructor
}

interface PendingSound {
  readonly gestureToken: number | null
  readonly tones: readonly Readonly<SensoryTone>[]
  readonly soundScale: number
}

interface PendingVibration {
  readonly gestureToken: number
  readonly pattern: readonly number[]
}

export class BrowserSensoryFeedbackOutput
  implements SensoryFeedbackOutput
{
  private readonly audioContextConstructor: AudioContextConstructor | null
  private readonly visibilityHandler: () => void
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private unlockTask: Promise<boolean> | null = null
  private pendingSound: PendingSound | null = null
  private pendingVibration: PendingVibration | null = null
  private gestureGeneration = 0
  private primedGestureToken: number | null = null
  private primedGestureReleased = false
  private gestureExpiryTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly activeSources = new Set<OscillatorNode>()
  private destroyed = false

  constructor(
    windowObject: Window,
    private readonly documentObject: Document,
    private readonly navigatorObject: Navigator,
  ) {
    const audioWindow = windowObject as AudioWindow
    this.audioContextConstructor =
      audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null
    this.visibilityHandler = () => {
      if (this.documentObject.hidden) {
        this.cancelPrimedGesture()
        this.stopSound()
        this.cancelVibration()
        void this.suspendContext()
      }
    }
    this.documentObject.addEventListener(
      'visibilitychange',
      this.visibilityHandler,
    )
  }

  get audioState(): SensoryAudioState {
    if (this.destroyed) {
      return 'closed'
    }
    if (!this.audioContextConstructor) {
      return 'unavailable'
    }
    if (!this.context) {
      return 'locked'
    }
    if (this.context.state === 'running') {
      return 'running'
    }
    if (this.context.state === 'closed') {
      return 'closed'
    }
    return 'suspended'
  }

  get hapticsSupported(): boolean {
    return typeof this.navigatorObject.vibrate === 'function'
  }

  primeForGesture(): void {
    if (
      this.destroyed ||
      this.documentObject.hidden ||
      (!this.audioContextConstructor && !this.hapticsSupported)
    ) {
      return
    }

    this.cancelPrimedGesture()
    const gestureToken = ++this.gestureGeneration
    this.primedGestureToken = gestureToken
    this.primedGestureReleased = false
    this.gestureExpiryTimeout = globalThis.setTimeout(() => {
      if (this.primedGestureToken === gestureToken) {
        this.cancelPrimedGesture()
      }
    }, PRIMED_GESTURE_MAX_MS)
  }

  releaseGesture(): void {
    const gestureToken = this.primedGestureToken
    if (this.destroyed || gestureToken === null) {
      return
    }

    this.primedGestureReleased = true
    const pendingVibration = this.pendingVibration
    if (pendingVibration?.gestureToken === gestureToken) {
      this.pendingVibration = null
      this.performVibration(pendingVibration.pattern)
    }
  }

  cancelPrimedGesture(): void {
    const gestureToken = this.primedGestureToken
    if (this.gestureExpiryTimeout !== null) {
      globalThis.clearTimeout(this.gestureExpiryTimeout)
      this.gestureExpiryTimeout = null
    }
    if (this.pendingSound?.gestureToken === gestureToken) {
      this.pendingSound = null
    }
    if (this.pendingVibration?.gestureToken === gestureToken) {
      this.pendingVibration = null
    }
    this.primedGestureToken = null
    this.primedGestureReleased = false
  }

  async unlock(): Promise<boolean> {
    if (
      this.destroyed ||
      this.documentObject.hidden ||
      !this.audioContextConstructor
    ) {
      return false
    }
    if (this.unlockTask) {
      return this.unlockTask
    }

    const task = this.unlockContext()
    this.unlockTask = task
    try {
      return await task
    } finally {
      if (this.unlockTask === task) {
        this.unlockTask = null
      }
    }
  }

  play(
    tones: readonly Readonly<SensoryTone>[],
    soundScale: number,
  ): boolean {
    if (this.destroyed || this.documentObject.hidden) {
      return false
    }

    const context = this.context
    const masterGain = this.masterGain
    const gestureToken = this.primedGestureToken
    const mayQueueForCurrentGesture =
      this.unlockTask !== null ||
      (gestureToken !== null && !this.primedGestureReleased)
    if (!context || !masterGain) {
      if (this.audioContextConstructor && mayQueueForCurrentGesture) {
        this.pendingSound = {
          gestureToken,
          tones: [...tones],
          soundScale,
        }
        return true
      }
      return false
    }
    if (context.state !== 'running') {
      if (context.state !== 'closed' && mayQueueForCurrentGesture) {
        // Keep only the newest cue associated with this pointer lifecycle.
        this.pendingSound = {
          gestureToken,
          tones: [...tones],
          soundScale,
        }
        return true
      }
      return false
    }

    return this.playNow(context, masterGain, tones, soundScale)
  }

  vibrate(pattern: readonly number[]): boolean {
    if (
      !this.hapticsSupported ||
      this.destroyed ||
      this.documentObject.hidden
    ) {
      return false
    }

    const gestureToken = this.primedGestureToken
    if (gestureToken !== null && !this.primedGestureReleased) {
      this.pendingVibration = {
        gestureToken,
        pattern: [...pattern],
      }
      return true
    }
    return this.performVibration(pattern)
  }

  stopSound(): void {
    this.pendingSound = null
    for (const source of this.activeSources) {
      try {
        source.stop()
      } catch {
        // The source may already have completed naturally.
      }
    }
    this.activeSources.clear()
  }

  cancelVibration(): void {
    this.pendingVibration = null
    if (!this.hapticsSupported) {
      return
    }
    try {
      this.navigatorObject.vibrate(0)
    } catch {
      // Vibration is optional and some browsers throw after backgrounding.
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }
    this.destroyed = true
    this.documentObject.removeEventListener(
      'visibilitychange',
      this.visibilityHandler,
    )
    this.cancelPrimedGesture()
    this.stopSound()
    this.cancelVibration()
    this.masterGain?.disconnect()
    this.masterGain = null
    const context = this.context
    this.context = null
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined)
    }
  }

  private performVibration(pattern: readonly number[]): boolean {
    if (
      !this.hapticsSupported ||
      this.destroyed ||
      this.documentObject.hidden
    ) {
      return false
    }
    try {
      return this.navigatorObject.vibrate([...pattern])
    } catch {
      return false
    }
  }

  private playNow(
    context: AudioContext,
    masterGain: GainNode,
    tones: readonly Readonly<SensoryTone>[],
    soundScale: number,
  ): boolean {
    if (
      this.destroyed ||
      this.documentObject.hidden ||
      this.context !== context ||
      context.state !== 'running'
    ) {
      return false
    }

    let played = false
    const now = context.currentTime + 0.005
    for (const toneSpec of tones) {
      let oscillator: OscillatorNode | null = null
      let gain: GainNode | null = null
      try {
        const startAt = now + toneSpec.startMs / 1_000
        const duration = toneSpec.durationMs / 1_000
        const endAt = startAt + duration
        const attackEnd = startAt + Math.min(0.012, duration / 3)
        oscillator = context.createOscillator()
        gain = context.createGain()

        oscillator.type = toneSpec.wave
        oscillator.frequency.setValueAtTime(toneSpec.frequency, startAt)
        oscillator.frequency.exponentialRampToValueAtTime(
          toneSpec.endFrequency,
          endAt,
        )
        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.linearRampToValueAtTime(
          Math.max(0.0001, toneSpec.gain * soundScale),
          attackEnd,
        )
        gain.gain.exponentialRampToValueAtTime(0.0001, endAt)

        oscillator.connect(gain)
        gain.connect(masterGain)
        const activeOscillator = oscillator
        const activeGain = gain
        oscillator.onended = () => {
          this.activeSources.delete(activeOscillator)
          activeOscillator.disconnect()
          activeGain.disconnect()
        }
        this.activeSources.add(oscillator)
        oscillator.start(startAt)
        oscillator.stop(endAt + 0.012)
        played = true
      } catch {
        if (oscillator) {
          this.activeSources.delete(oscillator)
          oscillator.onended = null
          try {
            oscillator.stop()
          } catch {
            // A partially started oscillator can reject a second stop.
          }
          try {
            oscillator.disconnect()
          } catch {
            // Disconnection is best effort during an AudioContext transition.
          }
        }
        if (gain) {
          try {
            gain.disconnect()
          } catch {
            // Disconnection is best effort during an AudioContext transition.
          }
        }
      }
    }
    return played
  }

  private async unlockContext(): Promise<boolean> {
    let context: AudioContext | null = null
    try {
      if (this.destroyed || this.documentObject.hidden) {
        this.pendingSound = null
        return false
      }

      if (!this.context) {
        const AudioContextClass = this.audioContextConstructor
        if (!AudioContextClass) {
          return false
        }
        context = new AudioContextClass()
        const masterGain = context.createGain()
        masterGain.gain.setValueAtTime(0.78, context.currentTime)
        masterGain.connect(context.destination)
        this.context = context
        this.masterGain = masterGain
      } else {
        context = this.context
      }

      if (context.state !== 'running' && context.state !== 'closed') {
        await context.resume()
      }

      if (
        this.destroyed ||
        this.context !== context ||
        this.documentObject.hidden
      ) {
        this.pendingSound = null
        if (context.state === 'running') {
          try {
            await context.suspend()
          } catch {
            // A destroyed or closing context may reject suspension.
          }
        }
        return false
      }

      if (context.state !== 'running' || !this.masterGain) {
        this.pendingSound = null
        return false
      }

      const pendingSound = this.pendingSound
      const pendingMatchesGesture =
        pendingSound?.gestureToken !== null &&
        pendingSound?.gestureToken === this.primedGestureToken
      const shouldFlushPending =
        pendingSound !== null &&
        (pendingMatchesGesture ||
          (pendingSound.gestureToken === null && this.unlockTask !== null))
      this.pendingSound = null
      if (pendingSound && shouldFlushPending) {
        this.playNow(
          context,
          this.masterGain,
          pendingSound.tones,
          pendingSound.soundScale,
        )
      }
      return true
    } catch {
      this.pendingSound = null
      if (
        context &&
        context !== this.context &&
        context.state !== 'closed'
      ) {
        try {
          await context.close()
        } catch {
          // A constructor-time failure still must not escape into gameplay.
        }
      }
      return false
    }
  }

  private async suspendContext(): Promise<void> {
    const context = this.context
    if (!context || context.state !== 'running') {
      return
    }
    try {
      await context.suspend()
    } catch {
      // The next trusted pointer input will retry resume.
    }
  }
}
export function createBrowserSensoryFeedback(): SensoryFeedbackController {
  let storage: Storage | null = null
  try {
    storage = window.localStorage
  } catch {
    storage = null
  }

  return new SensoryFeedbackController(
    new BrowserSensoryFeedbackOutput(window, document, navigator),
    storage,
  )
}

class NoopSensoryFeedback implements SensoryFeedback {
  readonly soundEnabled = false
  readonly hapticsEnabled = false
  readonly hapticsSupported = false

  primeForGesture(): void {}
  releaseGesture(): void {}
  cancelPrimedGesture(): void {}
  async unlock(): Promise<boolean> {
    return false
  }
  trigger(): void {}
  setSoundEnabled(): void {}
  setHapticsEnabled(): void {}
  stopAll(): void {}
  destroy(): void {}
  getDebugState(): Readonly<SensoryFeedbackDebugState> {
    return Object.freeze({
      soundEnabled: false,
      hapticsEnabled: false,
      hapticsSupported: false,
      audioState: 'unavailable',
      lastCue: null,
      triggerCount: 0,
      soundOutputCount: 0,
      hapticOutputCount: 0,
    })
  }
}

export const NOOP_SENSORY_FEEDBACK: SensoryFeedback = Object.freeze(
  new NoopSensoryFeedback(),
)

function cue(
  tones: readonly Readonly<SensoryTone>[],
  vibration: readonly number[],
): Readonly<SensoryCueSpec> {
  return Object.freeze({
    tones: Object.freeze(tones.map((toneSpec) => Object.freeze(toneSpec))),
    vibration: Object.freeze([...vibration]),
  })
}

function tone(
  wave: OscillatorType,
  frequency: number,
  endFrequency: number,
  startMs: number,
  durationMs: number,
  gain: number,
): Readonly<SensoryTone> {
  return Object.freeze({
    wave,
    frequency,
    endFrequency,
    startMs,
    durationMs,
    gain,
  })
}

import {
  loadFeedbackSettings,
  saveFeedbackSettings,
  type FeedbackSettings,
  type FeedbackSettingsStorage,
} from './feedbackSettings'
import {
  ARCADE_BGM_LOOP_STEPS,
  ARCADE_BGM_STEP_SECONDS,
  getArcadeBgmEvents,
  type MusicIntensity,
} from './arcadeBgm'

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

export interface NarrationAudioAsset {
  readonly id: string
  readonly url: string
  /** The opening rounds are fetched before the rest of the current deck. */
  readonly preloadPriority?: 'initial-round' | 'background'
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
  readonly musicRequested: boolean
  readonly musicPlaying: boolean
  readonly musicIntensity: MusicIntensity | null
  readonly musicStartCount: number
  readonly narrationPreparedCount: number
  readonly lastNarrationId: string | null
  readonly narrationRequestCount: number
  readonly narrationPlayCount: number
  readonly narrationPlaying: boolean
  readonly musicDucked: boolean
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
  startMusic(intensity: MusicIntensity): void
  stopMusic(): void
  prepareNarrations(
    assets: readonly Readonly<NarrationAudioAsset>[],
  ): Promise<void>
  playNarration(id: string): boolean
  stopNarration(): void
  setSoundEnabled(enabled: boolean): void
  setHapticsEnabled(enabled: boolean): void
  stopAll(): void
  destroy(): void
  getDebugState(): Readonly<SensoryFeedbackDebugState>
}

export interface SensoryFeedbackOutput {
  readonly audioState: SensoryAudioState
  readonly hapticsSupported: boolean
  readonly musicPlaying: boolean
  readonly musicStartCount: number
  readonly narrationPreparedCount: number
  readonly narrationPlaying: boolean
  readonly musicDucked: boolean
  primeForGesture(): void
  releaseGesture(): void
  cancelPrimedGesture(): void
  unlock(): Promise<boolean>
  play(tones: readonly Readonly<SensoryTone>[], soundScale: number): boolean
  startMusic(intensity: MusicIntensity): boolean
  stopMusic(): void
  prepareNarrations(
    assets: readonly Readonly<NarrationAudioAsset>[],
  ): Promise<void>
  playNarration(id: string): boolean
  stopNarration(): void
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
      [
        tone('sawtooth', 720, 260, 0, 62, 0.026),
        tone('square', 210, 95, 26, 72, 0.029),
        tone('sine', 320, 360, 76, 60, 0.008),
      ],
      [28],
    ),
    'slice-good': cue(
      [
        tone('sawtooth', 880, 330, 0, 68, 0.029),
        tone('triangle', 260, 120, 24, 78, 0.032),
        tone('sine', 520, 720, 76, 76, 0.012),
      ],
      [38],
    ),
    'slice-great': cue(
      [
        tone('sawtooth', 1_100, 420, 0, 72, 0.032),
        tone('square', 320, 150, 24, 86, 0.034),
        tone('sine', 780, 1_180, 70, 110, 0.017),
      ],
      [50],
    ),
    'slice-perfect': cue(
      [
        tone('sawtooth', 1_450, 500, 0, 76, 0.035),
        tone('square', 380, 165, 22, 90, 0.037),
        tone('triangle', 980, 1_540, 65, 118, 0.02),
        tone('sine', 1_520, 2_140, 118, 100, 0.014),
      ],
      [40, 22, 58],
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
  private musicRequested = false
  private musicIntensity: MusicIntensity = 'opening'
  private lastNarrationId: string | null = null
  private narrationRequestCount = 0
  private narrationPlayCount = 0

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
      const unlocked = await this.output.unlock()
      if (unlocked && this.musicRequested && this.soundEnabled) {
        this.tryStartMusic()
      }
      return unlocked
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

  startMusic(intensity: MusicIntensity): void {
    if (this.destroyed) {
      return
    }
    this.musicRequested = true
    this.musicIntensity = intensity
    if (this.soundEnabled) {
      this.tryStartMusic()
    }
  }

  stopMusic(): void {
    if (this.destroyed) {
      return
    }
    this.musicRequested = false
    this.output.stopMusic()
  }

  async prepareNarrations(
    assets: readonly Readonly<NarrationAudioAsset>[],
  ): Promise<void> {
    if (this.destroyed) {
      return
    }
    try {
      await this.output.prepareNarrations(assets)
    } catch {
      // Optional voice assets must never block the game from starting.
    }
  }

  playNarration(id: string): boolean {
    if (this.destroyed) {
      return false
    }

    this.lastNarrationId = id
    this.narrationRequestCount += 1
    if (!this.soundEnabled) {
      this.output.stopNarration()
      return false
    }

    const played = this.output.playNarration(id)
    if (played) {
      this.narrationPlayCount += 1
    }
    return played
  }

  stopNarration(): void {
    if (!this.destroyed) {
      this.output.stopNarration()
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
    } else if (this.musicRequested) {
      this.tryStartMusic()
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
    this.musicRequested = false
    this.output.cancelPrimedGesture()
    this.output.stopSound()
    this.output.cancelVibration()
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }
    this.destroyed = true
    this.musicRequested = false
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
      musicRequested: this.musicRequested,
      musicPlaying: this.output.musicPlaying,
      musicIntensity: this.musicRequested ? this.musicIntensity : null,
      musicStartCount: this.output.musicStartCount,
      narrationPreparedCount: this.output.narrationPreparedCount,
      lastNarrationId: this.lastNarrationId,
      narrationRequestCount: this.narrationRequestCount,
      narrationPlayCount: this.narrationPlayCount,
      narrationPlaying: this.output.narrationPlaying,
      musicDucked: this.output.musicDucked,
    })
  }

  private tryStartMusic(): boolean {
    return this.output.startMusic(this.musicIntensity)
  }

  private persistSettings(): void {
    saveFeedbackSettings(this.storage, this.settings)
  }
}

const PRIMED_GESTURE_MAX_MS = 2_500
const MUSIC_SCHEDULER_INTERVAL_MS = 90
const MUSIC_SCHEDULE_AHEAD_SECONDS = 0.32
const MUSIC_SCHEDULE_MAX_STEPS = 8
const MUSIC_BUS_GAIN = 0.18
const MUSIC_DUCKED_BUS_GAIN = 0.06
const MUSIC_DUCK_ATTACK_SECONDS = 0.045
const MUSIC_DUCK_RELEASE_SECONDS = 0.12
const MUSIC_EFFECT_DUCKED_BUS_GAIN = 0.09
const MUSIC_EFFECT_DUCK_ATTACK_SECONDS = 0.008
const MUSIC_EFFECT_DUCK_HOLD_SECONDS = 0.035
const MUSIC_EFFECT_DUCK_RELEASE_SECONDS = 0.2
const NARRATION_BUS_GAIN = 0.9
export const NARRATION_INITIAL_ROUND_PRELOAD_COUNT = 5
export const NARRATION_PRELOAD_CONCURRENCY = 3
export const NARRATION_CACHE_MAX_ENTRIES = 24

type AudioContextConstructor = new () => AudioContext
export type NarrationAudioLoader = (url: string) => Promise<ArrayBuffer>

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

interface CachedNarrationBytes {
  readonly url: string
  readonly bytes: ArrayBuffer
}

interface CachedNarrationBuffer {
  readonly url: string
  readonly buffer: AudioBuffer
}

interface NarrationPreparationTask {
  readonly url: string
  readonly priority: 'initial-round' | 'background'
  readonly task: Promise<void>
}

interface NarrationLoadWaiter {
  readonly priority: 'initial-round' | 'background'
  readonly resolve: (release: () => void) => void
}

interface ActiveNarrationSource {
  readonly id: string
  readonly generation: number
  readonly source: AudioBufferSourceNode
  readonly gain: GainNode
}

export class BrowserSensoryFeedbackOutput
  implements SensoryFeedbackOutput
{
  private readonly audioContextConstructor: AudioContextConstructor | null
  private readonly visibilityHandler: () => void
  private readonly narrationLoader: NarrationAudioLoader
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private musicScheduler: ReturnType<typeof setInterval> | null = null
  private musicRequested = false
  private musicIntensity: MusicIntensity = 'opening'
  private musicStepIndex = 0
  private musicNextStepAt = 0
  private musicSessionCount = 0
  private unlockTask: Promise<boolean> | null = null
  private pendingSound: PendingSound | null = null
  private pendingVibration: PendingVibration | null = null
  private gestureGeneration = 0
  private primedGestureToken: number | null = null
  private primedGestureReleased = false
  private gestureExpiryTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly activeSources = new Set<OscillatorNode>()
  private readonly activeMusicSources = new Map<OscillatorNode, GainNode>()
  private readonly narrationBytes = new Map<string, CachedNarrationBytes>()
  private readonly narrationBuffers = new Map<string, CachedNarrationBuffer>()
  private readonly narrationPreparationTasks = new Map<
    string,
    NarrationPreparationTask
  >()
  private readonly narrationScope = new Map<string, string>()
  private readonly narrationCacheAccess = new Map<string, number>()
  private narrationCacheAccessGeneration = 0
  private narrationLoadActiveCount = 0
  private readonly narrationLoadWaiters: NarrationLoadWaiter[] = []
  private activeNarration: ActiveNarrationSource | null = null
  private narrationGeneration = 0
  private musicDuckedState = false
  private musicEffectDuckUntil = 0
  private destroyed = false

  constructor(
    windowObject: Window,
    private readonly documentObject: Document,
    private readonly navigatorObject: Navigator,
    narrationLoader?: NarrationAudioLoader,
  ) {
    const audioWindow = windowObject as AudioWindow
    this.audioContextConstructor =
      audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null
    this.narrationLoader =
      narrationLoader ??
      (async (url) => {
        const response = await windowObject.fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to load narration audio: ${response.status}`)
        }
        return response.arrayBuffer()
      })
    this.visibilityHandler = () => {
      if (this.documentObject.hidden) {
        this.cancelPrimedGesture()
        this.pendingSound = null
        this.stopNarration()
        this.pauseMusic()
        this.stopEffectSources()
        this.cancelVibration()
        void this.suspendContext()
        return
      }
      if (this.musicRequested) {
        void this.resumeRequestedMusic()
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

  get musicPlaying(): boolean {
    return (
      !this.destroyed &&
      !this.documentObject.hidden &&
      this.musicScheduler !== null &&
      this.context?.state === 'running' &&
      this.musicGain !== null
    )
  }

  get musicStartCount(): number {
    return this.musicSessionCount
  }

  get narrationPreparedCount(): number {
    return this.narrationBuffers.size
  }

  get narrationPlaying(): boolean {
    return (
      !this.destroyed &&
      !this.documentObject.hidden &&
      this.context?.state === 'running' &&
      this.activeNarration !== null
    )
  }

  get musicDucked(): boolean {
    return this.musicDuckedState && this.musicGain !== null
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

  startMusic(intensity: MusicIntensity): boolean {
    if (this.destroyed) {
      return false
    }

    this.musicRequested = true
    this.musicIntensity = intensity
    if (this.documentObject.hidden) {
      return false
    }

    const context = this.context
    const masterGain = this.masterGain
    if (!context || !masterGain || context.state !== 'running') {
      return false
    }

    if (this.musicScheduler !== null && this.musicGain) {
      this.scheduleMusicWindow()
      return true
    }

    try {
      const musicGain = context.createGain()
      const narrationActive = this.activeNarration !== null
      musicGain.gain.setValueAtTime(
        narrationActive ? MUSIC_DUCKED_BUS_GAIN : MUSIC_BUS_GAIN,
        context.currentTime,
      )
      this.musicDuckedState = narrationActive
      musicGain.connect(masterGain)
      this.musicGain = musicGain
      this.musicStepIndex = 0
      this.musicNextStepAt = context.currentTime + 0.035
      this.scheduleMusicWindow()
      this.musicScheduler = globalThis.setInterval(() => {
        this.scheduleMusicWindow()
      }, MUSIC_SCHEDULER_INTERVAL_MS)
      this.musicSessionCount += 1
      return true
    } catch {
      this.pauseMusic()
      return false
    }
  }

  stopMusic(): void {
    this.musicRequested = false
    this.pauseMusic()
  }

  async prepareNarrations(
    assets: readonly Readonly<NarrationAudioAsset>[],
  ): Promise<void> {
    if (this.destroyed) {
      return
    }

    const uniqueAssets = new Map<string, Readonly<NarrationAudioAsset>>()
    for (const asset of assets) {
      const id = asset.id.trim()
      const url = asset.url.trim()
      if (id && url) {
        uniqueAssets.set(id, {
          id,
          url,
          preloadPriority:
            asset.preloadPriority === 'initial-round'
              ? 'initial-round'
              : 'background',
        })
      }
    }

    const orderedAssets = [...uniqueAssets.values()]
    this.updateNarrationScope(orderedAssets)
    const initialAssets = orderedAssets.filter(
      (asset) => asset.preloadPriority === 'initial-round',
    )
    const backgroundAssets = orderedAssets.filter(
      (asset) => asset.preloadPriority !== 'initial-round',
    )

    await this.prepareNarrationBatch(initialAssets, 'initial-round')
    await this.prepareNarrationBatch(backgroundAssets, 'background')
    this.evictNarrationCaches()
  }

  playNarration(id: string): boolean {
    this.stopNarration()
    if (this.destroyed || this.documentObject.hidden) {
      return false
    }

    const context = this.context
    const masterGain = this.masterGain
    const cached = this.narrationBuffers.get(id)
    if (!context || !masterGain || !cached || context.state !== 'running') {
      return false
    }
    this.touchNarrationCache(id)

    const generation = ++this.narrationGeneration
    let source: AudioBufferSourceNode | null = null
    let gain: GainNode | null = null
    try {
      source = context.createBufferSource()
      gain = context.createGain()
      source.buffer = cached.buffer
      gain.gain.setValueAtTime(NARRATION_BUS_GAIN, context.currentTime)
      source.connect(gain)
      gain.connect(masterGain)

      const active: ActiveNarrationSource = {
        id,
        generation,
        source,
        gain,
      }
      this.activeNarration = active
      source.onended = () => this.finishNarration(active)
      source.start(context.currentTime + 0.005)
      this.duckMusicForNarration(generation)
      return true
    } catch {
      if (source) {
        source.onended = null
        try {
          source.stop()
        } catch {
          // A partially started source can reject a second stop.
        }
        try {
          source.disconnect()
        } catch {
          // Disconnection is best effort after a failed source start.
        }
      }
      try {
        gain?.disconnect()
      } catch {
        // Disconnection is best effort after a failed source start.
      }
      if (this.activeNarration?.generation === generation) {
        this.activeNarration = null
      }
      this.restoreMusicAfterNarration(generation)
      return false
    }
  }

  stopNarration(): void {
    const generation = ++this.narrationGeneration
    const active = this.activeNarration
    this.activeNarration = null
    if (active) {
      active.source.onended = null
      try {
        active.source.stop()
      } catch {
        // The clip may already have completed naturally.
      }
      try {
        active.source.disconnect()
      } catch {
        // Disconnection is best effort during a context transition.
      }
      try {
        active.gain.disconnect()
      } catch {
        // Disconnection is best effort during a context transition.
      }
    }
    this.evictNarrationCaches()
    this.restoreMusicAfterNarration(generation)
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
    this.stopNarration()
    this.stopMusic()
    this.stopEffectSources()
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
    this.narrationBytes.clear()
    this.narrationBuffers.clear()
    this.narrationPreparationTasks.clear()
    this.narrationScope.clear()
    this.narrationCacheAccess.clear()
    for (const waiter of this.narrationLoadWaiters.splice(0)) {
      waiter.resolve(() => undefined)
    }
    const context = this.context
    this.context = null
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined)
    }
  }

  private updateNarrationScope(
    assets: readonly Readonly<NarrationAudioAsset>[],
  ): void {
    this.narrationScope.clear()
    for (const asset of assets) {
      this.narrationScope.set(asset.id, asset.url)
    }

    for (const [id, task] of this.narrationPreparationTasks) {
      if (this.narrationScope.get(id) !== task.url) {
        // The loader cannot always be aborted, but the identity guard prevents
        // a late response from entering the new deck's cache.
        this.narrationPreparationTasks.delete(id)
      }
    }
    this.evictNarrationCaches()
  }

  private async prepareNarrationBatch(
    assets: readonly Readonly<NarrationAudioAsset>[],
    priority: 'initial-round' | 'background',
  ): Promise<void> {
    let nextIndex = 0
    const workerCount = Math.min(NARRATION_PRELOAD_CONCURRENCY, assets.length)
    const workers = Array.from({ length: workerCount }, async () => {
      while (nextIndex < assets.length) {
        const asset = assets[nextIndex]
        nextIndex += 1
        if (!asset) {
          return
        }
        try {
          await this.prepareNarrationAsset(asset, priority)
        } catch {
          // A missing optional voice clip keeps the caption fallback active.
        }
      }
    })
    await Promise.all(workers)
  }

  private async prepareNarrationAsset(
    asset: Readonly<NarrationAudioAsset>,
    priority: 'initial-round' | 'background',
  ): Promise<void> {
    if (this.narrationScope.get(asset.id) !== asset.url) {
      return
    }

    const prepared = this.narrationBuffers.get(asset.id)
    if (prepared?.url === asset.url) {
      this.touchNarrationCache(asset.id)
      return
    }

    const bytes = this.narrationBytes.get(asset.id)
    if (bytes?.url === asset.url) {
      this.touchNarrationCache(asset.id)
      const context = this.context
      if (context && context.state !== 'closed') {
        await this.decodeNarrationBytes(asset.id, bytes, context)
      }
      return
    }

    const existingTask = this.narrationPreparationTasks.get(asset.id)
    if (existingTask?.url === asset.url) {
      if (
        priority !== 'initial-round' ||
        existingTask.priority === 'initial-round'
      ) {
        await existingTask.task
        return
      }
      // Upgrade a queued background fetch when it becomes an opening-round clip.
      this.narrationPreparationTasks.delete(asset.id)
    }

    this.narrationBuffers.delete(asset.id)
    this.narrationBytes.delete(asset.id)
    this.narrationCacheAccess.delete(asset.id)
    let taskRecord: NarrationPreparationTask | null = null
    const task = (async () => {
      const releaseLoadSlot = await this.acquireNarrationLoadSlot(priority)
      let loadedBytes: ArrayBuffer | null = null
      try {
        const currentTask = this.narrationPreparationTasks.get(asset.id)
        if (
          this.destroyed ||
          taskRecord === null ||
          currentTask !== taskRecord ||
          this.narrationScope.get(asset.id) !== asset.url
        ) {
          return
        }
        loadedBytes = await this.narrationLoader(asset.url)
      } finally {
        releaseLoadSlot()
      }

      const currentTask = this.narrationPreparationTasks.get(asset.id)
      if (
        loadedBytes === null ||
        this.destroyed ||
        taskRecord === null ||
        currentTask !== taskRecord ||
        currentTask?.url !== asset.url ||
        this.narrationScope.get(asset.id) !== asset.url
      ) {
        return
      }
      const cachedBytes = { url: asset.url, bytes: loadedBytes.slice(0) }
      this.narrationBytes.set(asset.id, cachedBytes)
      this.touchNarrationCache(asset.id)
      const context = this.context
      if (context && context.state !== 'closed') {
        await this.decodeNarrationBytes(asset.id, cachedBytes, context)
      }
      this.evictNarrationCaches()
    })()
    taskRecord = { url: asset.url, priority, task }
    this.narrationPreparationTasks.set(asset.id, taskRecord)
    try {
      await task
    } finally {
      if (this.narrationPreparationTasks.get(asset.id) === taskRecord) {
        this.narrationPreparationTasks.delete(asset.id)
      }
    }
  }

  private acquireNarrationLoadSlot(
    priority: 'initial-round' | 'background',
  ): Promise<() => void> {
    if (this.destroyed) {
      return Promise.resolve(() => undefined)
    }
    if (this.narrationLoadActiveCount < NARRATION_PRELOAD_CONCURRENCY) {
      this.narrationLoadActiveCount += 1
      return Promise.resolve(this.createNarrationLoadSlotRelease())
    }
    return new Promise((resolve) => {
      this.narrationLoadWaiters.push({ priority, resolve })
    })
  }

  private createNarrationLoadSlotRelease(): () => void {
    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      const initialIndex = this.narrationLoadWaiters.findIndex(
        (waiter) => waiter.priority === 'initial-round',
      )
      const nextIndex = initialIndex >= 0 ? initialIndex : 0
      const next = this.narrationLoadWaiters.splice(nextIndex, 1)[0]
      if (next) {
        next.resolve(this.createNarrationLoadSlotRelease())
        return
      }
      this.narrationLoadActiveCount = Math.max(
        0,
        this.narrationLoadActiveCount - 1,
      )
    }
  }

  private touchNarrationCache(id: string): void {
    this.narrationCacheAccess.set(id, ++this.narrationCacheAccessGeneration)
  }

  private evictNarrationCaches(): void {
    const activeId = this.activeNarration?.id ?? null
    const cachedIds = new Set([
      ...this.narrationBytes.keys(),
      ...this.narrationBuffers.keys(),
    ])

    for (const id of cachedIds) {
      if (id === activeId) {
        continue
      }
      const expectedUrl = this.narrationScope.get(id)
      const bytes = this.narrationBytes.get(id)
      const buffer = this.narrationBuffers.get(id)
      if (
        expectedUrl === undefined ||
        (bytes !== undefined && bytes.url !== expectedUrl) ||
        (buffer !== undefined && buffer.url !== expectedUrl)
      ) {
        this.deleteNarrationCacheEntry(id)
      }
    }

    const retainedIds = new Set([
      ...this.narrationBytes.keys(),
      ...this.narrationBuffers.keys(),
    ])
    const evictionCandidates = [...retainedIds]
      .filter((id) => id !== activeId)
      .sort(
        (left, right) =>
          (this.narrationCacheAccess.get(left) ?? 0) -
          (this.narrationCacheAccess.get(right) ?? 0),
      )
    while (
      retainedIds.size > NARRATION_CACHE_MAX_ENTRIES &&
      evictionCandidates.length > 0
    ) {
      const id = evictionCandidates.shift()
      if (!id) {
        break
      }
      this.deleteNarrationCacheEntry(id)
      retainedIds.delete(id)
    }

    for (const id of this.narrationCacheAccess.keys()) {
      if (
        !this.narrationBytes.has(id) &&
        !this.narrationBuffers.has(id)
      ) {
        this.narrationCacheAccess.delete(id)
      }
    }
  }

  private deleteNarrationCacheEntry(id: string): void {
    this.narrationBytes.delete(id)
    this.narrationBuffers.delete(id)
    this.narrationCacheAccess.delete(id)
  }

  private async decodeNarrationBytes(
    id: string,
    cached: CachedNarrationBytes,
    context: AudioContext,
  ): Promise<void> {
    if (
      this.destroyed ||
      context.state === 'closed' ||
      this.narrationBuffers.get(id)?.url === cached.url
    ) {
      return
    }

    try {
      const buffer = await context.decodeAudioData(cached.bytes.slice(0))
      if (
        !this.destroyed &&
        this.context === context &&
        this.narrationBytes.get(id) === cached
      ) {
        this.narrationBuffers.set(id, { url: cached.url, buffer })
        this.touchNarrationCache(id)
        this.evictNarrationCaches()
      }
    } catch {
      // An unsupported or corrupt optional voice file falls back to captions.
    }
  }

  private async decodeCachedNarrations(context: AudioContext): Promise<void> {
    await Promise.allSettled(
      [...this.narrationBytes].map(([id, cached]) =>
        this.decodeNarrationBytes(id, cached, context),
      ),
    )
  }

  private finishNarration(active: ActiveNarrationSource): void {
    active.source.onended = null
    try {
      active.source.disconnect()
    } catch {
      // Disconnection is best effort when the context is interrupted.
    }
    try {
      active.gain.disconnect()
    } catch {
      // Disconnection is best effort when the context is interrupted.
    }

    if (this.activeNarration === active) {
      this.activeNarration = null
    }
    this.evictNarrationCaches()
    this.restoreMusicAfterNarration(active.generation)
  }

  private duckMusicForNarration(generation: number): void {
    if (
      generation !== this.narrationGeneration ||
      this.activeNarration?.generation !== generation
    ) {
      return
    }
    if (
      this.setMusicBusGain(MUSIC_DUCKED_BUS_GAIN, MUSIC_DUCK_ATTACK_SECONDS)
    ) {
      this.musicDuckedState = true
    }
  }

  private restoreMusicAfterNarration(generation: number): void {
    if (
      generation !== this.narrationGeneration ||
      this.activeNarration !== null
    ) {
      return
    }
    this.musicDuckedState = false
    const context = this.context
    const musicGain = this.musicGain
    if (
      context &&
      musicGain &&
      context.state === 'running' &&
      this.musicEffectDuckUntil > context.currentTime
    ) {
      try {
        const parameter = musicGain.gain
        this.cancelMusicBusAutomation(
          parameter,
          context,
          MUSIC_DUCKED_BUS_GAIN,
        )
        parameter.setValueAtTime(
          MUSIC_DUCKED_BUS_GAIN,
          this.musicEffectDuckUntil,
        )
        parameter.linearRampToValueAtTime(
          MUSIC_BUS_GAIN,
          this.musicEffectDuckUntil + MUSIC_EFFECT_DUCK_RELEASE_SECONDS,
        )
        return
      } catch {
        // Fall through to the normal narration release below.
      }
    }
    this.setMusicBusGain(MUSIC_BUS_GAIN, MUSIC_DUCK_RELEASE_SECONDS)
  }

  private duckMusicForEffect(
    tones: readonly Readonly<SensoryTone>[],
  ): void {
    const context = this.context
    const musicGain = this.musicGain
    if (
      !context ||
      !musicGain ||
      context.state !== 'running' ||
      tones.length === 0
    ) {
      return
    }

    const effectTailSeconds = Math.max(
      ...tones.map(
        (toneSpec) =>
          (toneSpec.startMs + toneSpec.durationMs) / 1_000,
      ),
    )
    this.musicEffectDuckUntil = Math.max(
      this.musicEffectDuckUntil,
      context.currentTime +
        0.005 +
        effectTailSeconds +
        MUSIC_EFFECT_DUCK_HOLD_SECONDS,
    )

    // Narration already owns the lower-priority music mix. Its restoration
    // path observes musicEffectDuckUntil if the voice ends during this cue.
    if (this.activeNarration !== null) {
      return
    }

    try {
      const parameter = musicGain.gain
      this.cancelMusicBusAutomation(parameter, context, MUSIC_BUS_GAIN)
      parameter.linearRampToValueAtTime(
        MUSIC_EFFECT_DUCKED_BUS_GAIN,
        context.currentTime + MUSIC_EFFECT_DUCK_ATTACK_SECONDS,
      )
      parameter.setValueAtTime(
        MUSIC_EFFECT_DUCKED_BUS_GAIN,
        this.musicEffectDuckUntil,
      )
      parameter.linearRampToValueAtTime(
        MUSIC_BUS_GAIN,
        this.musicEffectDuckUntil + MUSIC_EFFECT_DUCK_RELEASE_SECONDS,
      )
    } catch {
      // Optional music ducking must never suppress the effect itself.
    }
  }

  private setMusicBusGain(target: number, rampSeconds: number): boolean {
    const context = this.context
    const musicGain = this.musicGain
    if (!context || !musicGain || context.state !== 'running') {
      return false
    }

    try {
      const parameter = musicGain.gain
      this.cancelMusicBusAutomation(parameter, context, MUSIC_BUS_GAIN)
      parameter.linearRampToValueAtTime(
        target,
        context.currentTime + rampSeconds,
      )
      return true
    } catch {
      return false
    }
  }

  private cancelMusicBusAutomation(
    parameter: AudioParam,
    context: AudioContext,
    fallbackValue: number,
  ): void {
    const cancellable = parameter as AudioParam & {
      cancelAndHoldAtTime?: (cancelTime: number) => AudioParam
      cancelScheduledValues?: (startTime: number) => AudioParam
    }
    if (typeof cancellable.cancelAndHoldAtTime === 'function') {
      cancellable.cancelAndHoldAtTime(context.currentTime)
      return
    }

    cancellable.cancelScheduledValues?.(context.currentTime)
    const currentValue = Number.isFinite(parameter.value)
      ? Math.max(0.0001, parameter.value)
      : fallbackValue
    parameter.setValueAtTime(currentValue, context.currentTime)
  }

  private pauseMusic(): void {
    if (this.musicScheduler !== null) {
      globalThis.clearInterval(this.musicScheduler)
      this.musicScheduler = null
    }
    for (const [source, gain] of this.activeMusicSources) {
      source.onended = null
      try {
        source.stop()
      } catch {
        // The scheduled source may already have completed naturally.
      }
      try {
        source.disconnect()
      } catch {
        // Disconnection is best effort during an AudioContext transition.
      }
      try {
        gain.disconnect()
      } catch {
        // Disconnection is best effort during an AudioContext transition.
      }
    }
    this.activeMusicSources.clear()
    try {
      this.musicGain?.disconnect()
    } catch {
      // Disconnection is best effort during an AudioContext transition.
    }
    this.musicGain = null
    this.musicDuckedState = false
    this.musicEffectDuckUntil = 0
    this.musicStepIndex = 0
    this.musicNextStepAt = 0
  }

  private stopEffectSources(): void {
    for (const source of this.activeSources) {
      try {
        source.stop()
      } catch {
        // The source may already have completed naturally.
      }
    }
    this.activeSources.clear()
  }

  private async resumeRequestedMusic(): Promise<void> {
    const context = this.context
    if (
      !this.musicRequested ||
      this.destroyed ||
      this.documentObject.hidden ||
      !context ||
      context.state === 'closed'
    ) {
      return
    }
    try {
      if (context.state !== 'running') {
        await context.resume()
      }
      if (
        this.musicRequested &&
        !this.destroyed &&
        !this.documentObject.hidden &&
        this.context === context &&
        context.state === 'running'
      ) {
        this.startMusic(this.musicIntensity)
      }
    } catch {
      // iOS may require the next trusted gesture; the request stays pending.
    }
  }

  private scheduleMusicWindow(): void {
    const context = this.context
    const musicGain = this.musicGain
    if (
      this.destroyed ||
      this.documentObject.hidden ||
      !context ||
      !musicGain ||
      context.state !== 'running'
    ) {
      return
    }

    if (
      this.musicNextStepAt <
      context.currentTime - ARCADE_BGM_STEP_SECONDS
    ) {
      this.musicNextStepAt = context.currentTime + 0.035
    }

    const scheduleUntil = context.currentTime + MUSIC_SCHEDULE_AHEAD_SECONDS
    let scheduledSteps = 0
    while (
      this.musicNextStepAt <= scheduleUntil &&
      scheduledSteps < MUSIC_SCHEDULE_MAX_STEPS
    ) {
      this.scheduleMusicStep(
        context,
        musicGain,
        this.musicNextStepAt,
        this.musicStepIndex,
      )
      this.musicNextStepAt += ARCADE_BGM_STEP_SECONDS
      this.musicStepIndex =
        (this.musicStepIndex + 1) % ARCADE_BGM_LOOP_STEPS
      scheduledSteps += 1
    }
  }

  private scheduleMusicStep(
    context: AudioContext,
    musicGain: GainNode,
    startAt: number,
    stepIndex: number,
  ): void {
    const events = getArcadeBgmEvents(stepIndex, this.musicIntensity)
    for (const event of events) {
      let oscillator: OscillatorNode | null = null
      let noteGain: GainNode | null = null
      try {
        const duration = Math.max(
          0.05,
          event.durationSteps * ARCADE_BGM_STEP_SECONDS * 0.88,
        )
        const endAt = startAt + duration
        const attackEnd = startAt + Math.min(0.008, duration / 4)
        oscillator = context.createOscillator()
        noteGain = context.createGain()
        oscillator.type = event.wave
        oscillator.frequency.setValueAtTime(event.frequency, startAt)
        oscillator.frequency.exponentialRampToValueAtTime(
          event.endFrequency,
          endAt,
        )
        noteGain.gain.setValueAtTime(0.0001, startAt)
        noteGain.gain.linearRampToValueAtTime(event.gain, attackEnd)
        noteGain.gain.exponentialRampToValueAtTime(0.0001, endAt)
        oscillator.connect(noteGain)
        noteGain.connect(musicGain)
        const activeOscillator = oscillator
        const activeGain = noteGain
        oscillator.onended = () => {
          this.activeMusicSources.delete(activeOscillator)
          activeOscillator.disconnect()
          activeGain.disconnect()
        }
        this.activeMusicSources.set(activeOscillator, activeGain)
        oscillator.start(startAt)
        oscillator.stop(endAt + 0.012)
      } catch {
        if (oscillator) {
          this.activeMusicSources.delete(oscillator)
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
        if (noteGain) {
          try {
            noteGain.disconnect()
          } catch {
            // Disconnection is best effort during an AudioContext transition.
          }
        }
      }
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
    if (played) {
      this.duckMusicForEffect(tones)
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

      await this.decodeCachedNarrations(context)
      if (
        this.destroyed ||
        this.context !== context ||
        this.documentObject.hidden ||
        context.state !== 'running'
      ) {
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
  readonly musicPlaying = false
  readonly musicStartCount = 0

  primeForGesture(): void {}
  releaseGesture(): void {}
  cancelPrimedGesture(): void {}
  async unlock(): Promise<boolean> {
    return false
  }
  trigger(): void {}
  startMusic(): void {}
  stopMusic(): void {}
  async prepareNarrations(): Promise<void> {}
  playNarration(): boolean {
    return false
  }
  stopNarration(): void {}
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
      musicRequested: false,
      musicPlaying: false,
      musicIntensity: null,
      musicStartCount: 0,
      narrationPreparedCount: 0,
      lastNarrationId: null,
      narrationRequestCount: 0,
      narrationPlayCount: 0,
      narrationPlaying: false,
      musicDucked: false,
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

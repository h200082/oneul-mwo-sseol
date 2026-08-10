export type MusicIntensity =
  | 'opening'
  | 'rotation'
  | 'final-five'
  | 'final-two'

export type ArcadeBgmWave = 'sine' | 'square' | 'triangle'

export interface ArcadeBgmEvent {
  readonly wave: ArcadeBgmWave
  readonly frequency: number
  readonly endFrequency: number
  readonly durationSteps: number
  readonly gain: number
}

export const ARCADE_BGM_BPM = 120
export const ARCADE_BGM_STEPS_PER_BEAT = 4
export const ARCADE_BGM_LOOP_STEPS = 64
export const ARCADE_BGM_STEP_SECONDS =
  60 / ARCADE_BGM_BPM / ARCADE_BGM_STEPS_PER_BEAT

export const ARCADE_BGM_INTENSITIES: readonly MusicIntensity[] = Object.freeze([
  'opening',
  'rotation',
  'final-five',
  'final-two',
])

type ArcadeBgmScore = readonly (readonly Readonly<ArcadeBgmEvent>[])[]

// An original four-bar kitchen-arcade loop using only the G-major pentatonic
// notes G, A, B, D, and E. Every onset occupies its own score step and stays
// below 400 Hz, leaving the bright range open for slicing, capture, and voice.
// Later phases add short syncopated pickups instead of stacking higher leads.
const BASS_MIDI = [55, 50, 52, 50, 52, 50, 50, 55] as const
const PLUCK_MIDI = [62, 67, 64, 59, 62, 67, 57, 62] as const
const ROTATION_PULSE_MIDI = [59, 62, 57, 59, 62, 64, 59, 57] as const
const FINAL_FIVE_CHOP_MIDI = [62, 59, 64, 62, 59, 57, 62, 64] as const
const FINAL_TWO_SYNC_MIDI = [59, 62, 57, 59, 62, 64, 59, 57] as const

const BASS_EVENTS = createVoice(BASS_MIDI, 'triangle', 3, 0.044)
const PLUCK_EVENTS = createVoice(PLUCK_MIDI, 'square', 2, 0.012)
const ROTATION_PULSE_EVENTS = createVoice(
  ROTATION_PULSE_MIDI,
  'sine',
  1,
  0.01,
)
const FINAL_FIVE_CHOP_EVENTS = createVoice(
  FINAL_FIVE_CHOP_MIDI,
  'triangle',
  1,
  0.008,
)
const FINAL_TWO_SYNC_EVENTS = createVoice(
  FINAL_TWO_SYNC_MIDI,
  'square',
  1,
  0.006,
)

const SCORE_BY_INTENSITY: Readonly<Record<MusicIntensity, ArcadeBgmScore>> =
  Object.freeze({
    opening: createScore(0),
    rotation: createScore(1),
    'final-five': createScore(2),
    'final-two': createScore(3),
  })

/**
 * Returns the immutable notes that begin on one 16th-note score step.
 *
 * Step indices wrap in both directions, making the function exactly periodic
 * over the 64-step loop. A non-finite scheduler value safely restarts at step
 * zero instead of allowing invalid numbers into the audio graph.
 */
export function getArcadeBgmEvents(
  stepIndex: number,
  intensity: MusicIntensity,
): readonly Readonly<ArcadeBgmEvent>[] {
  const normalizedStep = normalizeStep(stepIndex)
  return SCORE_BY_INTENSITY[intensity][normalizedStep]!
}

export function getRoundMusicIntensity(roundIndex: number): MusicIntensity {
  if (!Number.isInteger(roundIndex) || roundIndex < 0) {
    throw new RangeError('Round index must be a non-negative integer.')
  }
  if (roundIndex < 5) {
    return 'opening'
  }
  if (roundIndex < 15) {
    return 'rotation'
  }
  if (roundIndex < 18) {
    return 'final-five'
  }
  return 'final-two'
}

function createScore(highestLayer: 0 | 1 | 2 | 3): ArcadeBgmScore {
  const score = Array.from({ length: ARCADE_BGM_LOOP_STEPS }, (_, step) => {
    const events: Readonly<ArcadeBgmEvent>[] = []

    if (step % 8 === 0) {
      events.push(BASS_EVENTS[step / 8]!)
    }
    if (step % 8 === 4) {
      events.push(PLUCK_EVENTS[(step - 4) / 8]!)
    }
    if (highestLayer >= 1 && step % 8 === 6) {
      events.push(ROTATION_PULSE_EVENTS[(step - 6) / 8]!)
    }
    if (highestLayer >= 2 && step % 8 === 2) {
      events.push(FINAL_FIVE_CHOP_EVENTS[(step - 2) / 8]!)
    }
    if (highestLayer >= 3 && step % 8 === 3) {
      events.push(FINAL_TWO_SYNC_EVENTS[(step - 3) / 8]!)
    }

    return Object.freeze(events)
  })

  return Object.freeze(score)
}

function createVoice(
  midiNotes: readonly number[],
  wave: ArcadeBgmWave,
  durationSteps: number,
  gain: number,
): readonly Readonly<ArcadeBgmEvent>[] {
  return Object.freeze(
    midiNotes.map((midiNote) => {
      const frequency = midiToFrequency(midiNote)
      return Object.freeze({
        wave,
        frequency,
        endFrequency: frequency,
        durationSteps,
        gain,
      })
    }),
  )
}

function midiToFrequency(midiNote: number): number {
  return 440 * 2 ** ((midiNote - 69) / 12)
}

function normalizeStep(stepIndex: number): number {
  if (!Number.isFinite(stepIndex)) {
    return 0
  }

  const integerStep = Math.trunc(stepIndex)
  return (
    (integerStep % ARCADE_BGM_LOOP_STEPS + ARCADE_BGM_LOOP_STEPS) %
    ARCADE_BGM_LOOP_STEPS
  )
}

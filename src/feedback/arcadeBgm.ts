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

export const ARCADE_BGM_BPM = 128
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

// An original four-bar pattern built only from the G-major pentatonic notes
// G, A, B, D, and E. Each later score keeps every earlier voice and adds one
// rhythmic layer, so game intensity can rise without changing the clock.
const BASS_MIDI = [55, 55, 52, 52, 47, 47, 50, 50] as const
const PLUCK_MIDI = [
  67, 71, 74, 71,
  64, 67, 71, 74,
  59, 62, 67, 71,
  62, 69, 71, 74,
] as const
const ROTATION_ECHO_MIDI = [
  74, 71, 76, 74,
  71, 74, 76, 79,
  62, 67, 71, 74,
  69, 71, 74, 79,
] as const
const FINAL_FIVE_LEAD_MIDI = [
  79, 81, 83, 86, 83, 81, 79, 74,
  76, 79, 81, 83, 86, 83, 81, 76,
  71, 74, 79, 81, 83, 86, 83, 79,
  74, 76, 79, 81, 83, 81, 79, 74,
] as const
const FINAL_TWO_DRIVE_MIDI = [
  79, 83, 86, 83, 81, 83, 86, 88,
  76, 79, 83, 86, 88, 86, 83, 79,
  71, 74, 79, 83, 86, 83, 79, 74,
  74, 81, 83, 86, 88, 86, 83, 81,
] as const

const BASS_EVENTS = createVoice(BASS_MIDI, 'triangle', 6, 0.055)
const PLUCK_EVENTS = createVoice(PLUCK_MIDI, 'square', 2, 0.032)
const ROTATION_ECHO_EVENTS = createVoice(
  ROTATION_ECHO_MIDI,
  'sine',
  1,
  0.022,
)
const FINAL_FIVE_LEAD_EVENTS = createVoice(
  FINAL_FIVE_LEAD_MIDI,
  'square',
  1,
  0.016,
)
const FINAL_TWO_DRIVE_EVENTS = createVoice(
  FINAL_TWO_DRIVE_MIDI,
  'triangle',
  1,
  0.014,
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
    if (step % 4 === 0) {
      events.push(PLUCK_EVENTS[step / 4]!)
    }
    if (highestLayer >= 1 && step % 4 === 2) {
      events.push(ROTATION_ECHO_EVENTS[(step - 2) / 4]!)
    }
    if (highestLayer >= 2 && step % 2 === 1) {
      events.push(FINAL_FIVE_LEAD_EVENTS[(step - 1) / 2]!)
    }
    if (highestLayer >= 3 && step % 2 === 0) {
      events.push(FINAL_TWO_DRIVE_EVENTS[step / 2]!)
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

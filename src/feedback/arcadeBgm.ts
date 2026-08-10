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

export const ARCADE_BGM_BPM = 152
export const ARCADE_BGM_STEPS_PER_BEAT = 4
export const ARCADE_BGM_LOOP_STEPS = 128
export const ARCADE_BGM_GAIN_SCALE = 1.2
export const ARCADE_BGM_STEP_SECONDS =
  60 / ARCADE_BGM_BPM / ARCADE_BGM_STEPS_PER_BEAT

export const ARCADE_BGM_INTENSITIES: readonly MusicIntensity[] = Object.freeze([
  'opening',
  'rotation',
  'final-five',
  'final-two',
])

type ArcadeBgmScore = readonly (readonly Readonly<ArcadeBgmEvent>[])[]

interface VoicePattern {
  readonly offsets: readonly number[]
  readonly wave: ArcadeBgmWave
  readonly durationSteps: readonly number[]
  readonly gains: readonly number[]
  readonly startMidiByBar: readonly (readonly number[])[]
  readonly endMidiByBar?: readonly (readonly number[])[]
}

const BAR_COUNT = 8
const STEPS_PER_BAR = 16

// An original eight-bar G-major kitchen-arcade loop. The opening is already
// driven by kick, snare, syncopated bass, and a square-wave lead. Later game
// phases add arpeggios, hats, a counter melody, and an octave rush without
// replacing earlier layers, so intensity rises continuously with the round.
const KICK_PATTERN = createPattern(
  [0, 6, 8, 14],
  'sine',
  [2, 1, 2, 1],
  [0.11, 0.085, 0.11, 0.085],
  repeatAcrossBars([43, 43, 43, 43]),
  repeatAcrossBars([31, 31, 31, 31]),
)

const SNARE_PATTERN = createPattern(
  [4, 12],
  'triangle',
  [1, 1],
  [0.05, 0.055],
  repeatAcrossBars([76, 79]),
  repeatAcrossBars([52, 55]),
)

const BASS_PATTERN = createPattern(
  [0, 3, 6, 8, 11, 12, 14],
  'triangle',
  [2, 1, 2, 2, 1, 1, 2],
  [0.075, 0.05, 0.065, 0.075, 0.05, 0.058, 0.068],
  [
    [55, 55, 62, 55, 59, 62, 55],
    [50, 50, 57, 50, 54, 57, 50],
    [52, 52, 59, 52, 55, 59, 52],
    [48, 48, 55, 48, 52, 55, 48],
    [55, 55, 62, 55, 59, 62, 55],
    [50, 50, 57, 50, 54, 57, 50],
    [48, 48, 55, 48, 52, 55, 48],
    [50, 50, 57, 50, 54, 57, 62],
  ],
)

const LEAD_PATTERN = createPattern(
  [2, 5, 7, 10, 13, 15],
  'square',
  [2, 1, 2, 2, 1, 1],
  [0.045, 0.032, 0.04, 0.05, 0.032, 0.038],
  [
    [67, 71, 74, 71, 69, 67],
    [66, 69, 74, 78, 76, 74],
    [64, 67, 71, 76, 74, 71],
    [64, 67, 72, 76, 74, 72],
    [67, 71, 74, 79, 76, 74],
    [69, 74, 78, 81, 78, 74],
    [67, 72, 76, 79, 76, 72],
    [69, 74, 78, 81, 78, 74],
  ],
)

const ARPEGGIO_PATTERN = createPattern(
  [0, 2, 4, 6, 8, 10, 12, 14],
  'square',
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0.025, 0.017, 0.02, 0.017, 0.023, 0.017, 0.02, 0.017],
  [
    [67, 71, 74, 79, 74, 71, 74, 79],
    [66, 69, 74, 78, 74, 69, 74, 78],
    [64, 67, 71, 76, 71, 67, 71, 76],
    [64, 67, 72, 76, 72, 67, 72, 76],
    [67, 71, 74, 79, 74, 71, 74, 79],
    [66, 69, 74, 78, 74, 69, 74, 78],
    [64, 67, 72, 76, 72, 67, 72, 76],
    [66, 69, 74, 78, 74, 69, 74, 78],
  ],
)

const CLOSED_HAT_PATTERN = createPattern(
  [1, 3, 5, 7, 9, 11, 13, 15],
  'square',
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0.008, 0.005, 0.007, 0.005, 0.008, 0.005, 0.007, 0.005],
  repeatAcrossBars([96, 91, 96, 91, 98, 91, 96, 91]),
  repeatAcrossBars([84, 79, 84, 79, 86, 79, 84, 79]),
)

const COUNTER_PATTERN = createPattern(
  [1, 4, 9, 12],
  'triangle',
  [1, 2, 1, 2],
  [0.028, 0.035, 0.028, 0.035],
  [
    [74, 71, 79, 74],
    [69, 66, 74, 78],
    [71, 67, 76, 71],
    [67, 64, 72, 76],
    [74, 71, 79, 83],
    [69, 74, 78, 81],
    [67, 72, 76, 79],
    [69, 74, 78, 81],
  ],
)

const OPEN_HAT_PATTERN = createPattern(
  [6, 14],
  'square',
  [1, 1],
  [0.01, 0.012],
  repeatAcrossBars([96, 95]),
  repeatAcrossBars([84, 83]),
)

const OCTAVE_RUSH_PATTERN = createPattern(
  [1, 5, 9, 13],
  'square',
  [1, 1, 1, 1],
  [0.012, 0.014, 0.012, 0.016],
  [
    [79, 83, 86, 91],
    [78, 81, 86, 90],
    [76, 79, 83, 88],
    [76, 79, 84, 88],
    [79, 83, 86, 91],
    [78, 81, 86, 90],
    [76, 79, 84, 88],
    [78, 81, 86, 90],
  ],
)

const GHOST_KICK_PATTERN = createPattern(
  [3, 11],
  'sine',
  [1, 1],
  [0.045, 0.055],
  repeatAcrossBars([40, 43]),
  repeatAcrossBars([31, 31]),
)

const PATTERN_LAYERS: readonly (readonly VoicePattern[])[] = Object.freeze([
  Object.freeze([KICK_PATTERN, SNARE_PATTERN, BASS_PATTERN, LEAD_PATTERN]),
  Object.freeze([ARPEGGIO_PATTERN, CLOSED_HAT_PATTERN]),
  Object.freeze([COUNTER_PATTERN, OPEN_HAT_PATTERN]),
  Object.freeze([OCTAVE_RUSH_PATTERN, GHOST_KICK_PATTERN]),
])

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
 * over the 128-step loop. A non-finite scheduler value safely restarts at step
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
    const barIndex = Math.floor(step / STEPS_PER_BAR)
    const offset = step % STEPS_PER_BAR
    const events: Readonly<ArcadeBgmEvent>[] = []

    for (let layerIndex = 0; layerIndex <= highestLayer; layerIndex += 1) {
      for (const pattern of PATTERN_LAYERS[layerIndex]!) {
        const event = getPatternEvent(pattern, barIndex, offset)
        if (event) {
          events.push(event)
        }
      }
    }

    return Object.freeze(events)
  })

  return Object.freeze(score)
}

function getPatternEvent(
  pattern: VoicePattern,
  barIndex: number,
  offset: number,
): Readonly<ArcadeBgmEvent> | null {
  const eventIndex = pattern.offsets.indexOf(offset)
  if (eventIndex < 0) {
    return null
  }

  const startMidi = pattern.startMidiByBar[barIndex]![eventIndex]!
  const endMidi =
    pattern.endMidiByBar?.[barIndex]?.[eventIndex] ?? startMidi

  return Object.freeze({
    wave: pattern.wave,
    frequency: midiToFrequency(startMidi),
    endFrequency: midiToFrequency(endMidi),
    durationSteps: pattern.durationSteps[eventIndex]!,
    gain: pattern.gains[eventIndex]! * ARCADE_BGM_GAIN_SCALE,
  })
}

function createPattern(
  offsets: readonly number[],
  wave: ArcadeBgmWave,
  durationSteps: readonly number[],
  gains: readonly number[],
  startMidiByBar: readonly (readonly number[])[],
  endMidiByBar?: readonly (readonly number[])[],
): VoicePattern {
  const expectedLength = offsets.length
  const rows = endMidiByBar
    ? [...startMidiByBar, ...endMidiByBar]
    : startMidiByBar

  if (
    durationSteps.length !== expectedLength ||
    gains.length !== expectedLength ||
    startMidiByBar.length !== BAR_COUNT ||
    (endMidiByBar !== undefined && endMidiByBar.length !== BAR_COUNT) ||
    rows.some((row) => row.length !== expectedLength)
  ) {
    throw new Error('Arcade BGM pattern dimensions must match.')
  }

  return Object.freeze({
    offsets: Object.freeze([...offsets]),
    wave,
    durationSteps: Object.freeze([...durationSteps]),
    gains: Object.freeze([...gains]),
    startMidiByBar: freezeRows(startMidiByBar),
    ...(endMidiByBar
      ? { endMidiByBar: freezeRows(endMidiByBar) }
      : {}),
  })
}

function repeatAcrossBars(
  midiNotes: readonly number[],
): readonly (readonly number[])[] {
  return Object.freeze(
    Array.from({ length: BAR_COUNT }, () => Object.freeze([...midiNotes])),
  )
}

function freezeRows(
  rows: readonly (readonly number[])[],
): readonly (readonly number[])[] {
  return Object.freeze(rows.map((row) => Object.freeze([...row])))
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
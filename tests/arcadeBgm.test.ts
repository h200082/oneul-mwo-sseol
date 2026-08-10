import { describe, expect, it } from 'vitest'

import {
  ARCADE_BGM_BPM,
  ARCADE_BGM_INTENSITIES,
  ARCADE_BGM_LOOP_STEPS,
  ARCADE_BGM_STEPS_PER_BEAT,
  ARCADE_BGM_STEP_SECONDS,
  getArcadeBgmEvents,
  getRoundMusicIntensity,
  type ArcadeBgmEvent,
  type MusicIntensity,
} from '../src/feedback/arcadeBgm'

const LEGAL_WAVES = new Set(['sine', 'square', 'triangle', 'sawtooth'])
const G_MAJOR_PENTATONIC_PITCH_CLASSES = new Set([2, 4, 7, 9, 11])

describe('arcade BGM score', () => {
  it('uses a 120 BPM, four-bar 16th-note clock', () => {
    expect(ARCADE_BGM_BPM).toBe(120)
    expect(ARCADE_BGM_STEPS_PER_BEAT).toBe(4)
    expect(ARCADE_BGM_LOOP_STEPS).toBe(64)
    expect(ARCADE_BGM_STEP_SECONDS).toBeCloseTo(60 / 120 / 4, 12)
  })

  it('is exactly periodic over all 64 steps in either direction', () => {
    for (const intensity of ARCADE_BGM_INTENSITIES) {
      for (let step = -128; step < 128; step += 1) {
        expect(getArcadeBgmEvents(step + 64, intensity)).toBe(
          getArcadeBgmEvents(step, intensity),
        )
      }
    }
  })

  it('emits only immutable, finite, Web Audio-safe events', () => {
    for (const intensity of ARCADE_BGM_INTENSITIES) {
      for (let step = 0; step < ARCADE_BGM_LOOP_STEPS; step += 1) {
        const events = getArcadeBgmEvents(step, intensity)
        expect(Object.isFrozen(events)).toBe(true)

        for (const event of events) {
          expectSafeEvent(event)
          expect(Object.isFrozen(event)).toBe(true)
        }
      }
    }
  })

  it('keeps every pitch in the G-major pentatonic palette', () => {
    for (const intensity of ARCADE_BGM_INTENSITIES) {
      for (let step = 0; step < ARCADE_BGM_LOOP_STEPS; step += 1) {
        for (const event of getArcadeBgmEvents(step, intensity)) {
          const midiNote = 69 + 12 * Math.log2(event.frequency / 440)
          expect(midiNote).toBeCloseTo(Math.round(midiNote), 10)
          expect(
            G_MAJOR_PENTATONIC_PITCH_CLASSES.has(
              ((Math.round(midiNote) % 12) + 12) % 12,
            ),
          ).toBe(true)
        }
      }
    }
  })

  it('starts with bass and pluck voices, then adds denser supersets', () => {
    const intensityOrder: readonly MusicIntensity[] = [
      'opening',
      'rotation',
      'final-five',
      'final-two',
    ]
    const totals = intensityOrder.map((intensity) => eventCount(intensity))

    expect(totals).toEqual([16, 24, 32, 40])
    expect(
      allEvents('opening').some((event) => event.wave === 'triangle'),
    ).toBe(true)
    expect(allEvents('opening').some((event) => event.wave === 'square')).toBe(
      true,
    )

    for (let index = 1; index < intensityOrder.length; index += 1) {
      const earlier = intensityOrder[index - 1]!
      const later = intensityOrder[index]!
      for (let step = 0; step < ARCADE_BGM_LOOP_STEPS; step += 1) {
        const earlierEvents = getArcadeBgmEvents(step, earlier)
        const laterEvents = getArcadeBgmEvents(step, later)
        expect(laterEvents.slice(0, earlierEvents.length)).toEqual(earlierEvents)
      }
    }
  })

  it('leaves bright effect space and never starts stacked notes', () => {
    for (const intensity of ARCADE_BGM_INTENSITIES) {
      for (let step = 0; step < ARCADE_BGM_LOOP_STEPS; step += 1) {
        const events = getArcadeBgmEvents(step, intensity)
        expect(events).toHaveLength(events.length > 0 ? 1 : 0)
        expect(
          events.reduce((total, event) => total + event.gain, 0),
        ).toBeLessThanOrEqual(0.044)
      }
    }

    expect(
      Math.max(
        ...allEvents('final-two').map((event) => event.frequency),
      ),
    ).toBeLessThanOrEqual(392.01)
  })

  it('keeps the bass audible on small mobile speakers', () => {
    const bassEvents = allEvents('opening').filter(
      (event) => event.wave === 'triangle',
    )

    expect(bassEvents).toHaveLength(8)
    expect(
      Math.min(...bassEvents.map((event) => event.frequency)),
    ).toBeGreaterThanOrEqual(120)
  })

  it('maps round boundaries to escalating music intensity', () => {
    expect(getRoundMusicIntensity(0)).toBe('opening')
    expect(getRoundMusicIntensity(4)).toBe('opening')
    expect(getRoundMusicIntensity(5)).toBe('rotation')
    expect(getRoundMusicIntensity(14)).toBe('rotation')
    expect(getRoundMusicIntensity(15)).toBe('final-five')
    expect(getRoundMusicIntensity(17)).toBe('final-five')
    expect(getRoundMusicIntensity(18)).toBe('final-two')
    expect(getRoundMusicIntensity(200)).toBe('final-two')
  })

  it.each([
    -1,
    0.5,
    Number.NaN,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ])('rejects invalid round index %s', (roundIndex) => {
    expect(() => getRoundMusicIntensity(roundIndex)).toThrow(RangeError)
  })

  it('normalizes fractional and non-finite scheduler input safely', () => {
    expect(getArcadeBgmEvents(3.99, 'opening')).toBe(
      getArcadeBgmEvents(3, 'opening'),
    )
    expect(getArcadeBgmEvents(-1, 'opening')).toBe(
      getArcadeBgmEvents(63, 'opening'),
    )
    expect(getArcadeBgmEvents(Number.NaN, 'opening')).toBe(
      getArcadeBgmEvents(0, 'opening'),
    )
    expect(getArcadeBgmEvents(Number.POSITIVE_INFINITY, 'opening')).toBe(
      getArcadeBgmEvents(0, 'opening'),
    )
  })
})

function allEvents(intensity: MusicIntensity): readonly ArcadeBgmEvent[] {
  return Array.from({ length: ARCADE_BGM_LOOP_STEPS }, (_, step) =>
    getArcadeBgmEvents(step, intensity),
  ).flat()
}

function eventCount(intensity: MusicIntensity): number {
  return allEvents(intensity).length
}

function expectSafeEvent(event: Readonly<ArcadeBgmEvent>): void {
  expect(LEGAL_WAVES.has(event.wave)).toBe(true)
  expect(Number.isFinite(event.frequency)).toBe(true)
  expect(event.frequency).toBeGreaterThanOrEqual(20)
  expect(event.frequency).toBeLessThanOrEqual(20_000)
  expect(Number.isFinite(event.endFrequency)).toBe(true)
  expect(event.endFrequency).toBeGreaterThanOrEqual(20)
  expect(event.endFrequency).toBeLessThanOrEqual(20_000)
  expect(Number.isSafeInteger(event.durationSteps)).toBe(true)
  expect(event.durationSteps).toBeGreaterThan(0)
  expect(event.durationSteps).toBeLessThanOrEqual(ARCADE_BGM_LOOP_STEPS)
  expect(Number.isFinite(event.gain)).toBe(true)
  expect(event.gain).toBeGreaterThan(0)
  expect(event.gain).toBeLessThanOrEqual(0.1)
}

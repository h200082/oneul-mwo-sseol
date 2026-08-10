import { describe, expect, it, vi } from 'vitest'

import {
  createPlayerGameResult,
  createPlayerGameResultReporter,
  resolvePersonalBestPresentation,
  type GameLaunchOptions,
} from '../src/game/gameTypes'

const roomOptions: GameLaunchOptions = {
  mode: 'room',
  mealTime: 'dinner',
  deckSeed: 'shared-deck-7',
  roomCode: 'ABCD2345',
}

describe('player game result', () => {
  it('creates a JSON-serializable result with an isolated capture list', () => {
    const capturedMenuIds = ['ramen', 'bibimbap']
    const result = createPlayerGameResult(
      roomOptions,
      {
        score: 87.35,
        capturedMenuIds,
      },
      1_754_000_123_456,
    )

    capturedMenuIds.push('tteokbokki')

    expect(JSON.parse(JSON.stringify(result))).toEqual({
      mode: 'room',
      mealTime: 'dinner',
      deckSeed: 'shared-deck-7',
      roomCode: 'ABCD2345',
      score: 87.35,
      capturedMenuIds: ['ramen', 'bibimbap'],
      completedAt: 1_754_000_123_456,
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.capturedMenuIds)).toBe(true)
  })

  it('reports once per run and lets a retry report its new result', () => {
    const handler = vi.fn()
    const now = vi.fn(() => 1_754_000_123_456)
    const firstRunReport = createPlayerGameResultReporter(
      roomOptions,
      handler,
      now,
    )

    firstRunReport({
      score: 92.1,
      capturedMenuIds: ['ramen'],
    })
    firstRunReport({
      score: 99.9,
      capturedMenuIds: ['bibimbap'],
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(now).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        score: 92.1,
        capturedMenuIds: ['ramen'],
      }),
    )

    // Phaser calls Scene.create again on retry, creating one reporter for
    // the new run while retaining the same external handler.
    const retryReport = createPlayerGameResultReporter(
      roomOptions,
      handler,
      now,
    )
    retryReport({
      score: 99.9,
      capturedMenuIds: ['bibimbap'],
    })
    retryReport({
      score: 45,
      capturedMenuIds: [],
    })

    expect(handler).toHaveBeenCalledTimes(2)
    expect(now).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        score: 99.9,
        capturedMenuIds: ['bibimbap'],
      }),
    )
  })

  it('remains a no-op for the existing solo flow without a handler', () => {
    const report = createPlayerGameResultReporter({
      mode: 'solo',
      mealTime: 'lunch',
      deckSeed: 'solo-seed',
    })

    expect(() => {
      report({ score: 80, capturedMenuIds: [] })
      report({ score: 90, capturedMenuIds: ['gimbap'] })
    }).not.toThrow()
  })

  it('never reports a result for the non-scoring tutorial launch', () => {
    const handler = vi.fn()
    const now = vi.fn(() => 1_754_000_123_456)
    const report = createPlayerGameResultReporter(
      {
        mode: 'solo',
        launchMode: 'tutorial',
        mealTime: 'lunch',
        deckSeed: 'tutorial-seed',
      },
      handler,
      now,
    )

    report({ score: 100, capturedMenuIds: ['gimbap'] })

    expect(handler).not.toHaveBeenCalled()
    expect(now).not.toHaveBeenCalled()
  })

  it('does not retry a handler that throws', () => {
    const handler = vi.fn(() => {
      throw new Error('storage unavailable')
    })
    const report = createPlayerGameResultReporter(
      roomOptions,
      handler,
      () => 1,
    )

    expect(() =>
      report({ score: 70, capturedMenuIds: [] }),
    ).toThrow('storage unavailable')
    expect(() =>
      report({ score: 71, capturedMenuIds: [] }),
    ).not.toThrow()
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('solo personal best presentation', () => {
  it('labels a run without a previous device score as the first record', () => {
    expect(resolvePersonalBestPresentation(82.4)).toEqual({
      bestScore: 82.4,
      status: 'first',
    })
  })

  it('labels only a strictly higher score as NEW', () => {
    expect(resolvePersonalBestPresentation(91.2, 88.7)).toEqual({
      bestScore: 91.2,
      status: 'new',
    })
    expect(resolvePersonalBestPresentation(88.7, 88.7)).toEqual({
      bestScore: 88.7,
      status: 'existing',
    })
  })

  it('keeps the previous best when the current score is lower', () => {
    const presentation = resolvePersonalBestPresentation(74.5, 93.1)
    expect(presentation).toEqual({
      bestScore: 93.1,
      status: 'existing',
    })
    expect(Object.isFrozen(presentation)).toBe(true)
  })
})

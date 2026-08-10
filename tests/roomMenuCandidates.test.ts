import { describe, expect, it } from 'vitest'

import type { FinalRoomResultsSummary } from '../src/domain/roomResultResolution'
import { resolveRoomMenuCandidates } from '../src/domain/roomMenuCandidates'

function standing(
  playerId: string,
  capturedMenuIds: readonly string[],
  didNotFinish = false,
) {
  return Object.freeze({
    rank: didNotFinish ? 3 : 1,
    playerId,
    displayName: playerId,
    rosterOrder: playerId === 'one' ? 0 : 1,
    score: didNotFinish ? 0 : 80,
    capturedMenuIds: Object.freeze([...capturedMenuIds]),
    capturedMenuSlots: Object.freeze([
      capturedMenuIds[0] ?? null,
      capturedMenuIds[1] ?? null,
    ] as const),
    isScoreTied: false,
    scoreTieSize: 1,
    didNotFinish,
  })
}

function summary(
  standings: FinalRoomResultsSummary['standings'],
  mostOverlappedMenus: FinalRoomResultsSummary['mostOverlappedMenus'] = [],
): FinalRoomResultsSummary {
  return {
    standings,
    winners: standings.filter((entry) => !entry.didNotFinish).slice(0, 1),
    lastPlaces: standings.slice(-1),
    mostOverlappedMenus,
  }
}

describe('resolveRoomMenuCandidates', () => {
  it('prioritizes exact menu overlap over category affinity', () => {
    const result = resolveRoomMenuCandidates(
      summary(
        [standing('one', ['ramyeon']), standing('two', ['ramyeon'])],
        [
          {
            menuId: 'ramyeon',
            captureCount: 2,
            playerIds: ['one', 'two'],
          },
        ],
      ),
    )

    expect(result.kind).toBe('exact-menu')
  })

  it('uses shared category when exact menu ids differ', () => {
    const result = resolveRoomMenuCandidates(
      summary([
        standing('one', ['ramyeon']),
        standing('two', ['pasta']),
      ]),
    )

    expect(result).toMatchObject({
      kind: 'category-affinity',
      affinities: [{ category: 'noodle', matchCount: 2 }],
    })
  })

  it('falls back to each finisher pick when no category matches', () => {
    const result = resolveRoomMenuCandidates(
      summary([
        standing('one', ['ramyeon']),
        standing('two', ['pizza']),
      ]),
    )

    expect(result).toEqual({
      kind: 'individual-picks',
      picks: [
        { playerId: 'one', displayName: 'one', menuIds: ['ramyeon'] },
        { playerId: 'two', displayName: 'two', menuIds: ['pizza'] },
      ],
    })
  })

  it('excludes DNF players and returns none when nobody picked a menu', () => {
    const result = resolveRoomMenuCandidates(
      summary([
        standing('one', []),
        standing('two', ['pasta'], true),
      ]),
    )

    expect(result).toEqual({ kind: 'none' })
  })
})

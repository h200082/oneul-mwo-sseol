import { describe, expect, it } from 'vitest'

import type { RoomPlayer } from '../src/domain/room'
import { resolveRoomResults } from '../src/domain/roomResultResolution'
import type { RoomResultSubmission } from '../src/domain/roomResults'

const DEADLINE = 181_000
const ROSTER: readonly RoomPlayer[] = Object.freeze([
  Object.freeze({
    playerId: 'host',
    nickname: '완주자',
    role: 'host' as const,
    rosterOrder: 0,
  }),
  Object.freeze({
    playerId: 'guest',
    nickname: '미완주자',
    role: 'member' as const,
    rosterOrder: 1,
  }),
])

function result(
  playerId: string,
  score: number,
  completedAt = DEADLINE - 1,
): RoomResultSubmission {
  return {
    playerId,
    score,
    capturedMenuIds: playerId === 'host' ? ['pizza'] : [],
    completedAt,
  }
}

describe('resolveRoomResults', () => {
  it('keeps missing players pending until server finalization is confirmed', () => {
    const resolution = resolveRoomResults(
      ROSTER,
      [result('host', 80)],
      DEADLINE,
      false,
    )

    expect(resolution).toMatchObject({
      isFinal: false,
      pendingPlayerIds: ['guest'],
      summary: null,
    })
    expect(resolution.receivedResults.map((item) => item.playerId)).toEqual([
      'host',
    ])
  })

  it('finalizes immediately when every locked player submitted', () => {
    const resolution = resolveRoomResults(
      ROSTER,
      [result('guest', 75), result('host', 90)],
      DEADLINE,
      false,
    )

    expect(resolution.isFinal).toBe(true)
    expect(resolution.pendingPlayerIds).toEqual([])
    expect(
      resolution.summary?.standings.map((standing) => standing.playerId),
    ).toEqual(['host', 'guest'])
    expect(
      resolution.summary?.standings.every(
        (standing) => !standing.didNotFinish,
      ),
    ).toBe(true)
  })

  it('ranks a zero-point finisher above DNF after server confirmation', () => {
    const resolution = resolveRoomResults(
      ROSTER,
      [result('host', 0)],
      DEADLINE,
      true,
    )
    const standings = resolution.summary?.standings

    expect(standings).toHaveLength(2)
    expect(standings?.[0]).toMatchObject({
      playerId: 'host',
      rank: 1,
      score: 0,
      didNotFinish: false,
    })
    expect(standings?.[1]).toMatchObject({
      playerId: 'guest',
      rank: 2,
      score: 0,
      capturedMenuIds: [],
      capturedMenuSlots: [null, null],
      didNotFinish: true,
    })
    expect(
      resolution.summary?.winners.map((winner) => winner.playerId),
    ).toEqual(['host'])
    expect(
      resolution.summary?.lastPlaces.map((last) => last.playerId),
    ).toEqual(['guest'])
  })

  it('returns no winner and shared last place when everyone is DNF', () => {
    const resolution = resolveRoomResults(ROSTER, [], DEADLINE, true)

    expect(resolution.summary?.winners).toEqual([])
    expect(resolution.summary?.lastPlaces).toHaveLength(2)
    expect(
      resolution.summary?.standings.map((standing) => ({
        rank: standing.rank,
        tied: standing.isScoreTied,
        dnf: standing.didNotFinish,
      })),
    ).toEqual([
      { rank: 1, tied: true, dnf: true },
      { rank: 1, tied: true, dnf: true },
    ])
  })

  it('ignores late and non-roster submissions deterministically', () => {
    const submissions = [
      result('guest', 100, DEADLINE + 1),
      result('outsider', 100),
      result('host', 65),
    ]
    const forward = resolveRoomResults(
      ROSTER,
      submissions,
      DEADLINE,
      true,
    )
    const reversed = resolveRoomResults(
      ROSTER,
      [...submissions].reverse(),
      DEADLINE,
      true,
    )

    expect(reversed).toEqual(forward)
    expect(forward.receivedResults.map((item) => item.playerId)).toEqual([
      'host',
    ])
    expect(forward.summary?.standings[1]?.didNotFinish).toBe(true)
  })
})

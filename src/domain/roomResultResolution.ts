import type { RoomPlayer } from './room'
import {
  aggregateRoomResults,
  type MostOverlappedMenu,
  type RoomResultStanding,
  type RoomResultSubmission,
} from './roomResults'

export interface FinalRoomResultStanding extends RoomResultStanding {
  readonly didNotFinish: boolean
}

export interface FinalRoomResultsSummary {
  readonly standings: readonly FinalRoomResultStanding[]
  readonly winners: readonly FinalRoomResultStanding[]
  readonly lastPlaces: readonly FinalRoomResultStanding[]
  readonly mostOverlappedMenus: readonly MostOverlappedMenu[]
}

export interface RoomResultsResolution {
  readonly receivedResults: readonly RoomResultSubmission[]
  readonly pendingPlayerIds: readonly string[]
  readonly isFinal: boolean
  readonly summary: Readonly<FinalRoomResultsSummary> | null
}

/**
 * Resolves a room's immutable result board from its locked roster and the
 * accepted submissions visible to the client.
 *
 * Missing players remain pending until the caller supplies a server-backed
 * finalization proof. Once confirmed, they become deterministic DNF rows:
 * zero points, empty capture slots, and a rank below every player who
 * completed the game. A legitimate zero-point finisher therefore always
 * ranks above a DNF player.
 */
export function resolveRoomResults(
  roster: readonly RoomPlayer[],
  submissions: readonly RoomResultSubmission[],
  resultDeadlineAt: number,
  finalizeMissing: boolean,
): Readonly<RoomResultsResolution> {
  validateTimestamp(resultDeadlineAt, 'result deadline')

  if (roster.length === 0) {
    throw new RangeError('A locked result roster must not be empty.')
  }

  const rosterById = new Map<string, RoomPlayer>()
  const rosterOrders = new Set<number>()
  for (const player of roster) {
    if (rosterById.has(player.playerId)) {
      throw new Error(`Duplicate roster player id: ${player.playerId}`)
    }
    if (rosterOrders.has(player.rosterOrder)) {
      throw new Error(`Duplicate roster order: ${player.rosterOrder}`)
    }
    rosterById.set(player.playerId, player)
    rosterOrders.add(player.rosterOrder)
  }

  const submissionByPlayer = new Map<string, RoomResultSubmission>()
  for (const submission of submissions) {
    if (
      !rosterById.has(submission.playerId) ||
      submission.completedAt > resultDeadlineAt ||
      submissionByPlayer.has(submission.playerId)
    ) {
      continue
    }
    submissionByPlayer.set(submission.playerId, submission)
  }

  const receivedResults = Object.freeze(
    roster
      .map((player) => submissionByPlayer.get(player.playerId))
      .filter(
        (submission): submission is RoomResultSubmission =>
          submission !== undefined,
      ),
  )
  const pendingPlayers = roster.filter(
    (player) => !submissionByPlayer.has(player.playerId),
  )
  const pendingPlayerIds = Object.freeze(
    pendingPlayers.map((player) => player.playerId),
  )

  if (pendingPlayers.length > 0 && !finalizeMissing) {
    return Object.freeze({
      receivedResults,
      pendingPlayerIds,
      isFinal: false,
      summary: null,
    })
  }

  const completedPlayerResults = roster.flatMap((player) => {
    const submission = submissionByPlayer.get(player.playerId)
    return submission
      ? [
          {
            playerId: player.playerId,
            displayName: player.nickname,
            rosterOrder: player.rosterOrder,
            score: submission.score,
            capturedMenuIds: submission.capturedMenuIds,
          },
        ]
      : []
  })

  const completedSummary =
    completedPlayerResults.length > 0
      ? aggregateRoomResults(completedPlayerResults)
      : null
  const completedStandings = Object.freeze(
    (completedSummary?.standings ?? []).map((standing) =>
      Object.freeze({ ...standing, didNotFinish: false }),
    ),
  )
  const dnfRank = completedStandings.length + 1
  const dnfTieSize = pendingPlayers.length
  const dnfStandings = Object.freeze(
    pendingPlayers.map((player) =>
      Object.freeze({
        rank: dnfRank,
        playerId: player.playerId,
        displayName: player.nickname,
        rosterOrder: player.rosterOrder,
        score: 0,
        capturedMenuIds: Object.freeze([]),
        capturedMenuSlots: Object.freeze([null, null] as const),
        isScoreTied: dnfTieSize > 1,
        scoreTieSize: dnfTieSize,
        didNotFinish: true,
      }),
    ),
  )
  const standings = Object.freeze([
    ...completedStandings,
    ...dnfStandings,
  ])
  const winners = Object.freeze(
    (completedSummary?.winners ?? []).map((winner) => {
      const standing = completedStandings.find(
        (candidate) => candidate.playerId === winner.playerId,
      )
      if (!standing) {
        throw new Error(`Winner ${winner.playerId} is missing from standings.`)
      }
      return standing
    }),
  )
  const lastPlaces = Object.freeze(
    dnfStandings.length > 0
      ? [...dnfStandings]
      : (completedSummary?.lastPlaces ?? []).map((lastPlace) => {
          const standing = completedStandings.find(
            (candidate) => candidate.playerId === lastPlace.playerId,
          )
          if (!standing) {
            throw new Error(
              `Last-place player ${lastPlace.playerId} is missing from standings.`,
            )
          }
          return standing
        }),
  )
  const summary = Object.freeze({
    standings,
    winners,
    lastPlaces,
    mostOverlappedMenus:
      completedSummary?.mostOverlappedMenus ?? Object.freeze([]),
  })

  return Object.freeze({
    receivedResults,
    pendingPlayerIds,
    isFinal: true,
    summary,
  })
}

function validateTimestamp(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer.`)
  }
}

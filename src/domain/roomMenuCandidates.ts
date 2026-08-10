import { findStrongestMenuCategoryAffinities } from '../data/menuCategoryAffinity'
import type { FinalRoomResultsSummary } from './roomResultResolution'

export type RoomMenuCandidateResolution =
  | {
      readonly kind: 'exact-menu'
      readonly overlaps: FinalRoomResultsSummary['mostOverlappedMenus']
    }
  | {
      readonly kind: 'category-affinity'
      readonly affinities: ReturnType<
        typeof findStrongestMenuCategoryAffinities
      >
    }
  | {
      readonly kind: 'individual-picks'
      readonly picks: readonly {
        readonly playerId: string
        readonly displayName: string
        readonly menuIds: readonly string[]
      }[]
    }
  | { readonly kind: 'none' }

/**
 * Resolves the result screen's menu candidates in a strict, explainable order:
 * exact shared menus, then shared categories, then each finisher's own picks.
 */
export function resolveRoomMenuCandidates(
  summary: Readonly<FinalRoomResultsSummary>,
): Readonly<RoomMenuCandidateResolution> {
  if (summary.mostOverlappedMenus.length > 0) {
    return Object.freeze({
      kind: 'exact-menu',
      overlaps: summary.mostOverlappedMenus,
    })
  }

  const completedStandings = summary.standings.filter(
    (standing) => !standing.didNotFinish,
  )
  const affinities = findStrongestMenuCategoryAffinities(completedStandings)
  if (affinities.length > 0) {
    return Object.freeze({
      kind: 'category-affinity',
      affinities,
    })
  }

  const picks = Object.freeze(
    completedStandings.flatMap((standing) =>
      standing.capturedMenuIds.length === 0
        ? []
        : [
            Object.freeze({
              playerId: standing.playerId,
              displayName: standing.displayName,
              menuIds: Object.freeze([...standing.capturedMenuIds]),
            }),
          ],
    ),
  )
  return picks.length > 0
    ? Object.freeze({ kind: 'individual-picks', picks })
    : Object.freeze({ kind: 'none' })
}

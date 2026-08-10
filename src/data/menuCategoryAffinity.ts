import {
  MENU_CATALOG,
  MENU_CATEGORIES,
  type MenuCategory,
  type MenuItem,
} from './menus'

export interface MenuCategoryAffinitySource {
  readonly playerId: string
  readonly capturedMenuIds: readonly string[]
}

export interface MenuCategoryAffinitySelection {
  readonly playerId: string
  readonly menuIds: readonly string[]
}

export interface MenuCategoryAffinity {
  readonly category: MenuCategory
  readonly emoji: string
  readonly labelKo: string
  readonly recommendationKo: string
  readonly matchCount: number
  readonly playerIds: readonly string[]
  readonly menuIds: readonly string[]
  readonly selections: readonly MenuCategoryAffinitySelection[]
}

interface MenuCategoryPresentation {
  readonly emoji: string
  readonly labelKo: string
  readonly recommendationKo: string
}

interface MutableCategoryAffinity {
  readonly category: MenuCategory
  readonly menuIds: string[]
  readonly seenMenuIds: Set<string>
  readonly selections: MenuCategoryAffinitySelection[]
}

export const MENU_CATEGORY_PRESENTATION: Readonly<
  Record<MenuCategory, MenuCategoryPresentation>
> = Object.freeze({
  'soup-stew': Object.freeze({
    emoji: '🍲',
    labelKo: '국물 요리파',
    recommendationKo: '오늘은 따뜻한 국물 취향',
  }),
  'rice-meal': Object.freeze({
    emoji: '🍚',
    labelKo: '든든한 밥파',
    recommendationKo: '오늘은 든든한 밥 취향',
  }),
  noodle: Object.freeze({
    emoji: '🍜',
    labelKo: '면 요리파',
    recommendationKo: '오늘은 면 요리 취향',
  }),
  'quick-meal': Object.freeze({
    emoji: '🥪',
    labelKo: '간편식파',
    recommendationKo: '오늘은 가볍고 빠른 한 끼 취향',
  }),
  'meat-grill': Object.freeze({
    emoji: '🥩',
    labelKo: '고기파',
    recommendationKo: '오늘은 든든한 고기 취향',
  }),
  'shared-dish': Object.freeze({
    emoji: '🥘',
    labelKo: '함께 먹는 메뉴파',
    recommendationKo: '오늘은 함께 나눠 먹는 취향',
  }),
})

/**
 * Finds the strongest near-match between captured menus by category.
 *
 * Each player contributes at most once to a category, even if both of their
 * captured menus belong to it. Unknown menu ids are ignored so older room
 * results remain renderable after catalog changes. Ties are returned in the
 * catalog's stable category order.
 */
export function findStrongestMenuCategoryAffinities(
  players: readonly MenuCategoryAffinitySource[],
  menus: readonly MenuItem[] = MENU_CATALOG,
): readonly MenuCategoryAffinity[] {
  const menuById = new Map(menus.map((menu) => [menu.id, menu]))
  const affinityByCategory = new Map<
    MenuCategory,
    MutableCategoryAffinity
  >()
  const seenPlayerIds = new Set<string>()

  for (const player of players) {
    if (seenPlayerIds.has(player.playerId)) {
      throw new Error(`Duplicate affinity player id: ${player.playerId}`)
    }
    seenPlayerIds.add(player.playerId)

    const menuIdsByCategory = new Map<MenuCategory, string[]>()
    const seenMenuIds = new Set<string>()

    for (const menuId of player.capturedMenuIds) {
      if (seenMenuIds.has(menuId)) {
        continue
      }
      seenMenuIds.add(menuId)
      const menu = menuById.get(menuId)
      if (!menu) {
        continue
      }
      const categoryMenuIds = menuIdsByCategory.get(menu.category)
      if (categoryMenuIds) {
        categoryMenuIds.push(menu.id)
      } else {
        menuIdsByCategory.set(menu.category, [menu.id])
      }
    }

    for (const [category, menuIds] of menuIdsByCategory) {
      let affinity = affinityByCategory.get(category)
      if (!affinity) {
        affinity = {
          category,
          menuIds: [],
          seenMenuIds: new Set<string>(),
          selections: [],
        }
        affinityByCategory.set(category, affinity)
      }

      for (const menuId of menuIds) {
        if (!affinity.seenMenuIds.has(menuId)) {
          affinity.seenMenuIds.add(menuId)
          affinity.menuIds.push(menuId)
        }
      }
      affinity.selections.push(
        Object.freeze({
          playerId: player.playerId,
          menuIds: Object.freeze([...menuIds]),
        }),
      )
    }
  }

  const strongestMatchCount = Math.max(
    1,
    ...[...affinityByCategory.values()].map(
      (affinity) => affinity.selections.length,
    ),
  )
  if (strongestMatchCount < 2) {
    return Object.freeze([])
  }

  return Object.freeze(
    MENU_CATEGORIES.flatMap((category) => {
      const affinity = affinityByCategory.get(category)
      if (!affinity || affinity.selections.length !== strongestMatchCount) {
        return []
      }
      const presentation = MENU_CATEGORY_PRESENTATION[category]
      const selections = Object.freeze([...affinity.selections])

      return [
        Object.freeze({
          category,
          ...presentation,
          matchCount: selections.length,
          playerIds: Object.freeze(
            selections.map((selection) => selection.playerId),
          ),
          menuIds: Object.freeze([...affinity.menuIds]),
          selections,
        }),
      ]
    }),
  )
}

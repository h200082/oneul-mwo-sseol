import { describe, expect, it } from 'vitest'

import { MENU_CATALOG, type MenuCategory } from '../src/data/menus'
import { DEFAULT_DECK_SIZE } from '../src/domain/gameRules'
import {
  GAME_DECK_MAX_CATEGORY_COUNT,
  GAME_DECK_MAX_CONSECUTIVE_CATEGORY,
  GAME_DECK_PHASE_CATEGORY_LIMITS,
  createGameMenuDeck,
  getGameDeckMenuIds,
} from '../src/game/gameDeck'

function countCategories(
  categories: readonly MenuCategory[],
): Map<MenuCategory, number> {
  const counts = new Map<MenuCategory, number>()
  for (const category of categories) {
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return counts
}

function getLongestCategoryStreak(
  categories: readonly MenuCategory[],
): number {
  let longest = 0
  let current = 0
  let previous: MenuCategory | null = null
  for (const category of categories) {
    current = category === previous ? current + 1 : 1
    previous = category
    longest = Math.max(longest, current)
  }
  return longest
}

describe('game deck preparation', () => {
  it('builds the same unique twenty-menu deck for preparation and play', () => {
    const options = {
      mealTime: 'lunch' as const,
      deckSeed: 'shared-preload-seed',
    }

    const first = createGameMenuDeck(options)
    const second = createGameMenuDeck(options)
    const menuIds = getGameDeckMenuIds(options)

    expect(first).toHaveLength(DEFAULT_DECK_SIZE)
    expect(new Set(menuIds)).toHaveLength(DEFAULT_DECK_SIZE)
    expect(second.map((menu) => menu.id)).toEqual(menuIds)
    expect(first.map((menu) => menu.id)).toEqual(menuIds)
  })

  it('honors both meal time and seed without changing the fixed deck size', () => {
    const lunch = getGameDeckMenuIds({
      mealTime: 'lunch',
      deckSeed: 42,
    })
    const dinner = getGameDeckMenuIds({
      mealTime: 'dinner',
      deckSeed: 42,
    })

    expect(lunch).toHaveLength(DEFAULT_DECK_SIZE)
    expect(dinner).toHaveLength(DEFAULT_DECK_SIZE)
    expect(dinner).not.toEqual(lunch)
  })

  it.each(['lunch', 'dinner'] as const)(
    'limits whole-deck and phase category concentration for %s seeds',
    (mealTime) => {
      for (let deckSeed = 0; deckSeed < 500; deckSeed += 1) {
        const deck = createGameMenuDeck({ mealTime, deckSeed })
        const categories = deck.map((menu) => menu.category)
        const wholeDeckCounts = countCategories(categories)

        expect(Math.max(...wholeDeckCounts.values())).toBeLessThanOrEqual(
          GAME_DECK_MAX_CATEGORY_COUNT,
        )
        expect(getLongestCategoryStreak(categories)).toBeLessThanOrEqual(
          GAME_DECK_MAX_CONSECUTIVE_CATEGORY,
        )

        for (const phase of GAME_DECK_PHASE_CATEGORY_LIMITS) {
          const phaseCounts = countCategories(
            categories.slice(phase.startRoundIndex, phase.endRoundIndex),
          )
          expect(Math.max(...phaseCounts.values())).toBeLessThanOrEqual(
            phase.maxPerCategory,
          )
        }
      }
    },
  )

  it('keeps the learning, core, and final-sprint limits aligned to 20 rounds', () => {
    expect(GAME_DECK_PHASE_CATEGORY_LIMITS).toEqual([
      {
        phase: 'learning',
        startRoundIndex: 0,
        endRoundIndex: 5,
        maxPerCategory: 2,
      },
      {
        phase: 'core',
        startRoundIndex: 5,
        endRoundIndex: 15,
        maxPerCategory: 4,
      },
      {
        phase: 'final-sprint',
        startRoundIndex: 15,
        endRoundIndex: DEFAULT_DECK_SIZE,
        maxPerCategory: 2,
      },
    ])
  })

  it('does not mutate launch options or the source menu catalog', () => {
    const options = Object.freeze({
      mealTime: 'dinner' as const,
      deckSeed: 'immutable-input-seed',
    })
    const catalogBefore = MENU_CATALOG.map((menu) => ({ ...menu }))

    createGameMenuDeck(options)

    expect(options).toEqual({
      mealTime: 'dinner',
      deckSeed: 'immutable-input-seed',
    })
    expect(MENU_CATALOG).toEqual(catalogBefore)
  })
})

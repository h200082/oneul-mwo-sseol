import {
  DEFAULT_DECK_SIZE,
  createWeightedMenuDeck,
} from '../domain/gameRules'
import {
  MENU_CATEGORIES,
  createSeededRandom,
  toWeightedMenuPool,
  type MenuCategory,
  type WeightedMenuCatalogEntry,
} from '../data/menus'
import type { GameLaunchOptions } from './gameTypes'

export type GameDeckOptions = Pick<
  GameLaunchOptions,
  'mealTime' | 'deckSeed'
>

/**
 * Six catalog categories share a twenty-round run. A six-item whole-deck cap
 * keeps the strongest meal-time weights visible while limiting one category
 * to 30% of play. The 5/10/5 phase caps allow at most 40% in each pace band,
 * and the streak rule prevents a third consecutive menu from feeling repeated.
 */
export const GAME_DECK_MAX_CATEGORY_COUNT = 6
export const GAME_DECK_MAX_CONSECUTIVE_CATEGORY = 2

export const GAME_DECK_PHASE_CATEGORY_LIMITS = Object.freeze([
  Object.freeze({
    phase: 'learning',
    startRoundIndex: 0,
    endRoundIndex: 5,
    maxPerCategory: 2,
  }),
  Object.freeze({
    phase: 'core',
    startRoundIndex: 5,
    endRoundIndex: 15,
    maxPerCategory: 4,
  }),
  Object.freeze({
    phase: 'final-sprint',
    startRoundIndex: 15,
    endRoundIndex: DEFAULT_DECK_SIZE,
    maxPerCategory: 2,
  }),
] as const)

type GameDeckPhaseCategoryLimit =
  (typeof GAME_DECK_PHASE_CATEGORY_LIMITS)[number]

/**
 * Builds the deterministic twenty-menu deck shared by preparation and play.
 * Keeping this in one place prevents the asset preloader from drifting away
 * from the deck that the Phaser scene actually consumes.
 */
export function createGameMenuDeck(
  options: GameDeckOptions,
): readonly WeightedMenuCatalogEntry[] {
  const remaining = toWeightedMenuPool(options.mealTime)
  const rng = createSeededRandom(options.deckSeed)
  const deck: WeightedMenuCatalogEntry[] = []
  const totalCategoryCounts = createCategoryCountMap()
  const phaseCategoryCounts = new Map(
    GAME_DECK_PHASE_CATEGORY_LIMITS.map(({ phase }) => [
      phase,
      createCategoryCountMap(),
    ]),
  )

  while (deck.length < DEFAULT_DECK_SIZE) {
    const phase = getGameDeckPhaseLimit(deck.length)
    const phaseCounts = phaseCategoryCounts.get(phase.phase)!
    const blockedStreakCategory = getBlockedStreakCategory(deck)
    const eligible = remaining.filter(
      (menu) =>
        totalCategoryCounts.get(menu.category)! <
          GAME_DECK_MAX_CATEGORY_COUNT &&
        phaseCounts.get(menu.category)! < phase.maxPerCategory &&
        menu.category !== blockedStreakCategory,
    )

    if (eligible.length === 0) {
      throw new Error(
        `Unable to build a category-balanced game deck at round ${deck.length + 1}.`,
      )
    }

    const selected = createWeightedMenuDeck(eligible, {
      size: 1,
      rng,
    })[0]!
    const selectedIndex = remaining.indexOf(selected)
    remaining.splice(selectedIndex, 1)
    deck.push(selected)
    incrementCategoryCount(totalCategoryCounts, selected.category)
    incrementCategoryCount(phaseCounts, selected.category)
  }

  return deck
}

export function getGameDeckMenuIds(
  options: GameDeckOptions,
): readonly string[] {
  return createGameMenuDeck(options).map((menu) => menu.id)
}

function createCategoryCountMap(): Map<MenuCategory, number> {
  return new Map(MENU_CATEGORIES.map((category) => [category, 0]))
}

function incrementCategoryCount(
  counts: Map<MenuCategory, number>,
  category: MenuCategory,
): void {
  counts.set(category, counts.get(category)! + 1)
}

function getGameDeckPhaseLimit(
  roundIndex: number,
): GameDeckPhaseCategoryLimit {
  const phase = GAME_DECK_PHASE_CATEGORY_LIMITS.find(
    ({ startRoundIndex, endRoundIndex }) =>
      roundIndex >= startRoundIndex && roundIndex < endRoundIndex,
  )
  if (!phase) {
    throw new RangeError(`No game-deck phase covers round ${roundIndex + 1}.`)
  }
  return phase
}

function getBlockedStreakCategory(
  deck: readonly WeightedMenuCatalogEntry[],
): MenuCategory | null {
  if (deck.length < GAME_DECK_MAX_CONSECUTIVE_CATEGORY) {
    return null
  }

  const recent = deck.slice(-GAME_DECK_MAX_CONSECUTIVE_CATEGORY)
  const category = recent[0]!.category
  return recent.every((menu) => menu.category === category) ? category : null
}

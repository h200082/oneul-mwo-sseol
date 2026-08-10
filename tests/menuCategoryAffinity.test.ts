import { describe, expect, it } from 'vitest'

import {
  findStrongestMenuCategoryAffinities,
  MENU_CATEGORY_PRESENTATION,
  type MenuCategoryAffinitySource,
} from '../src/data/menuCategoryAffinity'

function player(
  playerId: string,
  capturedMenuIds: readonly string[],
): MenuCategoryAffinitySource {
  return { playerId, capturedMenuIds }
}

describe('findStrongestMenuCategoryAffinities', () => {
  it('finds a near match when players capture different noodle menus', () => {
    const affinities = findStrongestMenuCategoryAffinities([
      player('one', ['ramyeon']),
      player('two', ['pasta']),
    ])

    expect(affinities).toHaveLength(1)
    expect(affinities[0]).toMatchObject({
      category: 'noodle',
      emoji: '🍜',
      labelKo: '면 요리파',
      recommendationKo: '오늘은 면 요리 취향',
      matchCount: 2,
      playerIds: ['one', 'two'],
      menuIds: ['ramyeon', 'pasta'],
      selections: [
        { playerId: 'one', menuIds: ['ramyeon'] },
        { playerId: 'two', menuIds: ['pasta'] },
      ],
    })
  })

  it('counts a player only once when both captures share a category', () => {
    const affinities = findStrongestMenuCategoryAffinities([
      player('one', ['ramyeon', 'pasta']),
      player('two', ['pizza']),
    ])

    expect(affinities).toEqual([])
  })

  it('returns only the category shared by the most distinct players', () => {
    const affinities = findStrongestMenuCategoryAffinities([
      player('one', ['ramyeon', 'pizza']),
      player('two', ['pasta', 'shabu-shabu']),
      player('three', ['udon']),
    ])

    expect(affinities.map((affinity) => affinity.category)).toEqual([
      'noodle',
    ])
    expect(affinities[0]?.playerIds).toEqual(['one', 'two', 'three'])
  })

  it('returns strongest ties in the catalog category order', () => {
    const affinities = findStrongestMenuCategoryAffinities([
      player('one', ['kimchi-jjigae', 'ramyeon']),
      player('two', ['sundubu-jjigae', 'udon']),
    ])

    expect(affinities.map((affinity) => affinity.category)).toEqual([
      'soup-stew',
      'noodle',
    ])
    expect(affinities.every((affinity) => affinity.matchCount === 2)).toBe(
      true,
    )
  })

  it('ignores unknown menu ids and freezes the complete result', () => {
    const input = [
      player('one', ['old-menu', 'ramyeon']),
      player('two', ['pasta']),
    ] as const

    const affinities = findStrongestMenuCategoryAffinities(input)

    expect(input[0].capturedMenuIds).toEqual(['old-menu', 'ramyeon'])
    expect(affinities[0]?.menuIds).toEqual(['ramyeon', 'pasta'])
    expect(Object.isFrozen(affinities)).toBe(true)
    expect(Object.isFrozen(affinities[0])).toBe(true)
    expect(Object.isFrozen(affinities[0]?.playerIds)).toBe(true)
    expect(Object.isFrozen(affinities[0]?.menuIds)).toBe(true)
    expect(Object.isFrozen(affinities[0]?.selections)).toBe(true)
    expect(Object.isFrozen(affinities[0]?.selections[0])).toBe(true)
    expect(Object.isFrozen(affinities[0]?.selections[0]?.menuIds)).toBe(true)
    expect(Object.isFrozen(MENU_CATEGORY_PRESENTATION)).toBe(true)
  })

  it('rejects duplicate player ids instead of inflating an affinity', () => {
    expect(() =>
      findStrongestMenuCategoryAffinities([
        player('same', ['ramyeon']),
        player('same', ['pasta']),
      ]),
    ).toThrow(/Duplicate affinity player id/)
  })
})

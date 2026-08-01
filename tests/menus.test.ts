import { describe, expect, it } from "vitest";

import { createWeightedMenuDeck } from "../src/domain/gameRules";
import {
  MENU_CATALOG,
  MENU_CATEGORIES,
  createSeededRandom,
  toWeightedMenuPool,
  type MenuCategory,
  type MenuItem,
} from "../src/data/menus";

function averageWeight(
  category: MenuCategory,
  key: "lunchWeight" | "dinnerWeight",
): number {
  const categoryMenus = MENU_CATALOG.filter(
    (menu) => menu.category === category,
  );

  if (categoryMenus.length === 0) {
    throw new Error(`Missing menu category: ${category}`);
  }

  return (
    categoryMenus.reduce((sum, menu) => sum + menu[key], 0) /
    categoryMenus.length
  );
}

describe("MENU_CATALOG", () => {
  it("contains exactly 50 uniquely identified Korean meal entries", () => {
    expect(MENU_CATALOG).toHaveLength(50);
    expect(new Set(MENU_CATALOG.map((menu) => menu.id)).size).toBe(50);
    expect(new Set(MENU_CATALOG.map((menu) => menu.nameKo)).size).toBe(
      50,
    );

    for (const menu of MENU_CATALOG) {
      expect(menu.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(menu.nameKo.trim().length).toBeGreaterThan(0);
      expect(MENU_CATEGORIES).toContain(menu.category);
      expect(menu.placeholderColor).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("keeps every menu available at both meal times", () => {
    for (const menu of MENU_CATALOG) {
      expect(menu.lunchWeight).toBeGreaterThan(0);
      expect(menu.dinnerWeight).toBeGreaterThan(0);
      expect(Number.isFinite(menu.lunchWeight)).toBe(true);
      expect(Number.isFinite(menu.dinnerWeight)).toBe(true);
    }
  });

  it("contains every declared category and excludes dessert items", () => {
    expect(
      [...new Set(MENU_CATALOG.map((menu) => menu.category))].sort(),
    ).toEqual([...MENU_CATEGORIES].sort());

    const dessertTerms =
      /디저트|케이크|아이스크림|빙수|와플|도넛|마카롱|쿠키|푸딩/;
    expect(
      MENU_CATALOG.some((menu) => dessertTerms.test(menu.nameKo)),
    ).toBe(false);
  });

  it("biases quick meals, noodles, and rice meals toward lunch", () => {
    for (const category of [
      "quick-meal",
      "noodle",
      "rice-meal",
    ] as const) {
      expect(averageWeight(category, "lunchWeight")).toBeGreaterThan(
        averageWeight(category, "dinnerWeight"),
      );
    }
  });

  it("biases meat, soups, and shared dishes toward dinner", () => {
    for (const category of [
      "meat-grill",
      "soup-stew",
      "shared-dish",
    ] as const) {
      expect(averageWeight(category, "dinnerWeight")).toBeGreaterThan(
        averageWeight(category, "lunchWeight"),
      );
    }
  });
});

describe("toWeightedMenuPool", () => {
  it("maps the selected meal-time weight while preserving menu data", () => {
    const lunchPool = toWeightedMenuPool("lunch");
    const dinnerPool = toWeightedMenuPool("dinner");

    expect(lunchPool).toHaveLength(50);
    expect(dinnerPool).toHaveLength(50);

    for (let index = 0; index < MENU_CATALOG.length; index += 1) {
      const source = MENU_CATALOG[index] as MenuItem;
      const lunch = lunchPool[index];
      const dinner = dinnerPool[index];

      expect(lunch).toEqual({
        ...source,
        weight: source.lunchWeight,
      });
      expect(dinner).toEqual({
        ...source,
        weight: source.dinnerWeight,
      });
    }
  });

  it("feeds directly into a deterministic 20-item weighted deck", () => {
    const pool = toWeightedMenuPool("dinner");
    const firstDeck = createWeightedMenuDeck(pool, {
      rng: createSeededRandom("ROOM-AB12CD34"),
    });
    const secondDeck = createWeightedMenuDeck(pool, {
      rng: createSeededRandom("ROOM-AB12CD34"),
    });

    expect(firstDeck).toHaveLength(20);
    expect(new Set(firstDeck.map((menu) => menu.id)).size).toBe(20);
    expect(firstDeck.map((menu) => menu.id)).toEqual(
      secondDeck.map((menu) => menu.id),
    );
  });
});

describe("createSeededRandom", () => {
  it("returns repeatable values in the required half-open interval", () => {
    const first = createSeededRandom(2_026_0727);
    const second = createSeededRandom(2_026_0727);
    const firstSequence = Array.from({ length: 100 }, () => first());
    const secondSequence = Array.from({ length: 100 }, () => second());

    expect(firstSequence).toEqual(secondSequence);
    for (const value of firstSequence) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("supports stable string seeds and distinguishes different rooms", () => {
    const roomA = createSeededRandom("room-a");
    const repeatedRoomA = createSeededRandom("room-a");
    const roomB = createSeededRandom("room-b");
    const takeFive = (rng: () => number): number[] =>
      Array.from({ length: 5 }, () => rng());

    expect(takeFive(roomA)).toEqual(takeFive(repeatedRoomA));
    expect(takeFive(createSeededRandom("room-a"))).not.toEqual(
      takeFive(roomB),
    );
  });

  it("rejects non-finite numeric seeds", () => {
    expect(() => createSeededRandom(Number.NaN)).toThrow(/finite/);
    expect(() => createSeededRandom(Number.POSITIVE_INFINITY)).toThrow(
      /finite/,
    );
  });
});

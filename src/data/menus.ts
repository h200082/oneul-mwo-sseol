import type {
  RandomSource,
  WeightedMenu,
} from "../domain/gameRules";

export const MENU_CATEGORIES = [
  "soup-stew",
  "rice-meal",
  "noodle",
  "quick-meal",
  "meat-grill",
  "shared-dish",
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];
export type MealTime = "lunch" | "dinner";
export type MenuSeed = number | string;

export interface MenuItem {
  readonly id: string;
  readonly nameKo: string;
  readonly category: MenuCategory;
  readonly lunchWeight: number;
  readonly dinnerWeight: number;
  /**
   * Temporary card color used until the final licensed food image is ready.
   */
  readonly placeholderColor: `#${string}`;
}

export type WeightedMenuCatalogEntry = MenuItem &
  Readonly<WeightedMenu>;

/**
 * Korean everyday meal catalog for the hackathon MVP.
 *
 * Dessert-only items are intentionally excluded. Every menu has a positive
 * weight for both meal times so no item becomes impossible to draw.
 */
export const MENU_CATALOG: readonly MenuItem[] = [
  {
    id: "kimchi-jjigae",
    nameKo: "김치찌개",
    category: "soup-stew",
    lunchWeight: 4,
    dinnerWeight: 4,
    placeholderColor: "#D9544D",
  },
  {
    id: "doenjang-jjigae",
    nameKo: "된장찌개",
    category: "soup-stew",
    lunchWeight: 4,
    dinnerWeight: 3,
    placeholderColor: "#B58B45",
  },
  {
    id: "sundubu-jjigae",
    nameKo: "순두부찌개",
    category: "soup-stew",
    lunchWeight: 4,
    dinnerWeight: 3,
    placeholderColor: "#E96B55",
  },
  {
    id: "budae-jjigae",
    nameKo: "부대찌개",
    category: "soup-stew",
    lunchWeight: 3,
    dinnerWeight: 6,
    placeholderColor: "#C84C4C",
  },
  {
    id: "gamjatang",
    nameKo: "감자탕",
    category: "soup-stew",
    lunchWeight: 2,
    dinnerWeight: 6,
    placeholderColor: "#A9693E",
  },
  {
    id: "seolleongtang",
    nameKo: "설렁탕",
    category: "soup-stew",
    lunchWeight: 3,
    dinnerWeight: 4,
    placeholderColor: "#E6D8B8",
  },
  {
    id: "gomtang",
    nameKo: "곰탕",
    category: "soup-stew",
    lunchWeight: 3,
    dinnerWeight: 4,
    placeholderColor: "#D9C8A1",
  },
  {
    id: "galbitang",
    nameKo: "갈비탕",
    category: "soup-stew",
    lunchWeight: 3,
    dinnerWeight: 5,
    placeholderColor: "#C99B63",
  },
  {
    id: "yukgaejang",
    nameKo: "육개장",
    category: "soup-stew",
    lunchWeight: 4,
    dinnerWeight: 4,
    placeholderColor: "#C7443E",
  },
  {
    id: "samgyetang",
    nameKo: "삼계탕",
    category: "soup-stew",
    lunchWeight: 2,
    dinnerWeight: 5,
    placeholderColor: "#E3C993",
  },
  {
    id: "kongnamul-gukbap",
    nameKo: "콩나물국밥",
    category: "soup-stew",
    lunchWeight: 5,
    dinnerWeight: 2,
    placeholderColor: "#D8B75E",
  },
  {
    id: "dwaeji-gukbap",
    nameKo: "돼지국밥",
    category: "soup-stew",
    lunchWeight: 4,
    dinnerWeight: 4,
    placeholderColor: "#C99F78",
  },
  {
    id: "sundae-guk",
    nameKo: "순대국",
    category: "soup-stew",
    lunchWeight: 4,
    dinnerWeight: 4,
    placeholderColor: "#A87963",
  },
  {
    id: "cheonggukjang",
    nameKo: "청국장",
    category: "soup-stew",
    lunchWeight: 3,
    dinnerWeight: 4,
    placeholderColor: "#9C7A3B",
  },
  {
    id: "home-style-baekban",
    nameKo: "가정식 백반",
    category: "soup-stew",
    lunchWeight: 5,
    dinnerWeight: 3,
    placeholderColor: "#7AAE75",
  },
  {
    id: "bibimbap",
    nameKo: "비빔밥",
    category: "rice-meal",
    lunchWeight: 5,
    dinnerWeight: 3,
    placeholderColor: "#65A65D",
  },
  {
    id: "jeyuk-deopbap",
    nameKo: "제육덮밥",
    category: "rice-meal",
    lunchWeight: 7,
    dinnerWeight: 3,
    placeholderColor: "#DF5748",
  },
  {
    id: "bulgogi-deopbap",
    nameKo: "불고기덮밥",
    category: "rice-meal",
    lunchWeight: 6,
    dinnerWeight: 3,
    placeholderColor: "#A86E46",
  },
  {
    id: "chicken-mayo-deopbap",
    nameKo: "치킨마요덮밥",
    category: "rice-meal",
    lunchWeight: 7,
    dinnerWeight: 2,
    placeholderColor: "#E6B94D",
  },
  {
    id: "curry-rice",
    nameKo: "카레라이스",
    category: "rice-meal",
    lunchWeight: 6,
    dinnerWeight: 3,
    placeholderColor: "#D99D27",
  },
  {
    id: "omurice",
    nameKo: "오므라이스",
    category: "rice-meal",
    lunchWeight: 6,
    dinnerWeight: 3,
    placeholderColor: "#F0B340",
  },
  {
    id: "fried-rice",
    nameKo: "볶음밥",
    category: "rice-meal",
    lunchWeight: 6,
    dinnerWeight: 3,
    placeholderColor: "#D7A552",
  },
  {
    id: "kimchi-fried-rice",
    nameKo: "김치볶음밥",
    category: "rice-meal",
    lunchWeight: 6,
    dinnerWeight: 3,
    placeholderColor: "#D85F45",
  },
  {
    id: "pork-cutlet",
    nameKo: "돈가스",
    category: "rice-meal",
    lunchWeight: 5,
    dinnerWeight: 4,
    placeholderColor: "#C98B4B",
  },
  {
    id: "sushi",
    nameKo: "초밥",
    category: "rice-meal",
    lunchWeight: 4,
    dinnerWeight: 5,
    placeholderColor: "#E9897E",
  },
  {
    id: "bibim-guksu",
    nameKo: "비빔국수",
    category: "noodle",
    lunchWeight: 5,
    dinnerWeight: 2,
    placeholderColor: "#D94B42",
  },
  {
    id: "janchi-guksu",
    nameKo: "잔치국수",
    category: "noodle",
    lunchWeight: 5,
    dinnerWeight: 2,
    placeholderColor: "#D8B66E",
  },
  {
    id: "kalguksu",
    nameKo: "칼국수",
    category: "noodle",
    lunchWeight: 5,
    dinnerWeight: 3,
    placeholderColor: "#CFAF72",
  },
  {
    id: "naengmyeon",
    nameKo: "냉면",
    category: "noodle",
    lunchWeight: 5,
    dinnerWeight: 3,
    placeholderColor: "#74AAB0",
  },
  {
    id: "jjajangmyeon",
    nameKo: "짜장면",
    category: "noodle",
    lunchWeight: 6,
    dinnerWeight: 3,
    placeholderColor: "#6F4C3E",
  },
  {
    id: "jjamppong",
    nameKo: "짬뽕",
    category: "noodle",
    lunchWeight: 4,
    dinnerWeight: 4,
    placeholderColor: "#D74C3D",
  },
  {
    id: "ramyeon",
    nameKo: "라면",
    category: "noodle",
    lunchWeight: 7,
    dinnerWeight: 2,
    placeholderColor: "#E76A32",
  },
  {
    id: "udon",
    nameKo: "우동",
    category: "noodle",
    lunchWeight: 6,
    dinnerWeight: 3,
    placeholderColor: "#D9B56C",
  },
  {
    id: "pasta",
    nameKo: "파스타",
    category: "noodle",
    lunchWeight: 4,
    dinnerWeight: 5,
    placeholderColor: "#E3A83F",
  },
  {
    id: "pho",
    nameKo: "쌀국수",
    category: "noodle",
    lunchWeight: 6,
    dinnerWeight: 3,
    placeholderColor: "#79A96B",
  },
  {
    id: "tteokbokki",
    nameKo: "떡볶이",
    category: "quick-meal",
    lunchWeight: 5,
    dinnerWeight: 3,
    placeholderColor: "#E34842",
  },
  {
    id: "gimbap",
    nameKo: "김밥",
    category: "quick-meal",
    lunchWeight: 7,
    dinnerWeight: 2,
    placeholderColor: "#4F8462",
  },
  {
    id: "sandwich",
    nameKo: "샌드위치",
    category: "quick-meal",
    lunchWeight: 7,
    dinnerWeight: 2,
    placeholderColor: "#75A85C",
  },
  {
    id: "hamburger",
    nameKo: "햄버거",
    category: "quick-meal",
    lunchWeight: 6,
    dinnerWeight: 4,
    placeholderColor: "#CF7A3E",
  },
  {
    id: "korean-toast",
    nameKo: "길거리 토스트",
    category: "quick-meal",
    lunchWeight: 7,
    dinnerWeight: 2,
    placeholderColor: "#E5A64D",
  },
  {
    id: "samgyeopsal",
    nameKo: "삼겹살",
    category: "meat-grill",
    lunchWeight: 2,
    dinnerWeight: 8,
    placeholderColor: "#C86A5A",
  },
  {
    id: "grilled-galbi",
    nameKo: "갈비구이",
    category: "meat-grill",
    lunchWeight: 2,
    dinnerWeight: 8,
    placeholderColor: "#A65B45",
  },
  {
    id: "dakgalbi",
    nameKo: "닭갈비",
    category: "meat-grill",
    lunchWeight: 3,
    dinnerWeight: 7,
    placeholderColor: "#CE5744",
  },
  {
    id: "bossam",
    nameKo: "보쌈",
    category: "meat-grill",
    lunchWeight: 2,
    dinnerWeight: 8,
    placeholderColor: "#C88C70",
  },
  {
    id: "jokbal",
    nameKo: "족발",
    category: "meat-grill",
    lunchWeight: 2,
    dinnerWeight: 8,
    placeholderColor: "#8F5846",
  },
  {
    id: "bulgogi",
    nameKo: "불고기",
    category: "meat-grill",
    lunchWeight: 4,
    dinnerWeight: 6,
    placeholderColor: "#A86842",
  },
  {
    id: "fried-chicken",
    nameKo: "치킨",
    category: "meat-grill",
    lunchWeight: 3,
    dinnerWeight: 7,
    placeholderColor: "#D4933D",
  },
  {
    id: "pizza",
    nameKo: "피자",
    category: "shared-dish",
    lunchWeight: 3,
    dinnerWeight: 7,
    placeholderColor: "#D85C46",
  },
  {
    id: "dak-hanmari",
    nameKo: "닭한마리",
    category: "shared-dish",
    lunchWeight: 2,
    dinnerWeight: 7,
    placeholderColor: "#D1A468",
  },
  {
    id: "shabu-shabu",
    nameKo: "샤부샤부",
    category: "shared-dish",
    lunchWeight: 2,
    dinnerWeight: 7,
    placeholderColor: "#D56555",
  },
];

/**
 * Adapts the catalog to `createWeightedMenuDeck` without losing display data.
 */
export function toWeightedMenuPool(
  mealTime: MealTime,
  menus: readonly MenuItem[] = MENU_CATALOG,
): WeightedMenuCatalogEntry[] {
  return menus.map((menu) => ({
    ...menu,
    weight:
      mealTime === "lunch"
        ? menu.lunchWeight
        : menu.dinnerWeight,
  }));
}

/**
 * Small deterministic PRNG suitable for reproducing a room deck from a seed.
 *
 * This is not a cryptographic random source. The host should still persist the
 * explicit deck so every client receives the exact same round conditions.
 */
export function createSeededRandom(seed: MenuSeed): RandomSource {
  let state = normalizeSeed(seed);

  return () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^=
      value +
      Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function normalizeSeed(seed: MenuSeed): number {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      throw new RangeError("A numeric menu seed must be finite.");
    }
    return Math.trunc(seed) >>> 0;
  }

  let hash = 0x811c_9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x0100_0193);
  }
  return hash >>> 0;
}

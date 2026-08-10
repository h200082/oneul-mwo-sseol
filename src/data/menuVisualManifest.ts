import kimchiJjigaeImageUrl from '../assets/food/kimchi-jjigae-v2.webp'
import sushiImageUrl from '../assets/food/sushi-v2.webp'
import pizzaImageUrl from '../assets/food/pizza-v2.webp'
import hamburgerImageUrl from '../assets/food/hamburger.webp'
import porkCutletImageUrl from '../assets/food/pork-cutlet.webp'
import jjajangmyeonImageUrl from '../assets/food/jjajangmyeon.webp'
import naengmyeonImageUrl from '../assets/food/naengmyeon.webp'
import samgyeopsalImageUrl from '../assets/food/samgyeopsal.webp'
import jokbalImageUrl from '../assets/food/jokbal.webp'
import samgyetangImageUrl from '../assets/food/samgyetang.webp'
import bibimbapImageUrl from '../assets/food/bibimbap.webp'
import gamjatangImageUrl from '../assets/food/gamjatang.webp'
import doenjangJjigaeImageUrl from '../assets/food/doenjang-jjigae.webp'
import sundubuJjigaeImageUrl from '../assets/food/sundubu-jjigae.webp'
import budaeJjigaeImageUrl from '../assets/food/budae-jjigae.webp'
import seolleongtangImageUrl from '../assets/food/seolleongtang.webp'
import gomtangImageUrl from '../assets/food/gomtang.webp'
import yukgaejangImageUrl from '../assets/food/yukgaejang.webp'
import kongnamulGukbapImageUrl from '../assets/food/kongnamul-gukbap.webp'
import dwaejiGukbapImageUrl from '../assets/food/dwaeji-gukbap.webp'
import sundaeGukImageUrl from '../assets/food/sundae-guk.webp'
import cheonggukjangImageUrl from '../assets/food/cheonggukjang.webp'
import jeyukDeopbapImageUrl from '../assets/food/jeyuk-deopbap.webp'
import bulgogiDeopbapImageUrl from '../assets/food/bulgogi-deopbap.webp'
import chickenMayoDeopbapImageUrl from '../assets/food/chicken-mayo-deopbap.webp'
import curryRiceImageUrl from '../assets/food/curry-rice.webp'
import friedRiceImageUrl from '../assets/food/fried-rice.webp'
import kimchiFriedRiceImageUrl from '../assets/food/kimchi-fried-rice.webp'
import bibimGuksuImageUrl from '../assets/food/bibim-guksu.webp'
import janchiGuksuImageUrl from '../assets/food/janchi-guksu.webp'
import kalguksuImageUrl from '../assets/food/kalguksu.webp'
import jjamppongImageUrl from '../assets/food/jjamppong.webp'
import udonImageUrl from '../assets/food/udon.webp'
import pastaImageUrl from '../assets/food/pasta.webp'
import phoImageUrl from '../assets/food/pho.webp'
import koreanToastImageUrl from '../assets/food/korean-toast.webp'
import grilledGalbiImageUrl from '../assets/food/grilled-galbi.webp'
import dakgalbiImageUrl from '../assets/food/dakgalbi.webp'
import bossamImageUrl from '../assets/food/bossam.webp'
import bulgogiImageUrl from '../assets/food/bulgogi.webp'
import dakHanmariImageUrl from '../assets/food/dak-hanmari.webp'
import shabuShabuImageUrl from '../assets/food/shabu-shabu.webp'
import friedChickenImageUrl from '../assets/food/fried-chicken-v2.webp'
import galbitangImageUrl from '../assets/food/galbitang-v2.webp'
import gimbapImageUrl from '../assets/food/gimbap-v2.webp'
import homeStyleBaekbanImageUrl from '../assets/food/home-style-baekban-v2.webp'
import omuriceImageUrl from '../assets/food/omurice-v2.webp'
import ramyeonImageUrl from '../assets/food/ramyeon-v2.webp'
import sandwichImageUrl from '../assets/food/sandwich-v2.webp'
import tteokbokkiImageUrl from '../assets/food/tteokbokki-v2.webp'

export interface MenuVisual {
  readonly menuId: string
  readonly textureKey: `food:${string}`
  readonly imageUrl: string
  readonly assetFilename: string
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly gameplayOffset?: {
    readonly x: number
    readonly y: number
  }
}

export const MENU_VISUALS: readonly MenuVisual[] = Object.freeze([
  {
    menuId: 'kimchi-jjigae',
    textureKey: 'food:kimchi-jjigae',
    imageUrl: kimchiJjigaeImageUrl,
    assetFilename: 'kimchi-jjigae-v2.webp',
    sourceWidth: 448,
    sourceHeight: 512,
  },
  {
    menuId: 'sushi',
    textureKey: 'food:sushi',
    imageUrl: sushiImageUrl,
    assetFilename: 'sushi-v2.webp',
    sourceWidth: 512,
    sourceHeight: 293,
  },
  {
    menuId: 'pizza',
    textureKey: 'food:pizza',
    imageUrl: pizzaImageUrl,
    assetFilename: 'pizza-v2.webp',
    sourceWidth: 512,
    sourceHeight: 330,
  },
  {
    menuId: 'hamburger',
    textureKey: 'food:hamburger',
    imageUrl: hamburgerImageUrl,
    assetFilename: 'hamburger.webp',
    sourceWidth: 396,
    sourceHeight: 512,
  },
  {
    menuId: 'pork-cutlet',
    textureKey: 'food:pork-cutlet',
    imageUrl: porkCutletImageUrl,
    assetFilename: 'pork-cutlet.webp',
    sourceWidth: 512,
    sourceHeight: 308,
  },
  {
    menuId: 'jjajangmyeon',
    textureKey: 'food:jjajangmyeon',
    imageUrl: jjajangmyeonImageUrl,
    assetFilename: 'jjajangmyeon.webp',
    sourceWidth: 512,
    sourceHeight: 337,
  },
  {
    menuId: 'naengmyeon',
    textureKey: 'food:naengmyeon',
    imageUrl: naengmyeonImageUrl,
    assetFilename: 'naengmyeon.webp',
    sourceWidth: 512,
    sourceHeight: 292,
  },
  {
    menuId: 'samgyeopsal',
    textureKey: 'food:samgyeopsal',
    imageUrl: samgyeopsalImageUrl,
    assetFilename: 'samgyeopsal.webp',
    sourceWidth: 512,
    sourceHeight: 242,
  },
  {
    menuId: 'jokbal',
    textureKey: 'food:jokbal',
    imageUrl: jokbalImageUrl,
    assetFilename: 'jokbal.webp',
    sourceWidth: 512,
    sourceHeight: 288,
  },
  {
    menuId: 'samgyetang',
    textureKey: 'food:samgyetang',
    imageUrl: samgyetangImageUrl,
    assetFilename: 'samgyetang.webp',
    sourceWidth: 512,
    sourceHeight: 453,
  },
  {
    menuId: 'bibimbap',
    textureKey: 'food:bibimbap',
    imageUrl: bibimbapImageUrl,
    assetFilename: 'bibimbap.webp',
    sourceWidth: 495,
    sourceHeight: 512,
  },
  {
    menuId: 'gamjatang',
    textureKey: 'food:gamjatang',
    imageUrl: gamjatangImageUrl,
    assetFilename: 'gamjatang.webp',
    sourceWidth: 433,
    sourceHeight: 512,
    gameplayOffset: {
      x: -7,
      y: -13,
    },
  },
  {
    menuId: 'doenjang-jjigae',
    textureKey: 'food:doenjang-jjigae',
    imageUrl: doenjangJjigaeImageUrl,
    assetFilename: 'doenjang-jjigae.webp',
    sourceWidth: 435,
    sourceHeight: 512,
  },
  {
    menuId: 'sundubu-jjigae',
    textureKey: 'food:sundubu-jjigae',
    imageUrl: sundubuJjigaeImageUrl,
    assetFilename: 'sundubu-jjigae.webp',
    sourceWidth: 512,
    sourceHeight: 428,
  },
  {
    menuId: 'budae-jjigae',
    textureKey: 'food:budae-jjigae',
    imageUrl: budaeJjigaeImageUrl,
    assetFilename: 'budae-jjigae.webp',
    sourceWidth: 512,
    sourceHeight: 316,
  },
  {
    menuId: 'seolleongtang',
    textureKey: 'food:seolleongtang',
    imageUrl: seolleongtangImageUrl,
    assetFilename: 'seolleongtang.webp',
    sourceWidth: 512,
    sourceHeight: 303,
  },
  {
    menuId: 'gomtang',
    textureKey: 'food:gomtang',
    imageUrl: gomtangImageUrl,
    assetFilename: 'gomtang.webp',
    sourceWidth: 512,
    sourceHeight: 318,
  },
  {
    menuId: 'yukgaejang',
    textureKey: 'food:yukgaejang',
    imageUrl: yukgaejangImageUrl,
    assetFilename: 'yukgaejang.webp',
    sourceWidth: 512,
    sourceHeight: 310,
  },
  {
    menuId: 'kongnamul-gukbap',
    textureKey: 'food:kongnamul-gukbap',
    imageUrl: kongnamulGukbapImageUrl,
    assetFilename: 'kongnamul-gukbap.webp',
    sourceWidth: 512,
    sourceHeight: 309,
  },
  {
    menuId: 'dwaeji-gukbap',
    textureKey: 'food:dwaeji-gukbap',
    imageUrl: dwaejiGukbapImageUrl,
    assetFilename: 'dwaeji-gukbap.webp',
    sourceWidth: 512,
    sourceHeight: 369,
  },
  {
    menuId: 'sundae-guk',
    textureKey: 'food:sundae-guk',
    imageUrl: sundaeGukImageUrl,
    assetFilename: 'sundae-guk.webp',
    sourceWidth: 512,
    sourceHeight: 483,
  },
  {
    menuId: 'cheonggukjang',
    textureKey: 'food:cheonggukjang',
    imageUrl: cheonggukjangImageUrl,
    assetFilename: 'cheonggukjang.webp',
    sourceWidth: 510,
    sourceHeight: 512,
  },
  {
    menuId: 'jeyuk-deopbap',
    textureKey: 'food:jeyuk-deopbap',
    imageUrl: jeyukDeopbapImageUrl,
    assetFilename: 'jeyuk-deopbap.webp',
    sourceWidth: 512,
    sourceHeight: 353,
  },
  {
    menuId: 'bulgogi-deopbap',
    textureKey: 'food:bulgogi-deopbap',
    imageUrl: bulgogiDeopbapImageUrl,
    assetFilename: 'bulgogi-deopbap.webp',
    sourceWidth: 512,
    sourceHeight: 402,
  },
  {
    menuId: 'chicken-mayo-deopbap',
    textureKey: 'food:chicken-mayo-deopbap',
    imageUrl: chickenMayoDeopbapImageUrl,
    assetFilename: 'chicken-mayo-deopbap.webp',
    sourceWidth: 512,
    sourceHeight: 386,
  },
  {
    menuId: 'curry-rice',
    textureKey: 'food:curry-rice',
    imageUrl: curryRiceImageUrl,
    assetFilename: 'curry-rice.webp',
    sourceWidth: 512,
    sourceHeight: 335,
  },
  {
    menuId: 'fried-rice',
    textureKey: 'food:fried-rice',
    imageUrl: friedRiceImageUrl,
    assetFilename: 'fried-rice.webp',
    sourceWidth: 507,
    sourceHeight: 512,
  },
  {
    menuId: 'kimchi-fried-rice',
    textureKey: 'food:kimchi-fried-rice',
    imageUrl: kimchiFriedRiceImageUrl,
    assetFilename: 'kimchi-fried-rice.webp',
    sourceWidth: 512,
    sourceHeight: 391,
  },
  {
    menuId: 'bibim-guksu',
    textureKey: 'food:bibim-guksu',
    imageUrl: bibimGuksuImageUrl,
    assetFilename: 'bibim-guksu.webp',
    sourceWidth: 512,
    sourceHeight: 443,
  },
  {
    menuId: 'janchi-guksu',
    textureKey: 'food:janchi-guksu',
    imageUrl: janchiGuksuImageUrl,
    assetFilename: 'janchi-guksu.webp',
    sourceWidth: 512,
    sourceHeight: 333,
  },
  {
    menuId: 'kalguksu',
    textureKey: 'food:kalguksu',
    imageUrl: kalguksuImageUrl,
    assetFilename: 'kalguksu.webp',
    sourceWidth: 512,
    sourceHeight: 310,
  },
  {
    menuId: 'jjamppong',
    textureKey: 'food:jjamppong',
    imageUrl: jjamppongImageUrl,
    assetFilename: 'jjamppong.webp',
    sourceWidth: 512,
    sourceHeight: 407,
  },
  {
    menuId: 'udon',
    textureKey: 'food:udon',
    imageUrl: udonImageUrl,
    assetFilename: 'udon.webp',
    sourceWidth: 512,
    sourceHeight: 404,
  },
  {
    menuId: 'pasta',
    textureKey: 'food:pasta',
    imageUrl: pastaImageUrl,
    assetFilename: 'pasta.webp',
    sourceWidth: 418,
    sourceHeight: 512,
    gameplayOffset: {
      x: -4,
      y: -25,
    },
  },
  {
    menuId: 'pho',
    textureKey: 'food:pho',
    imageUrl: phoImageUrl,
    assetFilename: 'pho.webp',
    sourceWidth: 512,
    sourceHeight: 300,
  },
  {
    menuId: 'korean-toast',
    textureKey: 'food:korean-toast',
    imageUrl: koreanToastImageUrl,
    assetFilename: 'korean-toast.webp',
    sourceWidth: 344,
    sourceHeight: 512,
  },
  {
    menuId: 'grilled-galbi',
    textureKey: 'food:grilled-galbi',
    imageUrl: grilledGalbiImageUrl,
    assetFilename: 'grilled-galbi.webp',
    sourceWidth: 512,
    sourceHeight: 228,
  },
  {
    menuId: 'dakgalbi',
    textureKey: 'food:dakgalbi',
    imageUrl: dakgalbiImageUrl,
    assetFilename: 'dakgalbi.webp',
    sourceWidth: 512,
    sourceHeight: 276,
  },
  {
    menuId: 'bossam',
    textureKey: 'food:bossam',
    imageUrl: bossamImageUrl,
    assetFilename: 'bossam.webp',
    sourceWidth: 512,
    sourceHeight: 395,
    gameplayOffset: {
      x: 15,
      y: -6,
    },
  },
  {
    menuId: 'bulgogi',
    textureKey: 'food:bulgogi',
    imageUrl: bulgogiImageUrl,
    assetFilename: 'bulgogi.webp',
    sourceWidth: 512,
    sourceHeight: 251,
  },
  {
    menuId: 'dak-hanmari',
    textureKey: 'food:dak-hanmari',
    imageUrl: dakHanmariImageUrl,
    assetFilename: 'dak-hanmari.webp',
    sourceWidth: 512,
    sourceHeight: 384,
  },
  {
    menuId: 'shabu-shabu',
    textureKey: 'food:shabu-shabu',
    imageUrl: shabuShabuImageUrl,
    assetFilename: 'shabu-shabu.webp',
    sourceWidth: 512,
    sourceHeight: 359,
  },
  {
    menuId: 'fried-chicken',
    textureKey: 'food:fried-chicken',
    imageUrl: friedChickenImageUrl,
    assetFilename: 'fried-chicken-v2.webp',
    sourceWidth: 512,
    sourceHeight: 512,
  },
  {
    menuId: 'galbitang',
    textureKey: 'food:galbitang',
    imageUrl: galbitangImageUrl,
    assetFilename: 'galbitang-v2.webp',
    sourceWidth: 438,
    sourceHeight: 512,
  },
  {
    menuId: 'gimbap',
    textureKey: 'food:gimbap',
    imageUrl: gimbapImageUrl,
    assetFilename: 'gimbap-v2.webp',
    sourceWidth: 512,
    sourceHeight: 341,
  },
  {
    menuId: 'home-style-baekban',
    textureKey: 'food:home-style-baekban',
    imageUrl: homeStyleBaekbanImageUrl,
    assetFilename: 'home-style-baekban-v2.webp',
    sourceWidth: 512,
    sourceHeight: 175,
  },
  {
    menuId: 'omurice',
    textureKey: 'food:omurice',
    imageUrl: omuriceImageUrl,
    assetFilename: 'omurice-v2.webp',
    sourceWidth: 512,
    sourceHeight: 332,
  },
  {
    menuId: 'ramyeon',
    textureKey: 'food:ramyeon',
    imageUrl: ramyeonImageUrl,
    assetFilename: 'ramyeon-v2.webp',
    sourceWidth: 512,
    sourceHeight: 512,
  },
  {
    menuId: 'sandwich',
    textureKey: 'food:sandwich',
    imageUrl: sandwichImageUrl,
    assetFilename: 'sandwich-v2.webp',
    sourceWidth: 512,
    sourceHeight: 330,
  },
  {
    menuId: 'tteokbokki',
    textureKey: 'food:tteokbokki',
    imageUrl: tteokbokkiImageUrl,
    assetFilename: 'tteokbokki-v2.webp',
    sourceWidth: 394,
    sourceHeight: 512,
    gameplayOffset: {
      x: -5,
      y: -14,
    },
  },
])

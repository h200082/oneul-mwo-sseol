import friedChickenImageUrl from '../assets/food/fried-chicken-v2.webp'
import galbitangImageUrl from '../assets/food/galbitang-v2.webp'
import gimbapImageUrl from '../assets/food/gimbap-v2.webp'
import homeStyleBaekbanImageUrl from '../assets/food/home-style-baekban-v2.webp'
import kimchiJjigaeImageUrl from '../assets/food/kimchi-jjigae.webp'
import omuriceImageUrl from '../assets/food/omurice-v2.webp'
import pizzaImageUrl from '../assets/food/pizza.webp'
import ramyeonImageUrl from '../assets/food/ramyeon-v2.webp'
import sandwichImageUrl from '../assets/food/sandwich-v2.webp'
import sushiImageUrl from '../assets/food/sushi.webp'
import tteokbokkiImageUrl from '../assets/food/tteokbokki-v2.webp'
import {
  createAlphaSilhouetteMask,
  type AlphaSilhouetteMask,
} from '../domain/alphaSilhouette'

export interface MenuVisual {
  readonly menuId: string
  readonly textureKey: `food:${string}`
  readonly imageUrl: string
}

export interface ContainedSize {
  readonly width: number
  readonly height: number
}

/**
 * Fits artwork inside a render box without changing its original aspect
 * ratio. This keeps future wide, tall, and irregular transparent food assets
 * from being stretched into a square token.
 */
export function calculateContainedSize(
  sourceWidth: number,
  sourceHeight: number,
  maximumWidth: number,
  maximumHeight: number,
): ContainedSize {
  for (const [name, value] of [
    ['sourceWidth', sourceWidth],
    ['sourceHeight', sourceHeight],
    ['maximumWidth', maximumWidth],
    ['maximumHeight', maximumHeight],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive finite number.`)
    }
  }

  const scale = Math.min(
    maximumWidth / sourceWidth,
    maximumHeight / sourceHeight,
  )
  return { width: sourceWidth * scale, height: sourceHeight * scale }
}

export const MENU_VISUALS: readonly MenuVisual[] = Object.freeze([
  {
    menuId: 'ramyeon',
    textureKey: 'food:ramyeon',
    imageUrl: ramyeonImageUrl,
  },
  {
    menuId: 'kimchi-jjigae',
    textureKey: 'food:kimchi-jjigae',
    imageUrl: kimchiJjigaeImageUrl,
  },
  {
    menuId: 'sushi',
    textureKey: 'food:sushi',
    imageUrl: sushiImageUrl,
  },
  {
    menuId: 'fried-chicken',
    textureKey: 'food:fried-chicken',
    imageUrl: friedChickenImageUrl,
  },
  {
    menuId: 'pizza',
    textureKey: 'food:pizza',
    imageUrl: pizzaImageUrl,
  },
  {
    menuId: 'galbitang',
    textureKey: 'food:galbitang',
    imageUrl: galbitangImageUrl,
  },
  {
    menuId: 'omurice',
    textureKey: 'food:omurice',
    imageUrl: omuriceImageUrl,
  },
  {
    menuId: 'gimbap',
    textureKey: 'food:gimbap',
    imageUrl: gimbapImageUrl,
  },
  {
    menuId: 'sandwich',
    textureKey: 'food:sandwich',
    imageUrl: sandwichImageUrl,
  },
  {
    menuId: 'tteokbokki',
    textureKey: 'food:tteokbokki',
    imageUrl: tteokbokkiImageUrl,
  },
  {
    menuId: 'home-style-baekban',
    textureKey: 'food:home-style-baekban',
    imageUrl: homeStyleBaekbanImageUrl,
  },
])

const MENU_VISUAL_BY_ID = new Map(
  MENU_VISUALS.map((visual) => [visual.menuId, visual]),
)

export function getMenuVisual(
  menuId: string,
): MenuVisual | undefined {
  return MENU_VISUAL_BY_ID.get(menuId)
}

export const MENU_ALPHA_MASK_RESOLUTION = 128

const PRELOADED_MENU_IMAGES = new Map<string, HTMLImageElement>()
const PRELOADED_MENU_ALPHA_MASKS = new Map<string, AlphaSilhouetteMask>()
let preloadPromise: Promise<void> | null = null

/**
 * Downloads and decodes the visual slice before the room countdown.
 * Phaser can then register the decoded images synchronously at game start, so
 * one player's network speed cannot delay their first round after `startAt`.
 * Failed images intentionally fall back to the existing colored menu token.
 */
export function preloadMenuVisuals(): Promise<void> {
  if (typeof Image === 'undefined') {
    return Promise.resolve()
  }

  preloadPromise ??= Promise.allSettled(
    MENU_VISUALS.map(async (visual) => {
      const image = new Image()
      image.decoding = 'async'

      await new Promise<void>((resolve, reject) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener(
          'error',
          () => reject(new Error(`Failed to load ${visual.menuId}.`)),
          { once: true },
        )
        image.src = visual.imageUrl
      })

      try {
        await image.decode()
      } catch {
        if (image.naturalWidth === 0) {
          return
        }
      }

      PRELOADED_MENU_IMAGES.set(visual.menuId, image)

      const alphaMask = createMenuAlphaMask(image)
      if (alphaMask && alphaMask.totalWeight > 0) {
        PRELOADED_MENU_ALPHA_MASKS.set(visual.menuId, alphaMask)
      }
    }),
  ).then(() => undefined)

  return preloadPromise
}

export function getPreloadedMenuImage(
  menuId: string,
): HTMLImageElement | undefined {
  return PRELOADED_MENU_IMAGES.get(menuId)
}

export function getPreloadedMenuAlphaMask(
  menuId: string,
): AlphaSilhouetteMask | undefined {
  return PRELOADED_MENU_ALPHA_MASKS.get(menuId)
}

function createMenuAlphaMask(
  image: HTMLImageElement,
): AlphaSilhouetteMask | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = MENU_ALPHA_MASK_RESOLUTION
    canvas.height = MENU_ALPHA_MASK_RESOLUTION
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      return undefined
    }

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const rgba = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    ).data
    const alpha = new Uint8Array(canvas.width * canvas.height)
    for (let pixel = 0; pixel < alpha.length; pixel += 1) {
      alpha[pixel] = rgba[pixel * 4 + 3]!
    }

    return createAlphaSilhouetteMask(canvas.width, canvas.height, alpha)
  } catch {
    // Canvas readback can fail in privacy-restricted browsers. Artwork still
    // renders and gameplay safely falls back to the established circle.
    return undefined
  }
}

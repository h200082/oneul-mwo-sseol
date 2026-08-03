import friedChickenImageUrl from '../assets/food/fried-chicken.webp'
import kimchiJjigaeImageUrl from '../assets/food/kimchi-jjigae.webp'
import pizzaImageUrl from '../assets/food/pizza.webp'
import ramyeonImageUrl from '../assets/food/ramyeon.webp'
import sushiImageUrl from '../assets/food/sushi.webp'

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
])

const MENU_VISUAL_BY_ID = new Map(
  MENU_VISUALS.map((visual) => [visual.menuId, visual]),
)

export function getMenuVisual(
  menuId: string,
): MenuVisual | undefined {
  return MENU_VISUAL_BY_ID.get(menuId)
}

const PRELOADED_MENU_IMAGES = new Map<string, HTMLImageElement>()
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
    }),
  ).then(() => undefined)

  return preloadPromise
}

export function getPreloadedMenuImage(
  menuId: string,
): HTMLImageElement | undefined {
  return PRELOADED_MENU_IMAGES.get(menuId)
}

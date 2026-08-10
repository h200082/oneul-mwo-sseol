import {
  createAlphaSilhouetteMask,
  type AlphaSilhouetteMask,
} from '../domain/alphaSilhouette'
import { MENU_VISUALS, type MenuVisual } from './menuVisualManifest'

export { MENU_VISUALS }
export type { MenuVisual }

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


const MENU_VISUAL_BY_ID = new Map(
  MENU_VISUALS.map((visual) => [visual.menuId, visual]),
)

export function getMenuVisual(
  menuId: string,
): MenuVisual | undefined {
  return MENU_VISUAL_BY_ID.get(menuId)
}

export const MENU_ALPHA_MASK_RESOLUTION = 128
export const MENU_VISUAL_LOAD_DEADLINE_MS = 1_200
export const MENU_VISUAL_DECODE_DEADLINE_MS = 600

const CANONICAL_SHAPE_RADIUS_PERCENT = 84

const PRELOADED_MENU_IMAGES = new Map<string, HTMLImageElement>()
const MENU_VISUAL_PRELOAD_TASKS = new Map<string, Promise<void>>()
const CANONICAL_MENU_ALPHA_MASK = createCanonicalMenuAlphaMask()

export interface CanonicalMenuGameplayGeometry {
  readonly renderBounds: ContainedSize
  readonly artworkCenter: {
    readonly x: number
    readonly y: number
  }
  readonly captureCenter: {
    readonly x: number
    readonly y: number
  }
  readonly alphaMask: Readonly<AlphaSilhouetteMask>
}

/**
 * Downloads, decodes, and measures only the requested visual slice before a
 * game starts. Omitting `menuIds` preserves the original all-visuals API.
 * Failed images intentionally fall back to the existing colored menu token.
 */
export function preloadMenuVisuals(
  menuIds?: readonly string[],
): Promise<void> {
  if (typeof Image === 'undefined') {
    return Promise.resolve()
  }

  const visuals =
    menuIds === undefined
      ? MENU_VISUALS
      : [...new Set(menuIds)]
          .map((menuId) => getMenuVisual(menuId))
          .filter((visual): visual is MenuVisual => visual !== undefined)

  return Promise.allSettled(visuals.map(preloadMenuVisual)).then(
    () => undefined,
  )
}

function preloadMenuVisual(visual: MenuVisual): Promise<void> {
  if (PRELOADED_MENU_IMAGES.has(visual.menuId)) {
    return Promise.resolve()
  }

  const pending = MENU_VISUAL_PRELOAD_TASKS.get(visual.menuId)
  if (pending) {
    return pending
  }

  const task = loadMenuVisual(visual).catch((error: unknown) => {
    MENU_VISUAL_PRELOAD_TASKS.delete(visual.menuId)
    throw error
  })
  MENU_VISUAL_PRELOAD_TASKS.set(visual.menuId, task)
  return task
}

async function loadMenuVisual(visual: MenuVisual): Promise<void> {
  const image = new Image()
  image.decoding = 'async'

  await waitForImageLoad(image, visual)

  try {
    await waitForTaskWithDeadline(
      image.decode(),
      MENU_VISUAL_DECODE_DEADLINE_MS,
      `Timed out decoding ${visual.menuId}.`,
    )
  } catch (error) {
    if (error instanceof MenuVisualDeadlineError) {
      throw error
    }
    if (image.naturalWidth === 0) {
      throw new Error(`Failed to decode ${visual.menuId}.`)
    }
  }

  PRELOADED_MENU_IMAGES.set(visual.menuId, image)
}

export function getPreloadedMenuImage(
  menuId: string,
): HTMLImageElement | undefined {
  return PRELOADED_MENU_IMAGES.get(menuId)
}

export function getPreloadedMenuAlphaMask(
  menuId: string,
): AlphaSilhouetteMask | undefined {
  return getCanonicalMenuAlphaMask(menuId)
}

export function getCanonicalMenuAlphaMask(
  menuId: string,
): AlphaSilhouetteMask | undefined {
  return MENU_VISUAL_BY_ID.has(menuId)
    ? CANONICAL_MENU_ALPHA_MASK
    : undefined
}

/**
 * Gameplay geometry comes only from versioned manifest data and this bundled
 * canonical mask. Image decoding and Canvas readback are deliberately absent,
 * so every client judges the same gesture even when artwork falls back.
 */
export function getCanonicalMenuGameplayGeometry(
  menuId: string,
  maximumWidth: number,
  maximumHeight: number,
  artworkYOffset = -7,
): CanonicalMenuGameplayGeometry | undefined {
  const visual = getMenuVisual(menuId)
  if (!visual) {
    return undefined
  }

  const gameplayOffset = visual.gameplayOffset ?? { x: 0, y: 0 }
  return {
    renderBounds: calculateContainedSize(
      visual.sourceWidth,
      visual.sourceHeight,
      maximumWidth,
      maximumHeight,
    ),
    artworkCenter: {
      x: gameplayOffset.x,
      y: artworkYOffset + gameplayOffset.y,
    },
    captureCenter: {
      x: gameplayOffset.x,
      y: gameplayOffset.y,
    },
    alphaMask: CANONICAL_MENU_ALPHA_MASK,
  }
}

function waitForImageLoad(
  image: HTMLImageElement,
  visual: MenuVisual,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (result: 'load' | 'error' | 'timeout'): void => {
      if (settled) {
        return
      }
      settled = true
      globalThis.clearTimeout(timeout)
      image.removeEventListener('load', handleLoad)
      image.removeEventListener('error', handleError)

      if (result === 'load') {
        resolve()
      } else if (result === 'timeout') {
        reject(
          new MenuVisualDeadlineError(
            `Timed out loading ${visual.menuId}.`,
          ),
        )
      } else {
        reject(new Error(`Failed to load ${visual.menuId}.`))
      }
    }
    const handleLoad = (): void => finish('load')
    const handleError = (): void => finish('error')
    const timeout = globalThis.setTimeout(
      () => finish('timeout'),
      MENU_VISUAL_LOAD_DEADLINE_MS,
    )

    image.addEventListener('load', handleLoad, { once: true })
    image.addEventListener('error', handleError, { once: true })
    image.src = visual.imageUrl
  })
}

function waitForTaskWithDeadline(
  task: Promise<void>,
  deadlineMs: number,
  timeoutMessage: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void): void => {
      if (settled) {
        return
      }
      settled = true
      globalThis.clearTimeout(timeout)
      callback()
    }
    const timeout = globalThis.setTimeout(
      () =>
        finish(() => reject(new MenuVisualDeadlineError(timeoutMessage))),
      Math.max(0, deadlineMs),
    )
    void task.then(
      () => finish(resolve),
      (error: unknown) => finish(() => reject(error)),
    )
  })
}

function createCanonicalMenuAlphaMask(): AlphaSilhouetteMask {
  const resolution = MENU_ALPHA_MASK_RESOLUTION
  const radiusScaled = resolution * CANONICAL_SHAPE_RADIUS_PERCENT
  const alpha = new Uint8Array(resolution * resolution)

  for (let row = 0; row < resolution; row += 1) {
    const yScaled = (row * 2 + 1 - resolution) * 100
    for (let column = 0; column < resolution; column += 1) {
      const xScaled = (column * 2 + 1 - resolution) * 100
      if (
        xScaled * xScaled + yScaled * yScaled <=
        radiusScaled * radiusScaled
      ) {
        alpha[row * resolution + column] = 255
      }
    }
  }

  return createAlphaSilhouetteMask(resolution, resolution, alpha)
}

class MenuVisualDeadlineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MenuVisualDeadlineError'
  }
}

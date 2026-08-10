import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  MENU_VISUAL_DECODE_DEADLINE_MS,
  MENU_VISUAL_LOAD_DEADLINE_MS,
  getCanonicalMenuAlphaMask,
  getCanonicalMenuGameplayGeometry,
  getMenuVisual,
  getPreloadedMenuAlphaMask,
  getPreloadedMenuImage,
  preloadMenuVisuals,
} from '../src/data/menuVisuals'

type ImageEventType = 'load' | 'error'

class FakeImage {
  static readonly requests: string[] = []
  static readonly failOnceUrls = new Set<string>()
  static readonly pendingLoadUrls = new Set<string>()
  static readonly pendingDecodeUrls = new Set<string>()

  decoding = ''
  naturalWidth = 512
  naturalHeight = 512
  private readonly listeners = new Map<ImageEventType, (() => void)[]>()
  private currentUrl = ''

  static reset(): void {
    FakeImage.requests.length = 0
    FakeImage.failOnceUrls.clear()
    FakeImage.pendingLoadUrls.clear()
    FakeImage.pendingDecodeUrls.clear()
  }

  addEventListener(type: ImageEventType, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: ImageEventType, listener: () => void): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter(
        (candidate) => candidate !== listener,
      ),
    )
  }

  set src(value: string) {
    this.currentUrl = value
    FakeImage.requests.push(value)
    if (FakeImage.pendingLoadUrls.has(value)) {
      return
    }
    const shouldFail = FakeImage.failOnceUrls.delete(value)
    if (shouldFail) {
      this.naturalWidth = 0
      this.naturalHeight = 0
    }
    queueMicrotask(() => {
      for (const listener of this.listeners.get(
        shouldFail ? 'error' : 'load',
      ) ?? []) {
        listener()
      }
    })
  }

  decode(): Promise<void> {
    return FakeImage.pendingDecodeUrls.has(this.currentUrl)
      ? new Promise(() => undefined)
      : Promise.resolve()
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  FakeImage.reset()
})

describe('preloadMenuVisuals', () => {
  it('loads only requested menus, deduplicates overlap, and adds later subsets', async () => {
    vi.stubGlobal('Image', FakeImage)
    const ramyeonUrl = getMenuVisual('ramyeon')!.imageUrl
    const kimchiUrl = getMenuVisual('kimchi-jjigae')!.imageUrl
    const sushiUrl = getMenuVisual('sushi')!.imageUrl

    await Promise.all([
      preloadMenuVisuals(['ramyeon', 'kimchi-jjigae', 'ramyeon']),
      preloadMenuVisuals(['ramyeon']),
    ])

    expect(FakeImage.requests).toEqual(
      expect.arrayContaining([ramyeonUrl, kimchiUrl]),
    )
    expect(FakeImage.requests).toHaveLength(2)

    await preloadMenuVisuals(['ramyeon', 'sushi', 'menu-without-art'])

    expect(FakeImage.requests).toHaveLength(3)
    expect(FakeImage.requests.at(-1)).toBe(sushiUrl)
    expect(getPreloadedMenuImage('ramyeon')).toBeDefined()
    expect(getPreloadedMenuImage('sushi')).toBeDefined()
  })

  it('settles failed assets for fallback and retries them next time', async () => {
    vi.stubGlobal('Image', FakeImage)
    const pizzaUrl = getMenuVisual('pizza')!.imageUrl
    FakeImage.failOnceUrls.add(pizzaUrl)
    const requestsBefore = FakeImage.requests.length

    await expect(preloadMenuVisuals(['pizza'])).resolves.toBeUndefined()
    expect(getPreloadedMenuImage('pizza')).toBeUndefined()

    await expect(preloadMenuVisuals(['pizza'])).resolves.toBeUndefined()
    expect(FakeImage.requests.slice(requestsBefore)).toEqual([
      pizzaUrl,
      pizzaUrl,
    ])
    expect(getPreloadedMenuImage('pizza')).toBeDefined()
  })

  it('settles a load event that never arrives at the bounded deadline', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('Image', FakeImage)
    const menuId = 'hamburger'
    const imageUrl = getMenuVisual(menuId)!.imageUrl
    FakeImage.pendingLoadUrls.add(imageUrl)
    let settled = false
    const preparation = preloadMenuVisuals([menuId]).then(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(MENU_VISUAL_LOAD_DEADLINE_MS - 1)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(preparation).resolves.toBeUndefined()
    expect(settled).toBe(true)
    expect(getPreloadedMenuImage(menuId)).toBeUndefined()
    expect(getCanonicalMenuAlphaMask(menuId)?.totalWeight).toBeGreaterThan(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('settles a decode task that never resolves at the bounded deadline', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('Image', FakeImage)
    const menuId = 'pork-cutlet'
    const imageUrl = getMenuVisual(menuId)!.imageUrl
    FakeImage.pendingDecodeUrls.add(imageUrl)
    let settled = false
    const preparation = preloadMenuVisuals([menuId]).then(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(MENU_VISUAL_DECODE_DEADLINE_MS - 1)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(preparation).resolves.toBeUndefined()
    expect(settled).toBe(true)
    expect(getPreloadedMenuImage(menuId)).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps judgement geometry identical before and after artwork succeeds', async () => {
    vi.stubGlobal('Image', FakeImage)
    const createElement = vi.fn(() => {
      throw new Error('Canvas readback is unavailable')
    })
    vi.stubGlobal('document', { createElement })
    const menuId = 'jjajangmyeon'
    const fallbackGeometry = getCanonicalMenuGameplayGeometry(
      menuId,
      160,
      140,
    )
    const fallbackMask = getCanonicalMenuAlphaMask(menuId)

    await expect(preloadMenuVisuals([menuId])).resolves.toBeUndefined()

    expect(getPreloadedMenuImage(menuId)).toBeDefined()
    expect(getCanonicalMenuGameplayGeometry(menuId, 160, 140)).toEqual(
      fallbackGeometry,
    )
    expect(getCanonicalMenuAlphaMask(menuId)).toBe(fallbackMask)
    expect(getPreloadedMenuAlphaMask(menuId)).toBe(fallbackMask)
    expect(createElement).not.toHaveBeenCalled()
  })
})

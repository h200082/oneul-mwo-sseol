import { afterEach, describe, expect, it, vi } from 'vitest'

const hostMocks = vi.hoisted(() => ({
  getGameDeckMenuIds: vi.fn<() => readonly string[]>(),
  getMenuNarration: vi.fn(),
  preloadMenuVisuals: vi.fn(async () => undefined),
}))

vi.mock('../src/game/createGame', () => ({ createGame: vi.fn() }))
vi.mock('../src/game/gameDeck', () => ({
  getGameDeckMenuIds: hostMocks.getGameDeckMenuIds,
}))
vi.mock('../src/data/menuNarrations', () => ({
  getMenuNarration: hostMocks.getMenuNarration,
}))
vi.mock('../src/data/menuVisuals', () => ({
  preloadMenuVisuals: hostMocks.preloadMenuVisuals,
}))

import {
  GameHost,
  MENU_VISUAL_PREPARE_DEADLINE_MS,
  NARRATION_PREPARE_DEADLINE_MS,
  waitForOptionalNarrationPreparation,
} from '../src/app/GameHost'
import {
  NARRATION_INITIAL_ROUND_PRELOAD_COUNT,
  NOOP_SENSORY_FEEDBACK,
  type SensoryFeedback,
} from '../src/feedback/SensoryFeedback'
import { DEFAULT_GAME_LAUNCH_OPTIONS } from '../src/game/gameTypes'

describe('optional narration preparation deadline', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('lets game startup continue after the 1.2 second deadline', async () => {
    vi.useFakeTimers()
    let resolvePreparation: (() => void) | undefined
    const preparation = new Promise<void>((resolve) => {
      resolvePreparation = resolve
    })
    let startupReleased = false
    const waiting = waitForOptionalNarrationPreparation(preparation).then(() => {
      startupReleased = true
    })

    await vi.advanceTimersByTimeAsync(NARRATION_PREPARE_DEADLINE_MS - 1)
    expect(startupReleased).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(waiting).resolves.toBeUndefined()
    expect(startupReleased).toBe(true)

    resolvePreparation?.()
    await Promise.resolve()
  })

  it('finishes early on success and treats audio failure as optional', async () => {
    vi.useFakeTimers()

    await expect(
      waitForOptionalNarrationPreparation(Promise.resolve(), 10_000),
    ).resolves.toBeUndefined()
    await expect(
      waitForOptionalNarrationPreparation(
        Promise.reject(new Error('optional MP3 unavailable')),
        10_000,
      ),
    ).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('marks only the first five deck rounds as initial narration loads', async () => {
    const menuIds = Array.from({ length: 8 }, (_, index) => `menu-${index}`)
    hostMocks.getGameDeckMenuIds.mockReturnValue(menuIds)
    hostMocks.getMenuNarration.mockImplementation((menuId: string) => ({
      audioUrl: `/${menuId}.mp3`,
    }))
    const prepareNarrations = vi.fn(async () => undefined)
    const sensoryFeedback = Object.create(
      NOOP_SENSORY_FEEDBACK,
    ) as SensoryFeedback
    Object.defineProperty(sensoryFeedback, 'prepareNarrations', {
      value: prepareNarrations,
    })
    const host = new GameHost(
      {} as HTMLElement,
      () => undefined,
      undefined,
      undefined,
      sensoryFeedback,
    )

    await expect(host.prepare(DEFAULT_GAME_LAUNCH_OPTIONS)).resolves.toBeUndefined()

    expect(prepareNarrations).toHaveBeenCalledOnce()
    expect(prepareNarrations).toHaveBeenCalledWith(
      menuIds.map((id, roundIndex) => ({
        id,
        url: `/${id}.mp3`,
        preloadPriority:
          roundIndex < NARRATION_INITIAL_ROUND_PRELOAD_COUNT
            ? 'initial-round'
            : 'background',
      })),
    )
    expect(hostMocks.preloadMenuVisuals).toHaveBeenCalledWith(menuIds)
  })

  it('releases game startup when visual preparation never settles', async () => {
    vi.useFakeTimers()
    hostMocks.getGameDeckMenuIds.mockReturnValue(['ramyeon'])
    hostMocks.getMenuNarration.mockReturnValue(undefined)
    hostMocks.preloadMenuVisuals.mockReturnValueOnce(
      new Promise(() => undefined),
    )
    const host = new GameHost(
      {} as HTMLElement,
      () => undefined,
    )
    let startupReleased = false
    const preparation = host
      .prepare(DEFAULT_GAME_LAUNCH_OPTIONS)
      .then(() => {
        startupReleased = true
      })

    await vi.advanceTimersByTimeAsync(
      MENU_VISUAL_PREPARE_DEADLINE_MS - 1,
    )
    expect(startupReleased).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(preparation).resolves.toBeUndefined()
    expect(startupReleased).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})

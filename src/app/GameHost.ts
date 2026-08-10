import type Phaser from 'phaser'

import { getMenuNarration } from '../data/menuNarrations'
import { preloadMenuVisuals } from '../data/menuVisuals'
import {
  NARRATION_INITIAL_ROUND_PRELOAD_COUNT,
  NOOP_SENSORY_FEEDBACK,
  type NarrationAudioAsset,
  type SensoryFeedback,
} from '../feedback/SensoryFeedback'
import type { NarrationPreference } from '../feedback/narrationPreference'
import { createGame } from '../game/createGame'
import { getGameDeckMenuIds } from '../game/gameDeck'
import type {
  GameLaunchOptions,
  PlayerGameResultHandler,
} from '../game/gameTypes'
import type { RoomGameProgressStore } from '../game/gameProgress'

type DebugWindow = Window & {
  __NHN_GAME__?: Phaser.Game
}

export const NARRATION_PREPARE_DEADLINE_MS = 1_200
export const MENU_VISUAL_PREPARE_DEADLINE_MS = 2_000

export function waitForOptionalPreparation(
  task: Promise<void>,
  deadlineMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (): void => {
      if (settled) {
        return
      }
      settled = true
      globalThis.clearTimeout(timeout)
      resolve()
    }
    const timeout = globalThis.setTimeout(finish, Math.max(0, deadlineMs))
    void task.catch(() => undefined).then(finish)
  })
}

export function waitForOptionalNarrationPreparation(
  task: Promise<void>,
  deadlineMs = NARRATION_PREPARE_DEADLINE_MS,
): Promise<void> {
  return waitForOptionalPreparation(task, deadlineMs)
}

export class GameHost {
  private game: Phaser.Game | null = null

  constructor(
    private readonly root: HTMLElement,
    private readonly onReturnHome: () => void,
    private readonly onGameResult?: PlayerGameResultHandler,
    private readonly progressStore?: RoomGameProgressStore,
    private readonly sensoryFeedback: SensoryFeedback =
      NOOP_SENSORY_FEEDBACK,
    private readonly narrationPreference?: NarrationPreference,
  ) {}

  prepare(options: GameLaunchOptions): Promise<void> {
    const menuIds = getGameDeckMenuIds(options)
    const narrationAssets = menuIds.flatMap((menuId, roundIndex) => {
      const audioUrl = getMenuNarration(menuId)?.audioUrl
      return audioUrl
        ? ([
            {
              id: menuId,
              url: audioUrl,
              preloadPriority:
                roundIndex < NARRATION_INITIAL_ROUND_PRELOAD_COUNT
                  ? 'initial-round'
                  : 'background',
            },
          ] satisfies NarrationAudioAsset[])
        : []
    })

    const narrationPreparation = this.sensoryFeedback.prepareNarrations(
      narrationAssets,
    )
    return Promise.allSettled([
      waitForOptionalPreparation(
        preloadMenuVisuals(menuIds),
        MENU_VISUAL_PREPARE_DEADLINE_MS,
      ),
      waitForOptionalNarrationPreparation(narrationPreparation),
    ]).then(() => undefined)
  }

  start(options: GameLaunchOptions): Phaser.Game {
    this.stop()
    this.root.hidden = false

    const game = createGame(
      this.root,
      options,
      this.onGameResult,
      this.progressStore,
      this.sensoryFeedback,
      this.narrationPreference,
    )
    this.game = game
    game.events.once('return-home', this.onReturnHome)

    if (import.meta.env.DEV) {
      const debugWindow = window as DebugWindow
      debugWindow.__NHN_GAME__ = game
    }

    return game
  }

  stop(): void {
    this.sensoryFeedback.stopAll()
    if (this.game) {
      this.game.destroy(true)
      this.game = null
    }

    this.root.replaceChildren()
    this.root.hidden = true

    if (import.meta.env.DEV) {
      delete (window as DebugWindow).__NHN_GAME__
    }
  }
}

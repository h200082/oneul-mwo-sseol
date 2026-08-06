import type Phaser from 'phaser'

import {
  NOOP_SENSORY_FEEDBACK,
  type SensoryFeedback,
} from '../feedback/SensoryFeedback'
import { createGame } from '../game/createGame'
import type {
  GameLaunchOptions,
  PlayerGameResultHandler,
} from '../game/gameTypes'
import type { RoomGameProgressStore } from '../game/gameProgress'

type DebugWindow = Window & {
  __NHN_GAME__?: Phaser.Game
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
  ) {}

  start(options: GameLaunchOptions): Phaser.Game {
    this.stop()
    this.root.hidden = false

    const game = createGame(
      this.root,
      options,
      this.onGameResult,
      this.progressStore,
      this.sensoryFeedback,
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

import type Phaser from 'phaser'

import { createGame } from '../game/createGame'
import type {
  GameLaunchOptions,
  PlayerGameResultHandler,
} from '../game/gameTypes'

type DebugWindow = Window & {
  __NHN_GAME__?: Phaser.Game
}

export class GameHost {
  private game: Phaser.Game | null = null

  constructor(
    private readonly root: HTMLElement,
    private readonly onReturnHome: () => void,
    private readonly onGameResult?: PlayerGameResultHandler,
  ) {}

  start(options: GameLaunchOptions): Phaser.Game {
    this.stop()
    this.root.hidden = false

    const game = createGame(
      this.root,
      options,
      this.onGameResult,
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

import Phaser from 'phaser'
import {
  NOOP_SENSORY_FEEDBACK,
  type SensoryFeedback,
} from '../feedback/SensoryFeedback'
import type { NarrationPreference } from '../feedback/narrationPreference'
import {
  DEFAULT_GAME_LAUNCH_OPTIONS,
  type GameLaunchOptions,
  type PlayerGameResultHandler,
} from './gameTypes'
import type { RoomGameProgressStore } from './gameProgress'
import { PrototypeScene } from './scenes/PrototypeScene'

export const LOGICAL_WIDTH = 390
export const LOGICAL_HEIGHT = 844
export const COMPACT_GAME_MAX_WIDTH = 360
export const COMPACT_GAME_MAX_HEIGHT = 640

export function shouldUseCompactGameLayout(
  width: number,
  height: number,
): boolean {
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0 &&
    width <= COMPACT_GAME_MAX_WIDTH &&
    height <= COMPACT_GAME_MAX_HEIGHT &&
    height >= width
  )
}

export function createGame(
  parent: HTMLElement,
  launchOptions: GameLaunchOptions = DEFAULT_GAME_LAUNCH_OPTIONS,
  onGameResult?: PlayerGameResultHandler,
  progressStore?: RoomGameProgressStore,
  sensoryFeedback: SensoryFeedback = NOOP_SENSORY_FEEDBACK,
  narrationPreference?: NarrationPreference,
): Phaser.Game {
  const compactLayout = shouldUseCompactGameLayout(
    parent.clientWidth,
    parent.clientHeight,
  )
  const scene = new PrototypeScene(
    launchOptions,
    onGameResult,
    progressStore,
    sensoryFeedback,
    narrationPreference,
  )

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    backgroundColor: '#111923',
    render: {
      antialias: true,
      roundPixels: false,
    },
    scale: {
      mode: compactLayout ? Phaser.Scale.RESIZE : Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    },
    input: {
      activePointers: 2,
    },
    scene: [scene],
    ...(compactLayout
      ? {
          callbacks: {
            postBoot: (game: Phaser.Game) => {
              installCompactCameraLayout(game, scene)
            },
          },
        }
      : {}),
  })
}

function installCompactCameraLayout(
  game: Phaser.Game,
  scene: Phaser.Scene,
): void {
  const applyLayout = (): void => {
    const width = game.scale.width
    const height = game.scale.height
    const camera = scene.cameras.main

    camera.setSize(width, height)
    camera.setZoom(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT)
    camera.centerOn(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2)
  }

  applyLayout()
  scene.events.on(Phaser.Scenes.Events.CREATE, applyLayout)
  game.scale.on(Phaser.Scale.Events.RESIZE, applyLayout)
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.CREATE, applyLayout)
    game.scale.off(Phaser.Scale.Events.RESIZE, applyLayout)
  })
}

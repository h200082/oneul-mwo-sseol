import Phaser from 'phaser'
import {
  NOOP_SENSORY_FEEDBACK,
  type SensoryFeedback,
} from '../feedback/SensoryFeedback'
import {
  DEFAULT_GAME_LAUNCH_OPTIONS,
  type GameLaunchOptions,
  type PlayerGameResultHandler,
} from './gameTypes'
import type { RoomGameProgressStore } from './gameProgress'
import { PrototypeScene } from './scenes/PrototypeScene'

export const LOGICAL_WIDTH = 390
export const LOGICAL_HEIGHT = 844

export function createGame(
  parent: HTMLElement,
  launchOptions: GameLaunchOptions = DEFAULT_GAME_LAUNCH_OPTIONS,
  onGameResult?: PlayerGameResultHandler,
  progressStore?: RoomGameProgressStore,
  sensoryFeedback: SensoryFeedback = NOOP_SENSORY_FEEDBACK,
): Phaser.Game {
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
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    },
    input: {
      activePointers: 2,
    },
    scene: [
      new PrototypeScene(
        launchOptions,
        onGameResult,
        progressStore,
        sensoryFeedback,
      ),
    ],
  })
}

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
export const MAX_GAME_RENDER_SCALE = 2

export function resolveGameRenderScale(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 1) {
    return 1
  }

  return Math.min(devicePixelRatio, MAX_GAME_RENDER_SCALE)
}

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
  const renderScale = resolveGameRenderScale(window.devicePixelRatio)
  const compactLayout = shouldUseCompactGameLayout(
    parent.clientWidth,
    parent.clientHeight,
  )
  const backingWidth = Math.max(
    1,
    Math.round(
      (compactLayout ? parent.clientWidth : LOGICAL_WIDTH) * renderScale,
    ),
  )
  const backingHeight = Math.max(
    1,
    Math.round(
      (compactLayout ? parent.clientHeight : LOGICAL_HEIGHT) * renderScale,
    ),
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
    width: backingWidth,
    height: backingHeight,
    backgroundColor: '#111923',
    render: {
      antialias: true,
      roundPixels: false,
    },
    scale: {
      mode: compactLayout ? Phaser.Scale.NONE : Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: backingWidth,
      height: backingHeight,
      ...(compactLayout ? { zoom: 1 / renderScale } : {}),
    },
    input: {
      activePointers: 2,
    },
    scene: [scene],
    callbacks: {
      postBoot: (game: Phaser.Game) => {
        installHighResolutionLayout(
          game,
          scene,
          parent,
          renderScale,
          compactLayout,
        )
      },
    },
  })
}

function installHighResolutionLayout(
  game: Phaser.Game,
  scene: Phaser.Scene,
  parent: HTMLElement,
  renderScale: number,
  compactLayout: boolean,
): void {
  const applyTextResolution = (gameObject: Phaser.GameObjects.GameObject): void => {
    if (
      gameObject instanceof Phaser.GameObjects.Text &&
      gameObject.style.resolution !== renderScale
    ) {
      gameObject.setResolution(renderScale)
    }
  }

  const applyLayout = (): void => {
    const width = game.scale.width
    const height = game.scale.height
    const camera = scene.cameras.main
    const uniformZoom = Math.min(
      width / LOGICAL_WIDTH,
      height / LOGICAL_HEIGHT,
    )

    camera.setSize(width, height)
    camera.setZoom(uniformZoom)
    camera.centerOn(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2)
    scene.children.list.forEach(applyTextResolution)
  }

  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, applyTextResolution)
  applyLayout()
  scene.events.on(Phaser.Scenes.Events.CREATE, applyLayout)
  game.scale.on(Phaser.Scale.Events.RESIZE, applyLayout)

  let compactResizeObserver: ResizeObserver | undefined
  let compactWindowResizeHandler: (() => void) | undefined
  if (compactLayout) {
    const resizeCompactBackingStore = (): void => {
      const width = Math.max(1, Math.round(parent.clientWidth * renderScale))
      const height = Math.max(1, Math.round(parent.clientHeight * renderScale))

      if (width !== game.scale.width || height !== game.scale.height) {
        game.scale.resize(width, height)
      }
    }

    if (typeof ResizeObserver === 'undefined') {
      compactWindowResizeHandler = resizeCompactBackingStore
      window.addEventListener('resize', compactWindowResizeHandler)
    } else {
      compactResizeObserver = new ResizeObserver(resizeCompactBackingStore)
      compactResizeObserver.observe(parent)
    }
    resizeCompactBackingStore()
  }

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    compactResizeObserver?.disconnect()
    if (compactWindowResizeHandler) {
      window.removeEventListener('resize', compactWindowResizeHandler)
    }
    scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, applyTextResolution)
    scene.events.off(Phaser.Scenes.Events.CREATE, applyLayout)
    game.scale.off(Phaser.Scale.Events.RESIZE, applyLayout)
  })
}

import { expect, test, type Page } from '@playwright/test'

interface RotationDebugState {
  readonly enabled: boolean
  readonly direction: -1 | 0 | 1
  readonly turns: number
  readonly targetDegrees: number
  readonly currentDegrees: number
  readonly labelDegrees: 0
}

interface RotationSceneDebugState {
  readonly activeToken: {
    readonly menuId: string
    readonly rotation: RotationDebugState
  } | null
  readonly completedRounds: number
  readonly deckSeed: number | string
  readonly introVisible: boolean
}

interface RotationTestWindow extends Window {
  __NHN_APP__?: {
    getDebugState: () => {
      startSoloGameForTest: (deckSeed: number | string) => void
    }
  }
  __NHN_GAME__?: {
    scene: {
      getScene: (key: string) => {
        getDebugState: () => RotationSceneDebugState
      }
    }
  }
}

interface VisualStructure {
  readonly artworkIsTopLevel: boolean
  readonly artworkImageCount: number
  readonly foodTextureImageCount: number
  readonly topLevelImageCount: number
  readonly imageLocalAngles: readonly number[]
  readonly labelIsTopLevel: boolean
  readonly labelPlateIsTopLevel: boolean
  readonly labelDegrees: number | null
  readonly artworkDegrees: number
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('keeps rounds 1-5 still and starts deterministic nested rotation at round 6', async ({
  page,
}) => {
  test.setTimeout(75_000)
  const deckSeed = 'rotation-e2e-seed-v1'
  await startSeededGame(page, deckSeed)

  for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
    const state = await readDebugState(page)
    expect(state.completedRounds).toBe(roundIndex)
    expect(state.activeToken?.rotation).toEqual({
      enabled: false,
      direction: 0,
      turns: 0,
      targetDegrees: 0,
      currentDegrees: 0,
      labelDegrees: 0,
    })

    const structure = await readVisualStructure(page)
    expect(structure.labelDegrees).toBe(0)
    expect(structure.labelIsTopLevel).toBe(true)
    await forceMissAndWaitForRound(page, roundIndex)
  }

  const firstRotation = await readDebugState(page)
  const firstToken = firstRotation.activeToken
  expect(firstRotation.completedRounds).toBe(5)
  expect(firstToken).not.toBeNull()
  if (!firstToken) return

  expect(firstToken.rotation.enabled).toBe(true)
  expect(firstToken.rotation.turns).toBe(0.5)
  expect(Math.abs(firstToken.rotation.targetDegrees)).toBe(180)
  expect(firstToken.rotation.direction).toBe(
    Math.sign(firstToken.rotation.targetDegrees),
  )
  expect(firstToken.rotation.labelDegrees).toBe(0)

  const initialStructure = await readVisualStructure(page)
  expect(initialStructure).toMatchObject({
    artworkIsTopLevel: true,
    artworkImageCount: 3,
    foodTextureImageCount: 3,
    topLevelImageCount: 0,
    labelIsTopLevel: true,
    labelPlateIsTopLevel: true,
    labelDegrees: 0,
  })
  expect(initialStructure.imageLocalAngles).toEqual([0, 0, 0])

  const initialDegrees = firstToken.rotation.currentDegrees
  await page.waitForTimeout(220)
  const movingRotation = await readDebugState(page)
  const movingToken = movingRotation.activeToken
  expect(movingToken?.menuId).toBe(firstToken.menuId)
  if (!movingToken) return

  expect(
    Math.abs(movingToken.rotation.currentDegrees - initialDegrees),
  ).toBeGreaterThan(5)
  expect(Math.sign(movingToken.rotation.currentDegrees)).toBe(
    movingToken.rotation.direction,
  )
  expect(movingToken.rotation.labelDegrees).toBe(0)

  const movingStructure = await readVisualStructure(page)
  expect(movingStructure.imageLocalAngles).toEqual([0, 0, 0])
  expect(movingStructure.labelDegrees).toBe(0)
  expect(
    Math.abs(
      movingStructure.artworkDegrees -
        movingToken.rotation.currentDegrees,
    ),
  ).toBeLessThan(3)

  const expectedReplay = {
    menuId: firstToken.menuId,
    direction: firstToken.rotation.direction,
    targetDegrees: firstToken.rotation.targetDegrees,
  }
  await startSeededGame(page, deckSeed)
  await advanceToRound(page, 5)

  const replay = await readDebugState(page)
  expect(replay.activeToken).toMatchObject({
    menuId: expectedReplay.menuId,
    rotation: {
      enabled: true,
      direction: expectedReplay.direction,
      turns: 0.5,
      targetDegrees: expectedReplay.targetDegrees,
      labelDegrees: 0,
    },
  })
})

async function startSeededGame(
  page: Page,
  deckSeed: number | string,
): Promise<void> {
  await page.waitForFunction(() =>
    Boolean((window as RotationTestWindow).__NHN_APP__),
  )
  await page.evaluate((seed) => {
    const app = (window as RotationTestWindow).__NHN_APP__
    if (!app) throw new Error('App debug hook is unavailable.')
    app.getDebugState().startSoloGameForTest(seed)
  }, deckSeed)

  const canvas = page.locator('#game-root canvas')
  await expect(canvas).toBeVisible()
  await waitForRound(page, 0)
}

async function advanceToRound(
  page: Page,
  targetRoundIndex: number,
): Promise<void> {
  const state = await readDebugState(page)
  for (
    let roundIndex = state.completedRounds;
    roundIndex < targetRoundIndex;
    roundIndex += 1
  ) {
    await forceMissAndWaitForRound(page, roundIndex)
  }
}

async function forceMissAndWaitForRound(
  page: Page,
  currentRoundIndex: number,
): Promise<void> {
  await page.evaluate((expectedRoundIndex) => {
    const scene = (window as RotationTestWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    ) as
      | {
          getDebugState: () => RotationSceneDebugState
          resolveRound: (action: { readonly type: 'miss' }) => void
        }
      | undefined
    if (!scene) throw new Error('Prototype scene is unavailable.')
    const state = scene.getDebugState()
    if (
      state.completedRounds !== expectedRoundIndex ||
      !state.activeToken
    ) {
      throw new Error('Cannot force a miss outside the expected active round.')
    }
    scene.resolveRound({ type: 'miss' })
  }, currentRoundIndex)

  await waitForRound(page, currentRoundIndex + 1)
}

async function waitForRound(
  page: Page,
  roundIndex: number,
): Promise<void> {
  await page.waitForFunction((expectedRoundIndex) => {
    const scene = (window as RotationTestWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) return false
    const state = scene.getDebugState()
    return (
      state.completedRounds === expectedRoundIndex &&
      state.activeToken !== null
    )
  }, roundIndex)
}

async function readDebugState(
  page: Page,
): Promise<RotationSceneDebugState> {
  return page.evaluate(() => {
    const scene = (window as RotationTestWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) throw new Error('Prototype scene is unavailable.')
    return scene.getDebugState()
  })
}

async function readVisualStructure(
  page: Page,
): Promise<VisualStructure> {
  return page.evaluate(() => {
    interface RuntimeNode {
      readonly type?: string
      readonly angle?: number
      readonly texture?: { readonly key?: string }
      readonly list?: readonly RuntimeNode[]
      readonly parentContainer?: RuntimeNode | null
    }
    const scene = (window as RotationTestWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    ) as
      | {
          activeToken?: {
            readonly menu?: { readonly id?: string }
            readonly container?: RuntimeNode
            readonly rotatingArtwork?: RuntimeNode
          }
        }
      | undefined
    const token = scene?.activeToken
    const outer = token?.container
    const artwork = token?.rotatingArtwork
    if (!token || !outer?.list || !artwork?.list) {
      throw new Error('Nested token artwork is unavailable.')
    }

    const images = artwork.list.filter((node) => node.type === 'Image')
    const label = outer.list.find((node) => node.type === 'Text')
    const labelPlate = outer.list.find((node) => node.type === 'Rectangle')
    const textureKey = 'food:' + (token.menu?.id ?? '')
    return {
      artworkIsTopLevel: outer.list.includes(artwork),
      artworkImageCount: images.length,
      foodTextureImageCount: images.filter(
        (node) => node.texture?.key === textureKey,
      ).length,
      topLevelImageCount: outer.list.filter(
        (node) => node.type === 'Image',
      ).length,
      imageLocalAngles: images.map((node) => node.angle ?? 0),
      labelIsTopLevel: label?.parentContainer === outer,
      labelPlateIsTopLevel: labelPlate?.parentContainer === outer,
      labelDegrees: label?.angle ?? null,
      artworkDegrees: artwork.angle ?? 0,
    }
  })
}

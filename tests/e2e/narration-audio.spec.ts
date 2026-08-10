import { expect, test, type Page, type Request } from '@playwright/test'

import { MENU_NARRATION_AUDIO_IDS } from '../../src/data/menuNarrationAudioIds'
import { getGameDeckMenuIds } from '../../src/game/gameDeck'
import { enterMainMenu } from './appEntry'

const APPROVED_AUDIO_IDS = new Set<string>(MENU_NARRATION_AUDIO_IDS)

interface SensoryDebugState {
  readonly audioState: 'unavailable' | 'locked' | 'running' | 'suspended' | 'closed'
  readonly musicPlaying: boolean
  readonly narrationPreparedCount: number
  readonly narrationRequestCount: number
  readonly narrationPlayCount: number
  readonly narrationPlaying: boolean
  readonly musicDucked: boolean
}

interface GameDebugState {
  readonly activeToken: { readonly menuId: string } | null
  readonly introVisible: boolean
  readonly narration: {
    readonly menuId: string | null
    readonly text: string | null
    readonly captionVisible: boolean
    readonly requestedEnabled: boolean
    readonly effectiveEnabled: boolean
    readonly audioStarted: boolean
  }
  readonly sensoryFeedback: SensoryDebugState
}

interface NarrationProbe {
  readonly decodedByteLengths: number[]
  bufferStarts: number
  bufferStops: number
  finishLatestNarration(): void
}

interface NarrationDebugWindow extends Window {
  __NARRATION_AUDIO_PROBE__?: NarrationProbe
  __NHN_APP__?: {
    getDebugState(): {
      readonly sensoryFeedback: SensoryDebugState
      readonly gameVisible: boolean
      readonly startSoloGameForTest: (deckSeed: number | string) => void
    }
    setNarrationEnabled(enabled: boolean): void
  }
  __NHN_GAME__?: {
    readonly events: { emit(eventName: string): void }
    readonly scene: {
      getScene(sceneKey: string): { getDebugState(): GameDebugState }
    }
  }
}

interface SeedCase {
  readonly seed: string
  readonly mealTime: 'lunch' | 'dinner'
  readonly deck: readonly string[]
  readonly firstMenuId: string
  readonly audioMenuIds: readonly string[]
}

interface NarrationRequestAudit {
  readonly allUrls: string[]
  readonly audioFetchUrls: string[]
  readonly audioResponseStatuses: number[]
}

const AUDIO_FIRST_CASE = findSeedCase(
  'narration-audio-first',
  (deck) => APPROVED_AUDIO_IDS.has(deck[0] ?? ''),
)
const CAPTION_ONLY_FIRST_CASE = findOptionalSeedCase(
  'narration-caption-only-first',
  (deck) => !APPROVED_AUDIO_IDS.has(deck[0] ?? ''),
)
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The controlled Web Audio integration probe runs on desktop Chromium first.',
  )
})

test('현재 덱의 정적 오디오만 준비하고 첫 음식 음성 재생과 BGM 덕킹을 완료한다', async ({
  page,
}) => {
  const audit = installNarrationRequestAudit(page)
  await installNarrationAudioProbe(page)
  await startSoloGameWithSeed(
    page,
    AUDIO_FIRST_CASE.seed,
    AUDIO_FIRST_CASE.mealTime,
  )

  await expect
    .poll(async () => (await readGameDebug(page)).narration.audioStarted)
    .toBe(true)
  const state = await readGameDebug(page)
  const catalogEntry = await readNarrationCatalogEntry(
    page,
    AUDIO_FIRST_CASE.firstMenuId,
  )

  expect(state.activeToken?.menuId).toBe(AUDIO_FIRST_CASE.firstMenuId)
  expect(catalogEntry?.audioUrl).toBeTruthy()
  expect(state.narration).toMatchObject({
    menuId: AUDIO_FIRST_CASE.firstMenuId,
    text: catalogEntry?.text,
    captionVisible: true,
    requestedEnabled: true,
    effectiveEnabled: true,
    audioStarted: true,
  })
  expect(state.sensoryFeedback).toMatchObject({
    audioState: 'running',
    musicPlaying: true,
    narrationPreparedCount: AUDIO_FIRST_CASE.audioMenuIds.length,
    narrationRequestCount: 1,
    narrationPlayCount: 1,
    narrationPlaying: true,
    musicDucked: true,
  })

  await assertDeckOnlyNarrationRequests(audit, AUDIO_FIRST_CASE.audioMenuIds)
  expect(audit.allUrls.some(isAzureSpeechUrl)).toBe(false)
  expect(await readNarrationProbe(page)).toMatchObject({
    bufferStarts: 1,
    bufferStops: 0,
  })

  await page.evaluate(() => {
    const probe = (window as NarrationDebugWindow).__NARRATION_AUDIO_PROBE__
    if (!probe) throw new Error('나레이션 오디오 프로브를 찾을 수 없습니다.')
    probe.finishLatestNarration()
  })

  await expect
    .poll(async () => (await readSensoryDebug(page)).narrationPlaying)
    .toBe(false)
  await expect
    .poll(async () => (await readSensoryDebug(page)).musicDucked)
    .toBe(false)
  expect((await readSensoryDebug(page)).musicPlaying).toBe(true)
})

test('VOX를 끄면 재생 중 음성을 멈추되 현재 음식 말풍선은 유지한다', async ({
  page,
}) => {
  await installNarrationAudioProbe(page)
  await startSoloGameWithSeed(
    page,
    AUDIO_FIRST_CASE.seed,
    AUDIO_FIRST_CASE.mealTime,
  )
  await expect
    .poll(async () => (await readSensoryDebug(page)).narrationPlaying)
    .toBe(true)

  const before = await readGameDebug(page)
  expect(before.narration.captionVisible).toBe(true)
  await page.evaluate(() => {
    const app = (window as NarrationDebugWindow).__NHN_APP__
    if (!app) throw new Error('앱 디버그 상태를 찾을 수 없습니다.')
    app.setNarrationEnabled(false)
  })

  const after = await readGameDebug(page)
  expect(after.narration).toMatchObject({
    menuId: before.narration.menuId,
    text: before.narration.text,
    captionVisible: true,
    requestedEnabled: false,
    effectiveEnabled: false,
    audioStarted: false,
  })
  expect(after.sensoryFeedback).toMatchObject({
    narrationPlaying: false,
    musicDucked: false,
    musicPlaying: true,
  })
  expect((await readNarrationProbe(page)).bufferStops).toBe(1)
})

test('재생 중 홈 복귀는 음성·덕킹·BGM과 게임 씬을 함께 정리한다', async ({
  page,
}) => {
  await installNarrationAudioProbe(page)
  await startSoloGameWithSeed(
    page,
    AUDIO_FIRST_CASE.seed,
    AUDIO_FIRST_CASE.mealTime,
  )
  await expect
    .poll(async () => (await readSensoryDebug(page)).narrationPlaying)
    .toBe(true)

  await page.evaluate(() => {
    const game = (window as NarrationDebugWindow).__NHN_GAME__
    if (!game) throw new Error('게임 디버그 상태를 찾을 수 없습니다.')
    game.events.emit('return-home')
  })

  await expect(page.getByTestId('home-screen')).toBeVisible()
  const appState = await page.evaluate(() => {
    const app = (window as NarrationDebugWindow).__NHN_APP__
    if (!app) throw new Error('앱 디버그 상태를 찾을 수 없습니다.')
    return app.getDebugState()
  })
  expect(appState.gameVisible).toBe(false)
  expect(appState.sensoryFeedback).toMatchObject({
    musicPlaying: false,
    narrationPlaying: false,
    musicDucked: false,
  })
  expect((await readNarrationProbe(page)).bufferStops).toBeGreaterThanOrEqual(1)
  expect(
    await page.evaluate(
      () => (window as NarrationDebugWindow).__NHN_GAME__ === undefined,
    ),
  ).toBe(true)
})

test('음원이 없는 첫 음식은 캡션만 표시하고 승인된 덱 음원만 준비한다', async ({
  page,
}) => {
  const seedCase = CAPTION_ONLY_FIRST_CASE
  test.skip(
    seedCase === null,
    '현재 모든 메뉴에 승인된 음원이 있어 캡션 전용 시나리오가 없습니다.',
  )
  if (!seedCase) return

  const audit = installNarrationRequestAudit(page)
  await installNarrationAudioProbe(page)
  const state = await startSoloGameWithSeed(
    page,
    seedCase.seed,
    seedCase.mealTime,
  )
  const catalogEntry = await readNarrationCatalogEntry(
    page,
    seedCase.firstMenuId,
  )

  expect(state.activeToken?.menuId).toBe(seedCase.firstMenuId)
  expect(catalogEntry?.audioUrl).toBeNull()
  expect(state.narration).toMatchObject({
    menuId: seedCase.firstMenuId,
    text: catalogEntry?.text,
    captionVisible: true,
    requestedEnabled: true,
    effectiveEnabled: true,
    audioStarted: false,
  })
  expect(state.sensoryFeedback).toMatchObject({
    narrationPreparedCount: seedCase.audioMenuIds.length,
    narrationRequestCount: 1,
    narrationPlayCount: 0,
    narrationPlaying: false,
    musicDucked: false,
  })
  expect((await readNarrationProbe(page)).bufferStarts).toBe(0)
  await assertDeckOnlyNarrationRequests(audit, seedCase.audioMenuIds)
  expect(audit.allUrls.some(isAzureSpeechUrl)).toBe(false)
})

function findSeedCase(
  prefix: string,
  predicate: (deck: readonly string[]) => boolean,
): SeedCase {
  const seedCase = findOptionalSeedCase(prefix, predicate)
  if (seedCase) return seedCase
  throw new Error(`${prefix} 조건을 만족하는 결정적 덱 시드를 찾지 못했습니다.`)
}

function findOptionalSeedCase(
  prefix: string,
  predicate: (deck: readonly string[]) => boolean,
): SeedCase | null {
  for (const mealTime of ['lunch', 'dinner'] as const) {
    for (let index = 0; index < 20_000; index += 1) {
      const seed = `${prefix}-${index}`
      const deck = getGameDeckMenuIds({ mealTime, deckSeed: seed })
      if (!predicate(deck)) continue

      return {
        seed,
        mealTime,
        deck,
        firstMenuId: deck[0]!,
        audioMenuIds: deck.filter((menuId) => APPROVED_AUDIO_IDS.has(menuId)),
      }
    }
  }
  return null
}

function installNarrationRequestAudit(page: Page): NarrationRequestAudit {
  const audit: NarrationRequestAudit = {
    allUrls: [],
    audioFetchUrls: [],
    audioResponseStatuses: [],
  }
  page.on('request', (request) => {
    audit.allUrls.push(request.url())
    if (isRuntimeNarrationAudioFetch(request)) {
      audit.audioFetchUrls.push(request.url())
    }
  })
  page.on('response', (response) => {
    if (isRuntimeNarrationAudioFetch(response.request())) {
      audit.audioResponseStatuses.push(response.status())
    }
  })
  return audit
}

function isRuntimeNarrationAudioFetch(request: Request): boolean {
  return (
    request.resourceType() === 'fetch' &&
    /\.(?:mp3|wav)$/.test(new URL(request.url()).pathname.toLowerCase())
  )
}

function isAzureSpeechUrl(rawUrl: string): boolean {
  const hostname = new URL(rawUrl).hostname.toLowerCase()
  return (
    hostname.includes('cognitiveservices.azure.com') ||
    hostname.includes('api.cognitive.microsoft.com') ||
    hostname.includes('speech.microsoft.com')
  )
}

async function assertDeckOnlyNarrationRequests(
  audit: NarrationRequestAudit,
  expectedMenuIds: readonly string[],
): Promise<void> {
  await expect.poll(() => audit.audioFetchUrls.length).toBe(expectedMenuIds.length)
  await expect
    .poll(() => audit.audioResponseStatuses.length)
    .toBe(expectedMenuIds.length)
  expect(audit.audioResponseStatuses).toEqual(
    expectedMenuIds.map(() => 200),
  )

  const requestedIds = audit.audioFetchUrls
    .map(menuIdFromNarrationUrl)
    .sort()
  expect(requestedIds).toEqual([...expectedMenuIds].sort())
}

function menuIdFromNarrationUrl(rawUrl: string): string {
  const fileName = decodeURIComponent(new URL(rawUrl).pathname.split('/').at(-1) ?? '')
  const exact = [...APPROVED_AUDIO_IDS].find(
    (menuId) =>
      fileName === `${menuId}.mp3` || fileName === `${menuId}.wav`,
  )
  if (exact) return exact

  const hashed = [...APPROVED_AUDIO_IDS].find(
    (menuId) =>
      fileName.startsWith(`${menuId}-`) &&
      (fileName.endsWith('.mp3') || fileName.endsWith('.wav')),
  )
  if (hashed) return hashed
  throw new Error(`알 수 없는 나레이션 오디오 요청입니다: ${rawUrl}`)
}

async function installNarrationAudioProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class FakeAudioParam {
      value = 1
      setValueAtTime(value: number): this {
        this.value = value
        return this
      }
      linearRampToValueAtTime(value: number): this {
        this.value = value
        return this
      }
      exponentialRampToValueAtTime(value: number): this {
        this.value = value
        return this
      }
      cancelScheduledValues(): this {
        return this
      }
    }

    class FakeGainNode {
      readonly gain = new FakeAudioParam()
      connect(): this {
        return this
      }
      disconnect(): void {}
    }

    class FakeOscillatorNode {
      readonly frequency = new FakeAudioParam()
      type = 'sine'
      onended: (() => void) | null = null
      connect(): this {
        return this
      }
      disconnect(): void {}
      start(): void {}
      stop(): void {
        queueMicrotask(() => this.onended?.())
      }
    }

    const narrationSources: FakeBufferSourceNode[] = []
    const probe: NarrationProbe = {
      decodedByteLengths: [],
      bufferStarts: 0,
      bufferStops: 0,
      finishLatestNarration: () => narrationSources.at(-1)?.finish(),
    }

    class FakeBufferSourceNode {
      buffer: unknown = null
      onended: (() => void) | null = null
      private finished = false
      connect(): this {
        return this
      }
      disconnect(): void {}
      start(): void {
        probe.bufferStarts += 1
      }
      stop(): void {
        if (this.finished) return
        this.finished = true
        probe.bufferStops += 1
      }
      finish(): void {
        if (this.finished) return
        this.finished = true
        const onended = this.onended
        this.onended = null
        onended?.()
      }
    }

    class FakeAudioContext {
      state = 'suspended'
      currentTime = 0
      readonly destination = {}
      createGain(): FakeGainNode {
        return new FakeGainNode()
      }
      createOscillator(): FakeOscillatorNode {
        return new FakeOscillatorNode()
      }
      createBufferSource(): FakeBufferSourceNode {
        const source = new FakeBufferSourceNode()
        narrationSources.push(source)
        return source
      }
      async decodeAudioData(bytes: ArrayBuffer): Promise<unknown> {
        probe.decodedByteLengths.push(bytes.byteLength)
        return { duration: 2, byteLength: bytes.byteLength }
      }
      async resume(): Promise<void> {
        this.state = 'running'
      }
      async suspend(): Promise<void> {
        this.state = 'suspended'
      }
      async close(): Promise<void> {
        this.state = 'closed'
      }
    }

    ;(window as NarrationDebugWindow).__NARRATION_AUDIO_PROBE__ = probe
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    })
    Object.defineProperty(window, 'webkitAudioContext', {
      configurable: true,
      value: FakeAudioContext,
    })
  })
}

async function startSoloGameWithSeed(
  page: Page,
  seed: string,
  mealTime: SeedCase['mealTime'],
): Promise<GameDebugState> {
  await page.goto('/')
  await enterMainMenu(page)
  await page
    .getByLabel(mealTime === 'lunch' ? '점심' : '저녁')
    .check()
  await expect.poll(async () => (await readSensoryDebug(page)).audioState).toBe('running')

  await page.evaluate((deckSeed) => {
    const app = (window as NarrationDebugWindow).__NHN_APP__
    if (!app) throw new Error('앱 디버그 상태를 찾을 수 없습니다.')
    app.getDebugState().startSoloGameForTest(deckSeed)
  }, seed)
  await expect(page.locator('#game-root canvas')).toBeVisible()
  await page.waitForFunction(() => {
    const scene = (window as NarrationDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    const state = scene?.getDebugState()
    return Boolean(state?.introVisible || state?.activeToken)
  })

  if ((await readGameDebug(page)).introVisible) {
    await page.locator('#game-root canvas').click({ position: { x: 12, y: 12 } })
  }
  await page.waitForFunction(() =>
    Boolean(
      (window as NarrationDebugWindow).__NHN_GAME__?.scene
        .getScene('prototype')
      .getDebugState().activeToken,
    ),
  )
  await page.evaluate(() => {
    const scene = (
      window as NarrationDebugWindow
    ).__NHN_GAME__?.scene.getScene('prototype') as unknown as
      | { skipPracticeForTest: () => void }
      | undefined
    scene?.skipPracticeForTest()
  })
  const initialStateHandle = await page.waitForFunction(() => {
    const state = (window as NarrationDebugWindow).__NHN_GAME__?.scene
      .getScene('prototype')
      .getDebugState()
    return state?.activeToken && state.narration.captionVisible
      ? state
      : false
  })
  const initialState = await initialStateHandle.jsonValue()
  if (!initialState) {
    throw new Error('첫 실전 음식 상태를 찾을 수 없습니다.')
  }
  return initialState
}

async function readSensoryDebug(page: Page): Promise<SensoryDebugState> {
  return page.evaluate(() => {
    const state = (window as NarrationDebugWindow).__NHN_APP__?.getDebugState()
      .sensoryFeedback
    if (!state) throw new Error('피드백 디버그 상태를 찾을 수 없습니다.')
    return state
  })
}

async function readGameDebug(page: Page): Promise<GameDebugState> {
  return page.evaluate(() => {
    const scene = (window as NarrationDebugWindow).__NHN_GAME__?.scene.getScene(
      'prototype',
    )
    if (!scene) throw new Error('게임 디버그 장면을 찾을 수 없습니다.')
    return scene.getDebugState()
  })
}

async function readNarrationProbe(
  page: Page,
): Promise<
  Pick<NarrationProbe, 'decodedByteLengths' | 'bufferStarts' | 'bufferStops'>
> {
  return page.evaluate(() => {
    const probe = (window as NarrationDebugWindow).__NARRATION_AUDIO_PROBE__
    if (!probe) throw new Error('나레이션 오디오 프로브를 찾을 수 없습니다.')
    return {
      decodedByteLengths: [...probe.decodedByteLengths],
      bufferStarts: probe.bufferStarts,
      bufferStops: probe.bufferStops,
    }
  })
}

async function readNarrationCatalogEntry(
  page: Page,
  menuId: string,
): Promise<{ readonly text: string; readonly audioUrl: string | null } | null> {
  return page.evaluate(async (id) => {
    const modulePath = '/src/data/menuNarrations.ts'
    const module = (await import(/* @vite-ignore */ modulePath)) as {
      getMenuNarration(
        menuId: string,
      ): { readonly text: string; readonly audioUrl: string | null } | undefined
    }
    const narration = module.getMenuNarration(id)
    return narration
      ? { text: narration.text, audioUrl: narration.audioUrl }
      : null
  }, menuId)
}

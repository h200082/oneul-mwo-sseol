import { expect, test, type Page } from "@playwright/test";

type MusicIntensity = "opening" | "rotation" | "final-five" | "final-two";

interface SensoryDebugState {
  readonly soundEnabled: boolean;
  readonly audioState:
    "unavailable" | "locked" | "running" | "suspended" | "closed";
  readonly lastCue: string | null;
  readonly triggerCount: number;
  readonly soundOutputCount: number;
  readonly musicRequested: boolean;
  readonly musicPlaying: boolean;
  readonly musicIntensity: MusicIntensity | null;
  readonly musicStartCount: number;
}

interface BgmSceneDebugState {
  readonly activeToken: unknown | null;
  readonly completedRounds: number;
  readonly deckSeed: number | string;
  readonly introVisible: boolean;
}

interface BgmTestWindow extends Window {
  __BGM_AUDIO_PROBE__?: {
    contexts: number;
    resumes: number;
    starts: number;
    stops: number;
  };
  __NHN_APP__?: {
    getDebugState: () => {
      sensoryFeedback: SensoryDebugState;
      startSoloGameForTest: (deckSeed: number | string) => void;
    };
  };
  __NHN_GAME__?: {
    scene: {
      getScene: (key: string) => {
        children: {
          list: Array<{
            texture?: { key: string };
            displayWidth?: number;
            displayHeight?: number;
          }>;
        };
        getDebugState: () => BgmSceneDebugState;
      };
    };
  };
}

const LOGICAL_WIDTH = 390;
const LOGICAL_HEIGHT = 844;

test("BGM은 라운드 난이도를 따라 올라가고 음소거·결과 생명주기를 지킨다", async ({
  page,
}) => {
  await installAudioProbe(page);
  await page.goto("/");
  await openSeededSoloGame(page, "bgm-e2e-seed-v1");

  await waitForRound(page, 0);
  await expectMusic(page, "opening", true);

  const firstSession = (await readSensoryDebug(page)).musicStartCount;
  expect(firstSession).toBe(1);

  for (let targetRound = 1; targetRound <= 18; targetRound += 1) {
    await forceMissAndWaitForRound(page, targetRound - 1);
    const expectedIntensity = getExpectedIntensity(targetRound);
    const sensory = await readSensoryDebug(page);
    expect(sensory).toMatchObject({
      musicRequested: true,
      musicPlaying: true,
      musicIntensity: expectedIntensity,
      musicStartCount: firstSession,
    });
  }

  const finalTwo = await readSensoryDebug(page);
  expect(finalTwo.musicIntensity).toBe("final-two");

  await pressCanvasControl(page, 317, 44);
  await expect
    .poll(async () => (await readSensoryDebug(page)).soundEnabled)
    .toBe(false);
  await expect
    .poll(async () => (await readSensoryDebug(page)).musicPlaying)
    .toBe(false);

  expect(await readSensoryDebug(page)).toMatchObject({
    musicRequested: true,
    musicPlaying: false,
    musicIntensity: "final-two",
    musicStartCount: firstSession,
  });

  await pressCanvasControl(page, 317, 44);
  await expect
    .poll(async () => (await readSensoryDebug(page)).soundEnabled)
    .toBe(true);
  await expectMusic(page, "final-two", true);

  const resumedSession = (await readSensoryDebug(page)).musicStartCount;
  expect(resumedSession).toBe(firstSession + 1);

  await forceMissAndWaitForRound(page, 18);
  expect(await readSensoryDebug(page)).toMatchObject({
    musicRequested: true,
    musicPlaying: true,
    musicIntensity: "final-two",
    musicStartCount: resumedSession,
  });

  const beforeResult = await readSensoryDebug(page);
  await forceFinalMissAndWaitForResults(page, 19);
  const chefDisplaySizes = await page.evaluate(() => {
    const scene = (window as BgmTestWindow).__NHN_GAME__?.scene.getScene(
      "prototype",
    );
    if (!scene) throw new Error("Prototype scene is unavailable.");
    return scene.children.list
      .filter((child) => child.texture?.key === "title-chef-cat")
      .map((child) => ({
        width: child.displayWidth ?? 0,
        height: child.displayHeight ?? 0,
      }));
  });
  expect(chefDisplaySizes).not.toHaveLength(0);
  expect(Math.max(...chefDisplaySizes.map((size) => size.width))).toBeLessThanOrEqual(108.1);
  expect(Math.max(...chefDisplaySizes.map((size) => size.height))).toBeLessThanOrEqual(136.1);
  const result = await readSensoryDebug(page);
  expect(result).toMatchObject({
    lastCue: "results",
    musicRequested: false,
    musicPlaying: false,
    musicIntensity: null,
    musicStartCount: resumedSession,
  });
  expect(result.soundOutputCount).toBeGreaterThan(
    beforeResult.soundOutputCount,
  );
});

async function installAudioProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = {
      contexts: 0,
      resumes: 0,
      starts: 0,
      stops: 0,
    };
    (window as BgmTestWindow).__BGM_AUDIO_PROBE__ = probe;

    class FakeAudioParam {
      setValueAtTime(): this {
        return this;
      }
      linearRampToValueAtTime(): this {
        return this;
      }
      exponentialRampToValueAtTime(): this {
        return this;
      }
    }

    class FakeGainNode {
      readonly gain = new FakeAudioParam();
      connect(): this {
        return this;
      }
      disconnect(): void {}
    }

    class FakeOscillatorNode {
      readonly frequency = new FakeAudioParam();
      type = "sine";
      onended: (() => void) | null = null;
      connect(): this {
        return this;
      }
      disconnect(): void {}
      start(): void {
        probe.starts += 1;
      }
      stop(): void {
        probe.stops += 1;
        queueMicrotask(() => this.onended?.());
      }
    }

    class FakeAudioContext {
      state = "suspended";
      currentTime = 0;
      readonly destination = {};
      constructor() {
        probe.contexts += 1;
      }
      createGain(): FakeGainNode {
        return new FakeGainNode();
      }
      createOscillator(): FakeOscillatorNode {
        return new FakeOscillatorNode();
      }
      async resume(): Promise<void> {
        probe.resumes += 1;
        this.state = "running";
      }
      async suspend(): Promise<void> {
        this.state = "suspended";
      }
      async close(): Promise<void> {
        this.state = "closed";
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    Object.defineProperty(window, "webkitAudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
  });
}

async function openSeededSoloGame(
  page: Page,
  deckSeed: number | string,
): Promise<void> {
  await page.waitForFunction(() =>
    Boolean((window as BgmTestWindow).__NHN_APP__),
  );
  await page.evaluate((seed) => {
    const app = (window as BgmTestWindow).__NHN_APP__;
    if (!app) throw new Error("App debug hook is unavailable.");
    app.getDebugState().startSoloGameForTest(seed);
  }, deckSeed);

  await page.waitForFunction((seed) => {
    const scene = (window as BgmTestWindow).__NHN_GAME__?.scene.getScene(
      "prototype",
    );
    if (!scene) return false;
    const state = scene.getDebugState();
    return state.deckSeed === seed && state.activeToken !== null;
  }, deckSeed);
  const canvas = page.locator("#game-root canvas");
  await expect(canvas).toBeVisible();
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    await canvas.tap({ position: { x: 12, y: 12 } });
  } else {
    await canvas.click({ position: { x: 12, y: 12 } });
  }
}

async function forceMissAndWaitForRound(
  page: Page,
  currentRoundIndex: number,
): Promise<void> {
  await forceMiss(page, currentRoundIndex);
  await waitForRound(page, currentRoundIndex + 1);
}

async function forceFinalMissAndWaitForResults(
  page: Page,
  currentRoundIndex: number,
): Promise<void> {
  await forceMiss(page, currentRoundIndex);
  await page.waitForFunction(() => {
    const app = (window as BgmTestWindow).__NHN_APP__;
    const scene = (window as BgmTestWindow).__NHN_GAME__?.scene.getScene(
      "prototype",
    );
    const sensory = app?.getDebugState().sensoryFeedback;
    return (
      scene?.getDebugState().completedRounds === 20 &&
      sensory?.lastCue === "results" &&
      sensory.musicRequested === false &&
      sensory.musicPlaying === false
    );
  });
}

async function forceMiss(page: Page, currentRoundIndex: number): Promise<void> {
  await page.evaluate((expectedRoundIndex) => {
    const scene = (window as BgmTestWindow).__NHN_GAME__?.scene.getScene(
      "prototype",
    ) as
      | {
          getDebugState: () => BgmSceneDebugState;
          resolveRound: (action: { readonly type: "miss" }) => void;
        }
      | undefined;
    if (!scene) throw new Error("Prototype scene is unavailable.");
    const state = scene.getDebugState();
    if (state.completedRounds !== expectedRoundIndex || !state.activeToken) {
      throw new Error("Cannot force a miss outside the expected active round.");
    }
    scene.resolveRound({ type: "miss" });
  }, currentRoundIndex);
}

async function waitForRound(page: Page, roundIndex: number): Promise<void> {
  await page.waitForFunction((expectedRoundIndex) => {
    const scene = (window as BgmTestWindow).__NHN_GAME__?.scene.getScene(
      "prototype",
    );
    if (!scene) return false;
    const state = scene.getDebugState();
    return (
      state.completedRounds === expectedRoundIndex && state.activeToken !== null
    );
  }, roundIndex);
}

async function readSensoryDebug(page: Page): Promise<SensoryDebugState> {
  return page.evaluate(() => {
    const state = (window as BgmTestWindow).__NHN_APP__?.getDebugState()
      .sensoryFeedback;
    if (!state) throw new Error("Sensory debug state is unavailable.");
    return state;
  });
}

async function expectMusic(
  page: Page,
  intensity: MusicIntensity,
  playing: boolean,
): Promise<void> {
  await expect
    .poll(async () => {
      const sensory = await readSensoryDebug(page);
      return {
        requested: sensory.musicRequested,
        playing: sensory.musicPlaying,
        intensity: sensory.musicIntensity,
      };
    })
    .toEqual({ requested: true, playing, intensity });
}

async function pressCanvasControl(
  page: Page,
  logicalX: number,
  logicalY: number,
): Promise<void> {
  const box = await page.locator("#game-root canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable.");
  const point = {
    x: box.x + logicalX * (box.width / LOGICAL_WIDTH),
    y: box.y + logicalY * (box.height / LOGICAL_HEIGHT),
  };

  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...point, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    return;
  }

  await page.mouse.click(point.x, point.y);
}

function getExpectedIntensity(roundIndex: number): MusicIntensity {
  if (roundIndex < 5) return "opening";
  if (roundIndex < 15) return "rotation";
  if (roundIndex < 18) return "final-five";
  return "final-two";
}

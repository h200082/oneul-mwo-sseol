export interface HamburgerRepeatRemoval {
  readonly gapIndex: number
  readonly sourceGapStartSample: number
  readonly sourceGapEndSampleExclusive: number
  readonly removeStartSample: number
  readonly removeEndSample: number
  readonly removeStartSeconds: number
  readonly removeEndSeconds: number
  readonly removedSamples: number
  readonly removedSeconds: number
  readonly leftSample: number
  readonly rightSample: number
  readonly joinDelta: number
  readonly remainingGapSeconds: number
}

export interface HamburgerRepeatPcmAnalysis {
  readonly thresholdDbfs: number
  readonly windowSeconds: number
  readonly hopSeconds: number
  readonly firstActiveSample: number
  readonly lastActiveEndSampleExclusive: number
  readonly headSeconds: number
  readonly tailSeconds: number
  readonly activeSpanSeconds: number
  readonly gaps: readonly Readonly<{
    startSample: number
    endSampleExclusive: number
    startSeconds: number
    endSeconds: number
    durationSeconds: number
  }>[]
  readonly maximumInternalGapSeconds: number
}

export const HAMBURGER_REPEAT_TRIM_USER_FEEDBACK: string
export const HAMBURGER_REPEAT_TRIM_PATHS: Readonly<{
  source: string
  parentManifest: string
  catalog: string
  activeAudioIds: string
  defaultOutputDirectory: string
  outputFile: string
  manifestFile: string
}>
export const HAMBURGER_REPEAT_TRIM_SOURCE_PINS: Readonly<{
  source: Readonly<{
    byteLength: number
    sha256: string
    mpegFrameCount: number
    exactDurationSeconds: number
  }>
  parentManifest: Readonly<{
    byteLength: number
    sha256: string
    schemaVersion: number
  }>
  catalog: Readonly<{
    byteLength: number
    sha256: string
  }>
  activeAudioIds: Readonly<{
    byteLength: number
    sha256: string
    expectedCount: number
  }>
}>
export const HAMBURGER_REPEAT_TRIM_PERFORMANCE: Readonly<Record<string, unknown>>
export const HAMBURGER_REPEAT_TRIM_CONTRACT: Readonly<{
  sampleRate: 24_000
  channels: 1
  analysisWindowSeconds: 0.01
  analysisHopSeconds: 0.005
  thresholdsDbfs: readonly [-45, -40]
  targetRemainingGapSeconds: 0.12
  boundarySearchSeconds: 0.006
  maximumJoinDelta: 0.01
  sourceSampleCount: 100_224
  expectedGapsMinus45: readonly Readonly<{
    startSample: number
    endSampleExclusive: number
  }>[]
  expectedMainGapsMinus40: readonly Readonly<{
    startSample: number
    endSampleExclusive: number
  }>[]
  expectedRemovals: readonly Readonly<{
    removeStartSample: number
    removeEndSample: number
  }>[]
  expectedOutputSampleCount: 56_050
}>

export function validateHamburgerRepeatTrimSources(input: {
  sourceBytes: Uint8Array
  parentManifestBytes: Uint8Array
  catalogBytes: Uint8Array
  activeAudioIdsBytes: Uint8Array
}): Readonly<{
  sourceInspection: Readonly<Record<string, unknown>>
  activeAudioIds: readonly string[]
  current: Readonly<{ menuId: string; text: string; tone: string }>
}>

export function analyzeHamburgerRepeatPcm(
  samples: Float32Array,
  thresholdDbfs: number,
): HamburgerRepeatPcmAnalysis

export function chooseHamburgerRepeatRemovals(
  samples: Float32Array,
  minus45: HamburgerRepeatPcmAnalysis,
  minus40: HamburgerRepeatPcmAnalysis,
): readonly Readonly<HamburgerRepeatRemoval>[]

export function spliceHamburgerRepeatPcm(
  source: Float32Array,
  removals: readonly HamburgerRepeatRemoval[],
): Readonly<{
  output: Float32Array
  keptSegments: readonly Readonly<{
    sourceStartSample: number
    sourceEndSample: number
    outputStartSample: number
    outputEndSample: number
  }>[]
  mismatchSamples: 0
}>

export function analyzeHamburgerOverall(
  samples: Float32Array,
): Readonly<{
  rmsDbfs: number
  peakDbfs: number
  peakAmplitude: number
  clippingSamples: number
}>

export function encodeHamburgerFloat32Wav(samples: Float32Array): Buffer

export function runHamburgerRepeatTrim(
  argv?: readonly string[],
): Promise<Readonly<{
  outputPath: string
  manifestPath: string
  manifest: Record<string, unknown>
}> | null>

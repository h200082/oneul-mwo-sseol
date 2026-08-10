import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export interface JokbalCopyRetake01SourcePin {
  readonly path: string
  readonly byteLength: number
  readonly sha256: string
}

export interface JokbalCopyRetake01RejectedRawPin
  extends JokbalCopyRetake01SourcePin {
  readonly mpegFrameCount: 114
  readonly exactDurationSeconds: 2.736
}

export interface JokbalCopyRetake01ParentManifestPin
  extends JokbalCopyRetake01SourcePin {
  readonly schemaVersion: 2
}

export interface JokbalCopyRetake01Performance {
  readonly menuId: 'jokbal'
  readonly tone: 'playful'
  readonly catalogText: '발을 먹는데? 손이 더 바쁘다!'
  readonly spokenText: '발을 먹는데? 손이 더 바쁘다!'
  readonly modelId: 'flash'
  readonly model: 'MAI-Voice-2-Flash'
  readonly voiceId: 'junho'
  readonly voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash'
  readonly style: 'joyful'
  readonly styleDegree: 0.48
  readonly rate: '+22%'
  readonly pitch: '+0%'
  readonly structure: 'one-block'
  readonly segments: readonly ['발을 먹는데? 손이 더 바쁘다!']
  readonly synthesisAllowed: true
}

export interface JokbalCopyRetake01SourceAttestation {
  readonly catalogPin: Readonly<JokbalCopyRetake01SourcePin>
  readonly activeAudioIdsPin: Readonly<JokbalCopyRetake01SourcePin>
  readonly rejectedRawPin: Readonly<JokbalCopyRetake01RejectedRawPin>
  readonly parentManifestPin: Readonly<JokbalCopyRetake01ParentManifestPin>
  readonly activeAudioIds: readonly string[]
  readonly current: Readonly<NarrationBatchEntry>
}

export interface JokbalCopyRetake01CostSummary {
  readonly ssmlCharacters: number
  readonly maximumUsdPerMillionCharacters: number
  readonly maximumEstimatedCostUsd: number
}

export interface JokbalCopyRetake01AudioInspection {
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
}

export interface JokbalCopyRetake01GeneratedFile
  extends JokbalCopyRetake01AudioInspection {
  readonly menuId: 'jokbal'
  readonly file: 'jokbal.mp3'
}

export interface JokbalCopyRetake01Manifest {
  readonly schemaVersion: 2
  readonly provider: 'Azure AI Speech'
  readonly batch: 'jokbal-copy-retake-01'
  readonly region: 'southeastasia'
  readonly outputFormat: 'audio-24khz-160kbitrate-mono-mp3'
  readonly generatedAt: string
  readonly userFeedback: Readonly<{ statement: string }>
  readonly sourcePins: Readonly<{
    catalog: Readonly<JokbalCopyRetake01SourcePin>
    activeAudioIds: Readonly<JokbalCopyRetake01SourcePin>
    rejectedRaw: Readonly<JokbalCopyRetake01RejectedRawPin>
    parentManifest: Readonly<JokbalCopyRetake01ParentManifestPin>
    jokbalInactiveBeforeListening: true
  }>
  readonly performance: Readonly<JokbalCopyRetake01Performance>
  readonly delivery: Readonly<{
    oneVoice: true
    oneExpressAs: true
    oneProsody: true
    oneBlock: true
    explicitBreaks: 0
    subTagsUsed: false
    phonemeTagsUsed: false
    emphasisTagsUsed: false
    voiceSwitches: 0
  }>
  readonly pricing: Readonly<JokbalCopyRetake01CostSummary>
  readonly requests: Readonly<{
    voiceListPreflight: 1
    synthesisPerClip: 1
    totalSynthesisRequests: 1
    retries: 0
  }>
  readonly generatedFiles: readonly Readonly<JokbalCopyRetake01GeneratedFile>[]
  readonly listeningQa: Readonly<{
    exactImportantWordRequired: '더'
    questionToPunchGapTargetMilliseconds: readonly [180, 420]
    rejectQuestionToPunchGapAboveMilliseconds: 500
    maximumSecondToFirstLoudnessDeltaDb: 3
    shoutLikeSecondPhraseRejected: true
    automaticLexicalAlignmentUsed: false
    humanReviewRequired: true
  }>
  readonly outputQa: Readonly<{
    totalByteLength: number
    outputIdentityPinnedInManifest: true
    exactDurationMeasurement:
      'validated MPEG frame count * 576 samples / 24,000 Hz'
    postprocessingApplied: false
    runtimeIntegrationAttempted: false
    listeningReviewRequired: true
  }>
}

export const JOKBAL_COPY_RETAKE_01_REQUIRED_REGION: 'southeastasia'
export const JOKBAL_COPY_RETAKE_01_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const JOKBAL_COPY_RETAKE_01_PRICE_ENV:
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const JOKBAL_COPY_RETAKE_01_OFFICIAL_PRICE_CEILING: 22
export const JOKBAL_COPY_RETAKE_01_RETRY_COUNT: 0
export const JOKBAL_COPY_RETAKE_01_USER_QUOTE: string
export const JOKBAL_COPY_RETAKE_01_SOURCE_PINS: Readonly<{
  catalog: Readonly<JokbalCopyRetake01SourcePin>
  activeAudioIds: Readonly<JokbalCopyRetake01SourcePin>
  rejectedRaw: Readonly<JokbalCopyRetake01RejectedRawPin>
  parentManifest: Readonly<JokbalCopyRetake01ParentManifestPin>
}>
export const JOKBAL_COPY_RETAKE_01_PERFORMANCE: Readonly<JokbalCopyRetake01Performance>

export function validateJokbalCopyRetake01Sources(input: {
  readonly catalogBytes: Uint8Array
  readonly activeAudioIdsBytes: Uint8Array
  readonly rejectedRawBytes: Uint8Array
  readonly parentManifestBytes: Uint8Array
}): Readonly<JokbalCopyRetake01SourceAttestation>

export function createJokbalCopyRetake01Plan(): readonly [
  Readonly<{
    performance: Readonly<JokbalCopyRetake01Performance>
    relativeFile: 'jokbal.mp3'
  }>,
]

export function buildJokbalCopyRetake01Ssml(
  performance?: Readonly<JokbalCopyRetake01Performance>,
): string

export function validateJokbalCopyRetake01Voice(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
): true

export function readJokbalCopyRetake01PriceCeiling(
  environment: Readonly<Record<string, string | undefined>>,
): number

export function readJokbalCopyRetake01ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumUsdPerMillionCharacters: number
}>

export function summarizeJokbalCopyRetake01Cost(
  plan: ReturnType<typeof createJokbalCopyRetake01Plan>,
  maximumUsdPerMillionCharacters: number,
): Readonly<JokbalCopyRetake01CostSummary>

export function createJokbalCopyRetake01Manifest(input: {
  readonly sourceAttestation: Readonly<JokbalCopyRetake01SourceAttestation>
  readonly inspection: Readonly<JokbalCopyRetake01AudioInspection>
  readonly pricing: Readonly<JokbalCopyRetake01CostSummary>
  readonly generatedAt: string
}): Readonly<JokbalCopyRetake01Manifest>

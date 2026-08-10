import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export interface TteokbokkiOnsetRetake01SourcePin {
  readonly path: string
  readonly byteLength: number
  readonly sha256: string
}

export interface TteokbokkiOnsetRetake01RejectedRawPin
  extends TteokbokkiOnsetRetake01SourcePin {
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
}

export interface TteokbokkiOnsetRetake01ParentManifestPin
  extends TteokbokkiOnsetRetake01SourcePin {
  readonly schemaVersion: 2
}

export interface TteokbokkiOnsetRetake01Performance {
  readonly menuId: 'tteokbokki'
  readonly tone: 'alert'
  readonly catalogText: '떡볶이 포획! 쿨피스 지원 요청!'
  readonly spokenText: '떡볶이 포획! 쿨피스 지원 요청!'
  readonly modelId: 'flash'
  readonly model: 'MAI-Voice-2-Flash'
  readonly voiceId: 'haena'
  readonly voiceShortName: 'ko-KR-Haena:MAI-Voice-2-Flash'
  readonly style: 'joyful'
  readonly styleDegree: 0.5
  readonly pitch: '-1%'
  readonly structure: 'adjacent-two-block'
  readonly segments: readonly ['떡볶이 포획! ', '쿨피스 지원 요청!']
  readonly leadingBreakMilliseconds: 100
  readonly brandReview: 'metadata-only'
  readonly synthesisAllowed: true
}

export type TteokbokkiOnsetRetake01CandidateA = Readonly<
  TteokbokkiOnsetRetake01Performance & {
    readonly candidateId: 'A'
    readonly relativeFile: 'A.mp3'
    readonly rates: readonly ['+22%', '+22%']
  }
>

export type TteokbokkiOnsetRetake01CandidateB = Readonly<
  TteokbokkiOnsetRetake01Performance & {
    readonly candidateId: 'B'
    readonly relativeFile: 'B.mp3'
    readonly rates: readonly ['+12%', '+22%']
  }
>

export type TteokbokkiOnsetRetake01Candidate =
  | TteokbokkiOnsetRetake01CandidateA
  | TteokbokkiOnsetRetake01CandidateB

export interface TteokbokkiOnsetRetake01SourceAttestation {
  readonly catalogPin: Readonly<TteokbokkiOnsetRetake01SourcePin>
  readonly activeAudioIdsPin: Readonly<TteokbokkiOnsetRetake01SourcePin>
  readonly rejectedRawPin: Readonly<TteokbokkiOnsetRetake01RejectedRawPin>
  readonly parentManifestPin: Readonly<TteokbokkiOnsetRetake01ParentManifestPin>
  readonly activeAudioIds: readonly string[]
  readonly current: Readonly<NarrationBatchEntry>
}

export interface TteokbokkiOnsetRetake01CostSummary {
  readonly ssmlCharacters: number
  readonly maximumUsdPerMillionCharacters: number
  readonly maximumEstimatedCostUsd: number
}

export interface TteokbokkiOnsetRetake01AudioInspection {
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
}

export interface TteokbokkiOnsetRetake01GeneratedFile
  extends TteokbokkiOnsetRetake01AudioInspection {
  readonly candidateId: 'A' | 'B'
  readonly menuId: 'tteokbokki'
  readonly file: 'A.mp3' | 'B.mp3'
  readonly rates:
    | readonly ['+22%', '+22%']
    | readonly ['+12%', '+22%']
}

export interface TteokbokkiOnsetRetake01Manifest {
  readonly schemaVersion: 2
  readonly provider: 'Azure AI Speech'
  readonly batch: 'tteokbokki-onset-retake-01'
  readonly region: 'southeastasia'
  readonly outputFormat: 'audio-24khz-160kbitrate-mono-mp3'
  readonly generatedAt: string
  readonly userFeedback: Readonly<{ statement: string }>
  readonly sourcePins: Readonly<{
    catalog: Readonly<TteokbokkiOnsetRetake01SourcePin>
    activeAudioIds: Readonly<TteokbokkiOnsetRetake01SourcePin>
    rejectedRaw: Readonly<TteokbokkiOnsetRetake01RejectedRawPin>
    parentManifest: Readonly<TteokbokkiOnsetRetake01ParentManifestPin>
    tteokbokkiInactiveBeforeListening: true
  }>
  readonly candidates: typeof TTEOKBOKKI_ONSET_RETAKE_01_CANDIDATES
  readonly delivery: Readonly<{
    oneVoicePerClip: true
    expressAsPerClip: 2
    prosodyPerClip: 2
    leadingBreakMilliseconds: 100
    leadingBreakPerClip: 1
    otherBreaksPerClip: 0
    subTagsUsed: false
    phonemeTagsUsed: false
    emphasisTagsUsed: false
    voiceSwitchesPerClip: 0
    onlyAbVariable: 'first-block-rate'
  }>
  readonly pricing: Readonly<TteokbokkiOnsetRetake01CostSummary>
  readonly requests: Readonly<{
    voiceListPreflight: 1
    synthesisPerClip: 1
    totalSynthesisRequests: 2
    retries: 0
  }>
  readonly generatedFiles: readonly Readonly<TteokbokkiOnsetRetake01GeneratedFile>[]
  readonly listeningQa: Readonly<{
    decodedLeadingHeadTargetMilliseconds: readonly [110, 180]
    completeTteokbokkiWordHumanReviewRequired: true
    automaticLexicalAlignmentUsed: false
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

export const TTEOKBOKKI_ONSET_RETAKE_01_REQUIRED_REGION: 'southeastasia'
export const TTEOKBOKKI_ONSET_RETAKE_01_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const TTEOKBOKKI_ONSET_RETAKE_01_PRICE_ENV:
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const TTEOKBOKKI_ONSET_RETAKE_01_OFFICIAL_PRICE_CEILING: 22
export const TTEOKBOKKI_ONSET_RETAKE_01_RETRY_COUNT: 0
export const TTEOKBOKKI_ONSET_RETAKE_01_USER_QUOTE: string
export const TTEOKBOKKI_ONSET_RETAKE_01_SOURCE_PINS: Readonly<{
  catalog: Readonly<TteokbokkiOnsetRetake01SourcePin>
  activeAudioIds: Readonly<TteokbokkiOnsetRetake01SourcePin>
  rejectedRaw: Readonly<TteokbokkiOnsetRetake01RejectedRawPin>
  parentManifest: Readonly<TteokbokkiOnsetRetake01ParentManifestPin>
}>
export const TTEOKBOKKI_ONSET_RETAKE_01_CANDIDATES: readonly [
  TteokbokkiOnsetRetake01CandidateA,
  TteokbokkiOnsetRetake01CandidateB,
]

export function validateTteokbokkiOnsetRetake01Sources(input: {
  readonly catalogBytes: Uint8Array
  readonly activeAudioIdsBytes: Uint8Array
  readonly rejectedRawBytes: Uint8Array
  readonly parentManifestBytes: Uint8Array
}): Readonly<TteokbokkiOnsetRetake01SourceAttestation>

export function createTteokbokkiOnsetRetake01Plan(): typeof TTEOKBOKKI_ONSET_RETAKE_01_CANDIDATES

export function buildTteokbokkiOnsetRetake01Ssml(
  candidate: Readonly<TteokbokkiOnsetRetake01Candidate>,
): string

export function validateTteokbokkiOnsetRetake01Voice(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
): true

export function readTteokbokkiOnsetRetake01PriceCeiling(
  environment: Readonly<Record<string, string | undefined>>,
): number

export function readTteokbokkiOnsetRetake01ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumUsdPerMillionCharacters: number
}>

export function summarizeTteokbokkiOnsetRetake01Cost(
  plan: readonly Readonly<TteokbokkiOnsetRetake01Candidate>[],
  maximumUsdPerMillionCharacters: number,
): Readonly<TteokbokkiOnsetRetake01CostSummary>

export function createTteokbokkiOnsetRetake01Manifest(input: {
  readonly sourceAttestation: Readonly<TteokbokkiOnsetRetake01SourceAttestation>
  readonly audioResults: readonly Readonly<TteokbokkiOnsetRetake01AudioInspection>[]
  readonly pricing: Readonly<TteokbokkiOnsetRetake01CostSummary>
  readonly generatedAt: string
}): Readonly<TteokbokkiOnsetRetake01Manifest>

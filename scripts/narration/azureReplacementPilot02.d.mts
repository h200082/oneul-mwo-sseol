import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export type ReplacementPilot02Label = 'A' | 'B'
export type ReplacementPilot02SourceKind = 'raw' | 'gapTrim'
export type ReplacementPilot02Structure =
  | 'one-full-block'
  | 'adjacent-two-blocks-no-break'

export interface ReplacementPilot02RejectedProfile {
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly style: 'determined'
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: '-1%'
  readonly structure: 'one-full-block'
}

export interface ReplacementPilot02RejectedSource {
  readonly sourceKind: ReplacementPilot02SourceKind
  readonly sourceBatch: string
  readonly sourceManifestPath: string
  readonly sourcePath: string
  readonly sourceByteLength: number
  readonly sourceSha256: string
  readonly sourceDurationSeconds: number
  readonly sourceProfile: Readonly<ReplacementPilot02RejectedProfile>
  readonly localPostprocess?: 'bit-exact-internal-gap-trim'
  readonly rejectionStatus:
    | 'user-rejected-raw'
    | 'user-rejected-local-gap-trim'
}

export interface ReplacementPilot02RejectedSources {
  readonly raw: Readonly<ReplacementPilot02RejectedSource>
  readonly gapTrim: Readonly<ReplacementPilot02RejectedSource>
}

export interface ReplacementPilot02Candidate {
  readonly menuId: 'pasta' | 'bulgogi-deopbap'
  readonly label: ReplacementPilot02Label
  readonly voiceId: 'junho'
  readonly catalogText: string
  readonly spokenText: string
  readonly style: 'joyful'
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: '+0%'
  readonly structure: ReplacementPilot02Structure
  readonly segments: readonly string[] | null
  readonly relativeFile: string
  readonly reviewIntent: string
  readonly rejectedSources: Readonly<ReplacementPilot02RejectedSources>
}

export interface ReplacementPilot02PlanItem {
  readonly candidate: Readonly<ReplacementPilot02Candidate>
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly relativeFile: string
}

export interface ReplacementPilot02AudioInspection {
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
}

export interface ReplacementPilot02AudioResult
  extends ReplacementPilot02AudioInspection {
  readonly relativeFile: string
}

export interface ReplacementPilot02CostSummary {
  readonly basis: 'full-ssml-unicode-code-point-upper-bound'
  readonly ssmlCharacters: number
  readonly maximumPriceUsdPerMillionCharacters: number
  readonly maximumEstimatedCostUsd: number
  readonly files: readonly Readonly<{
    relativeFile: string
    ssmlCharacters: number
  }>[]
}

export const REPLACEMENT_PILOT_02_MENU_IDS: readonly string[]
export const REPLACEMENT_PILOT_02_REQUIRED_REGION: 'southeastasia'
export const REPLACEMENT_PILOT_02_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const REPLACEMENT_PILOT_02_PRICE_CEILING_ENV:
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const REPLACEMENT_PILOT_02_DEFAULT_PRICE_CEILING: number
export const REPLACEMENT_PILOT_02_SYNTHESIS_REQUESTS_PER_CLIP: 1
export const REPLACEMENT_PILOT_02_RETRY_COUNT: 0
export const REPLACEMENT_PILOT_02_APPROX_FILE_TARGET_SECONDS: Readonly<{
  minimum: 1.2
  maximum: 1.8
}>
export const REPLACEMENT_PILOT_02_HARD_MAX_SECONDS: 2
export const REPLACEMENT_PILOT_02_MAX_INTERNAL_GAP_MILLISECONDS: 180
export const REPLACEMENT_PILOT_02_ACTIVE_SPEECH_TARGET_SECONDS: Readonly<{
  minimum: 1.25
  maximum: 1.5
}>
export const REPLACEMENT_PILOT_02_REJECTED_SOURCES: Readonly<
  Record<string, Readonly<ReplacementPilot02RejectedSources>>
>
export const REPLACEMENT_PILOT_02_CANDIDATES: readonly Readonly<
  ReplacementPilot02Candidate
>[]

export function selectReplacementPilot02Candidates(
  catalog: readonly NarrationBatchEntry[],
): readonly Readonly<ReplacementPilot02Candidate>[]

export function createReplacementPilot02Plan(
  candidates?: readonly Readonly<ReplacementPilot02Candidate>[],
): readonly Readonly<ReplacementPilot02PlanItem>[]

export function buildReplacementPilot02Ssml(options: {
  candidate: Readonly<ReplacementPilot02Candidate>
  voiceShortName: string
}): string

export function estimateReplacementPilot02PlannedTiming(
  candidate: Readonly<ReplacementPilot02Candidate>,
): Readonly<{ approxDurationSeconds: number }>

export function validateReplacementPilot02Voices(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
): true

export function validateReplacementPilot02RejectedSource(options: {
  candidate: Readonly<ReplacementPilot02Candidate>
  sourceKind: ReplacementPilot02SourceKind
  byteLength: number
  sha256: string
}): true

export function readReplacementPilot02PriceCeiling(
  environment: Readonly<Record<string, string | undefined>>,
  requireExplicit?: boolean,
): Readonly<{
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling' | 'local-conservative-default'
}>

export function readReplacementPilot02ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling'
}>

export function summarizeReplacementPilot02Cost(
  plan: readonly Readonly<ReplacementPilot02PlanItem>[],
  maximumPriceUsdPerMillionCharacters: number,
): Readonly<ReplacementPilot02CostSummary>

export function inspectReplacementPilot02Mp3(
  audio: Uint8Array,
): Readonly<ReplacementPilot02AudioInspection>

export function summarizeReplacementPilot02Audio(byteLength: number): Readonly<{
  approxDurationSeconds: number
  durationWithinTarget: boolean
  durationWithinHardMaximum: boolean
}>

export function createReplacementPilot02Manifest(options: {
  plan: readonly Readonly<ReplacementPilot02PlanItem>[]
  audioResults: readonly Readonly<ReplacementPilot02AudioResult>[]
  region: string
  pricing: Readonly<ReplacementPilot02CostSummary>
  pricingSource: string
  generatedAt: string
}): Readonly<Record<string, unknown>>

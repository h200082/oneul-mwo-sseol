import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export type FinalRetakeBatch01Style = 'determined'
export type FinalRetakeBatch01SourceKind = 'fast' | 'slow'

export interface FinalRetakeBatch01SourceCandidate {
  readonly sourceBatch: 'replacement-batch-01' | 'slow-retake-batch-01'
  readonly sourceManifestPath: string
  readonly sourcePreviewPath: string
  readonly sourceCatalogText: string
  readonly sourceByteLength: number
  readonly sourceSha256: string
  readonly sourceListeningFinding: string
}

export interface FinalRetakeBatch01SupersededSources {
  readonly fast: Readonly<FinalRetakeBatch01SourceCandidate>
  readonly slow: Readonly<FinalRetakeBatch01SourceCandidate>
}

export interface FinalRetakeBatch01Performance {
  readonly menuId: string
  readonly voiceId: 'junho'
  readonly catalogText: string
  readonly spokenText: string
  readonly style: FinalRetakeBatch01Style
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly reviewIntent: string
  readonly supersededSources: Readonly<FinalRetakeBatch01SupersededSources>
}

export interface FinalRetakeBatch01PlanItem {
  readonly performance: Readonly<FinalRetakeBatch01Performance>
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly relativeFile: string
}

export interface FinalRetakeBatch01AudioInspection {
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
}

export interface FinalRetakeBatch01AudioResult
  extends FinalRetakeBatch01AudioInspection {
  readonly relativeFile: string
}

export interface FinalRetakeBatch01CostSummary {
  readonly basis: 'full-ssml-unicode-code-point-upper-bound'
  readonly ssmlCharacters: number
  readonly maximumPriceUsdPerMillionCharacters: number
  readonly maximumEstimatedCostUsd: number
  readonly files: readonly Readonly<{
    relativeFile: string
    ssmlCharacters: number
  }>[]
}

export const FINAL_RETAKE_BATCH_01_MENU_IDS: readonly string[]
export const FINAL_RETAKE_BATCH_01_REQUIRED_REGION: 'southeastasia'
export const FINAL_RETAKE_BATCH_01_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const FINAL_RETAKE_BATCH_01_PRICE_CEILING_ENV:
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const FINAL_RETAKE_BATCH_01_DEFAULT_PRICE_CEILING: number
export const FINAL_RETAKE_BATCH_01_MP3_BYTES_PER_SECOND: 20000
export const FINAL_RETAKE_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP: 1
export const FINAL_RETAKE_BATCH_01_RETRY_COUNT: 0
export const FINAL_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS: Readonly<{
  minimum: 1.2
  maximum: 1.8
}>
export const FINAL_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS: Readonly<{
  minimum: 1.25
  maximum: 1.5
}>
export const FINAL_RETAKE_BATCH_01_MAX_INTERNAL_GAP_MILLISECONDS: 180
export const FINAL_RETAKE_BATCH_01_HARD_MAX_SECONDS: 2
export const FINAL_RETAKE_BATCH_01_SUPERSEDED_SOURCES: Readonly<
  Record<string, Readonly<FinalRetakeBatch01SupersededSources>>
>
export const FINAL_RETAKE_BATCH_01_PERFORMANCES: readonly Readonly<
  FinalRetakeBatch01Performance
>[]

export function estimateFinalRetakeBatch01PlannedTiming(
  performance: Readonly<FinalRetakeBatch01Performance>,
): Readonly<{ approxDurationSeconds: number }>

export function selectFinalRetakeBatch01Performances(
  catalog: readonly NarrationBatchEntry[],
): readonly Readonly<FinalRetakeBatch01Performance>[]

export function createFinalRetakeBatch01Plan(
  performances?: readonly Readonly<FinalRetakeBatch01Performance>[],
): readonly Readonly<FinalRetakeBatch01PlanItem>[]

export function buildFinalRetakeBatch01Ssml(options: {
  performance: Readonly<FinalRetakeBatch01Performance>
  voiceShortName: string
}): string

export function validateFinalRetakeBatch01Voices(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
  performances?: readonly Readonly<FinalRetakeBatch01Performance>[],
): true

export function validateFinalRetakeBatch01SourceFile(options: {
  performance: Readonly<FinalRetakeBatch01Performance>
  sourceKind: FinalRetakeBatch01SourceKind
  byteLength: number
  sha256: string
}): true

export function readFinalRetakeBatch01PriceCeiling(
  environment: Readonly<Record<string, string | undefined>>,
  requireExplicit?: boolean,
): Readonly<{
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling' | 'local-conservative-default'
}>

export function readFinalRetakeBatch01ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling'
}>

export function summarizeFinalRetakeBatch01Cost(
  plan: readonly Readonly<FinalRetakeBatch01PlanItem>[],
  maximumPriceUsdPerMillionCharacters: number,
): Readonly<FinalRetakeBatch01CostSummary>

export function inspectFinalRetakeBatch01Mp3(
  audio: Uint8Array,
): Readonly<FinalRetakeBatch01AudioInspection>

export function summarizeFinalRetakeBatch01Audio(byteLength: number): Readonly<{
  approxDurationSeconds: number
  durationWithinTarget: boolean
  durationWithinHardMaximum: boolean
}>

export function createFinalRetakeBatch01Manifest(options: {
  plan: readonly Readonly<FinalRetakeBatch01PlanItem>[]
  audioResults: readonly Readonly<FinalRetakeBatch01AudioResult>[]
  region: string
  pricing: Readonly<FinalRetakeBatch01CostSummary>
  pricingSource: string
  generatedAt: string
}): Readonly<Record<string, unknown>>

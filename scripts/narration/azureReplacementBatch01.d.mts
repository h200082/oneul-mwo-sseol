import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export type ReplacementBatch01Style = 'determined' | 'joyful'
export type ReplacementBatch01Reason =
  | 'listening-retake'
  | 'catalog-copy-replacement'

export interface ReplacementBatch01SupersededSource {
  readonly supersededPreviewPath: string
  readonly supersededCatalogText: string
  readonly replacementReason: ReplacementBatch01Reason
}
export interface ReplacementBatch01Performance {
  readonly menuId: string
  readonly voiceId: 'junho'
  readonly catalogText: string
  readonly spokenText: string
  readonly style: ReplacementBatch01Style
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly reviewIntent: string
  readonly supersededPreviewPath: string
  readonly supersededCatalogText: string
  readonly replacementReason: ReplacementBatch01Reason
}

export interface ReplacementBatch01PlanItem {
  readonly performance: Readonly<ReplacementBatch01Performance>
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly relativeFile: string
}

export interface ReplacementBatch01AudioResult {
  readonly relativeFile: string
  readonly byteLength: number
}

export interface ReplacementBatch01CostSummary {
  readonly basis: 'full-ssml-unicode-code-point-upper-bound'
  readonly ssmlCharacters: number
  readonly maximumPriceUsdPerMillionCharacters: number
  readonly maximumEstimatedCostUsd: number
  readonly files: readonly Readonly<{
    relativeFile: string
    ssmlCharacters: number
  }>[]
}

export const REPLACEMENT_BATCH_01_MENU_IDS: readonly string[]
export const REPLACEMENT_BATCH_01_REQUIRED_REGION: 'southeastasia'
export const REPLACEMENT_BATCH_01_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const REPLACEMENT_BATCH_01_PRICE_CEILING_ENV:
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const REPLACEMENT_BATCH_01_DEFAULT_PRICE_CEILING: number
export const REPLACEMENT_BATCH_01_MP3_BYTES_PER_SECOND: 20000
export const REPLACEMENT_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP: 1
export const REPLACEMENT_BATCH_01_RETRY_COUNT: 0
export const REPLACEMENT_BATCH_01_QUALITY_TARGET_SECONDS: Readonly<{
  minimum: 1.2
  maximum: 1.8
}>
export const REPLACEMENT_BATCH_01_HARD_MAX_SECONDS: 2
export const REPLACEMENT_BATCH_01_SUPERSEDED_SOURCES: Readonly<
  Record<string, Readonly<ReplacementBatch01SupersededSource>>
>
export const REPLACEMENT_BATCH_01_PERFORMANCES: readonly Readonly<
  ReplacementBatch01Performance
>[]

export function estimateReplacementBatch01PlannedTiming(
  performance: Readonly<ReplacementBatch01Performance>,
): Readonly<{ approxDurationSeconds: number }>

export function selectReplacementBatch01Performances(
  catalog: readonly NarrationBatchEntry[],
): readonly Readonly<ReplacementBatch01Performance>[]

export function createReplacementBatch01Plan(
  performances?: readonly Readonly<ReplacementBatch01Performance>[],
): readonly Readonly<ReplacementBatch01PlanItem>[]

export function buildReplacementBatch01Ssml(options: {
  performance: Readonly<ReplacementBatch01Performance>
  voiceShortName: string
}): string

export function validateReplacementBatch01Voices(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
  performances?: readonly Readonly<ReplacementBatch01Performance>[],
): true

export function readReplacementBatch01PriceCeiling(
  environment: Readonly<Record<string, string | undefined>>,
  requireExplicit?: boolean,
): Readonly<{
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling' | 'local-conservative-default'
}>

export function readReplacementBatch01ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling'
}>

export function summarizeReplacementBatch01Cost(
  plan: readonly Readonly<ReplacementBatch01PlanItem>[],
  maximumPriceUsdPerMillionCharacters: number,
): Readonly<ReplacementBatch01CostSummary>

export function summarizeReplacementBatch01Audio(byteLength: number): Readonly<{
  approxDurationSeconds: number
  durationWithinTarget: boolean
  durationWithinHardMaximum: boolean
}>

export function createReplacementBatch01Manifest(options: {
  plan: readonly Readonly<ReplacementBatch01PlanItem>[]
  audioResults: readonly Readonly<ReplacementBatch01AudioResult>[]
  region: string
  pricing: Readonly<ReplacementBatch01CostSummary>
  pricingSource: string
  generatedAt: string
}): Readonly<Record<string, unknown>>

import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export type SlowRetakeBatch01Style = 'determined' | 'joyful'
export type SlowRetakeBatch01Reason = 'superseded-too-fast'

export interface SlowRetakeBatch01SupersededSource {
  readonly supersededPreviewPath: string
  readonly supersededCatalogText: string
  readonly supersededByteLength: number
  readonly supersededSha256: string
  readonly replacementReason: SlowRetakeBatch01Reason
}
export interface SlowRetakeBatch01Performance {
  readonly menuId: string
  readonly voiceId: 'junho'
  readonly catalogText: string
  readonly spokenText: string
  readonly style: SlowRetakeBatch01Style
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly reviewIntent: string
  readonly supersededPreviewPath: string
  readonly supersededCatalogText: string
  readonly supersededByteLength: number
  readonly supersededSha256: string
  readonly replacementReason: SlowRetakeBatch01Reason
}

export interface SlowRetakeBatch01PlanItem {
  readonly performance: Readonly<SlowRetakeBatch01Performance>
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly relativeFile: string
}

export interface SlowRetakeBatch01AudioInspection {
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
}

export interface SlowRetakeBatch01AudioResult
  extends SlowRetakeBatch01AudioInspection {
  readonly relativeFile: string
}

export interface SlowRetakeBatch01CostSummary {
  readonly basis: 'full-ssml-unicode-code-point-upper-bound'
  readonly ssmlCharacters: number
  readonly maximumPriceUsdPerMillionCharacters: number
  readonly maximumEstimatedCostUsd: number
  readonly files: readonly Readonly<{
    relativeFile: string
    ssmlCharacters: number
  }>[]
}

export const SLOW_RETAKE_BATCH_01_MENU_IDS: readonly string[]
export const SLOW_RETAKE_BATCH_01_REQUIRED_REGION: 'southeastasia'
export const SLOW_RETAKE_BATCH_01_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const SLOW_RETAKE_BATCH_01_PRICE_CEILING_ENV:
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const SLOW_RETAKE_BATCH_01_DEFAULT_PRICE_CEILING: number
export const SLOW_RETAKE_BATCH_01_MP3_BYTES_PER_SECOND: 20000
export const SLOW_RETAKE_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP: 1
export const SLOW_RETAKE_BATCH_01_RETRY_COUNT: 0
export const SLOW_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS: Readonly<{
  minimum: 1.2
  maximum: 1.8
}>
export const SLOW_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS: Readonly<{
  minimum: 1.3
  maximum: 1.55
}>
export const SLOW_RETAKE_BATCH_01_MAX_INTERNAL_GAP_MILLISECONDS: 180
export const SLOW_RETAKE_BATCH_01_HARD_MAX_SECONDS: 2
export const SLOW_RETAKE_BATCH_01_SUPERSEDED_SOURCES: Readonly<
  Record<string, Readonly<SlowRetakeBatch01SupersededSource>>
>
export const SLOW_RETAKE_BATCH_01_PERFORMANCES: readonly Readonly<
  SlowRetakeBatch01Performance
>[]

export function estimateSlowRetakeBatch01PlannedTiming(
  performance: Readonly<SlowRetakeBatch01Performance>,
): Readonly<{ approxDurationSeconds: number }>

export function selectSlowRetakeBatch01Performances(
  catalog: readonly NarrationBatchEntry[],
): readonly Readonly<SlowRetakeBatch01Performance>[]

export function createSlowRetakeBatch01Plan(
  performances?: readonly Readonly<SlowRetakeBatch01Performance>[],
): readonly Readonly<SlowRetakeBatch01PlanItem>[]

export function buildSlowRetakeBatch01Ssml(options: {
  performance: Readonly<SlowRetakeBatch01Performance>
  voiceShortName: string
}): string

export function validateSlowRetakeBatch01Voices(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
  performances?: readonly Readonly<SlowRetakeBatch01Performance>[],
): true

export function validateSlowRetakeBatch01SupersededFile(options: {
  performance: Readonly<SlowRetakeBatch01Performance>
  byteLength: number
  sha256: string
}): true

export function readSlowRetakeBatch01PriceCeiling(
  environment: Readonly<Record<string, string | undefined>>,
  requireExplicit?: boolean,
): Readonly<{
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling' | 'local-conservative-default'
}>

export function readSlowRetakeBatch01ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling'
}>

export function summarizeSlowRetakeBatch01Cost(
  plan: readonly Readonly<SlowRetakeBatch01PlanItem>[],
  maximumPriceUsdPerMillionCharacters: number,
): Readonly<SlowRetakeBatch01CostSummary>

export function inspectSlowRetakeBatch01Mp3(
  audio: Uint8Array,
): Readonly<SlowRetakeBatch01AudioInspection>

export function summarizeSlowRetakeBatch01Audio(byteLength: number): Readonly<{
  approxDurationSeconds: number
  durationWithinTarget: boolean
  durationWithinHardMaximum: boolean
}>

export function createSlowRetakeBatch01Manifest(options: {
  plan: readonly Readonly<SlowRetakeBatch01PlanItem>[]
  audioResults: readonly Readonly<SlowRetakeBatch01AudioResult>[]
  region: string
  pricing: Readonly<SlowRetakeBatch01CostSummary>
  pricingSource: string
  generatedAt: string
}): Readonly<Record<string, unknown>>

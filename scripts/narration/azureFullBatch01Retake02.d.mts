import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export type FullBatch01Retake02Style = 'determined' | 'joyful'

export interface FullBatch01Retake02Performance {
  readonly menuId: string
  readonly voiceId: 'junho'
  readonly catalogText: string
  readonly spokenText: string
  readonly style: FullBatch01Retake02Style
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly reviewIntent: string
}

export interface FullBatch01Retake02PlanItem {
  readonly performance: Readonly<FullBatch01Retake02Performance>
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly relativeFile: string
}

export interface FullBatch01Retake02AudioResult {
  readonly relativeFile: string
  readonly byteLength: number
}

export interface FullBatch01Retake02CostSummary {
  readonly basis: 'full-ssml-unicode-code-point-upper-bound'
  readonly ssmlCharacters: number
  readonly maximumPriceUsdPerMillionCharacters: number
  readonly maximumEstimatedCostUsd: number
  readonly files: readonly Readonly<{
    relativeFile: string
    ssmlCharacters: number
  }>[]
}

export const FULL_BATCH_01_RETAKE_02_MENU_IDS: readonly string[]
export const FULL_BATCH_01_RETAKE_02_REQUIRED_REGION: 'southeastasia'
export const FULL_BATCH_01_RETAKE_02_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const FULL_BATCH_01_RETAKE_02_PRICE_CEILING_ENV:
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const FULL_BATCH_01_RETAKE_02_DEFAULT_PRICE_CEILING: number
export const FULL_BATCH_01_RETAKE_02_MP3_BYTES_PER_SECOND: 20000
export const FULL_BATCH_01_RETAKE_02_SYNTHESIS_REQUESTS_PER_CLIP: 1
export const FULL_BATCH_01_RETAKE_02_RETRY_COUNT: 0
export const FULL_BATCH_01_RETAKE_02_QUALITY_TARGET_SECONDS: Readonly<{
  minimum: 1.2
  maximum: 1.8
}>
export const FULL_BATCH_01_RETAKE_02_HARD_MAX_SECONDS: 2
export const FULL_BATCH_01_RETAKE_02_PERFORMANCES: readonly Readonly<
  FullBatch01Retake02Performance
>[]

export function estimateFullBatch01Retake02PlannedTiming(
  performance: Readonly<FullBatch01Retake02Performance>,
): Readonly<{ approxDurationSeconds: number }>

export function selectFullBatch01Retake02Performances(
  catalog: readonly NarrationBatchEntry[],
): readonly Readonly<FullBatch01Retake02Performance>[]

export function createFullBatch01Retake02Plan(
  performances?: readonly Readonly<FullBatch01Retake02Performance>[],
): readonly Readonly<FullBatch01Retake02PlanItem>[]

export function buildFullBatch01Retake02Ssml(options: {
  performance: Readonly<FullBatch01Retake02Performance>
  voiceShortName: string
}): string

export function validateFullBatch01Retake02Voices(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
  performances?: readonly Readonly<FullBatch01Retake02Performance>[],
): true

export function readFullBatch01Retake02PriceCeiling(
  environment: Readonly<Record<string, string | undefined>>,
  requireExplicit?: boolean,
): Readonly<{
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling' | 'local-conservative-default'
}>

export function readFullBatch01Retake02ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling'
}>

export function summarizeFullBatch01Retake02Cost(
  plan: readonly Readonly<FullBatch01Retake02PlanItem>[],
  maximumPriceUsdPerMillionCharacters: number,
): Readonly<FullBatch01Retake02CostSummary>

export function summarizeFullBatch01Retake02Audio(byteLength: number): Readonly<{
  approxDurationSeconds: number
  durationWithinTarget: boolean
  durationWithinHardMaximum: boolean
}>

export function createFullBatch01Retake02Manifest(options: {
  plan: readonly Readonly<FullBatch01Retake02PlanItem>[]
  audioResults: readonly Readonly<FullBatch01Retake02AudioResult>[]
  region: string
  pricing: Readonly<FullBatch01Retake02CostSummary>
  pricingSource: string
  generatedAt: string
}): Readonly<Record<string, unknown>>

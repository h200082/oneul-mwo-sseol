import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export type FullBatch01Retake03Style = 'determined' | 'joyful'

export interface FullBatch01Retake03Performance {
  readonly menuId: string
  readonly voiceId: 'junho'
  readonly catalogText: string
  readonly spokenText: string
  readonly style: FullBatch01Retake03Style
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly reviewIntent: string
}

export interface FullBatch01Retake03PlanItem {
  readonly performance: Readonly<FullBatch01Retake03Performance>
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly relativeFile: string
}

export interface FullBatch01Retake03AudioResult {
  readonly relativeFile: string
  readonly byteLength: number
}

export interface FullBatch01Retake03CostSummary {
  readonly basis: 'full-ssml-unicode-code-point-upper-bound'
  readonly ssmlCharacters: number
  readonly maximumPriceUsdPerMillionCharacters: number
  readonly maximumEstimatedCostUsd: number
  readonly files: readonly Readonly<{
    relativeFile: string
    ssmlCharacters: number
  }>[]
}

export const FULL_BATCH_01_RETAKE_03_MENU_IDS: readonly string[]
export const FULL_BATCH_01_RETAKE_03_REQUIRED_REGION: 'southeastasia'
export const FULL_BATCH_01_RETAKE_03_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const FULL_BATCH_01_RETAKE_03_PRICE_CEILING_ENV:
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const FULL_BATCH_01_RETAKE_03_DEFAULT_PRICE_CEILING: number
export const FULL_BATCH_01_RETAKE_03_MP3_BYTES_PER_SECOND: 20000
export const FULL_BATCH_01_RETAKE_03_SYNTHESIS_REQUESTS_PER_CLIP: 1
export const FULL_BATCH_01_RETAKE_03_RETRY_COUNT: 0
export const FULL_BATCH_01_RETAKE_03_QUALITY_TARGET_SECONDS: Readonly<{
  minimum: 1.2
  maximum: 1.8
}>
export const FULL_BATCH_01_RETAKE_03_HARD_MAX_SECONDS: 2
export const FULL_BATCH_01_RETAKE_03_PERFORMANCES: readonly Readonly<
  FullBatch01Retake03Performance
>[]

export function estimateFullBatch01Retake03PlannedTiming(
  performance: Readonly<FullBatch01Retake03Performance>,
): Readonly<{ approxDurationSeconds: number }>

export function selectFullBatch01Retake03Performances(
  catalog: readonly NarrationBatchEntry[],
): readonly Readonly<FullBatch01Retake03Performance>[]

export function createFullBatch01Retake03Plan(
  performances?: readonly Readonly<FullBatch01Retake03Performance>[],
): readonly Readonly<FullBatch01Retake03PlanItem>[]

export function buildFullBatch01Retake03Ssml(options: {
  performance: Readonly<FullBatch01Retake03Performance>
  voiceShortName: string
}): string

export function validateFullBatch01Retake03Voices(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
  performances?: readonly Readonly<FullBatch01Retake03Performance>[],
): true

export function readFullBatch01Retake03PriceCeiling(
  environment: Readonly<Record<string, string | undefined>>,
  requireExplicit?: boolean,
): Readonly<{
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling' | 'local-conservative-default'
}>

export function readFullBatch01Retake03ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling'
}>

export function summarizeFullBatch01Retake03Cost(
  plan: readonly Readonly<FullBatch01Retake03PlanItem>[],
  maximumPriceUsdPerMillionCharacters: number,
): Readonly<FullBatch01Retake03CostSummary>

export function summarizeFullBatch01Retake03Audio(byteLength: number): Readonly<{
  approxDurationSeconds: number
  durationWithinTarget: boolean
  durationWithinHardMaximum: boolean
}>

export function createFullBatch01Retake03Manifest(options: {
  plan: readonly Readonly<FullBatch01Retake03PlanItem>[]
  audioResults: readonly Readonly<FullBatch01Retake03AudioResult>[]
  region: string
  pricing: Readonly<FullBatch01Retake03CostSummary>
  pricingSource: string
  generatedAt: string
}): Readonly<Record<string, unknown>>

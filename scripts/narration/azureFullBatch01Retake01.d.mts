import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export type FullBatch01Retake01Style = 'determined' | 'excited' | 'joyful'

export interface FullBatch01Retake01PronunciationOverride {
  readonly catalogSetupText: string
  readonly spokenSetupText: string
  readonly scope: string
  readonly reason: string
}

export interface FullBatch01Retake01Performance {
  readonly menuId: string
  readonly voiceId: 'junho'
  readonly catalogText: string
  readonly spokenSetupText: string
  readonly spokenPunchText: string
  readonly setupStyle: FullBatch01Retake01Style
  readonly punchStyle: FullBatch01Retake01Style
  readonly setupStyleDegree: number
  readonly punchStyleDegree: number
  readonly setupRate: string
  readonly setupPitch: string
  readonly punchRate: string
  readonly punchPitch: string
  readonly breakMs: number
  readonly maximumPunchStartSeconds: number
  readonly clarityTimingException: string | null
  readonly pronunciationOverride:
    | Readonly<FullBatch01Retake01PronunciationOverride>
    | null
  readonly reviewIntent: string
}

export interface FullBatch01Retake01PlanItem {
  readonly performance: Readonly<FullBatch01Retake01Performance>
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly relativeFile: string
}

export interface FullBatch01Retake01AudioResult {
  readonly relativeFile: string
  readonly byteLength: number
}

export interface FullBatch01Retake01CostSummary {
  readonly basis: 'full-ssml-unicode-code-point-upper-bound'
  readonly ssmlCharacters: number
  readonly maximumPriceUsdPerMillionCharacters: number
  readonly maximumEstimatedCostUsd: number
  readonly files: readonly Readonly<{
    relativeFile: string
    ssmlCharacters: number
  }>[]
}

export const FULL_BATCH_01_RETAKE_01_MENU_IDS: readonly string[]
export const FULL_BATCH_01_RETAKE_01_REQUIRED_REGION: 'southeastasia'
export const FULL_BATCH_01_RETAKE_01_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const FULL_BATCH_01_RETAKE_01_PRICE_CEILING_ENV:
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const FULL_BATCH_01_RETAKE_01_DEFAULT_PRICE_CEILING: number
export const FULL_BATCH_01_RETAKE_01_MP3_BYTES_PER_SECOND: 20000
export const FULL_BATCH_01_RETAKE_01_SYNTHESIS_REQUESTS_PER_CLIP: 1
export const FULL_BATCH_01_RETAKE_01_RETRY_COUNT: 0
export const FULL_BATCH_01_RETAKE_01_QUALITY_TARGET_SECONDS: Readonly<{
  minimum: 1.2
  maximum: 1.8
}>
export const FULL_BATCH_01_RETAKE_01_HARD_MAX_SECONDS: 2
export const FULL_BATCH_01_RETAKE_01_DEFAULT_MAXIMUM_PUNCH_START_SECONDS: 0.7
export const FULL_BATCH_01_RETAKE_01_CLARITY_MAXIMUM_PUNCH_START_SECONDS: 0.9
export const FULL_BATCH_01_RETAKE_01_PERFORMANCES: readonly Readonly<
  FullBatch01Retake01Performance
>[]

export function normalizeFullBatch01Retake01SpokenCopy(value: string): string

export function estimateFullBatch01Retake01PlannedTiming(
  performance: Readonly<FullBatch01Retake01Performance>,
): Readonly<{
  approxDurationSeconds: number
  approxPunchStartSeconds: number
}>

export function selectFullBatch01Retake01Performances(
  catalog: readonly NarrationBatchEntry[],
): readonly Readonly<FullBatch01Retake01Performance>[]

export function createFullBatch01Retake01Plan(
  performances?: readonly Readonly<FullBatch01Retake01Performance>[],
): readonly Readonly<FullBatch01Retake01PlanItem>[]

export function buildFullBatch01Retake01Ssml(options: {
  performance: Readonly<FullBatch01Retake01Performance>
  voiceShortName: string
}): string

export function validateFullBatch01Retake01Voices(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
  performances?: readonly Readonly<FullBatch01Retake01Performance>[],
): true

export function readFullBatch01Retake01PriceCeiling(
  environment: Readonly<Record<string, string | undefined>>,
  requireExplicit?: boolean,
): Readonly<{
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling' | 'local-conservative-default'
}>

export function readFullBatch01Retake01ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling'
}>

export function summarizeFullBatch01Retake01Cost(
  plan: readonly Readonly<FullBatch01Retake01PlanItem>[],
  maximumPriceUsdPerMillionCharacters: number,
): Readonly<FullBatch01Retake01CostSummary>

export function summarizeFullBatch01Retake01Audio(byteLength: number): Readonly<{
  approxDurationSeconds: number
  durationWithinTarget: boolean
  durationWithinHardMaximum: boolean
}>

export function createFullBatch01Retake01Manifest(options: {
  plan: readonly Readonly<FullBatch01Retake01PlanItem>[]
  audioResults: readonly Readonly<FullBatch01Retake01AudioResult>[]
  region: string
  pricing: Readonly<FullBatch01Retake01CostSummary>
  pricingSource: string
  generatedAt: string
}): Readonly<Record<string, unknown>>

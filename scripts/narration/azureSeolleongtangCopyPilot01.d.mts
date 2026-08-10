import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export interface SeolleongtangCopyPilot01Candidate {
  readonly label: 'A' | 'B' | 'C'
  readonly takeId: string
  readonly candidateText: string
  readonly relativeFile: string
  readonly voiceId: 'junho'
  readonly style: 'joyful'
  readonly styleDegree: 0.8
  readonly rate: '+50%'
  readonly pitch: '+0%'
}

export interface SeolleongtangCopyPilot01PlanItem {
  readonly candidate: Readonly<SeolleongtangCopyPilot01Candidate>
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly relativeFile: string
}

export interface SeolleongtangCopyPilot01AudioResult {
  readonly relativeFile: string
  readonly byteLength: number
}

export interface SeolleongtangCopyPilot01CostSummary {
  readonly basis: 'full-ssml-unicode-code-point-upper-bound'
  readonly ssmlCharacters: number
  readonly maximumPriceUsdPerMillionCharacters: number
  readonly maximumEstimatedCostUsd: number
  readonly files: readonly Readonly<{
    relativeFile: string
    ssmlCharacters: number
  }>[]
}

export const SEOLLEONGTANG_COPY_PILOT_01_MENU_ID: 'seolleongtang'
export const SEOLLEONGTANG_COPY_PILOT_01_LIVE_PRIMARY_TEXT:
  '깍두기 없인 진행 불가!'
export const SEOLLEONGTANG_COPY_PILOT_01_REQUIRED_REGION: 'southeastasia'
export const SEOLLEONGTANG_COPY_PILOT_01_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const SEOLLEONGTANG_COPY_PILOT_01_PRICE_CEILING_ENV:
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const SEOLLEONGTANG_COPY_PILOT_01_DEFAULT_PRICE_CEILING: number
export const SEOLLEONGTANG_COPY_PILOT_01_SYNTHESIS_REQUESTS_PER_CLIP: 1
export const SEOLLEONGTANG_COPY_PILOT_01_RETRY_COUNT: 0
export const SEOLLEONGTANG_COPY_PILOT_01_QUALITY_TARGET_SECONDS: Readonly<{
  minimum: 1.2
  maximum: 1.8
}>
export const SEOLLEONGTANG_COPY_PILOT_01_HARD_MAX_SECONDS: 2
export const SEOLLEONGTANG_COPY_PILOT_01_CANDIDATES: readonly Readonly<
  SeolleongtangCopyPilot01Candidate
>[]

export function selectSeolleongtangCopyPilot01Candidates(
  catalog: readonly NarrationBatchEntry[],
): readonly Readonly<SeolleongtangCopyPilot01Candidate>[]

export function createSeolleongtangCopyPilot01Plan(
  candidates?: readonly Readonly<SeolleongtangCopyPilot01Candidate>[],
): readonly Readonly<SeolleongtangCopyPilot01PlanItem>[]

export function estimateSeolleongtangCopyPilot01PlannedTiming(
  candidate: Readonly<SeolleongtangCopyPilot01Candidate>,
): Readonly<{ approxDurationSeconds: number }>

export function buildSeolleongtangCopyPilot01Ssml(options: {
  candidate: Readonly<SeolleongtangCopyPilot01Candidate>
  voiceShortName: string
}): string

export function validateSeolleongtangCopyPilot01Voices(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
): true

export function readSeolleongtangCopyPilot01PriceCeiling(
  environment: Readonly<Record<string, string | undefined>>,
  requireExplicit?: boolean,
): Readonly<{
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling' | 'local-conservative-default'
}>

export function readSeolleongtangCopyPilot01ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-local-official-ceiling'
}>

export function summarizeSeolleongtangCopyPilot01Cost(
  plan: readonly Readonly<SeolleongtangCopyPilot01PlanItem>[],
  maximumPriceUsdPerMillionCharacters: number,
): Readonly<SeolleongtangCopyPilot01CostSummary>

export function summarizeSeolleongtangCopyPilot01Audio(byteLength: number): Readonly<{
  approxDurationSeconds: number
  durationWithinTarget: boolean
  durationWithinHardMaximum: boolean
}>

export function createSeolleongtangCopyPilot01Manifest(options: {
  plan: readonly Readonly<SeolleongtangCopyPilot01PlanItem>[]
  audioResults: readonly Readonly<SeolleongtangCopyPilot01AudioResult>[]
  region: string
  pricing: Readonly<SeolleongtangCopyPilot01CostSummary>
  pricingSource: string
  generatedAt: string
}): Readonly<Record<string, unknown>>

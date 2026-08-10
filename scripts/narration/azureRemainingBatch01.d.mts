import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export type RemainingBatch01ModelId = 'flash' | 'mai-voice-2'
export type RemainingBatch01Model = 'MAI-Voice-2-Flash' | 'MAI-Voice-2'
export type RemainingBatch01VoiceId = 'junho' | 'haena'
export type RemainingBatch01Style = 'joyful' | 'determined'
export type RemainingBatch01Tone = NarrationBatchEntry['tone']

export interface RemainingBatch01SourcePin {
  readonly path: string
  readonly byteLength: number
  readonly sha256: string
}

export interface RemainingBatch01Voice {
  readonly modelId: RemainingBatch01ModelId
  readonly model: RemainingBatch01Model
  readonly voiceId: RemainingBatch01VoiceId
  readonly shortName: string
}

export interface RemainingBatch01Performance {
  readonly menuId: string
  readonly listeningGroup: 1 | 2 | 3 | 4
  readonly tone: RemainingBatch01Tone
  readonly catalogText: string
  readonly spokenText: string
  readonly synthesisAllowed: true
  readonly modelId: RemainingBatch01ModelId
  readonly voiceId: RemainingBatch01VoiceId
  readonly style: RemainingBatch01Style
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly segments: readonly [string] | readonly [string, string]
  readonly copyRisk: readonly string[]
  readonly brandReview?: 'metadata-only'
  readonly neutralNoImpersonation?: true
}

export interface RemainingBatch01PlanItem {
  readonly performance: Readonly<RemainingBatch01Performance>
  readonly modelId: RemainingBatch01ModelId
  readonly model: RemainingBatch01Model
  readonly voiceId: RemainingBatch01VoiceId
  readonly voiceShortName: string
  readonly relativeFile: string
}

export interface RemainingBatch01PriceCeiling {
  readonly modelId: RemainingBatch01ModelId
  readonly model: RemainingBatch01Model
  readonly environmentVariable: string
  readonly maximumPriceUsdPerMillionCharacters: number
  readonly source:
    | 'environment-local-official-ceiling'
    | 'local-conservative-default'
}

export type RemainingBatch01PriceCeilings = Readonly<
  Record<RemainingBatch01ModelId, Readonly<RemainingBatch01PriceCeiling>>
>

export interface RemainingBatch01CostFile {
  readonly relativeFile: string
  readonly modelId: RemainingBatch01ModelId
  readonly ssmlCharacters: number
}

export interface RemainingBatch01ModelCost
  extends RemainingBatch01PriceCeiling {
  readonly ssmlCharacters: number
  readonly maximumEstimatedCostUsd: number
  readonly files: readonly Readonly<RemainingBatch01CostFile>[]
}

export interface RemainingBatch01CostSummary {
  readonly basis: 'full-ssml-unicode-code-point-upper-bound'
  readonly models: readonly Readonly<RemainingBatch01ModelCost>[]
  readonly ssmlCharacters: number
  readonly maximumEstimatedCostUsd: number
  readonly files: readonly Readonly<RemainingBatch01CostFile>[]
}

export interface RemainingBatch01AudioInspection {
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
}

export interface RemainingBatch01AudioResult
  extends RemainingBatch01AudioInspection {
  readonly relativeFile: string
}

export interface RemainingBatch01SourceAttestation {
  readonly catalogPin: Readonly<RemainingBatch01SourcePin>
  readonly activeAudioIdsPin: Readonly<RemainingBatch01SourcePin>
  readonly catalog: readonly Readonly<NarrationBatchEntry>[]
  readonly activeAudioIds: readonly string[]
  readonly performances: readonly Readonly<RemainingBatch01Performance>[]
}

export const REMAINING_BATCH_01_REQUIRED_REGION: 'southeastasia'
export const REMAINING_BATCH_01_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const REMAINING_BATCH_01_RETRY_COUNT: 0
export const REMAINING_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP: 1

export const REMAINING_BATCH_01_MODEL_PRICE_PROFILES: Readonly<{
  flash: Readonly<{
    model: 'MAI-Voice-2-Flash'
    environmentVariable: 'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
    defaultPriceCeiling: number
  }>
  'mai-voice-2': Readonly<{
    model: 'MAI-Voice-2'
    environmentVariable:
      'AZURE_SPEECH_MAI_VOICE_2_MAX_USD_PER_MILLION_CHARS'
    defaultPriceCeiling: number
  }>
}>

export const REMAINING_BATCH_01_SOURCE_PINS: Readonly<{
  catalog: Readonly<RemainingBatch01SourcePin>
  activeAudioIds: Readonly<RemainingBatch01SourcePin>
}>

export const REMAINING_BATCH_01_ACTIVE_MENU_IDS: readonly string[]
export const REMAINING_BATCH_01_MENU_IDS: readonly string[]
export const REMAINING_BATCH_01_CATALOG_ORDER: readonly string[]
export const REMAINING_BATCH_01_LISTENING_GROUPS: readonly Readonly<{
  listeningGroup: 1 | 2 | 3 | 4
  menuIds: readonly string[]
}>[]
export const REMAINING_BATCH_01_VOICES: Readonly<
  Record<string, Readonly<RemainingBatch01Voice>>
>
export const REMAINING_BATCH_01_PERFORMANCES: readonly Readonly<
  RemainingBatch01Performance
>[]

export function selectRemainingBatch01Performances(
  catalog: readonly NarrationBatchEntry[],
  activeAudioIds: readonly string[],
): readonly Readonly<RemainingBatch01Performance>[]

export function validateRemainingBatch01SourceFiles(options: {
  readonly catalogBytes: Uint8Array
  readonly activeAudioIdsBytes: Uint8Array
}): Readonly<RemainingBatch01SourceAttestation>

export function createRemainingBatch01Plan(
  performances?: readonly Readonly<RemainingBatch01Performance>[],
): readonly Readonly<RemainingBatch01PlanItem>[]

export function buildRemainingBatch01Ssml(options: {
  readonly performance: Readonly<RemainingBatch01Performance>
  readonly voiceShortName: string
}): string

export function estimateRemainingBatch01PlannedTiming(
  performance: Readonly<RemainingBatch01Performance>,
): Readonly<{
  approxDurationSeconds: number
  basis: 'informational-total-text-heuristic-only'
}>

export function validateRemainingBatch01Voices(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
): true

export function readRemainingBatch01PriceCeilings(
  environment: Readonly<Record<string, string | undefined>>,
  requireExplicit?: boolean,
): Readonly<RemainingBatch01PriceCeilings>

export function readRemainingBatch01ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  priceCeilings: Readonly<RemainingBatch01PriceCeilings>
}>

export function summarizeRemainingBatch01Cost(
  plan: readonly Readonly<RemainingBatch01PlanItem>[],
  priceCeilings: Readonly<RemainingBatch01PriceCeilings>,
): Readonly<RemainingBatch01CostSummary>

export function inspectRemainingBatch01Mp3(
  audio: Uint8Array,
): Readonly<RemainingBatch01AudioInspection>

export function createRemainingBatch01Manifest(options: {
  readonly plan: readonly Readonly<RemainingBatch01PlanItem>[]
  readonly audioResults: readonly Readonly<RemainingBatch01AudioResult>[]
  readonly sourceAttestation: Readonly<RemainingBatch01SourceAttestation>
  readonly region: string
  readonly pricing: Readonly<RemainingBatch01CostSummary>
  readonly generatedAt: string
}): Readonly<Record<string, unknown>>

import type { ReplacementPilot02Candidate } from './azureReplacementPilot02.mjs'

export interface ReplacementPilot02MaiVoice2FlashManifestIdentity {
  readonly sourceBatch: 'replacement-pilot-02'
  readonly file: 'replacement-pilot-02-manifest.json'
  readonly path: string
  readonly byteLength: 14487
  readonly sha256: string
  readonly generatedAt: '2026-08-10T02:26:37.504Z'
  readonly schemaVersion: 2
  readonly model: 'MAI-Voice-2-Flash'
}

export interface ReplacementPilot02MaiVoice2FlashFileIdentity {
  readonly menuId: 'pasta' | 'bulgogi-deopbap'
  readonly label: 'A' | 'B'
  readonly file: string
  readonly path: string
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
}

export interface ReplacementPilot02MaiVoice2PlanItem {
  readonly candidate: Readonly<ReplacementPilot02Candidate>
  readonly voiceId: 'junho'
  readonly voiceShortName: 'ko-KR-Junho:MAI-Voice-2'
  readonly relativeFile: string
  readonly flashSource: Readonly<ReplacementPilot02MaiVoice2FlashFileIdentity>
}

export interface ReplacementPilot02MaiVoice2AudioResult {
  readonly relativeFile: string
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
}

export interface ReplacementPilot02MaiVoice2CostSummary {
  readonly basis: 'full-ssml-unicode-code-point-upper-bound'
  readonly ssmlCharacters: number
  readonly maximumPriceUsdPerMillionCharacters: number
  readonly maximumEstimatedCostUsd: number
  readonly files: readonly Readonly<{
    relativeFile: string
    ssmlCharacters: number
  }>[]
}

export interface ReplacementPilot02MaiVoice2FlashAttestation {
  readonly manifest: Readonly<ReplacementPilot02MaiVoice2FlashManifestIdentity>
  readonly files: readonly Readonly<ReplacementPilot02MaiVoice2FlashFileIdentity>[]
}

export const REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_SHORT_NAME:
  'ko-KR-Junho:MAI-Voice-2-Flash'
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME:
  'ko-KR-Junho:MAI-Voice-2'
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_MODEL: 'MAI-Voice-2'
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_REQUIRED_REGION: 'southeastasia'
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_OUTPUT_FORMAT:
  'audio-24khz-160kbitrate-mono-mp3'
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_PRICE_CEILING_ENV:
  'AZURE_SPEECH_MAI_VOICE_2_MAX_USD_PER_MILLION_CHARS'
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_DEFAULT_PRICE_CEILING: 20
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_SYNTHESIS_REQUESTS_PER_CLIP: 1
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_RETRY_COUNT: 0
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_MANIFEST:
  Readonly<ReplacementPilot02MaiVoice2FlashManifestIdentity>
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_FILES: readonly Readonly<
  ReplacementPilot02MaiVoice2FlashFileIdentity
>[]

export function createReplacementPilot02MaiVoice2Plan(): readonly Readonly<
  ReplacementPilot02MaiVoice2PlanItem
>[]

export function buildReplacementPilot02MaiVoice2Ssml(options: {
  candidate: Readonly<ReplacementPilot02Candidate>
  voiceShortName: string
}): string

export function readReplacementPilot02MaiVoice2PriceCeiling(
  environment: Readonly<Record<string, string | undefined>>,
  requireExplicit?: boolean,
): Readonly<{
  maximumPriceUsdPerMillionCharacters: number
  source:
    | 'environment-independent-mai-voice-2-ceiling'
    | 'local-conservative-default'
}>

export function readReplacementPilot02MaiVoice2ExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumPriceUsdPerMillionCharacters: number
  source: 'environment-independent-mai-voice-2-ceiling'
}>

export function summarizeReplacementPilot02MaiVoice2Cost(
  plan: readonly Readonly<ReplacementPilot02MaiVoice2PlanItem>[],
  maximumPriceUsdPerMillionCharacters: number,
): Readonly<ReplacementPilot02MaiVoice2CostSummary>

export function validateReplacementPilot02MaiVoice2Voices(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
): true

export function validateReplacementPilot02MaiVoice2FlashManifestBytes(
  bytes: Uint8Array,
): Readonly<ReplacementPilot02MaiVoice2FlashManifestIdentity>

export function validateReplacementPilot02MaiVoice2FlashAudioIdentity(options: {
  source: Readonly<ReplacementPilot02MaiVoice2FlashFileIdentity>
  byteLength: number
  sha256: string
  mpegFrameCount: number
  exactDurationSeconds: number
}): true

export function inspectReplacementPilot02MaiVoice2Mp3(
  audio: Uint8Array,
): Readonly<{
  byteLength: number
  sha256: string
  mpegFrameCount: number
  exactDurationSeconds: number
}>

export function createReplacementPilot02MaiVoice2Manifest(options: {
  plan: readonly Readonly<ReplacementPilot02MaiVoice2PlanItem>[]
  audioResults: readonly Readonly<ReplacementPilot02MaiVoice2AudioResult>[]
  flashAttestation: Readonly<ReplacementPilot02MaiVoice2FlashAttestation>
  region: string
  pricing: Readonly<ReplacementPilot02MaiVoice2CostSummary>
  pricingSource: string
  generatedAt: string
}): Readonly<Record<string, unknown>>

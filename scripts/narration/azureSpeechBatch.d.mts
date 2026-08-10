export interface NarrationBatchEntry {
  readonly menuId: string
  readonly text: string
  readonly tone: 'playful' | 'alert' | 'deadpan' | 'epic'
}

export interface AzureSpeechExecutionConfig {
  readonly key: string
  readonly region: string
  readonly voice: string
  readonly maximumPriceUsdPerMillion: number
}

export const REPRESENTATIVE_MENU_IDS: readonly string[]
export const TONE_SSML_PROFILES: Readonly<
  Record<NarrationBatchEntry['tone'], Readonly<Record<string, string>>>
>
export const DEFAULT_MAX_PRICE_USD_PER_MILLION_CHARS: number
export const AZURE_SPEECH_OUTPUT_FORMAT: 'audio-24khz-96kbitrate-mono-mp3'

export function escapeXml(value: string): string
export function parseNarrationCatalog(source: string): NarrationBatchEntry[]
export function selectRepresentativeNarrations(
  catalog: readonly NarrationBatchEntry[],
): NarrationBatchEntry[]
export function buildSsml(options: {
  readonly text: string
  readonly tone: NarrationBatchEntry['tone']
  readonly voice: string
}): string
export function sanitizeAzureSpeechErrorDetail(
  responseBody: unknown,
  sensitiveValues?: readonly string[],
): string
export function countBillableCharacters(
  narrations: readonly NarrationBatchEntry[],
): number
export function estimateMaximumCostUsd(
  characterCount: number,
  maximumPriceUsdPerMillion?: number,
): number
export function parseCliArgs(args: readonly string[]): {
  readonly execute: boolean
  readonly outputDir: string | undefined
  readonly help: boolean
}
export function readExecutionConfig(
  environment: Readonly<Record<string, string | undefined>>,
): AzureSpeechExecutionConfig

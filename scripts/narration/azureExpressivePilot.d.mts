import type { NarrationBatchEntry } from './azureSpeechBatch.mjs'

export interface ExpressivePilotLine {
  readonly menuId: string
  readonly text: string
  readonly setupText: string
  readonly punchText: string
  readonly style: 'determined' | 'excited' | 'joyful'
  readonly setupStyleDegree: number
  readonly punchStyleDegree: number
  readonly setupRate: string
  readonly setupPitch: string
  readonly punchRate: string
  readonly punchPitch: string
  readonly breakMs: number
}

export interface AzureVoiceListEntry {
  readonly ShortName?: string
  readonly StyleList?: readonly string[]
  readonly [key: string]: unknown
}

export const AZURE_MAI_OUTPUT_FORMAT: 'audio-24khz-160kbitrate-mono-mp3'
export const EXPRESSIVE_PILOT_VOICES: readonly Readonly<{
  id: 'haena' | 'junho'
  shortName: string
}>[]
export const EXPRESSIVE_PILOT_LINES: readonly Readonly<ExpressivePilotLine>[]

export function selectExpressivePilotLines(
  catalog: readonly NarrationBatchEntry[],
): readonly Readonly<ExpressivePilotLine>[]
export function createExpressivePilotMatrix(
  lines?: readonly Readonly<ExpressivePilotLine>[],
): readonly Readonly<{
  voiceId: 'haena' | 'junho'
  voiceShortName: string
  line: Readonly<ExpressivePilotLine>
  relativeFile: string
}>[]
export function buildExpressivePilotSsml(options: {
  line: Readonly<ExpressivePilotLine>
  voiceShortName: string
}): string
export function readExpressivePilotConfig(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<{ key: string; region: string }>
export function validateExpressivePilotVoices(
  availableVoices: readonly AzureVoiceListEntry[],
): true
export function readSafeAzureErrorDetail(
  response: Pick<Response, 'text'>,
  redactions?: readonly string[],
): Promise<string>
export { parseCliArgs } from './azureSpeechBatch.mjs'

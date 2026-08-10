export interface KalguksuCopyRetake01Performance {
  readonly menuId: 'kalguksu'
  readonly tone: 'deadpan'
  readonly catalogText: '칼은 위협용!'
  readonly spokenText: '칼은 위협용!'
  readonly modelId: 'flash'
  readonly model: 'MAI-Voice-2-Flash'
  readonly voiceId: 'junho'
  readonly voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash'
  readonly style: 'determined'
  readonly styleDegree: 0.36
  readonly rate: '+12%'
  readonly pitch: '-1%'
  readonly structure: 'one-block'
  readonly segments: readonly ['칼은 위협용!']
  readonly synthesisAllowed: true
}

export const KALGUKSU_COPY_RETAKE_01_REQUIRED_REGION: 'southeastasia'
export const KALGUKSU_COPY_RETAKE_01_OUTPUT_FORMAT: 'audio-24khz-160kbitrate-mono-mp3'
export const KALGUKSU_COPY_RETAKE_01_PRICE_ENV: 'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const KALGUKSU_COPY_RETAKE_01_OFFICIAL_PRICE_CEILING: 22
export const KALGUKSU_COPY_RETAKE_01_RETRY_COUNT: 0
export const KALGUKSU_COPY_RETAKE_01_USER_QUOTE: string
export const KALGUKSU_COPY_RETAKE_01_SOURCE_PINS: Readonly<{
  catalog: Readonly<{ path: string; byteLength: number; sha256: string }>
  activeAudioIds: Readonly<{ path: string; byteLength: number; sha256: string }>
  rejectedRaw: Readonly<{
    path: string
    byteLength: number
    sha256: string
    mpegFrameCount: number
    exactDurationSeconds: number
  }>
  parentManifest: Readonly<{
    path: string
    byteLength: number
    sha256: string
    schemaVersion: 2
  }>
}>
export const KALGUKSU_COPY_RETAKE_01_PERFORMANCE: KalguksuCopyRetake01Performance

export function validateKalguksuCopyRetake01Sources(input: {
  catalogBytes: Uint8Array
  activeAudioIdsBytes: Uint8Array
  rejectedRawBytes: Uint8Array
  parentManifestBytes: Uint8Array
}): Readonly<{
  catalogPin: { path: string; byteLength: number; sha256: string }
  activeAudioIdsPin: { path: string; byteLength: number; sha256: string }
  rejectedRawPin: {
    path: string
    byteLength: number
    sha256: string
    mpegFrameCount: number
    exactDurationSeconds: number
  }
  parentManifestPin: {
    path: string
    byteLength: number
    sha256: string
    schemaVersion: 2
  }
  activeAudioIds: readonly string[]
  current: Readonly<{ menuId: string; text: string; tone: string }>
}>
export function createKalguksuCopyRetake01Plan(): readonly [
  Readonly<{
    performance: KalguksuCopyRetake01Performance
    relativeFile: 'kalguksu.mp3'
  }>,
]
export function buildKalguksuCopyRetake01Ssml(
  performance?: KalguksuCopyRetake01Performance,
): string
export function validateKalguksuCopyRetake01Voice(
  availableVoices: readonly unknown[],
): true
export function readKalguksuCopyRetake01PriceCeiling(
  environment: NodeJS.ProcessEnv,
): number
export function readKalguksuCopyRetake01ExecutionConfig(
  environment: NodeJS.ProcessEnv,
): Readonly<{
  key: string
  region: 'southeastasia'
  maximumUsdPerMillionCharacters: number
}>
export function summarizeKalguksuCopyRetake01Cost(
  plan: ReturnType<typeof createKalguksuCopyRetake01Plan>,
  maximumUsdPerMillionCharacters: number,
): Readonly<{
  ssmlCharacters: number
  maximumUsdPerMillionCharacters: number
  maximumEstimatedCostUsd: number
}>
export function createKalguksuCopyRetake01Manifest(input: {
  sourceAttestation: ReturnType<typeof validateKalguksuCopyRetake01Sources>
  inspection: {
    byteLength: number
    sha256: string
    mpegFrameCount: number
    exactDurationSeconds: number
  }
  pricing: ReturnType<typeof summarizeKalguksuCopyRetake01Cost>
  generatedAt: string
}): Record<string, unknown>

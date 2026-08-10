export interface RamyeonSoftRetakeVariant {
  readonly menuId: 'ramyeon'
  readonly takeId: string
  readonly voiceId: 'haena'
  readonly text: string
  readonly setupText: string
  readonly punchText: string
  readonly setupStyle: 'excited' | 'happy'
  readonly punchStyle: 'excited' | 'happy'
  readonly setupStyleDegree: number
  readonly punchStyleDegree: number
  readonly setupRate: string
  readonly setupPitch: string
  readonly punchRate: string
  readonly punchPitch: string
  readonly breakMs: number
}

export interface RamyeonSoftRetakePlanItem {
  readonly variant: Readonly<RamyeonSoftRetakeVariant>
  readonly voiceId: 'haena'
  readonly voiceShortName: string
  readonly relativeFile: string
}

export const RAMYEON_SOFT_RETAKE_CATALOG_TEXT: string
export const RAMYEON_SOFT_RETAKE_TEXT: string
export const RAMYEON_SOFT_RETAKE_QUALITY_TARGET_SECONDS: Readonly<{
  minimum: 1.6
  maximum: 2.2
}>
export const AZURE_MAI_MP3_BYTES_PER_SECOND: 20000
export const RAMYEON_SOFT_RETAKE_VOICE: Readonly<{
  id: 'haena'
  shortName: string
}>
export const RAMYEON_SOFT_RETAKE_VARIANTS: readonly Readonly<
  RamyeonSoftRetakeVariant
>[]

export function selectRamyeonSoftRetakeVariants(
  catalog: readonly Readonly<{ menuId: string; text: string }>[],
): readonly Readonly<RamyeonSoftRetakeVariant>[]

export function createRamyeonSoftRetakePlan(
  variants?: readonly Readonly<RamyeonSoftRetakeVariant>[],
): readonly Readonly<RamyeonSoftRetakePlanItem>[]

export function buildRamyeonSoftRetakeSsml(options: {
  variant: Readonly<RamyeonSoftRetakeVariant>
  voiceShortName: string
}): string

export function validateRamyeonSoftRetakeVoice(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
  variants?: readonly Readonly<RamyeonSoftRetakeVariant>[],
): true

export function summarizeRamyeonSoftRetakeAudio(byteLength: number): Readonly<{
  approxDurationSeconds: number
  durationWithinTarget: boolean
}>

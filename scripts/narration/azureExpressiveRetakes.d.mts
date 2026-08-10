export interface ExpressiveRetakeVariant {
  readonly menuId: string
  readonly takeId: string
  readonly voiceId: string
  readonly text: string
  readonly setupText: string
  readonly punchText: string
  readonly setupStyle: 'determined' | 'excited'
  readonly punchStyle: 'determined' | 'excited'
  readonly setupStyleDegree: number
  readonly punchStyleDegree: number
  readonly setupRate: string
  readonly setupPitch: string
  readonly punchRate: string
  readonly punchPitch: string
  readonly breakMs: number
}

export interface ExpressiveRetakePlanItem {
  readonly variant: Readonly<ExpressiveRetakeVariant>
  readonly voiceId: string
  readonly voiceShortName: string
  readonly relativeFile: string
}

export const EXPRESSIVE_RETAKE_MENU_IDS: readonly string[]
export const APPROVED_RETAKE_TEXT_OVERRIDES: Readonly<
  Record<string, string>
>
export const EXPRESSIVE_RETAKE_VARIANTS: readonly Readonly<
  ExpressiveRetakeVariant
>[]

export function selectExpressiveRetakeVariants(
  catalog: readonly Readonly<{ menuId: string; text: string }>[],
): readonly Readonly<ExpressiveRetakeVariant>[]

export function createExpressiveRetakePlan(
  variants?: readonly Readonly<ExpressiveRetakeVariant>[],
): readonly Readonly<ExpressiveRetakePlanItem>[]

export function buildExpressiveRetakeSsml(options: {
  variant: Readonly<ExpressiveRetakeVariant>
  voiceShortName: string
}): string

export function validateExpressiveRetakeVoices(
  availableVoices: readonly Readonly<{
    ShortName?: string
    StyleList?: readonly string[]
  }>[],
  variants?: readonly Readonly<ExpressiveRetakeVariant>[],
): true

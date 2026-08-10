export const FEEDBACK_SETTINGS_STORAGE_KEY =
  'oneul-mwo-sseol-feedback-v1'

export interface FeedbackSettings {
  readonly soundEnabled: boolean
  readonly hapticsEnabled: boolean
}

export type FeedbackSettingsStorage = Pick<
  Storage,
  'getItem' | 'setItem'
>

export const DEFAULT_FEEDBACK_SETTINGS: Readonly<FeedbackSettings> =
  Object.freeze({
    soundEnabled: true,
    hapticsEnabled: true,
  })

export function loadFeedbackSettings(
  storage: FeedbackSettingsStorage | null,
): Readonly<FeedbackSettings> {
  if (!storage) {
    return DEFAULT_FEEDBACK_SETTINGS
  }

  try {
    const raw = storage.getItem(FEEDBACK_SETTINGS_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_FEEDBACK_SETTINGS
    }

    const parsed: unknown = JSON.parse(raw)
    if (!isFeedbackSettings(parsed)) {
      return DEFAULT_FEEDBACK_SETTINGS
    }

    return Object.freeze({
      soundEnabled: parsed.soundEnabled,
      hapticsEnabled: parsed.hapticsEnabled,
    })
  } catch {
    return DEFAULT_FEEDBACK_SETTINGS
  }
}

export function saveFeedbackSettings(
  storage: FeedbackSettingsStorage | null,
  settings: Readonly<FeedbackSettings>,
): void {
  if (!storage) {
    return
  }

  try {
    storage.setItem(
      FEEDBACK_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        soundEnabled: settings.soundEnabled,
        hapticsEnabled: settings.hapticsEnabled,
      }),
    )
  } catch {
    // Feedback settings must never block gameplay in restricted storage modes.
  }
}

function isFeedbackSettings(value: unknown): value is FeedbackSettings {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<FeedbackSettings>
  return (
    typeof candidate.soundEnabled === 'boolean' &&
    typeof candidate.hapticsEnabled === 'boolean'
  )
}

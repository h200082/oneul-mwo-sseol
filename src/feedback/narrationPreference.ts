export const NARRATION_ENABLED_STORAGE_KEY =
  'oneul-mwo-sseol-narration-enabled'

export interface NarrationPreferenceState {
  readonly requestedEnabled: boolean
  readonly effectiveEnabled: boolean
}

export type NarrationPreferenceListener = (
  state: Readonly<NarrationPreferenceState>,
) => void

export interface NarrationPreference {
  readonly requestedEnabled: boolean
  readonly effectiveEnabled: boolean
  getState(): Readonly<NarrationPreferenceState>
  setEnabled(enabled: boolean): void
  toggle(): boolean
  subscribe(listener: NarrationPreferenceListener): () => void
}

export class StoredNarrationPreference implements NarrationPreference {
  private enabled: boolean
  private writableStorage: Storage | null
  private readonly listeners = new Set<NarrationPreferenceListener>()

  constructor(
    storage: Storage | null,
    private readonly isMasterSoundEnabled: () => boolean = () => true,
    private readonly storageKey = NARRATION_ENABLED_STORAGE_KEY,
  ) {
    this.writableStorage = storage
    this.enabled = this.readStoredPreference(storage)
  }

  get requestedEnabled(): boolean {
    return this.enabled
  }

  get effectiveEnabled(): boolean {
    if (!this.enabled) {
      return false
    }

    try {
      return this.isMasterSoundEnabled()
    } catch {
      return false
    }
  }

  getState(): Readonly<NarrationPreferenceState> {
    return Object.freeze({
      requestedEnabled: this.requestedEnabled,
      effectiveEnabled: this.effectiveEnabled,
    })
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) {
      return
    }

    this.enabled = enabled
    this.persistPreference()
    this.emit()
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled)
    return this.enabled
  }

  subscribe(listener: NarrationPreferenceListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private readStoredPreference(storage: Storage | null): boolean {
    if (!storage) {
      return true
    }

    try {
      return storage.getItem(this.storageKey) !== '0'
    } catch {
      this.writableStorage = null
      return true
    }
  }

  private persistPreference(): void {
    if (!this.writableStorage) {
      return
    }

    try {
      this.writableStorage.setItem(this.storageKey, this.enabled ? '1' : '0')
    } catch {
      // Privacy modes can reject storage writes. The in-memory value remains valid.
      this.writableStorage = null
    }
  }

  private emit(): void {
    const state = this.getState()
    for (const listener of this.listeners) {
      listener(state)
    }
  }
}

export function createBrowserNarrationPreference(
  isMasterSoundEnabled: () => boolean,
): NarrationPreference {
  let storage: Storage | null = null
  try {
    storage = window.localStorage
  } catch {
    // Storage access itself can throw before any read in privacy-restricted modes.
  }

  return new StoredNarrationPreference(storage, isMasterSoundEnabled)
}

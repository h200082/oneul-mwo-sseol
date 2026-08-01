export const FIREBASE_REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const

export interface FirebaseClientConfig {
  readonly apiKey: string
  readonly authDomain: string
  readonly projectId: string
  readonly appId: string
  readonly storageBucket?: string
  readonly messagingSenderId?: string
  readonly measurementId?: string
}

export class FirebaseConfigError extends Error {
  constructor(readonly missingKeys: readonly string[]) {
    super(
      `Firebase 환경변수가 일부만 설정되었습니다: ${missingKeys.join(', ')}`,
    )
    this.name = 'FirebaseConfigError'
  }
}

type FirebaseEnvironment = Readonly<
  Record<string, string | boolean | undefined>
>

/**
 * Returns null only when Firebase is intentionally not configured.
 *
 * A partial configuration is treated as an error so production never appears
 * to offer cross-device rooms while silently falling back to localStorage.
 */
export function readFirebaseClientConfig(
  environment: FirebaseEnvironment,
): FirebaseClientConfig | null {
  const values = Object.fromEntries(
    FIREBASE_REQUIRED_ENV_KEYS.map((key) => [
      key,
      readEnvironmentString(environment[key]),
    ]),
  ) as Record<(typeof FIREBASE_REQUIRED_ENV_KEYS)[number], string>

  const configuredCount = Object.values(values).filter(Boolean).length
  if (configuredCount === 0) {
    return null
  }

  const missingKeys = FIREBASE_REQUIRED_ENV_KEYS.filter(
    (key) => values[key].length === 0,
  )
  if (missingKeys.length > 0) {
    throw new FirebaseConfigError(missingKeys)
  }

  const optional = {
    storageBucket: readEnvironmentString(
      environment.VITE_FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: readEnvironmentString(
      environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
    ),
    measurementId: readEnvironmentString(
      environment.VITE_FIREBASE_MEASUREMENT_ID,
    ),
  }

  return Object.freeze({
    apiKey: values.VITE_FIREBASE_API_KEY,
    authDomain: values.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: values.VITE_FIREBASE_PROJECT_ID,
    appId: values.VITE_FIREBASE_APP_ID,
    ...(optional.storageBucket
      ? { storageBucket: optional.storageBucket }
      : {}),
    ...(optional.messagingSenderId
      ? { messagingSenderId: optional.messagingSenderId }
      : {}),
    ...(optional.measurementId
      ? { measurementId: optional.measurementId }
      : {}),
  })
}

function readEnvironmentString(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

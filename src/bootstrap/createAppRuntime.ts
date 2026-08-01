import { LocalRoomGateway } from '../rooms/LocalRoomGateway'
import type { RoomGateway } from '../rooms/RoomGateway'
import {
  FirebaseConfigError,
  FIREBASE_REQUIRED_ENV_KEYS,
  readFirebaseClientConfig,
} from '../firebase/firebaseConfig'

export type MultiplayerBackend = 'local' | 'firebase'

export interface AppRuntime {
  readonly gateway: RoomGateway
  readonly playerId: string | null
  readonly backend: MultiplayerBackend
}

export async function createAppRuntime(
  environment: Readonly<
    Record<string, string | boolean | undefined>
  > = import.meta.env,
): Promise<AppRuntime> {
  const requestedBackend = readBackend(
    environment.VITE_MULTIPLAYER_BACKEND,
  )

  if (requestedBackend === 'local') {
    return createLocalRuntime()
  }

  const config = readFirebaseClientConfig(environment)
  if (!config) {
    if (requestedBackend === 'firebase') {
      throw new FirebaseConfigError(FIREBASE_REQUIRED_ENV_KEYS)
    }
    return createLocalRuntime()
  }

  const { createFirebaseRoomRuntime } = await import(
    '../firebase/createFirebaseRuntime'
  )
  const firebase = await createFirebaseRoomRuntime(
    config,
    environment.VITE_FIREBASE_USE_EMULATORS === 'true',
  )
  return Object.freeze({
    gateway: firebase.gateway,
    playerId: firebase.playerId,
    backend: 'firebase',
  })
}

function createLocalRuntime(): AppRuntime {
  return Object.freeze({
    gateway: new LocalRoomGateway(),
    playerId: null,
    backend: 'local',
  })
}

function readBackend(
  value: string | boolean | undefined,
): MultiplayerBackend | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }
  if (value === 'local' || value === 'firebase') {
    return value
  }
  throw new TypeError(
    'VITE_MULTIPLAYER_BACKEND must be "local" or "firebase".',
  )
}

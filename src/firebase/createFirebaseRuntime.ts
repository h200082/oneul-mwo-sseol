import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore'

import type { RoomGateway } from '../rooms/RoomGateway'
import type { FirebaseClientConfig } from './firebaseConfig'
import { FirebaseRoomGateway } from './FirebaseRoomGateway'

export interface FirebaseRoomRuntime {
  readonly gateway: RoomGateway
  readonly playerId: string
}

let emulatorsConnected = false

export async function createFirebaseRoomRuntime(
  config: FirebaseClientConfig,
  useEmulators = false,
): Promise<FirebaseRoomRuntime> {
  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp(config)
  const auth = getAuth(app)
  const db = getFirestore(app)

  if (useEmulators && !emulatorsConnected) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    emulatorsConnected = true
  }

  await auth.authStateReady()
  const user =
    auth.currentUser ?? (await signInAnonymously(auth)).user

  return Object.freeze({
    gateway: new FirebaseRoomGateway(db, user.uid),
    playerId: user.uid,
  })
}

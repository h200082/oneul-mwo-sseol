import { describe, expect, it } from 'vitest'

import {
  FirebaseConfigError,
  readFirebaseClientConfig,
} from '../src/firebase/firebaseConfig'

describe('readFirebaseClientConfig', () => {
  it('keeps the local gateway when no Firebase values are configured', () => {
    expect(readFirebaseClientConfig({})).toBeNull()
  })

  it('rejects a partial configuration instead of silently falling back', () => {
    expect(() =>
      readFirebaseClientConfig({
        VITE_FIREBASE_API_KEY: 'api-key',
        VITE_FIREBASE_PROJECT_ID: 'project',
      }),
    ).toThrow(FirebaseConfigError)
  })

  it('returns a frozen Firebase config and omits blank optional values', () => {
    const config = readFirebaseClientConfig({
      VITE_FIREBASE_API_KEY: ' api-key ',
      VITE_FIREBASE_AUTH_DOMAIN: 'project.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'project',
      VITE_FIREBASE_APP_ID: 'app-id',
      VITE_FIREBASE_STORAGE_BUCKET: ' ',
      VITE_FIREBASE_MESSAGING_SENDER_ID: 'sender',
    })

    expect(config).toEqual({
      apiKey: 'api-key',
      authDomain: 'project.firebaseapp.com',
      projectId: 'project',
      appId: 'app-id',
      messagingSenderId: 'sender',
    })
    expect(Object.isFrozen(config)).toBe(true)
  })
})

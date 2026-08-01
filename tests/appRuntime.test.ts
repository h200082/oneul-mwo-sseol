import { describe, expect, it, vi } from 'vitest'

import { createAppRuntime } from '../src/bootstrap/createAppRuntime'
import { FirebaseConfigError } from '../src/firebase/firebaseConfig'
import { LocalRoomGateway } from '../src/rooms/LocalRoomGateway'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length(): number {
    return this.values.size
  }
  clear(): void {
    this.values.clear()
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.values.delete(key)
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('createAppRuntime', () => {
  it('uses the local gateway when Firebase is intentionally absent', async () => {
    vi.stubGlobal('window', {
      localStorage: new MemoryStorage(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    try {
      const runtime = await createAppRuntime({
        VITE_MULTIPLAYER_BACKEND: 'local',
      })
      expect(runtime.backend).toBe('local')
      expect(runtime.playerId).toBeNull()
      expect(runtime.gateway).toBeInstanceOf(LocalRoomGateway)
      runtime.gateway.dispose?.()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects explicit Firebase mode without a complete config', async () => {
    await expect(
      createAppRuntime({
        VITE_MULTIPLAYER_BACKEND: 'firebase',
      }),
    ).rejects.toBeInstanceOf(FirebaseConfigError)
  })

  it('rejects unknown backend names', async () => {
    await expect(
      createAppRuntime({
        VITE_MULTIPLAYER_BACKEND: 'other',
      }),
    ).rejects.toThrow(/must be "local" or "firebase"/)
  })
})

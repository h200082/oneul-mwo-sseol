import { describe, expect, it, vi } from 'vitest'

import { createRandomUuid } from '../src/domain/randomUuid'

describe('createRandomUuid', () => {
  it('uses crypto.randomUUID when the browser provides it', () => {
    const randomUUID = vi.fn(() => 'secure-context-uuid')
    const getRandomValues = vi.fn((bytes: Uint8Array) => bytes)

    expect(createRandomUuid({ randomUUID, getRandomValues })).toBe(
      'secure-context-uuid',
    )
    expect(randomUUID).toHaveBeenCalledOnce()
    expect(getRandomValues).not.toHaveBeenCalled()
  })

  it('creates an RFC 4122 version 4 UUID when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
      ])
      return bytes
    })

    expect(
      createRandomUuid({ randomUUID: undefined, getRandomValues }),
    ).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
    expect(getRandomValues).toHaveBeenCalledOnce()
  })
})

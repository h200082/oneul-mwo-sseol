interface RandomUuidSource {
  readonly randomUUID: (() => string) | undefined
  readonly getRandomValues: (bytes: Uint8Array<ArrayBuffer>) => void
}

function getBrowserCryptoSource(): RandomUuidSource {
  return {
    randomUUID:
      typeof crypto.randomUUID === 'function'
        ? () => crypto.randomUUID()
        : undefined,
    getRandomValues: (bytes) => {
      crypto.getRandomValues(bytes)
    },
  }
}

/**
 * Creates a UUID in secure and insecure browser contexts.
 *
 * `crypto.randomUUID()` is restricted to secure contexts, while
 * `crypto.getRandomValues()` remains available for local-network HTTP testing.
 */
export function createRandomUuid(
  source: RandomUuidSource = getBrowserCryptoSource(),
): string {
  if (source.randomUUID) {
    return source.randomUUID()
  }

  const bytes = new Uint8Array(new ArrayBuffer(16))
  source.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from '../domain/room'

export class RoomInviteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RoomInviteError'
  }
}

/**
 * Accepts codes copied with spaces or hyphens, then returns the canonical
 * uppercase eight-character form used by storage, links and QR codes.
 */
export function normalizeRoomCode(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\s-]+/gu, '')

  if (normalized.length !== ROOM_CODE_LENGTH) {
    throw new RoomInviteError(
      `방 코드는 ${ROOM_CODE_LENGTH}자리여야 합니다.`,
    )
  }

  for (const character of normalized) {
    if (!ROOM_CODE_ALPHABET.includes(character)) {
      throw new RoomInviteError(
        '방 코드에 사용할 수 없는 문자가 포함되어 있습니다.',
      )
    }
  }

  return normalized
}

export function buildRoomInviteUrl(
  baseUrl: string | URL,
  roomCode: string,
): string {
  const url = new URL(baseUrl)
  url.searchParams.set('room', normalizeRoomCode(roomCode))
  url.hash = ''
  return url.toString()
}

export function readRoomCodeFromUrl(
  value: string | URL,
): string | null {
  const rawCode = new URL(value).searchParams.get('room')

  if (!rawCode) {
    return null
  }

  try {
    return normalizeRoomCode(rawCode)
  } catch {
    return null
  }
}

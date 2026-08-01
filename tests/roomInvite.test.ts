import { describe, expect, it } from 'vitest'

import {
  RoomInviteError,
  buildRoomInviteUrl,
  normalizeRoomCode,
  readRoomCodeFromUrl,
} from '../src/rooms/roomInvite'

describe('normalizeRoomCode', () => {
  it('공백·하이픈·소문자를 정규화한다', () => {
    expect(normalizeRoomCode('ab cd-2efg')).toBe('ABCD2EFG')
  })

  it.each(['ABC', 'ABCD0EFG', 'ABCD1EFG', 'ABCDOEFG'])(
    '유효하지 않은 방 코드 %s를 거부한다',
    (value) => {
      expect(() => normalizeRoomCode(value)).toThrow(RoomInviteError)
    },
  )
})

describe('room invite URL', () => {
  it('기존 Pages 경로를 유지하고 room 쿼리를 추가한다', () => {
    expect(
      buildRoomInviteUrl(
        'https://example.github.io/game/?source=home#top',
        'abcd2efg',
      ),
    ).toBe(
      'https://example.github.io/game/?source=home&room=ABCD2EFG',
    )
  })

  it('URL에서 유효한 방 코드를 읽는다', () => {
    expect(
      readRoomCodeFromUrl(
        'https://example.github.io/game/?room=abcd-2efg',
      ),
    ).toBe('ABCD2EFG')
  })

  it('방 코드가 없거나 잘못되면 null을 반환한다', () => {
    expect(
      readRoomCodeFromUrl('https://example.github.io/game/'),
    ).toBeNull()
    expect(
      readRoomCodeFromUrl(
        'https://example.github.io/game/?room=BAD-CODE',
      ),
    ).toBeNull()
  })
})

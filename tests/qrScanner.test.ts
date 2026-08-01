import { describe, expect, it } from 'vitest'

import { extractRoomCodeFromQrValue } from '../src/qr/QrScannerService'

describe('extractRoomCodeFromQrValue', () => {
  it('8자리 코드 자체를 인식한다', () => {
    expect(extractRoomCodeFromQrValue('abcd-2efg')).toBe('ABCD2EFG')
  })

  it('GitHub Pages 초대 URL의 room 쿼리를 인식한다', () => {
    expect(
      extractRoomCodeFromQrValue(
        'https://example.github.io/game/?room=ABCD2EFG',
      ),
    ).toBe('ABCD2EFG')
  })

  it('다른 QR과 잘못된 방 코드는 무시한다', () => {
    expect(
      extractRoomCodeFromQrValue('https://example.com/menu'),
    ).toBeNull()
    expect(extractRoomCodeFromQrValue('BAD-CODE')).toBeNull()
  })
})

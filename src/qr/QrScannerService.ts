import {
  normalizeRoomCode,
  readRoomCodeFromUrl,
} from '../rooms/roomInvite'

export type QrScannerErrorCode =
  | 'UNSUPPORTED'
  | 'PERMISSION_DENIED'
  | 'ABORTED'
  | 'TIMED_OUT'

export class QrScannerError extends Error {
  constructor(
    readonly code: QrScannerErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'QrScannerError'
  }
}

interface DetectedBarcode {
  readonly rawValue: string
}

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<readonly DetectedBarcode[]>
}

interface BarcodeDetectorConstructor {
  new (options: {
    formats: readonly string[]
  }): BarcodeDetectorInstance
}

interface BarcodeWindow extends Window {
  BarcodeDetector?: BarcodeDetectorConstructor
}

export interface QrScannerOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export function extractRoomCodeFromQrValue(value: string): string | null {
  const trimmed = value.trim()

  try {
    return normalizeRoomCode(trimmed)
  } catch {
    try {
      return readRoomCodeFromUrl(new URL(trimmed))
    } catch {
      return null
    }
  }
}

/**
 * Scans a QR code with the browser's native BarcodeDetector.
 *
 * Chrome/Android can use this directly. Browsers without BarcodeDetector keep
 * the invite-link and eight-character code fallbacks available in the UI.
 */
export async function scanRoomCodeFromCamera(
  video: HTMLVideoElement,
  options: QrScannerOptions = {},
): Promise<string> {
  const Detector = (window as BarcodeWindow).BarcodeDetector

  if (!Detector || !navigator.mediaDevices?.getUserMedia) {
    throw new QrScannerError(
      'UNSUPPORTED',
      '이 브라우저는 앱 내 QR 스캔을 지원하지 않습니다.',
    )
  }

  if (options.signal?.aborted) {
    throw new QrScannerError('ABORTED', 'QR 스캔을 취소했습니다.')
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
      },
    })
  } catch (error) {
    throw new QrScannerError(
      'PERMISSION_DENIED',
      '카메라 권한이 필요합니다. 권한을 허용하거나 방 코드를 입력하세요.',
      { cause: error },
    )
  }

  const timeoutMs = options.timeoutMs ?? 30_000
  const deadline = Date.now() + timeoutMs

  try {
    const detector = new Detector({ formats: ['qr_code'] })
    video.srcObject = stream
    video.playsInline = true
    video.muted = true
    await video.play()

    while (Date.now() < deadline) {
      if (options.signal?.aborted) {
        throw new QrScannerError('ABORTED', 'QR 스캔을 취소했습니다.')
      }

      const barcodes = await detector.detect(video)
      for (const barcode of barcodes) {
        const roomCode = extractRoomCodeFromQrValue(barcode.rawValue)
        if (roomCode) {
          return roomCode
        }
      }

      await waitForNextScan(options.signal)
    }

    throw new QrScannerError(
      'TIMED_OUT',
      'QR을 찾지 못했습니다. 방 코드를 직접 입력해 주세요.',
    )
  } finally {
    video.pause()
    video.srcObject = null
    for (const track of stream.getTracks()) {
      track.stop()
    }
  }
}

function waitForNextScan(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      window.clearTimeout(timeout)
      reject(new QrScannerError('ABORTED', 'QR 스캔을 취소했습니다.'))
    }
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, 140)

    signal?.addEventListener(
      'abort',
      handleAbort,
      { once: true },
    )
  })
}

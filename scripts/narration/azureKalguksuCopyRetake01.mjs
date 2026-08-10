import { createHash } from 'node:crypto'

import { escapeXml, parseNarrationCatalog } from './azureSpeechBatch.mjs'
import { inspectRemainingBatch01Mp3 } from './azureRemainingBatch01.mjs'

export const KALGUKSU_COPY_RETAKE_01_REQUIRED_REGION = 'southeastasia'
export const KALGUKSU_COPY_RETAKE_01_OUTPUT_FORMAT =
  'audio-24khz-160kbitrate-mono-mp3'
export const KALGUKSU_COPY_RETAKE_01_PRICE_ENV =
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const KALGUKSU_COPY_RETAKE_01_OFFICIAL_PRICE_CEILING = 22
export const KALGUKSU_COPY_RETAKE_01_RETRY_COUNT = 0

export const KALGUKSU_COPY_RETAKE_01_USER_QUOTE =
  '칼국수 뺴고 나머지 전부 괜찮아 승인할게. 칼국수는 문구를 바꾸자. "칼은 위협용" 으로 문구 바꿔서 재생성 해줘'

export const KALGUKSU_COPY_RETAKE_01_SOURCE_PINS = Object.freeze({
  catalog: Object.freeze({
    path: 'src/data/menuNarrations.ts',
    byteLength: 13_578,
    sha256: '059804c9f862864bbb1b26a127248856faef216f5a2f2dfb53872b07d68b5ba1',
  }),
  activeAudioIds: Object.freeze({
    path: 'src/data/menuNarrationAudioIds.ts',
    byteLength: 829,
    sha256: 'a6b91a7bfc24a06f53f5b570431b3da9b2946c93d2ee1815d63d3f04cb06b0f6',
  }),
  rejectedRaw: Object.freeze({
    path: 'tmp/narration-preview/remaining-batch-01/kalguksu.mp3',
    byteLength: 77_760,
    sha256: '5ab16c2df6ed341a498fa2d00db3ddc0c90a5ec22968a27918043fed16e3438c',
    mpegFrameCount: 162,
    exactDurationSeconds: 3.888,
  }),
  parentManifest: Object.freeze({
    path:
      'tmp/narration-preview/remaining-batch-01/remaining-batch-01-manifest.json',
    byteLength: 42_007,
    sha256: 'c2a6a2846c37a76c1fcf4a8e7f1e7f6255248d007d0712288ec934736cbf107e',
    schemaVersion: 2,
  }),
})

export const KALGUKSU_COPY_RETAKE_01_PERFORMANCE = Object.freeze({
  menuId: 'kalguksu',
  tone: 'deadpan',
  catalogText: '칼은 위협용!',
  spokenText: '칼은 위협용!',
  modelId: 'flash',
  model: 'MAI-Voice-2-Flash',
  voiceId: 'junho',
  voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
  style: 'determined',
  styleDegree: 0.36,
  rate: '+12%',
  pitch: '-1%',
  structure: 'one-block',
  segments: Object.freeze(['칼은 위협용!']),
  synthesisAllowed: true,
})

function validatePinnedBytes(bytes, pin, label) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`${label} source must be bytes`)
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (bytes.byteLength !== pin.byteLength || sha256 !== pin.sha256) {
    throw new Error(`${label} source identity changed`)
  }
  return Object.freeze({ ...pin })
}

function parseActiveAudioIds(source) {
  const match =
    /export const MENU_NARRATION_AUDIO_IDS = \[([\s\S]*?)\]\s+as const/u.exec(
      source,
    )
  if (!match?.[1]) throw new Error('Could not parse active narration audio IDs')
  const ids = [...match[1].matchAll(/'([a-z0-9-]+)'/g)].map(
    (entry) => entry[1],
  )
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error('Active narration audio IDs are empty or duplicated')
  }
  return ids
}

function assertPerformance(performance) {
  if (
    performance.menuId !== 'kalguksu' ||
    performance.catalogText !== '칼은 위협용!' ||
    performance.spokenText !== performance.catalogText ||
    performance.tone !== 'deadpan' ||
    performance.modelId !== 'flash' ||
    performance.model !== 'MAI-Voice-2-Flash' ||
    performance.voiceId !== 'junho' ||
    performance.voiceShortName !== 'ko-KR-Junho:MAI-Voice-2-Flash' ||
    performance.style !== 'determined' ||
    performance.styleDegree !== 0.36 ||
    performance.rate !== '+12%' ||
    performance.pitch !== '-1%' ||
    performance.structure !== 'one-block' ||
    performance.segments.length !== 1 ||
    performance.segments[0] !== performance.catalogText ||
    performance.synthesisAllowed !== true
  ) {
    throw new Error('Kalguksu copy retake 01 performance changed')
  }
}

export function validateKalguksuCopyRetake01Sources({
  catalogBytes,
  activeAudioIdsBytes,
  rejectedRawBytes,
  parentManifestBytes,
}) {
  const catalogPin = validatePinnedBytes(
    catalogBytes,
    KALGUKSU_COPY_RETAKE_01_SOURCE_PINS.catalog,
    'Narration catalog',
  )
  const activeAudioIdsPin = validatePinnedBytes(
    activeAudioIdsBytes,
    KALGUKSU_COPY_RETAKE_01_SOURCE_PINS.activeAudioIds,
    'Active audio IDs',
  )
  const rejectedRawPin = validatePinnedBytes(
    rejectedRawBytes,
    KALGUKSU_COPY_RETAKE_01_SOURCE_PINS.rejectedRaw,
    'Rejected kalguksu raw audio',
  )
  const parentManifestPin = validatePinnedBytes(
    parentManifestBytes,
    KALGUKSU_COPY_RETAKE_01_SOURCE_PINS.parentManifest,
    'Parent remaining-batch manifest',
  )
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const catalog = parseNarrationCatalog(decoder.decode(catalogBytes))
  const activeAudioIds = parseActiveAudioIds(
    decoder.decode(activeAudioIdsBytes),
  )
  const current = catalog.find(({ menuId }) => menuId === 'kalguksu')
  assertPerformance(KALGUKSU_COPY_RETAKE_01_PERFORMANCE)
  if (
    !current ||
    current.text !== KALGUKSU_COPY_RETAKE_01_PERFORMANCE.catalogText ||
    current.tone !== KALGUKSU_COPY_RETAKE_01_PERFORMANCE.tone
  ) {
    throw new Error('Kalguksu current catalog copy or tone changed')
  }
  if (activeAudioIds.length !== 35 || activeAudioIds.includes('kalguksu')) {
    throw new Error('Kalguksu must remain inactive before listening approval')
  }

  const rejectedInspection = inspectRemainingBatch01Mp3(rejectedRawBytes)
  if (
    rejectedInspection.mpegFrameCount !==
      KALGUKSU_COPY_RETAKE_01_SOURCE_PINS.rejectedRaw.mpegFrameCount ||
    rejectedInspection.exactDurationSeconds !==
      KALGUKSU_COPY_RETAKE_01_SOURCE_PINS.rejectedRaw.exactDurationSeconds
  ) {
    throw new Error('Rejected kalguksu raw MPEG identity changed')
  }

  const parentManifest = JSON.parse(decoder.decode(parentManifestBytes))
  const rejectedEntry = parentManifest.generatedFiles?.find(
    ({ menuId }) => menuId === 'kalguksu',
  )
  if (
    parentManifest.schemaVersion !== 2 ||
    rejectedEntry?.catalogText !== '칼은 이름에만, 국물은 따뜻!' ||
    rejectedEntry?.byteLength !== rejectedRawPin.byteLength ||
    rejectedEntry?.sha256 !== rejectedRawPin.sha256 ||
    rejectedEntry?.mpegFrameCount !== rejectedRawPin.mpegFrameCount ||
    rejectedEntry?.exactDurationSeconds !== rejectedRawPin.exactDurationSeconds
  ) {
    throw new Error('Rejected kalguksu parent manifest lineage changed')
  }

  return Object.freeze({
    catalogPin,
    activeAudioIdsPin,
    rejectedRawPin,
    parentManifestPin,
    activeAudioIds: Object.freeze(activeAudioIds),
    current: Object.freeze(current),
  })
}

export function createKalguksuCopyRetake01Plan() {
  assertPerformance(KALGUKSU_COPY_RETAKE_01_PERFORMANCE)
  return Object.freeze([
    Object.freeze({
      performance: KALGUKSU_COPY_RETAKE_01_PERFORMANCE,
      relativeFile: 'kalguksu.mp3',
    }),
  ])
}

export function buildKalguksuCopyRetake01Ssml(
  performance = KALGUKSU_COPY_RETAKE_01_PERFORMANCE,
) {
  assertPerformance(performance)
  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ko-KR">',
    `<voice xml:lang="ko-KR" name="${escapeXml(performance.voiceShortName)}">`,
    `<mstts:express-as style="${performance.style}" styledegree="${performance.styleDegree}">`,
    `<prosody rate="${performance.rate}" pitch="${performance.pitch}">${escapeXml(performance.spokenText)}</prosody>`,
    '</mstts:express-as>',
    '</voice>',
    '</speak>',
  ].join('')
}

export function validateKalguksuCopyRetake01Voice(availableVoices) {
  const voice = availableVoices.find(
    ({ ShortName }) =>
      ShortName === KALGUKSU_COPY_RETAKE_01_PERFORMANCE.voiceShortName,
  )
  if (!voice) {
    throw new Error('Required Kalguksu MAI voice is unavailable')
  }
  if (
    !Array.isArray(voice.StyleList) ||
    !voice.StyleList.includes(KALGUKSU_COPY_RETAKE_01_PERFORMANCE.style)
  ) {
    throw new Error('Required Kalguksu determined style is unavailable')
  }
  return true
}

export function readKalguksuCopyRetake01PriceCeiling(environment) {
  const raw = environment[KALGUKSU_COPY_RETAKE_01_PRICE_ENV]?.trim()
  if (!raw) {
    throw new Error(`${KALGUKSU_COPY_RETAKE_01_PRICE_ENV} is required`)
  }
  const value = Number(raw)
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > KALGUKSU_COPY_RETAKE_01_OFFICIAL_PRICE_CEILING
  ) {
    throw new Error(
      `${KALGUKSU_COPY_RETAKE_01_PRICE_ENV} must be > 0 and <= ${KALGUKSU_COPY_RETAKE_01_OFFICIAL_PRICE_CEILING}`,
    )
  }
  return value
}

export function readKalguksuCopyRetake01ExecutionConfig(environment) {
  const key = environment.AZURE_SPEECH_KEY?.trim()
  const region = environment.AZURE_SPEECH_REGION?.trim().toLowerCase()
  if (!key) throw new Error('AZURE_SPEECH_KEY is required')
  if (!/^[\x21-\x7e]+$/.test(key)) {
    throw new Error('AZURE_SPEECH_KEY must contain only printable ASCII')
  }
  if (region !== KALGUKSU_COPY_RETAKE_01_REQUIRED_REGION) {
    throw new Error(
      `AZURE_SPEECH_REGION must be ${KALGUKSU_COPY_RETAKE_01_REQUIRED_REGION}`,
    )
  }
  return Object.freeze({
    key,
    region,
    maximumUsdPerMillionCharacters:
      readKalguksuCopyRetake01PriceCeiling(environment),
  })
}

export function summarizeKalguksuCopyRetake01Cost(
  plan,
  maximumUsdPerMillionCharacters,
) {
  if (plan.length !== 1) throw new Error('Kalguksu retake must have one clip')
  const ssmlCharacters = Array.from(
    buildKalguksuCopyRetake01Ssml(plan[0].performance),
  ).length
  return Object.freeze({
    ssmlCharacters,
    maximumUsdPerMillionCharacters,
    maximumEstimatedCostUsd:
      (ssmlCharacters * maximumUsdPerMillionCharacters) / 1_000_000,
  })
}

export function createKalguksuCopyRetake01Manifest({
  sourceAttestation,
  inspection,
  pricing,
  generatedAt,
}) {
  if (
    !inspection ||
    !Number.isInteger(inspection.byteLength) ||
    inspection.byteLength <= 0 ||
    !/^[a-f0-9]{64}$/.test(inspection.sha256) ||
    !Number.isInteger(inspection.mpegFrameCount) ||
    inspection.mpegFrameCount <= 0 ||
    !Number.isFinite(inspection.exactDurationSeconds) ||
    inspection.exactDurationSeconds <= 0
  ) {
    throw new Error('Kalguksu retake MP3 inspection is invalid')
  }
  return {
    schemaVersion: 2,
    provider: 'Azure AI Speech',
    batch: 'kalguksu-copy-retake-01',
    region: KALGUKSU_COPY_RETAKE_01_REQUIRED_REGION,
    outputFormat: KALGUKSU_COPY_RETAKE_01_OUTPUT_FORMAT,
    generatedAt,
    userApproval: {
      statement: KALGUKSU_COPY_RETAKE_01_USER_QUOTE,
    },
    sourcePins: {
      catalog: sourceAttestation.catalogPin,
      activeAudioIds: sourceAttestation.activeAudioIdsPin,
      rejectedRaw: sourceAttestation.rejectedRawPin,
      parentManifest: sourceAttestation.parentManifestPin,
      kalguksuInactiveBeforeListening: true,
    },
    performance: KALGUKSU_COPY_RETAKE_01_PERFORMANCE,
    delivery: {
      oneVoice: true,
      oneExpressAs: true,
      oneProsody: true,
      oneBlock: true,
      explicitBreaks: 0,
      subTagsUsed: false,
      phonemeTagsUsed: false,
      emphasisTagsUsed: false,
      voiceSwitches: 0,
    },
    pricing,
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip: 1,
      totalSynthesisRequests: 1,
      retries: KALGUKSU_COPY_RETAKE_01_RETRY_COUNT,
    },
    generatedFiles: [
      {
        menuId: 'kalguksu',
        file: 'kalguksu.mp3',
        ...inspection,
      },
    ],
    outputQa: {
      totalByteLength: inspection.byteLength,
      outputIdentityPinnedInManifest: true,
      exactDurationMeasurement:
        'validated MPEG frame count * 576 samples / 24,000 Hz',
      postprocessingApplied: false,
      runtimeIntegrationAttempted: false,
      listeningReviewRequired: true,
    },
  }
}

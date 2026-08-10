import { createHash } from 'node:crypto'

import { escapeXml, parseNarrationCatalog } from './azureSpeechBatch.mjs'
import { inspectRemainingBatch01Mp3 } from './azureRemainingBatch01.mjs'

export const JOKBAL_COPY_RETAKE_01_REQUIRED_REGION = 'southeastasia'
export const JOKBAL_COPY_RETAKE_01_OUTPUT_FORMAT =
  'audio-24khz-160kbitrate-mono-mp3'
export const JOKBAL_COPY_RETAKE_01_PRICE_ENV =
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const JOKBAL_COPY_RETAKE_01_OFFICIAL_PRICE_CEILING = 22
export const JOKBAL_COPY_RETAKE_01_RETRY_COUNT = 0

export const JOKBAL_COPY_RETAKE_01_USER_QUOTE =
  '족발은 "발을 먹는데? 손이 더 바쁘다" 에서 "더"가 빠졌어 중요한 요소야 수정해줘.  나머지는 다 맘에 들어'

export const JOKBAL_COPY_RETAKE_01_SOURCE_PINS = Object.freeze({
  catalog: Object.freeze({
    path: 'src/data/menuNarrations.ts',
    byteLength: 14_046,
    sha256: '5648c5f240a39b3de924d16b31072717f722ea1b9d590f6eb1f75883b00e1475',
  }),
  activeAudioIds: Object.freeze({
    path: 'src/data/menuNarrationAudioIds.ts',
    byteLength: 1_040,
    sha256: '538e3150b36b6ee51b35457f396855a43a8820b9b583216a63b79fe1ae8b8b32',
  }),
  rejectedRaw: Object.freeze({
    path: 'tmp/narration-preview/remaining-batch-01/jokbal.mp3',
    byteLength: 54_720,
    sha256: '9d4505fe633998516a2aabe750920ce2cd14e98709ce87512d67b674d24966bd',
    mpegFrameCount: 114,
    exactDurationSeconds: 2.736,
  }),
  parentManifest: Object.freeze({
    path:
      'tmp/narration-preview/remaining-batch-01/remaining-batch-01-manifest.json',
    byteLength: 42_007,
    sha256: 'c2a6a2846c37a76c1fcf4a8e7f1e7f6255248d007d0712288ec934736cbf107e',
    schemaVersion: 2,
  }),
})

export const JOKBAL_COPY_RETAKE_01_PERFORMANCE = Object.freeze({
  menuId: 'jokbal',
  tone: 'playful',
  catalogText: '발을 먹는데? 손이 더 바쁘다!',
  spokenText: '발을 먹는데? 손이 더 바쁘다!',
  modelId: 'flash',
  model: 'MAI-Voice-2-Flash',
  voiceId: 'junho',
  voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
  style: 'joyful',
  styleDegree: 0.48,
  rate: '+22%',
  pitch: '+0%',
  structure: 'one-block',
  segments: Object.freeze(['발을 먹는데? 손이 더 바쁘다!']),
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
    performance.menuId !== 'jokbal' ||
    performance.catalogText !== '발을 먹는데? 손이 더 바쁘다!' ||
    performance.spokenText !== performance.catalogText ||
    performance.tone !== 'playful' ||
    performance.modelId !== 'flash' ||
    performance.model !== 'MAI-Voice-2-Flash' ||
    performance.voiceId !== 'junho' ||
    performance.voiceShortName !== 'ko-KR-Junho:MAI-Voice-2-Flash' ||
    performance.style !== 'joyful' ||
    performance.styleDegree !== 0.48 ||
    performance.rate !== '+22%' ||
    performance.pitch !== '+0%' ||
    performance.structure !== 'one-block' ||
    performance.segments.length !== 1 ||
    performance.segments[0] !== performance.catalogText ||
    performance.synthesisAllowed !== true
  ) {
    throw new Error('Jokbal copy retake 01 performance changed')
  }
}

export function validateJokbalCopyRetake01Sources({
  catalogBytes,
  activeAudioIdsBytes,
  rejectedRawBytes,
  parentManifestBytes,
}) {
  const catalogPin = validatePinnedBytes(
    catalogBytes,
    JOKBAL_COPY_RETAKE_01_SOURCE_PINS.catalog,
    'Narration catalog',
  )
  const activeAudioIdsPin = validatePinnedBytes(
    activeAudioIdsBytes,
    JOKBAL_COPY_RETAKE_01_SOURCE_PINS.activeAudioIds,
    'Active audio IDs',
  )
  const rejectedRawPin = validatePinnedBytes(
    rejectedRawBytes,
    JOKBAL_COPY_RETAKE_01_SOURCE_PINS.rejectedRaw,
    'Rejected jokbal raw audio',
  )
  const parentManifestPin = validatePinnedBytes(
    parentManifestBytes,
    JOKBAL_COPY_RETAKE_01_SOURCE_PINS.parentManifest,
    'Parent remaining-batch manifest',
  )
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const catalog = parseNarrationCatalog(decoder.decode(catalogBytes))
  const activeAudioIds = parseActiveAudioIds(
    decoder.decode(activeAudioIdsBytes),
  )
  const current = catalog.find(({ menuId }) => menuId === 'jokbal')
  assertPerformance(JOKBAL_COPY_RETAKE_01_PERFORMANCE)
  if (
    !current ||
    current.text !== JOKBAL_COPY_RETAKE_01_PERFORMANCE.catalogText ||
    current.tone !== JOKBAL_COPY_RETAKE_01_PERFORMANCE.tone
  ) {
    throw new Error('Jokbal current catalog copy or tone changed')
  }
  if (activeAudioIds.length !== 49 || activeAudioIds.includes('jokbal')) {
    throw new Error('Jokbal must remain inactive before listening approval')
  }

  const rejectedInspection = inspectRemainingBatch01Mp3(rejectedRawBytes)
  if (
    rejectedInspection.mpegFrameCount !==
      JOKBAL_COPY_RETAKE_01_SOURCE_PINS.rejectedRaw.mpegFrameCount ||
    rejectedInspection.exactDurationSeconds !==
      JOKBAL_COPY_RETAKE_01_SOURCE_PINS.rejectedRaw.exactDurationSeconds
  ) {
    throw new Error('Rejected jokbal raw MPEG identity changed')
  }

  const parentManifest = JSON.parse(decoder.decode(parentManifestBytes))
  const rejectedEntry = parentManifest.generatedFiles?.find(
    ({ menuId }) => menuId === 'jokbal',
  )
  if (
    parentManifest.schemaVersion !== 2 ||
    rejectedEntry?.catalogText !== '발을 먹는데 손이 바쁘다!' ||
    rejectedEntry?.byteLength !== rejectedRawPin.byteLength ||
    rejectedEntry?.sha256 !== rejectedRawPin.sha256 ||
    rejectedEntry?.mpegFrameCount !== rejectedRawPin.mpegFrameCount ||
    rejectedEntry?.exactDurationSeconds !== rejectedRawPin.exactDurationSeconds
  ) {
    throw new Error('Rejected jokbal parent manifest lineage changed')
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

export function createJokbalCopyRetake01Plan() {
  assertPerformance(JOKBAL_COPY_RETAKE_01_PERFORMANCE)
  return Object.freeze([
    Object.freeze({
      performance: JOKBAL_COPY_RETAKE_01_PERFORMANCE,
      relativeFile: 'jokbal.mp3',
    }),
  ])
}

export function buildJokbalCopyRetake01Ssml(
  performance = JOKBAL_COPY_RETAKE_01_PERFORMANCE,
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

export function validateJokbalCopyRetake01Voice(availableVoices) {
  const voice = availableVoices.find(
    ({ ShortName }) =>
      ShortName === JOKBAL_COPY_RETAKE_01_PERFORMANCE.voiceShortName,
  )
  if (!voice) throw new Error('Required Jokbal MAI voice is unavailable')
  if (
    !Array.isArray(voice.StyleList) ||
    !voice.StyleList.includes(JOKBAL_COPY_RETAKE_01_PERFORMANCE.style)
  ) {
    throw new Error('Required Jokbal joyful style is unavailable')
  }
  return true
}

export function readJokbalCopyRetake01PriceCeiling(environment) {
  const raw = environment[JOKBAL_COPY_RETAKE_01_PRICE_ENV]?.trim()
  if (!raw) throw new Error(`${JOKBAL_COPY_RETAKE_01_PRICE_ENV} is required`)
  const value = Number(raw)
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > JOKBAL_COPY_RETAKE_01_OFFICIAL_PRICE_CEILING
  ) {
    throw new Error(
      `${JOKBAL_COPY_RETAKE_01_PRICE_ENV} must be > 0 and <= ${JOKBAL_COPY_RETAKE_01_OFFICIAL_PRICE_CEILING}`,
    )
  }
  return value
}

export function readJokbalCopyRetake01ExecutionConfig(environment) {
  const key = environment.AZURE_SPEECH_KEY?.trim()
  const region = environment.AZURE_SPEECH_REGION?.trim().toLowerCase()
  if (!key) throw new Error('AZURE_SPEECH_KEY is required')
  if (!/^[\x21-\x7e]+$/.test(key)) {
    throw new Error('AZURE_SPEECH_KEY must contain only printable ASCII')
  }
  if (region !== JOKBAL_COPY_RETAKE_01_REQUIRED_REGION) {
    throw new Error(
      `AZURE_SPEECH_REGION must be ${JOKBAL_COPY_RETAKE_01_REQUIRED_REGION}`,
    )
  }
  return Object.freeze({
    key,
    region,
    maximumUsdPerMillionCharacters:
      readJokbalCopyRetake01PriceCeiling(environment),
  })
}

export function summarizeJokbalCopyRetake01Cost(
  plan,
  maximumUsdPerMillionCharacters,
) {
  if (plan.length !== 1) throw new Error('Jokbal retake must have one clip')
  const ssmlCharacters = Array.from(
    buildJokbalCopyRetake01Ssml(plan[0].performance),
  ).length
  return Object.freeze({
    ssmlCharacters,
    maximumUsdPerMillionCharacters,
    maximumEstimatedCostUsd:
      (ssmlCharacters * maximumUsdPerMillionCharacters) / 1_000_000,
  })
}

export function createJokbalCopyRetake01Manifest({
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
    throw new Error('Jokbal retake MP3 inspection is invalid')
  }
  return {
    schemaVersion: 2,
    provider: 'Azure AI Speech',
    batch: 'jokbal-copy-retake-01',
    region: JOKBAL_COPY_RETAKE_01_REQUIRED_REGION,
    outputFormat: JOKBAL_COPY_RETAKE_01_OUTPUT_FORMAT,
    generatedAt,
    userFeedback: {
      statement: JOKBAL_COPY_RETAKE_01_USER_QUOTE,
    },
    sourcePins: {
      catalog: sourceAttestation.catalogPin,
      activeAudioIds: sourceAttestation.activeAudioIdsPin,
      rejectedRaw: sourceAttestation.rejectedRawPin,
      parentManifest: sourceAttestation.parentManifestPin,
      jokbalInactiveBeforeListening: true,
    },
    performance: JOKBAL_COPY_RETAKE_01_PERFORMANCE,
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
      retries: JOKBAL_COPY_RETAKE_01_RETRY_COUNT,
    },
    generatedFiles: [
      {
        menuId: 'jokbal',
        file: 'jokbal.mp3',
        ...inspection,
      },
    ],
    listeningQa: {
      exactImportantWordRequired: '더',
      questionToPunchGapTargetMilliseconds: [180, 420],
      rejectQuestionToPunchGapAboveMilliseconds: 500,
      maximumSecondToFirstLoudnessDeltaDb: 3,
      shoutLikeSecondPhraseRejected: true,
      automaticLexicalAlignmentUsed: false,
      humanReviewRequired: true,
    },
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

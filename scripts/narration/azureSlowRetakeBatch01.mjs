import { createHash } from 'node:crypto'

import {
  escapeXml,
  estimateMaximumCostUsd,
} from './azureSpeechBatch.mjs'
import { EXPRESSIVE_PILOT_VOICES } from './azureExpressivePilot.mjs'
import {
  FULL_BATCH_01_DEFAULT_PRICE_CEILING,
  FULL_BATCH_01_HARD_MAX_SECONDS,
  FULL_BATCH_01_MP3_BYTES_PER_SECOND,
  FULL_BATCH_01_OUTPUT_FORMAT,
  FULL_BATCH_01_PRICE_CEILING_ENV,
  FULL_BATCH_01_QUALITY_TARGET_SECONDS,
  FULL_BATCH_01_REQUIRED_REGION,
  readFullBatch01ExecutionConfig,
  readFullBatch01PriceCeiling,
  summarizeFullBatch01Audio,
} from './azureFullBatch01.mjs'

export const SLOW_RETAKE_BATCH_01_MENU_IDS = Object.freeze([
  'shabu-shabu',
  'pasta',
  'bulgogi-deopbap',
  'gomtang',
])

export const SLOW_RETAKE_BATCH_01_REQUIRED_REGION =
  FULL_BATCH_01_REQUIRED_REGION
export const SLOW_RETAKE_BATCH_01_OUTPUT_FORMAT =
  FULL_BATCH_01_OUTPUT_FORMAT
export const SLOW_RETAKE_BATCH_01_PRICE_CEILING_ENV =
  FULL_BATCH_01_PRICE_CEILING_ENV
export const SLOW_RETAKE_BATCH_01_DEFAULT_PRICE_CEILING =
  FULL_BATCH_01_DEFAULT_PRICE_CEILING
export const SLOW_RETAKE_BATCH_01_MP3_BYTES_PER_SECOND =
  FULL_BATCH_01_MP3_BYTES_PER_SECOND
export const SLOW_RETAKE_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP = 1
export const SLOW_RETAKE_BATCH_01_RETRY_COUNT = 0
export const SLOW_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS =
  FULL_BATCH_01_QUALITY_TARGET_SECONDS
export const SLOW_RETAKE_BATCH_01_HARD_MAX_SECONDS =
  FULL_BATCH_01_HARD_MAX_SECONDS
export const SLOW_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS =
  Object.freeze({ minimum: 1.3, maximum: 1.55 })
export const SLOW_RETAKE_BATCH_01_MAX_INTERNAL_GAP_MILLISECONDS = 180

const BASE_KOREAN_TIMING_UNITS_PER_SECOND = 5.3
const SUPPORTED_STYLES = new Set(['determined', 'joyful'])
const VOICE_BY_ID = new Map(
  EXPRESSIVE_PILOT_VOICES.map((voice) => [voice.id, voice]),
)

export const SLOW_RETAKE_BATCH_01_SUPERSEDED_SOURCES = Object.freeze({
  'shabu-shabu': Object.freeze({
    supersededPreviewPath:
      'tmp/narration-preview/replacement-batch-01/shabu-shabu.mp3',
    supersededCatalogText: '채소도 먹었다고 주장 가능합니다!',
    supersededByteLength: 35_520,
    supersededSha256:
      '0040a6d1bbd374b17abf5024c30d1d510e6506779c4305de3fa1fbd9d7f2c397',
    replacementReason: 'superseded-too-fast',
  }),
  pasta: Object.freeze({
    supersededPreviewPath:
      'tmp/narration-preview/replacement-batch-01/pasta.mp3',
    supersededCatalogText: '포크로 돌리면 갑자기 유럽!',
    supersededByteLength: 35_520,
    supersededSha256:
      'f6f89186fe0a289245feca0da3066fa9926ab6da02e00aa34cca255de30c6624',
    replacementReason: 'superseded-too-fast',
  }),
  'bulgogi-deopbap': Object.freeze({
    supersededPreviewPath:
      'tmp/narration-preview/replacement-batch-01/bulgogi-deopbap.mp3',
    supersededCatalogText: '밥 위 무단점거 현행범!',
    supersededByteLength: 35_520,
    supersededSha256:
      'dc116da91da1aa385146474e5bcf46c0b801556859442d7cd0ab92464db0c4b6',
    replacementReason: 'superseded-too-fast',
  }),
  gomtang: Object.freeze({
    supersededPreviewPath:
      'tmp/narration-preview/replacement-batch-01/gomtang.mp3',
    supersededCatalogText: '곰은 없어도 곰처럼 든든!',
    supersededByteLength: 35_520,
    supersededSha256:
      'cbe0948eca5408f6591b640c0b1188eda297aa0d7695596f0a22eb25cb061fb2',
    replacementReason: 'superseded-too-fast',
  }),
})
export const SLOW_RETAKE_BATCH_01_PERFORMANCES = Object.freeze([
  Object.freeze({
    menuId: 'shabu-shabu',
    voiceId: 'junho',
    catalogText: '채소도 먹었다고 주장 가능합니다!',
    spokenText: '채소도 먹었다고 주장 가능합니다!',
    style: 'determined',
    styleDegree: 0.55,
    rate: '+20%',
    pitch: '-1%',
    reviewIntent:
      'Slow full-sentence retake for intelligibility and natural comic timing.',
    ...SLOW_RETAKE_BATCH_01_SUPERSEDED_SOURCES['shabu-shabu'],
  }),
  Object.freeze({
    menuId: 'pasta',
    voiceId: 'junho',
    catalogText: '포크로 돌리면 갑자기 유럽!',
    spokenText: '포크로 돌리면 갑자기 유럽!',
    style: 'joyful',
    styleDegree: 0.62,
    rate: '+5%',
    pitch: '+0%',
    reviewIntent:
      'Slower playful retake that preserves the final punch without rushing.',
    ...SLOW_RETAKE_BATCH_01_SUPERSEDED_SOURCES.pasta,
  }),
  Object.freeze({
    menuId: 'bulgogi-deopbap',
    voiceId: 'junho',
    catalogText: '밥 위 무단점거 현행범!',
    spokenText: '밥 위 무단점거 현행범!',
    style: 'determined',
    styleDegree: 0.58,
    rate: '+8%',
    pitch: '-1%',
    reviewIntent:
      'Slower determined retake with clear consonants and one natural breath.',
    ...SLOW_RETAKE_BATCH_01_SUPERSEDED_SOURCES['bulgogi-deopbap'],
  }),
  Object.freeze({
    menuId: 'gomtang',
    voiceId: 'junho',
    catalogText: '곰은 없어도 곰처럼 든든!',
    spokenText: '곰은 없어도 곰처럼 든든!',
    style: 'joyful',
    styleDegree: 0.55,
    rate: '+8%',
    pitch: '-1%',
    reviewIntent:
      'Warm slower retake with restrained joy and clearly separated words.',
    ...SLOW_RETAKE_BATCH_01_SUPERSEDED_SOURCES.gomtang,
  }),
])
function parseSignedPercent(value, label) {
  const match = /^([+-])(\d+)%$/.exec(value)
  if (!match) throw new Error(`${label} must be a signed percentage`)
  const magnitude = Number(match[2])
  if (magnitude > 100) throw new Error(`${label} must not exceed 100%`)
  return match[1] === '-' ? -magnitude : magnitude
}

function assertStyleDegree(value) {
  if (!Number.isFinite(value) || value < 0.01 || value > 2) {
    throw new Error('styleDegree must be between 0.01 and 2')
  }
}

function countTimingUnits(value) {
  return Array.from(value).filter((character) =>
    /[가-힣A-Za-z0-9]/u.test(character),
  ).length
}

function assertPerformance(performance) {
  if (!SLOW_RETAKE_BATCH_01_MENU_IDS.includes(performance.menuId)) {
    throw new Error(`Unexpected slow retake batch 01 menu: ${performance.menuId}`)
  }
  if (performance.voiceId !== 'junho' || !VOICE_BY_ID.has(performance.voiceId)) {
    throw new Error(`Slow retake batch 01 voice must be Junho: ${performance.menuId}`)
  }
  if (performance.spokenText !== performance.catalogText) {
    throw new Error(
      'Slow retake batch 01 spoken copy must exactly match catalog: ' +
        performance.menuId,
    )
  }
  if (
    !/^[가-힣A-Za-z0-9]+(?: [가-힣A-Za-z0-9]+)*!$/u.test(
      performance.spokenText,
    )
  ) {
    throw new Error(
      'Slow retake batch 01 copy must use one sentence with final ! only: ' +
        performance.menuId,
    )
  }
  const expectedSource =
    SLOW_RETAKE_BATCH_01_SUPERSEDED_SOURCES[performance.menuId]
  if (
    !expectedSource ||
    performance.supersededPreviewPath !== expectedSource.supersededPreviewPath ||
    performance.supersededCatalogText !== expectedSource.supersededCatalogText ||
    performance.supersededByteLength !== expectedSource.supersededByteLength ||
    performance.supersededSha256 !== expectedSource.supersededSha256 ||
    performance.replacementReason !== expectedSource.replacementReason
  ) {
    throw new Error(
      'Slow retake batch 01 superseded provenance changed: ' +
        performance.menuId,
    )
  }
  if (
    performance.replacementReason !== 'superseded-too-fast' ||
    performance.supersededCatalogText !== performance.catalogText ||
    !Number.isSafeInteger(performance.supersededByteLength) ||
    performance.supersededByteLength <= 0 ||
    !/^[a-f0-9]{64}$/.test(performance.supersededSha256)
  ) {
    throw new Error(
      'Slow retake batch 01 must pin the exact too-fast source: ' +
        performance.menuId,
    )
  }
  if (!SUPPORTED_STYLES.has(performance.style)) {
    throw new Error(`Unsupported style: ${performance.style}`)
  }
  assertStyleDegree(performance.styleDegree)
  parseSignedPercent(performance.rate, 'rate')
  parseSignedPercent(performance.pitch, 'pitch')
}

function assertExactlyOnePerformancePerMenu(performances) {
  if (performances.length !== SLOW_RETAKE_BATCH_01_MENU_IDS.length) {
    throw new Error('Slow retake batch 01 must contain exactly four performances')
  }
  const ids = performances.map(({ menuId }) => menuId)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Slow retake batch 01 menu IDs must be unique')
  }
  if (
    ids.some(
      (menuId, index) => menuId !== SLOW_RETAKE_BATCH_01_MENU_IDS[index],
    )
  ) {
    throw new Error('Slow retake batch 01 menu order changed')
  }
}

export function estimateSlowRetakeBatch01PlannedTiming(performance) {
  assertPerformance(performance)
  const ratePercent = parseSignedPercent(performance.rate, 'rate')
  const speedMultiplier = 1 + ratePercent / 100
  if (speedMultiplier <= 0) throw new Error('rate must keep speech speed positive')
  return Object.freeze({
    approxDurationSeconds: Number(
      (
        countTimingUnits(performance.spokenText) /
        (BASE_KOREAN_TIMING_UNITS_PER_SECOND * speedMultiplier)
      ).toFixed(3),
    ),
  })
}

export function selectSlowRetakeBatch01Performances(catalog) {
  assertExactlyOnePerformancePerMenu(SLOW_RETAKE_BATCH_01_PERFORMANCES)
  const narrationById = new Map(catalog.map((item) => [item.menuId, item]))
  for (const performance of SLOW_RETAKE_BATCH_01_PERFORMANCES) {
    assertPerformance(performance)
    const current = narrationById.get(performance.menuId)
    if (current === undefined) {
      throw new Error(`Narration catalog is missing ${performance.menuId}`)
    }
    if (current.text !== performance.catalogText) {
      throw new Error(`Slow retake batch 01 narration text is stale: ${performance.menuId}`)
    }

  }
  return SLOW_RETAKE_BATCH_01_PERFORMANCES
}

export function createSlowRetakeBatch01Plan(
  performances = SLOW_RETAKE_BATCH_01_PERFORMANCES,
) {
  assertExactlyOnePerformancePerMenu(performances)
  return performances.map((performance) => {
    assertPerformance(performance)
    const voice = VOICE_BY_ID.get(performance.voiceId)
    return Object.freeze({
      performance,
      voiceId: voice.id,
      voiceShortName: voice.shortName,
      relativeFile: `${performance.menuId}.mp3`,
    })
  })
}

export function buildSlowRetakeBatch01Ssml({
  performance,
  voiceShortName,
}) {
  assertPerformance(performance)
  const expectedVoice = VOICE_BY_ID.get(performance.voiceId)
  if (voiceShortName !== expectedVoice.shortName) {
    throw new Error(`Unexpected voice for ${performance.menuId}`)
  }
  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ko-KR">',
    `<voice xml:lang="ko-KR" name="${escapeXml(voiceShortName)}">`,
    `<mstts:express-as style="${performance.style}" styledegree="${performance.styleDegree}">`,
    `<prosody rate="${performance.rate}" pitch="${performance.pitch}">${escapeXml(performance.spokenText)}</prosody>`,
    '</mstts:express-as>',
    '</voice>',
    '</speak>',
  ].join('')
}

export function validateSlowRetakeBatch01Voices(
  availableVoices,
  performances = SLOW_RETAKE_BATCH_01_PERFORMANCES,
) {
  assertExactlyOnePerformancePerMenu(performances)
  const requiredStyles = new Set()
  for (const performance of performances) {
    assertPerformance(performance)
    requiredStyles.add(performance.style)
  }
  const shortName = VOICE_BY_ID.get('junho').shortName
  const available = availableVoices.find(
    (voice) => voice?.ShortName === shortName,
  )
  if (!available) {
    throw new Error(`Required Azure MAI voice is unavailable: ${shortName}`)
  }
  const supported = new Set(
    Array.isArray(available.StyleList) ? available.StyleList : [],
  )
  for (const style of requiredStyles) {
    if (!supported.has(style)) {
      throw new Error(`${shortName} does not support style: ${style}`)
    }
  }
  return true
}

export function validateSlowRetakeBatch01SupersededFile({
  performance,
  byteLength,
  sha256,
}) {
  assertPerformance(performance)
  if (
    byteLength !== performance.supersededByteLength ||
    sha256 !== performance.supersededSha256
  ) {
    throw new Error(
      `Pinned superseded source mismatch: ${performance.menuId}`,
    )
  }
  return true
}

export function readSlowRetakeBatch01PriceCeiling(
  environment,
  requireExplicit = false,
) {
  return readFullBatch01PriceCeiling(environment, requireExplicit)
}

export function readSlowRetakeBatch01ExecutionConfig(environment) {
  return readFullBatch01ExecutionConfig(environment)
}

export function summarizeSlowRetakeBatch01Cost(
  plan,
  maximumPriceUsdPerMillionCharacters,
) {
  const files = plan.map((item) => {
    const ssml = buildSlowRetakeBatch01Ssml({
      performance: item.performance,
      voiceShortName: item.voiceShortName,
    })
    return Object.freeze({
      relativeFile: item.relativeFile,
      ssmlCharacters: Array.from(ssml).length,
    })
  })
  const ssmlCharacters = files.reduce(
    (total, item) => total + item.ssmlCharacters,
    0,
  )
  return Object.freeze({
    basis: 'full-ssml-unicode-code-point-upper-bound',
    ssmlCharacters,
    maximumPriceUsdPerMillionCharacters,
    maximumEstimatedCostUsd: estimateMaximumCostUsd(
      ssmlCharacters,
      maximumPriceUsdPerMillionCharacters,
    ),
    files,
  })
}

function readId3v2End(audio) {
  if (
    audio.byteLength < 3 ||
    audio[0] !== 0x49 ||
    audio[1] !== 0x44 ||
    audio[2] !== 0x33
  ) {
    return 0
  }
  if (audio.byteLength < 10) {
    throw new Error('Slow retake MP3 has a truncated ID3v2 header')
  }
  const sizeBytes = audio.subarray(6, 10)
  if (Array.from(sizeBytes).some((value) => (value & 0x80) !== 0)) {
    throw new Error('Slow retake MP3 has an invalid ID3v2 sync-safe size')
  }
  const tagSize =
    (sizeBytes[0] << 21) |
    (sizeBytes[1] << 14) |
    (sizeBytes[2] << 7) |
    sizeBytes[3]
  const footerSize = (audio[5] & 0x10) === 0x10 ? 10 : 0
  const end = 10 + tagSize + footerSize
  if (end > audio.byteLength) {
    throw new Error('Slow retake MP3 ID3v2 tag exceeds the file length')
  }
  return end
}

function readMpegAudioEnd(audio) {
  if (
    audio.byteLength >= 128 &&
    audio[audio.byteLength - 128] === 0x54 &&
    audio[audio.byteLength - 127] === 0x41 &&
    audio[audio.byteLength - 126] === 0x47
  ) {
    return audio.byteLength - 128
  }
  return audio.byteLength
}

export function inspectSlowRetakeBatch01Mp3(audio) {
  if (!(audio instanceof Uint8Array) || audio.byteLength === 0) {
    throw new Error('Slow retake MP3 inspection requires non-empty bytes')
  }
  let offset = readId3v2End(audio)
  const audioEnd = readMpegAudioEnd(audio)
  let mpegFrameCount = 0
  let totalSamples = 0
  while (offset < audioEnd) {
    if (offset + 4 > audioEnd) {
      throw new Error('Slow retake MP3 has a truncated MPEG frame header')
    }
    const byte1 = audio[offset]
    const byte2 = audio[offset + 1]
    const byte3 = audio[offset + 2]
    const byte4 = audio[offset + 3]
    if (byte1 !== 0xff || (byte2 & 0xe0) !== 0xe0) {
      throw new Error(`Slow retake MP3 lost MPEG sync at byte ${offset}`)
    }
    const versionBits = (byte2 >> 3) & 0x03
    const layerBits = (byte2 >> 1) & 0x03
    const bitrateIndex = (byte3 >> 4) & 0x0f
    const sampleRateIndex = (byte3 >> 2) & 0x03
    const padding = (byte3 >> 1) & 0x01
    const channelMode = (byte4 >> 6) & 0x03
    if (
      versionBits !== 0x02 ||
      layerBits !== 0x01 ||
      bitrateIndex !== 0x0e ||
      sampleRateIndex !== 0x01 ||
      channelMode !== 0x03
    ) {
      throw new Error(
        `Slow retake MP3 frame ${mpegFrameCount + 1} does not match ` +
          'MPEG-2 Layer III 160 kbps 24 kHz mono',
      )
    }
    const frameLength = Math.floor((72 * 160_000) / 24_000) + padding
    if (offset + frameLength > audioEnd) {
      throw new Error(`Slow retake MP3 frame ${mpegFrameCount + 1} is truncated`)
    }
    offset += frameLength
    mpegFrameCount += 1
    totalSamples += 576
  }
  if (offset !== audioEnd || mpegFrameCount === 0) {
    throw new Error('Slow retake MP3 does not contain complete MPEG frames')
  }
  return Object.freeze({
    byteLength: audio.byteLength,
    sha256: createHash('sha256').update(audio).digest('hex'),
    mpegFrameCount,
    exactDurationSeconds: Number((totalSamples / 24_000).toFixed(6)),
  })
}

export function summarizeSlowRetakeBatch01Audio(byteLength) {
  return summarizeFullBatch01Audio(byteLength)
}

export function createSlowRetakeBatch01Manifest({
  plan,
  audioResults,
  region,
  pricing,
  pricingSource,
  generatedAt,
}) {
  if (region !== SLOW_RETAKE_BATCH_01_REQUIRED_REGION) {
    throw new Error('Manifest region does not match slow retake batch 01')
  }
  if (audioResults.length !== plan.length) {
    throw new Error('Manifest audio result count does not match the slow retake batch 01 plan')
  }
  const resultByFile = new Map(
    audioResults.map((result) => [result.relativeFile, result]),
  )
  const generatedFiles = plan.map((item) => {
    const result = resultByFile.get(item.relativeFile)
    if (!result) throw new Error(`Manifest result is missing ${item.relativeFile}`)
    const expectedExactDuration = Number(
      ((result.mpegFrameCount * 576) / 24_000).toFixed(6),
    )
    if (
      !Number.isSafeInteger(result.byteLength) ||
      result.byteLength <= 0 ||
      !/^[a-f0-9]{64}$/.test(result.sha256) ||
      !Number.isSafeInteger(result.mpegFrameCount) ||
      result.mpegFrameCount <= 0 ||
      result.exactDurationSeconds !== expectedExactDuration
    ) {
      throw new Error(`Manifest MP3 inspection is invalid: ${item.relativeFile}`)
    }
    const performance = item.performance
    return {
      menuId: performance.menuId,
      voiceId: item.voiceId,
      voiceShortName: item.voiceShortName,
      catalogText: performance.catalogText,
      spokenText: performance.spokenText,
      reviewIntent: performance.reviewIntent,
      supersededPreviewPath: performance.supersededPreviewPath,
      supersededCatalogText: performance.supersededCatalogText,
      supersededByteLength: performance.supersededByteLength,
      supersededSha256: performance.supersededSha256,
      replacementReason: performance.replacementReason,
      style: performance.style,
      styleDegree: performance.styleDegree,
      rate: performance.rate,
      pitch: performance.pitch,
      plannedTiming: estimateSlowRetakeBatch01PlannedTiming(performance),
      file: item.relativeFile,
      ssmlCharacters: pricing.files.find(
        (file) => file.relativeFile === item.relativeFile,
      )?.ssmlCharacters,
      byteLength: result.byteLength,
      sha256: result.sha256,
      mpegFrameCount: result.mpegFrameCount,
      exactDurationSeconds: result.exactDurationSeconds,
      ...summarizeSlowRetakeBatch01Audio(result.byteLength),
    }
  })
  return {
    schemaVersion: 2,
    provider: 'Azure AI Speech',
    model: 'MAI-Voice-2-Flash',
    region,
    outputFormat: SLOW_RETAKE_BATCH_01_OUTPUT_FORMAT,
    generatedAt,
    sourceCatalog: 'src/data/menuNarrations.ts',
    sourceListeningReview: 'slow-retake-batch-01-reviewed-copy-and-performance-matrix',
    copyReview: {
      catalogTextPinned: true,
      spokenTextExactlyMatchesCatalog: true,
      pronunciationOverrideUsed: false,
      userListeningReviewRequired: true,
    },
    slowRetakeReview: {
      supersededTooFastSourceRecordedPerClip: true,
      supersededSourceByteLengthAndSha256Pinned: true,
      outputCandidatesRequireHumanApproval: true,
      staleCatalogAudioMustNotBeIntegrated: true,
    },
    delivery: {
      expressAsBlocksPerClip: 1,
      prosodyBlocksPerClip: 1,
      explicitBreaksPerClip: 0,
      midSentenceStyleRateOrPitchSwitch: false,
      pausePunctuationCharactersUsed: false,
    },
    pricing: {
      environmentVariable: SLOW_RETAKE_BATCH_01_PRICE_CEILING_ENV,
      ceilingSource: pricingSource,
      ...pricing,
    },
    quality: {
      approximateFileDurationTargetSeconds:
        SLOW_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS,
      hardMaximumSeconds: SLOW_RETAKE_BATCH_01_HARD_MAX_SECONDS,
      approximateFileDurationEvaluatedAfterSynthesis: true,
      durationApproximation: 'MP3 byte length / 20,000 bytes per second',
      exactDurationMeasurement:
        'validated MPEG frame count * 576 samples / 24,000 Hz',
      outputIdentityPinnedInManifest: true,
      activeSpeechTargetSeconds:
        SLOW_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS,
      maximumInternalGapMilliseconds:
        SLOW_RETAKE_BATCH_01_MAX_INTERNAL_GAP_MILLISECONDS,
      activeSpeechAndInternalGapQa: 'human-listening-required',
      activeSpeechAndInternalGapAutomaticallyMeasured: false,
      plannedTimingPreflight: 'informational-total-text-heuristic-only',
      naturalFullSentenceDeliveryPriority: true,
    },
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip:
        SLOW_RETAKE_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP,
      retries: SLOW_RETAKE_BATCH_01_RETRY_COUNT,
    },
    generatedFiles,
  }
}

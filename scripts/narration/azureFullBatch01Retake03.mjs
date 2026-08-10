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

export const FULL_BATCH_01_RETAKE_03_MENU_IDS = Object.freeze([
  'seolleongtang',
  'samgyetang',
])

export const FULL_BATCH_01_RETAKE_03_REQUIRED_REGION =
  FULL_BATCH_01_REQUIRED_REGION
export const FULL_BATCH_01_RETAKE_03_OUTPUT_FORMAT =
  FULL_BATCH_01_OUTPUT_FORMAT
export const FULL_BATCH_01_RETAKE_03_PRICE_CEILING_ENV =
  FULL_BATCH_01_PRICE_CEILING_ENV
export const FULL_BATCH_01_RETAKE_03_DEFAULT_PRICE_CEILING =
  FULL_BATCH_01_DEFAULT_PRICE_CEILING
export const FULL_BATCH_01_RETAKE_03_MP3_BYTES_PER_SECOND =
  FULL_BATCH_01_MP3_BYTES_PER_SECOND
export const FULL_BATCH_01_RETAKE_03_SYNTHESIS_REQUESTS_PER_CLIP = 1
export const FULL_BATCH_01_RETAKE_03_RETRY_COUNT = 0
export const FULL_BATCH_01_RETAKE_03_QUALITY_TARGET_SECONDS =
  FULL_BATCH_01_QUALITY_TARGET_SECONDS
export const FULL_BATCH_01_RETAKE_03_HARD_MAX_SECONDS =
  FULL_BATCH_01_HARD_MAX_SECONDS

const BASE_KOREAN_TIMING_UNITS_PER_SECOND = 5.3
const SUPPORTED_STYLES = new Set(['determined', 'joyful'])
const VOICE_BY_ID = new Map(
  EXPRESSIVE_PILOT_VOICES.map((voice) => [voice.id, voice]),
)

export const FULL_BATCH_01_RETAKE_03_PERFORMANCES = Object.freeze([
  Object.freeze({
    menuId: 'seolleongtang',
    voiceId: 'junho',
    catalogText: '깍두기 없인 진행 불가!',
    spokenText: '깍두기 없인 진행 불가!',
    style: 'determined',
    styleDegree: 0.75,
    rate: '+45%',
    pitch: '+0%',
    reviewIntent:
      'Continuous no-comma full-sentence determined delivery with standard spelling and no forced beat boundary.',
  }),
  Object.freeze({
    menuId: 'samgyetang',
    voiceId: 'junho',
    catalogText: '복날 체력바 전부 회복!',
    spokenText: '복날 체력바 전부 회복!',
    style: 'joyful',
    styleDegree: 0.85,
    rate: '+50%',
    pitch: '+0%',
    reviewIntent:
      'Continuous no-comma full-sentence joyful delivery for the approved clear recovery-game metaphor.',
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
  if (!FULL_BATCH_01_RETAKE_03_MENU_IDS.includes(performance.menuId)) {
    throw new Error(`Unexpected retake 03 menu: ${performance.menuId}`)
  }
  if (performance.voiceId !== 'junho' || !VOICE_BY_ID.has(performance.voiceId)) {
    throw new Error(`Retake 03 voice must be Junho: ${performance.menuId}`)
  }
  if (performance.spokenText !== performance.catalogText) {
    throw new Error(`Retake 03 spoken copy must exactly match catalog: ${performance.menuId}`)
  }
  if (!SUPPORTED_STYLES.has(performance.style)) {
    throw new Error(`Unsupported style: ${performance.style}`)
  }
  assertStyleDegree(performance.styleDegree)
  parseSignedPercent(performance.rate, 'rate')
  parseSignedPercent(performance.pitch, 'pitch')
}

function assertExactlyOnePerformancePerMenu(performances) {
  if (performances.length !== FULL_BATCH_01_RETAKE_03_MENU_IDS.length) {
    throw new Error('Full batch 01 retake 03 must contain exactly two performances')
  }
  const ids = performances.map(({ menuId }) => menuId)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Full batch 01 retake 03 menu IDs must be unique')
  }
  if (
    ids.some(
      (menuId, index) => menuId !== FULL_BATCH_01_RETAKE_03_MENU_IDS[index],
    )
  ) {
    throw new Error('Full batch 01 retake 03 menu order changed')
  }
}

export function estimateFullBatch01Retake03PlannedTiming(performance) {
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

export function selectFullBatch01Retake03Performances(catalog) {
  assertExactlyOnePerformancePerMenu(FULL_BATCH_01_RETAKE_03_PERFORMANCES)
  const narrationById = new Map(catalog.map((item) => [item.menuId, item]))
  for (const performance of FULL_BATCH_01_RETAKE_03_PERFORMANCES) {
    assertPerformance(performance)
    const current = narrationById.get(performance.menuId)
    if (current === undefined) {
      throw new Error(`Narration catalog is missing ${performance.menuId}`)
    }
    if (current.text !== performance.catalogText) {
      throw new Error(`Retake 03 narration text is stale: ${performance.menuId}`)
    }
    const timing = estimateFullBatch01Retake03PlannedTiming(performance)
    if (
      timing.approxDurationSeconds >
      FULL_BATCH_01_RETAKE_03_QUALITY_TARGET_SECONDS.maximum
    ) {
      throw new Error(`Planned duration exceeds target: ${performance.menuId}`)
    }
  }
  return FULL_BATCH_01_RETAKE_03_PERFORMANCES
}

export function createFullBatch01Retake03Plan(
  performances = FULL_BATCH_01_RETAKE_03_PERFORMANCES,
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

export function buildFullBatch01Retake03Ssml({
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

export function validateFullBatch01Retake03Voices(
  availableVoices,
  performances = FULL_BATCH_01_RETAKE_03_PERFORMANCES,
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

export function readFullBatch01Retake03PriceCeiling(
  environment,
  requireExplicit = false,
) {
  return readFullBatch01PriceCeiling(environment, requireExplicit)
}

export function readFullBatch01Retake03ExecutionConfig(environment) {
  return readFullBatch01ExecutionConfig(environment)
}

export function summarizeFullBatch01Retake03Cost(
  plan,
  maximumPriceUsdPerMillionCharacters,
) {
  const files = plan.map((item) => {
    const ssml = buildFullBatch01Retake03Ssml({
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

export function summarizeFullBatch01Retake03Audio(byteLength) {
  return summarizeFullBatch01Audio(byteLength)
}

export function createFullBatch01Retake03Manifest({
  plan,
  audioResults,
  region,
  pricing,
  pricingSource,
  generatedAt,
}) {
  if (region !== FULL_BATCH_01_RETAKE_03_REQUIRED_REGION) {
    throw new Error('Manifest region does not match full batch 01 retake 03')
  }
  if (audioResults.length !== plan.length) {
    throw new Error('Manifest audio result count does not match the retake 03 plan')
  }
  const resultByFile = new Map(
    audioResults.map((result) => [result.relativeFile, result]),
  )
  const generatedFiles = plan.map((item) => {
    const result = resultByFile.get(item.relativeFile)
    if (!result) throw new Error(`Manifest result is missing ${item.relativeFile}`)
    const performance = item.performance
    return {
      menuId: performance.menuId,
      voiceId: item.voiceId,
      voiceShortName: item.voiceShortName,
      catalogText: performance.catalogText,
      spokenText: performance.spokenText,
      reviewIntent: performance.reviewIntent,
      style: performance.style,
      styleDegree: performance.styleDegree,
      rate: performance.rate,
      pitch: performance.pitch,
      plannedTiming: estimateFullBatch01Retake03PlannedTiming(performance),
      file: item.relativeFile,
      ssmlCharacters: pricing.files.find(
        (file) => file.relativeFile === item.relativeFile,
      )?.ssmlCharacters,
      byteLength: result.byteLength,
      ...summarizeFullBatch01Retake03Audio(result.byteLength),
    }
  })
  return {
    schemaVersion: 1,
    provider: 'Azure AI Speech',
    model: 'MAI-Voice-2-Flash',
    region,
    outputFormat: FULL_BATCH_01_RETAKE_03_OUTPUT_FORMAT,
    generatedAt,
    sourceCatalog: 'src/data/menuNarrations.ts',
    sourceListeningReview: 'full-batch-01-retake-02',
    copyReview: {
      catalogTextPinned: true,
      spokenTextExactlyMatchesCatalog: true,
      pronunciationOverrideUsed: false,
      userListeningReviewRequired: true,
    },
    delivery: {
      expressAsBlocksPerClip: 1,
      prosodyBlocksPerClip: 1,
      explicitBreaksPerClip: 0,
      midSentenceStyleRateOrPitchSwitch: false,
      pausePunctuationCharactersUsed: false,
    },
    pricing: {
      environmentVariable: FULL_BATCH_01_RETAKE_03_PRICE_CEILING_ENV,
      ceilingSource: pricingSource,
      ...pricing,
    },
    quality: {
      targetSeconds: FULL_BATCH_01_RETAKE_03_QUALITY_TARGET_SECONDS,
      hardMaximumSeconds: FULL_BATCH_01_RETAKE_03_HARD_MAX_SECONDS,
      durationApproximation: 'MP3 byte length / 20,000 bytes per second',
      naturalFullSentenceDeliveryPriority: true,
    },
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip:
        FULL_BATCH_01_RETAKE_03_SYNTHESIS_REQUESTS_PER_CLIP,
      retries: FULL_BATCH_01_RETAKE_03_RETRY_COUNT,
    },
    generatedFiles,
  }
}

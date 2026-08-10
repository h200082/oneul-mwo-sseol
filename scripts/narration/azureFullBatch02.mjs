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

export const FULL_BATCH_02_MENU_IDS = Object.freeze([
  'dwaeji-gukbap',
  'sundae-guk',
  'cheonggukjang',
  'home-style-baekban',
  'bibimbap',
  'jeyuk-deopbap',
  'bulgogi-deopbap',
  'chicken-mayo-deopbap',
])

export const FULL_BATCH_02_REQUIRED_REGION =
  FULL_BATCH_01_REQUIRED_REGION
export const FULL_BATCH_02_OUTPUT_FORMAT =
  FULL_BATCH_01_OUTPUT_FORMAT
export const FULL_BATCH_02_PRICE_CEILING_ENV =
  FULL_BATCH_01_PRICE_CEILING_ENV
export const FULL_BATCH_02_DEFAULT_PRICE_CEILING =
  FULL_BATCH_01_DEFAULT_PRICE_CEILING
export const FULL_BATCH_02_MP3_BYTES_PER_SECOND =
  FULL_BATCH_01_MP3_BYTES_PER_SECOND
export const FULL_BATCH_02_SYNTHESIS_REQUESTS_PER_CLIP = 1
export const FULL_BATCH_02_RETRY_COUNT = 0
export const FULL_BATCH_02_QUALITY_TARGET_SECONDS =
  FULL_BATCH_01_QUALITY_TARGET_SECONDS
export const FULL_BATCH_02_HARD_MAX_SECONDS =
  FULL_BATCH_01_HARD_MAX_SECONDS

const BASE_KOREAN_TIMING_UNITS_PER_SECOND = 5.3
const SUPPORTED_STYLES = new Set(['determined', 'joyful'])
const VOICE_BY_ID = new Map(
  EXPRESSIVE_PILOT_VOICES.map((voice) => [voice.id, voice]),
)

export const FULL_BATCH_02_PERFORMANCES = Object.freeze([
  Object.freeze({
    menuId: 'dwaeji-gukbap',
    voiceId: 'junho',
    catalogText: '돼지국밥 한술에 부산 도착!',
    spokenText: '돼지국밥 한술에 부산 도착!',
    style: 'joyful',
    styleDegree: 0.8,
    rate: '+50%',
    pitch: '+0%',
    reviewIntent:
      'One-breath joyful delivery with exact copy and no forced boundary.',
  }),
  Object.freeze({
    menuId: 'sundae-guk',
    voiceId: 'junho',
    catalogText: '순대국 든든 버프 풀충전!',
    spokenText: '순대국 든든 버프 풀충전!',
    style: 'joyful',
    styleDegree: 0.8,
    rate: '+50%',
    pitch: '+0%',
    reviewIntent:
      'One-breath joyful delivery with exact copy and no forced boundary.',
  }),
  Object.freeze({
    menuId: 'cheonggukjang',
    voiceId: 'junho',
    catalogText: '청국장 향부터 어그로 만렙!',
    spokenText: '청국장 향부터 어그로 만렙!',
    style: 'joyful',
    styleDegree: 0.8,
    rate: '+50%',
    pitch: '+0%',
    reviewIntent:
      'One-breath joyful delivery with exact copy and no forced boundary.',
  }),
  Object.freeze({
    menuId: 'home-style-baekban',
    voiceId: 'junho',
    catalogText: '백반 한상 반찬 슬롯 만렙!',
    spokenText: '백반 한상 반찬 슬롯 만렙!',
    style: 'joyful',
    styleDegree: 0.8,
    rate: '+50%',
    pitch: '+0%',
    reviewIntent:
      'One-breath joyful delivery with exact copy and no forced boundary.',
  }),
  Object.freeze({
    menuId: 'bibimbap',
    voiceId: 'junho',
    catalogText: '고추장 아래 만민평등!',
    spokenText: '고추장 아래 만민평등!',
    style: 'determined',
    styleDegree: 0.75,
    rate: '+45%',
    pitch: '+0%',
    reviewIntent:
      'One-breath determined delivery with exact copy and no forced boundary.',
  }),
  Object.freeze({
    menuId: 'jeyuk-deopbap',
    voiceId: 'junho',
    catalogText: '제육덮밥 메뉴 고민 강제 종료!',
    spokenText: '제육덮밥 메뉴 고민 강제 종료!',
    style: 'joyful',
    styleDegree: 0.8,
    rate: '+50%',
    pitch: '+0%',
    reviewIntent:
      'One-breath joyful delivery with exact copy and no forced boundary.',
  }),
  Object.freeze({
    menuId: 'bulgogi-deopbap',
    voiceId: 'junho',
    catalogText: '불고기가 밥을 덮쳤다!',
    spokenText: '불고기가 밥을 덮쳤다!',
    style: 'joyful',
    styleDegree: 0.8,
    rate: '+50%',
    pitch: '+0%',
    reviewIntent:
      'One-breath joyful delivery with exact copy and no forced boundary.',
  }),
  Object.freeze({
    menuId: 'chicken-mayo-deopbap',
    voiceId: 'junho',
    catalogText: '치킨마요 소스줄은 생명줄!',
    spokenText: '치킨마요 소스줄은 생명줄!',
    style: 'joyful',
    styleDegree: 0.8,
    rate: '+50%',
    pitch: '+0%',
    reviewIntent:
      'One-breath joyful delivery with exact copy and no forced boundary.',
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
  if (!FULL_BATCH_02_MENU_IDS.includes(performance.menuId)) {
    throw new Error(`Unexpected full batch 02 menu: ${performance.menuId}`)
  }
  if (performance.voiceId !== 'junho' || !VOICE_BY_ID.has(performance.voiceId)) {
    throw new Error(`Full batch 02 voice must be Junho: ${performance.menuId}`)
  }
  if (performance.spokenText !== performance.catalogText) {
    throw new Error(
      'Full batch 02 spoken copy must exactly match catalog: ' +
        performance.menuId,
    )
  }
  if (
    !/^[가-힣A-Za-z0-9]+(?: [가-힣A-Za-z0-9]+)*!$/u.test(
      performance.spokenText,
    )
  ) {
    throw new Error(
      'Full batch 02 copy must use one sentence with final ! only: ' +
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
  if (performances.length !== FULL_BATCH_02_MENU_IDS.length) {
    throw new Error('Full batch 02 must contain exactly eight performances')
  }
  const ids = performances.map(({ menuId }) => menuId)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Full batch 02 menu IDs must be unique')
  }
  if (
    ids.some(
      (menuId, index) => menuId !== FULL_BATCH_02_MENU_IDS[index],
    )
  ) {
    throw new Error('Full batch 02 menu order changed')
  }
}

export function estimateFullBatch02PlannedTiming(performance) {
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

export function selectFullBatch02Performances(catalog) {
  assertExactlyOnePerformancePerMenu(FULL_BATCH_02_PERFORMANCES)
  const narrationById = new Map(catalog.map((item) => [item.menuId, item]))
  for (const performance of FULL_BATCH_02_PERFORMANCES) {
    assertPerformance(performance)
    const current = narrationById.get(performance.menuId)
    if (current === undefined) {
      throw new Error(`Narration catalog is missing ${performance.menuId}`)
    }
    if (current.text !== performance.catalogText) {
      throw new Error(`Full batch 02 narration text is stale: ${performance.menuId}`)
    }
    const timing = estimateFullBatch02PlannedTiming(performance)
    if (
      timing.approxDurationSeconds >
      FULL_BATCH_02_QUALITY_TARGET_SECONDS.maximum
    ) {
      throw new Error(`Planned duration exceeds target: ${performance.menuId}`)
    }
  }
  return FULL_BATCH_02_PERFORMANCES
}

export function createFullBatch02Plan(
  performances = FULL_BATCH_02_PERFORMANCES,
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

export function buildFullBatch02Ssml({
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

export function validateFullBatch02Voices(
  availableVoices,
  performances = FULL_BATCH_02_PERFORMANCES,
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

export function readFullBatch02PriceCeiling(
  environment,
  requireExplicit = false,
) {
  return readFullBatch01PriceCeiling(environment, requireExplicit)
}

export function readFullBatch02ExecutionConfig(environment) {
  return readFullBatch01ExecutionConfig(environment)
}

export function summarizeFullBatch02Cost(
  plan,
  maximumPriceUsdPerMillionCharacters,
) {
  const files = plan.map((item) => {
    const ssml = buildFullBatch02Ssml({
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

export function summarizeFullBatch02Audio(byteLength) {
  return summarizeFullBatch01Audio(byteLength)
}

export function createFullBatch02Manifest({
  plan,
  audioResults,
  region,
  pricing,
  pricingSource,
  generatedAt,
}) {
  if (region !== FULL_BATCH_02_REQUIRED_REGION) {
    throw new Error('Manifest region does not match full batch 02')
  }
  if (audioResults.length !== plan.length) {
    throw new Error('Manifest audio result count does not match the full batch 02 plan')
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
      plannedTiming: estimateFullBatch02PlannedTiming(performance),
      file: item.relativeFile,
      ssmlCharacters: pricing.files.find(
        (file) => file.relativeFile === item.relativeFile,
      )?.ssmlCharacters,
      byteLength: result.byteLength,
      ...summarizeFullBatch02Audio(result.byteLength),
    }
  })
  return {
    schemaVersion: 1,
    provider: 'Azure AI Speech',
    model: 'MAI-Voice-2-Flash',
    region,
    outputFormat: FULL_BATCH_02_OUTPUT_FORMAT,
    generatedAt,
    sourceCatalog: 'src/data/menuNarrations.ts',
    sourceListeningReview: 'full-batch-02-reviewed-copy-and-performance-matrix',
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
      environmentVariable: FULL_BATCH_02_PRICE_CEILING_ENV,
      ceilingSource: pricingSource,
      ...pricing,
    },
    quality: {
      targetSeconds: FULL_BATCH_02_QUALITY_TARGET_SECONDS,
      hardMaximumSeconds: FULL_BATCH_02_HARD_MAX_SECONDS,
      plannedTimingPreflight: 'maximum-only-heuristic',
      minimumDurationEvaluatedAfterSynthesis: true,
      durationApproximation: 'MP3 byte length / 20,000 bytes per second',
      naturalFullSentenceDeliveryPriority: true,
    },
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip:
        FULL_BATCH_02_SYNTHESIS_REQUESTS_PER_CLIP,
      retries: FULL_BATCH_02_RETRY_COUNT,
    },
    generatedFiles,
  }
}

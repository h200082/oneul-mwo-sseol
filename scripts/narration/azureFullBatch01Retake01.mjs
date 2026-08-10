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

export const FULL_BATCH_01_RETAKE_01_MENU_IDS = Object.freeze([
  'doenjang-jjigae',
  'seolleongtang',
  'gomtang',
  'samgyetang',
])

export const FULL_BATCH_01_RETAKE_01_REQUIRED_REGION =
  FULL_BATCH_01_REQUIRED_REGION
export const FULL_BATCH_01_RETAKE_01_OUTPUT_FORMAT =
  FULL_BATCH_01_OUTPUT_FORMAT
export const FULL_BATCH_01_RETAKE_01_PRICE_CEILING_ENV =
  FULL_BATCH_01_PRICE_CEILING_ENV
export const FULL_BATCH_01_RETAKE_01_DEFAULT_PRICE_CEILING =
  FULL_BATCH_01_DEFAULT_PRICE_CEILING
export const FULL_BATCH_01_RETAKE_01_MP3_BYTES_PER_SECOND =
  FULL_BATCH_01_MP3_BYTES_PER_SECOND
export const FULL_BATCH_01_RETAKE_01_SYNTHESIS_REQUESTS_PER_CLIP = 1
export const FULL_BATCH_01_RETAKE_01_RETRY_COUNT = 0
export const FULL_BATCH_01_RETAKE_01_QUALITY_TARGET_SECONDS =
  FULL_BATCH_01_QUALITY_TARGET_SECONDS
export const FULL_BATCH_01_RETAKE_01_HARD_MAX_SECONDS =
  FULL_BATCH_01_HARD_MAX_SECONDS
export const FULL_BATCH_01_RETAKE_01_DEFAULT_MAXIMUM_PUNCH_START_SECONDS = 0.7
export const FULL_BATCH_01_RETAKE_01_CLARITY_MAXIMUM_PUNCH_START_SECONDS = 0.9

const BASE_KOREAN_TIMING_UNITS_PER_SECOND = 5.3
const SUPPORTED_STYLES = new Set(['determined', 'excited', 'joyful'])
const VOICE_BY_ID = new Map(
  EXPRESSIVE_PILOT_VOICES.map((voice) => [voice.id, voice]),
)

const SEOLLEONGTANG_PRONUNCIATION_OVERRIDE = Object.freeze({
  catalogSetupText: '깍두기 없인',
  spokenSetupText: '깍뚜기 없인',
  scope: 'setup-only-standard-korean-surface-pronunciation',
  reason:
    'Listening review found the original 깍두기 rendering unclear; direct plain-text pronunciation was chosen without unsupported SSML phoneme or sub elements.',
})

export const FULL_BATCH_01_RETAKE_01_PERFORMANCES = Object.freeze([
  Object.freeze({
    menuId: 'doenjang-jjigae',
    voiceId: 'junho',
    catalogText: '된장 나오면 밥상 끝장!',
    spokenSetupText: '된장 나오면',
    spokenPunchText: '밥상 끝장!',
    setupStyle: 'joyful',
    punchStyle: 'joyful',
    setupStyleDegree: 0.75,
    punchStyleDegree: 1.15,
    setupRate: '+65%',
    setupPitch: '+0%',
    punchRate: '+50%',
    punchPitch: '+1%',
    breakMs: 30,
    maximumPunchStartSeconds:
      FULL_BATCH_01_RETAKE_01_DEFAULT_MAXIMUM_PUNCH_START_SECONDS,
    clarityTimingException: null,
    pronunciationOverride: null,
    reviewIntent:
      'Junho joyful in both beats, modeled on the clear and brisk sundubu delivery with restrained comic energy.',
  }),
  Object.freeze({
    menuId: 'seolleongtang',
    voiceId: 'junho',
    catalogText: '깍두기 없인 진행 불가!',
    spokenSetupText: '깍뚜기 없인',
    spokenPunchText: '진행 불가!',
    setupStyle: 'joyful',
    punchStyle: 'determined',
    setupStyleDegree: 0.7,
    punchStyleDegree: 1.15,
    setupRate: '+45%',
    setupPitch: '+0%',
    punchRate: '+52%',
    punchPitch: '+1%',
    breakMs: 35,
    maximumPunchStartSeconds:
      FULL_BATCH_01_RETAKE_01_DEFAULT_MAXIMUM_PUNCH_START_SECONDS,
    clarityTimingException: null,
    pronunciationOverride: SEOLLEONGTANG_PRONUNCIATION_OVERRIDE,
    reviewIntent:
      'Prioritize clear 깍두기 recognition through a plain-text spoken form and restrained determined delivery.',
  }),
  Object.freeze({
    menuId: 'gomtang',
    voiceId: 'junho',
    catalogText: '곰은 없고 진국만 있다!',
    spokenSetupText: '곰은 없고',
    spokenPunchText: '진국만 있다!',
    setupStyle: 'determined',
    punchStyle: 'determined',
    setupStyleDegree: 0.55,
    punchStyleDegree: 0.9,
    setupRate: '+68%',
    setupPitch: '-2%',
    punchRate: '+60%',
    punchPitch: '+0%',
    breakMs: 30,
    maximumPunchStartSeconds:
      FULL_BATCH_01_RETAKE_01_DEFAULT_MAXIMUM_PUNCH_START_SECONDS,
    clarityTimingException: null,
    pronunciationOverride: null,
    reviewIntent:
      'Keep the approved Junho determined deadpan while making both beats moderately faster.',
  }),
  Object.freeze({
    menuId: 'samgyetang',
    voiceId: 'junho',
    catalogText: '닭 한 마리에서 찹쌀 드롭!',
    spokenSetupText: '닭 한 마리에서',
    spokenPunchText: '찹쌀 드롭!',
    setupStyle: 'joyful',
    punchStyle: 'excited',
    setupStyleDegree: 0.75,
    punchStyleDegree: 1.1,
    setupRate: '+60%',
    setupPitch: '+0%',
    punchRate: '+48%',
    punchPitch: '+1%',
    breakMs: 35,
    maximumPunchStartSeconds:
      FULL_BATCH_01_RETAKE_01_CLARITY_MAXIMUM_PUNCH_START_SECONDS,
    clarityTimingException:
      'Up to 0.9s is allowed to keep the full setup clearly articulated before the punch.',
    pronunciationOverride: null,
    reviewIntent:
      'Use low-degree Junho joyful-to-excited acting with a slower, clearer setup and exact catalog copy.',
  }),
])

function parseSignedPercent(value, label) {
  const match = /^([+-])(\d+)%$/.exec(value)
  if (!match) throw new Error(`${label} must be a signed percentage`)
  const magnitude = Number(match[2])
  if (magnitude > 100) throw new Error(`${label} must not exceed 100%`)
  return match[1] === '-' ? -magnitude : magnitude
}

function assertStyleDegree(value, label) {
  if (!Number.isFinite(value) || value < 0.01 || value > 2) {
    throw new Error(`${label} must be between 0.01 and 2`)
  }
}

function countTimingUnits(value) {
  return Array.from(value).filter((character) =>
    /[가-힣A-Za-z0-9]/u.test(character),
  ).length
}

function estimateBeatSeconds(text, rate) {
  const ratePercent = parseSignedPercent(rate, 'rate')
  const speedMultiplier = 1 + ratePercent / 100
  if (speedMultiplier <= 0) throw new Error('rate must keep speech speed positive')
  return countTimingUnits(text) /
    (BASE_KOREAN_TIMING_UNITS_PER_SECOND * speedMultiplier)
}

export function normalizeFullBatch01Retake01SpokenCopy(value) {
  return value.normalize('NFC').replace(/[\s,]+/gu, '')
}

function catalogEquivalentSpokenText(performance) {
  const spokenText = `${performance.spokenSetupText} ${performance.spokenPunchText}`
  if (performance.pronunciationOverride === null) return spokenText
  if (performance.menuId !== 'seolleongtang') {
    throw new Error('Only seolleongtang may use a pronunciation override')
  }
  const override = performance.pronunciationOverride
  if (
    override.catalogSetupText !== SEOLLEONGTANG_PRONUNCIATION_OVERRIDE.catalogSetupText ||
    override.spokenSetupText !== SEOLLEONGTANG_PRONUNCIATION_OVERRIDE.spokenSetupText ||
    performance.spokenSetupText !== override.spokenSetupText
  ) {
    throw new Error('Unexpected seolleongtang pronunciation override')
  }
  return `${override.catalogSetupText} ${performance.spokenPunchText}`
}

function assertPerformance(performance) {
  if (!FULL_BATCH_01_RETAKE_01_MENU_IDS.includes(performance.menuId)) {
    throw new Error(`Unexpected retake menu: ${performance.menuId}`)
  }
  if (performance.voiceId !== 'junho' || !VOICE_BY_ID.has(performance.voiceId)) {
    throw new Error(`Retake voice must be Junho: ${performance.menuId}`)
  }
  if (
    normalizeFullBatch01Retake01SpokenCopy(
      catalogEquivalentSpokenText(performance),
    ) !== normalizeFullBatch01Retake01SpokenCopy(performance.catalogText)
  ) {
    throw new Error(`Retake acting beats changed catalog text: ${performance.menuId}`)
  }
  for (const key of ['setupStyle', 'punchStyle']) {
    if (!SUPPORTED_STYLES.has(performance[key])) {
      throw new Error(`Unsupported ${key}: ${performance[key]}`)
    }
  }
  assertStyleDegree(performance.setupStyleDegree, 'setupStyleDegree')
  assertStyleDegree(performance.punchStyleDegree, 'punchStyleDegree')
  for (const key of [
    'setupRate',
    'setupPitch',
    'punchRate',
    'punchPitch',
  ]) {
    parseSignedPercent(performance[key], key)
  }
  if (
    !Number.isInteger(performance.breakMs) ||
    performance.breakMs < 25 ||
    performance.breakMs > 50
  ) {
    throw new Error(`Invalid comedy break for ${performance.menuId}`)
  }
  const hasClarityException = performance.clarityTimingException !== null
  const expectedMaximum = hasClarityException
    ? FULL_BATCH_01_RETAKE_01_CLARITY_MAXIMUM_PUNCH_START_SECONDS
    : FULL_BATCH_01_RETAKE_01_DEFAULT_MAXIMUM_PUNCH_START_SECONDS
  if (performance.maximumPunchStartSeconds !== expectedMaximum) {
    throw new Error(`Invalid punch timing limit for ${performance.menuId}`)
  }
}

function assertExactlyOnePerformancePerMenu(performances) {
  if (performances.length !== FULL_BATCH_01_RETAKE_01_MENU_IDS.length) {
    throw new Error('Full batch 01 retake 01 must contain exactly four performances')
  }
  const ids = performances.map(({ menuId }) => menuId)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Full batch 01 retake 01 menu IDs must be unique')
  }
  if (
    ids.some(
      (menuId, index) => menuId !== FULL_BATCH_01_RETAKE_01_MENU_IDS[index],
    )
  ) {
    throw new Error('Full batch 01 retake 01 menu order changed')
  }
}

export function estimateFullBatch01Retake01PlannedTiming(performance) {
  assertPerformance(performance)
  const setupSeconds = estimateBeatSeconds(
    performance.spokenSetupText,
    performance.setupRate,
  )
  const punchSeconds = estimateBeatSeconds(
    performance.spokenPunchText,
    performance.punchRate,
  )
  const punchStartSeconds = setupSeconds + performance.breakMs / 1000
  return Object.freeze({
    approxDurationSeconds: Number(
      (punchStartSeconds + punchSeconds).toFixed(3),
    ),
    approxPunchStartSeconds: Number(punchStartSeconds.toFixed(3)),
  })
}

export function selectFullBatch01Retake01Performances(catalog) {
  assertExactlyOnePerformancePerMenu(FULL_BATCH_01_RETAKE_01_PERFORMANCES)
  const narrationById = new Map(catalog.map((item) => [item.menuId, item]))
  for (const performance of FULL_BATCH_01_RETAKE_01_PERFORMANCES) {
    assertPerformance(performance)
    const current = narrationById.get(performance.menuId)
    if (current === undefined) {
      throw new Error(`Narration catalog is missing ${performance.menuId}`)
    }
    if (current.text !== performance.catalogText) {
      throw new Error(`Retake narration text is stale: ${performance.menuId}`)
    }
    const timing = estimateFullBatch01Retake01PlannedTiming(performance)
    if (
      timing.approxDurationSeconds >
      FULL_BATCH_01_RETAKE_01_QUALITY_TARGET_SECONDS.maximum
    ) {
      throw new Error(`Planned duration exceeds target: ${performance.menuId}`)
    }
    if (timing.approxPunchStartSeconds > performance.maximumPunchStartSeconds) {
      throw new Error(`Core punch starts too late: ${performance.menuId}`)
    }
  }
  return FULL_BATCH_01_RETAKE_01_PERFORMANCES
}

export function createFullBatch01Retake01Plan(
  performances = FULL_BATCH_01_RETAKE_01_PERFORMANCES,
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

export function buildFullBatch01Retake01Ssml({
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
    `<mstts:express-as style="${performance.setupStyle}" styledegree="${performance.setupStyleDegree}">`,
    `<prosody rate="${performance.setupRate}" pitch="${performance.setupPitch}">${escapeXml(performance.spokenSetupText)}</prosody>`,
    '</mstts:express-as>',
    `<break time="${performance.breakMs}ms"/>`,
    `<mstts:express-as style="${performance.punchStyle}" styledegree="${performance.punchStyleDegree}">`,
    `<prosody rate="${performance.punchRate}" pitch="${performance.punchPitch}">${escapeXml(performance.spokenPunchText)}</prosody>`,
    '</mstts:express-as>',
    '</voice>',
    '</speak>',
  ].join('')
}

export function validateFullBatch01Retake01Voices(
  availableVoices,
  performances = FULL_BATCH_01_RETAKE_01_PERFORMANCES,
) {
  assertExactlyOnePerformancePerMenu(performances)
  const requiredStyles = new Set()
  for (const performance of performances) {
    assertPerformance(performance)
    requiredStyles.add(performance.setupStyle)
    requiredStyles.add(performance.punchStyle)
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

export function readFullBatch01Retake01PriceCeiling(
  environment,
  requireExplicit = false,
) {
  return readFullBatch01PriceCeiling(environment, requireExplicit)
}

export function readFullBatch01Retake01ExecutionConfig(environment) {
  return readFullBatch01ExecutionConfig(environment)
}

export function summarizeFullBatch01Retake01Cost(
  plan,
  maximumPriceUsdPerMillionCharacters,
) {
  const files = plan.map((item) => {
    const ssml = buildFullBatch01Retake01Ssml({
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

export function summarizeFullBatch01Retake01Audio(byteLength) {
  return summarizeFullBatch01Audio(byteLength)
}

export function createFullBatch01Retake01Manifest({
  plan,
  audioResults,
  region,
  pricing,
  pricingSource,
  generatedAt,
}) {
  if (region !== FULL_BATCH_01_RETAKE_01_REQUIRED_REGION) {
    throw new Error('Manifest region does not match full batch 01 retake 01')
  }
  if (audioResults.length !== plan.length) {
    throw new Error('Manifest audio result count does not match the retake plan')
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
      spokenSetupText: performance.spokenSetupText,
      spokenPunchText: performance.spokenPunchText,
      spokenText: `${performance.spokenSetupText} ${performance.spokenPunchText}`,
      pronunciationOverride: performance.pronunciationOverride,
      reviewIntent: performance.reviewIntent,
      setupStyle: performance.setupStyle,
      punchStyle: performance.punchStyle,
      setupStyleDegree: performance.setupStyleDegree,
      punchStyleDegree: performance.punchStyleDegree,
      setupRate: performance.setupRate,
      setupPitch: performance.setupPitch,
      punchRate: performance.punchRate,
      punchPitch: performance.punchPitch,
      breakMs: performance.breakMs,
      maximumPunchStartSeconds: performance.maximumPunchStartSeconds,
      clarityTimingException: performance.clarityTimingException,
      plannedTiming: estimateFullBatch01Retake01PlannedTiming(performance),
      file: item.relativeFile,
      ssmlCharacters: pricing.files.find(
        (file) => file.relativeFile === item.relativeFile,
      )?.ssmlCharacters,
      byteLength: result.byteLength,
      ...summarizeFullBatch01Retake01Audio(result.byteLength),
    }
  })
  return {
    schemaVersion: 1,
    provider: 'Azure AI Speech',
    model: 'MAI-Voice-2-Flash',
    region,
    outputFormat: FULL_BATCH_01_RETAKE_01_OUTPUT_FORMAT,
    generatedAt,
    sourceCatalog: 'src/data/menuNarrations.ts',
    sourceListeningReview: 'full-batch-01',
    copyReview: {
      catalogTextPinned: true,
      spokenBeatDelimiterNormalization: 'whitespace-and-commas',
      approvedPronunciationOverrideMenuIds: ['seolleongtang'],
      unsupportedSsmlPronunciationElementsUsed: false,
      userListeningReviewRequired: true,
    },
    pricing: {
      environmentVariable: FULL_BATCH_01_RETAKE_01_PRICE_CEILING_ENV,
      ceilingSource: pricingSource,
      ...pricing,
    },
    quality: {
      targetSeconds: FULL_BATCH_01_RETAKE_01_QUALITY_TARGET_SECONDS,
      hardMaximumSeconds: FULL_BATCH_01_RETAKE_01_HARD_MAX_SECONDS,
      durationApproximation: 'MP3 byte length / 20,000 bytes per second',
      defaultMaximumPlannedPunchStartSeconds:
        FULL_BATCH_01_RETAKE_01_DEFAULT_MAXIMUM_PUNCH_START_SECONDS,
      clarityExceptionMaximumPlannedPunchStartSeconds:
        FULL_BATCH_01_RETAKE_01_CLARITY_MAXIMUM_PUNCH_START_SECONDS,
      clarityPriority: true,
    },
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip:
        FULL_BATCH_01_RETAKE_01_SYNTHESIS_REQUESTS_PER_CLIP,
      retries: FULL_BATCH_01_RETAKE_01_RETRY_COUNT,
    },
    generatedFiles,
  }
}

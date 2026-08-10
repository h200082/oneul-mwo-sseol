import {
  DEFAULT_MAX_PRICE_USD_PER_MILLION_CHARS,
  escapeXml,
  estimateMaximumCostUsd,
} from './azureSpeechBatch.mjs'
import {
  AZURE_MAI_OUTPUT_FORMAT,
  EXPRESSIVE_PILOT_VOICES,
  readExpressivePilotConfig,
} from './azureExpressivePilot.mjs'

export const FULL_BATCH_01_MENU_IDS = Object.freeze([
  'doenjang-jjigae',
  'sundubu-jjigae',
  'gamjatang',
  'seolleongtang',
  'gomtang',
  'galbitang',
  'samgyetang',
  'kongnamul-gukbap',
])

export const FULL_BATCH_01_REQUIRED_REGION = 'southeastasia'
export const FULL_BATCH_01_OUTPUT_FORMAT = AZURE_MAI_OUTPUT_FORMAT
export const FULL_BATCH_01_PRICE_CEILING_ENV =
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const FULL_BATCH_01_DEFAULT_PRICE_CEILING =
  DEFAULT_MAX_PRICE_USD_PER_MILLION_CHARS
export const FULL_BATCH_01_MP3_BYTES_PER_SECOND = 20_000
export const FULL_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP = 1
export const FULL_BATCH_01_RETRY_COUNT = 0
export const FULL_BATCH_01_QUALITY_TARGET_SECONDS = Object.freeze({
  minimum: 1.2,
  maximum: 1.8,
})
export const FULL_BATCH_01_HARD_MAX_SECONDS = 2

const BASE_KOREAN_TIMING_UNITS_PER_SECOND = 5.3
const MAXIMUM_PUNCH_START_SECONDS = 0.7
const SUPPORTED_STYLES = new Set(['determined', 'excited', 'joyful'])
const VOICE_BY_ID = new Map(
  EXPRESSIVE_PILOT_VOICES.map((voice) => [voice.id, voice]),
)

export const FULL_BATCH_01_PERFORMANCES = Object.freeze([
  Object.freeze({
    menuId: 'doenjang-jjigae',
    voiceId: 'haena',
    text: '된장 나오면 밥상 끝장!',
    setupText: '된장 나오면',
    punchText: '밥상 끝장!',
    setupStyle: 'joyful',
    punchStyle: 'excited',
    setupStyleDegree: 1,
    punchStyleDegree: 1.4,
    setupRate: '+45%',
    setupPitch: '+1%',
    punchRate: '+50%',
    punchPitch: '+3%',
    breakMs: 35,
  }),
  Object.freeze({
    menuId: 'sundubu-jjigae',
    voiceId: 'junho',
    text: '순두부의 순은, 순삭의 순!',
    setupText: '순두부의 순은',
    punchText: '순삭의 순!',
    setupStyle: 'joyful',
    punchStyle: 'joyful',
    setupStyleDegree: 0.8,
    punchStyleDegree: 1.3,
    setupRate: '+72%',
    setupPitch: '+0%',
    punchRate: '+52%',
    punchPitch: '+2%',
    breakMs: 30,
  }),
  Object.freeze({
    menuId: 'gamjatang',
    voiceId: 'junho',
    text: '감자는 조연, 뼈가 주연!',
    setupText: '감자는 조연',
    punchText: '뼈가 주연!',
    setupStyle: 'determined',
    punchStyle: 'determined',
    setupStyleDegree: 0.85,
    punchStyleDegree: 1.3,
    setupRate: '+45%',
    setupPitch: '-1%',
    punchRate: '+50%',
    punchPitch: '+1%',
    breakMs: 45,
  }),
  Object.freeze({
    menuId: 'seolleongtang',
    voiceId: 'junho',
    text: '깍두기 없인 진행 불가!',
    setupText: '깍두기 없인',
    punchText: '진행 불가!',
    setupStyle: 'excited',
    punchStyle: 'determined',
    setupStyleDegree: 0.9,
    punchStyleDegree: 1.35,
    setupRate: '+45%',
    setupPitch: '+0%',
    punchRate: '+52%',
    punchPitch: '+1%',
    breakMs: 40,
  }),
  Object.freeze({
    menuId: 'gomtang',
    voiceId: 'junho',
    text: '곰은 없고 진국만 있다!',
    setupText: '곰은 없고',
    punchText: '진국만 있다!',
    setupStyle: 'determined',
    punchStyle: 'determined',
    setupStyleDegree: 0.55,
    punchStyleDegree: 0.9,
    setupRate: '+28%',
    setupPitch: '-3%',
    punchRate: '+40%',
    punchPitch: '-1%',
    breakMs: 50,
  }),
  Object.freeze({
    menuId: 'galbitang',
    voiceId: 'junho',
    text: '갈비탕은 뼈대부터 다르다!',
    setupText: '갈비탕은',
    punchText: '뼈대부터 다르다!',
    setupStyle: 'determined',
    punchStyle: 'determined',
    setupStyleDegree: 0.8,
    punchStyleDegree: 1.25,
    setupRate: '+38%',
    setupPitch: '-2%',
    punchRate: '+58%',
    punchPitch: '+1%',
    breakMs: 40,
  }),
  Object.freeze({
    menuId: 'samgyetang',
    voiceId: 'haena',
    text: '닭 한 마리에서 찹쌀 드롭!',
    setupText: '닭 한 마리에서',
    punchText: '찹쌀 드롭!',
    setupStyle: 'excited',
    punchStyle: 'excited',
    setupStyleDegree: 0.9,
    punchStyleDegree: 1.4,
    setupRate: '+72%',
    setupPitch: '+1%',
    punchRate: '+50%',
    punchPitch: '+3%',
    breakMs: 30,
  }),
  Object.freeze({
    menuId: 'kongnamul-gukbap',
    voiceId: 'haena',
    text: '한 숟갈에 인간 복귀!',
    setupText: '한 숟갈에',
    punchText: '인간 복귀!',
    setupStyle: 'determined',
    punchStyle: 'joyful',
    setupStyleDegree: 0.65,
    punchStyleDegree: 1.2,
    setupRate: '+25%',
    setupPitch: '-1%',
    punchRate: '+38%',
    punchPitch: '+2%',
    breakMs: 45,
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

export function normalizeFullBatch01SpokenCopy(value) {
  return value.normalize('NFC').replace(/[\s,]+/gu, '')
}

function assertPerformance(performance) {
  if (!FULL_BATCH_01_MENU_IDS.includes(performance.menuId)) {
    throw new Error(`Unexpected full batch menu: ${performance.menuId}`)
  }
  if (!VOICE_BY_ID.has(performance.voiceId)) {
    throw new Error(`Unknown full batch voice: ${performance.voiceId}`)
  }
  const spokenBeatText = `${performance.setupText} ${performance.punchText}`
  if (
    normalizeFullBatch01SpokenCopy(spokenBeatText) !==
    normalizeFullBatch01SpokenCopy(performance.text)
  ) {
    throw new Error(`Acting beats changed catalog text: ${performance.menuId}`)
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
}

function assertExactlyOnePerformancePerMenu(performances) {
  if (performances.length !== FULL_BATCH_01_MENU_IDS.length) {
    throw new Error('Full batch 01 must contain exactly eight performances')
  }
  const ids = performances.map(({ menuId }) => menuId)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Full batch 01 menu IDs must be unique')
  }
  if (ids.some((menuId, index) => menuId !== FULL_BATCH_01_MENU_IDS[index])) {
    throw new Error('Full batch 01 menu order changed')
  }
}

export function estimateFullBatch01PlannedTiming(performance) {
  assertPerformance(performance)
  const setupSeconds = estimateBeatSeconds(
    performance.setupText,
    performance.setupRate,
  )
  const punchSeconds = estimateBeatSeconds(
    performance.punchText,
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

export function selectFullBatch01Performances(catalog) {
  assertExactlyOnePerformancePerMenu(FULL_BATCH_01_PERFORMANCES)
  const narrationById = new Map(catalog.map((item) => [item.menuId, item]))
  for (const performance of FULL_BATCH_01_PERFORMANCES) {
    assertPerformance(performance)
    const current = narrationById.get(performance.menuId)
    if (current === undefined) {
      throw new Error(`Narration catalog is missing ${performance.menuId}`)
    }
    if (current.text !== performance.text) {
      throw new Error(`Full batch narration text is stale: ${performance.menuId}`)
    }
    const timing = estimateFullBatch01PlannedTiming(performance)
    if (timing.approxDurationSeconds > FULL_BATCH_01_QUALITY_TARGET_SECONDS.maximum) {
      throw new Error(`Planned duration exceeds target: ${performance.menuId}`)
    }
    if (timing.approxPunchStartSeconds > MAXIMUM_PUNCH_START_SECONDS) {
      throw new Error(`Core punch starts too late: ${performance.menuId}`)
    }
  }
  return FULL_BATCH_01_PERFORMANCES
}

export function createFullBatch01Plan(
  performances = FULL_BATCH_01_PERFORMANCES,
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

export function buildFullBatch01Ssml({ performance, voiceShortName }) {
  assertPerformance(performance)
  const expectedVoice = VOICE_BY_ID.get(performance.voiceId)
  if (voiceShortName !== expectedVoice.shortName) {
    throw new Error(`Unexpected voice for ${performance.menuId}`)
  }
  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ko-KR">',
    `<voice xml:lang="ko-KR" name="${escapeXml(voiceShortName)}">`,
    `<mstts:express-as style="${performance.setupStyle}" styledegree="${performance.setupStyleDegree}">`,
    `<prosody rate="${performance.setupRate}" pitch="${performance.setupPitch}">${escapeXml(performance.setupText)}</prosody>`,
    '</mstts:express-as>',
    `<break time="${performance.breakMs}ms"/>`,
    `<mstts:express-as style="${performance.punchStyle}" styledegree="${performance.punchStyleDegree}">`,
    `<prosody rate="${performance.punchRate}" pitch="${performance.punchPitch}">${escapeXml(performance.punchText)}</prosody>`,
    '</mstts:express-as>',
    '</voice>',
    '</speak>',
  ].join('')
}

export function validateFullBatch01Voices(
  availableVoices,
  performances = FULL_BATCH_01_PERFORMANCES,
) {
  assertExactlyOnePerformancePerMenu(performances)
  const requirements = new Map()
  for (const performance of performances) {
    assertPerformance(performance)
    const voice = VOICE_BY_ID.get(performance.voiceId)
    const styles = requirements.get(voice.shortName) ?? new Set()
    styles.add(performance.setupStyle)
    styles.add(performance.punchStyle)
    requirements.set(voice.shortName, styles)
  }
  for (const [shortName, requiredStyles] of requirements) {
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
  }
  return true
}

export function readFullBatch01PriceCeiling(
  environment,
  requireExplicit = false,
) {
  const raw = environment[FULL_BATCH_01_PRICE_CEILING_ENV]?.trim()
  if (!raw && requireExplicit) {
    throw new Error(
      `Missing required environment variable: ${FULL_BATCH_01_PRICE_CEILING_ENV}`,
    )
  }
  const maximumPriceUsdPerMillionCharacters = raw
    ? Number(raw)
    : FULL_BATCH_01_DEFAULT_PRICE_CEILING
  if (
    !Number.isFinite(maximumPriceUsdPerMillionCharacters) ||
    maximumPriceUsdPerMillionCharacters <= 0
  ) {
    throw new Error(
      `${FULL_BATCH_01_PRICE_CEILING_ENV} must be a positive number`,
    )
  }
  return Object.freeze({
    maximumPriceUsdPerMillionCharacters,
    source: raw ? 'environment-local-official-ceiling' : 'local-conservative-default',
  })
}

export function readFullBatch01ExecutionConfig(environment) {
  const speech = readExpressivePilotConfig(environment)
  if (speech.region !== FULL_BATCH_01_REQUIRED_REGION) {
    throw new Error(
      `AZURE_SPEECH_REGION must be ${FULL_BATCH_01_REQUIRED_REGION} for full batch 01`,
    )
  }
  return Object.freeze({
    ...speech,
    ...readFullBatch01PriceCeiling(environment, true),
  })
}

export function summarizeFullBatch01Cost(
  plan,
  maximumPriceUsdPerMillionCharacters,
) {
  const files = plan.map((item) => {
    const ssml = buildFullBatch01Ssml({
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

export function summarizeFullBatch01Audio(byteLength) {
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    throw new Error('Azure MAI MP3 byte length must be a positive integer')
  }
  const approxDurationSeconds =
    byteLength / FULL_BATCH_01_MP3_BYTES_PER_SECOND
  return Object.freeze({
    approxDurationSeconds,
    durationWithinTarget:
      approxDurationSeconds >= FULL_BATCH_01_QUALITY_TARGET_SECONDS.minimum &&
      approxDurationSeconds <= FULL_BATCH_01_QUALITY_TARGET_SECONDS.maximum,
    durationWithinHardMaximum:
      approxDurationSeconds <= FULL_BATCH_01_HARD_MAX_SECONDS,
  })
}

export function createFullBatch01Manifest({
  plan,
  audioResults,
  region,
  pricing,
  pricingSource,
  generatedAt,
}) {
  if (region !== FULL_BATCH_01_REQUIRED_REGION) {
    throw new Error('Manifest region does not match full batch 01')
  }
  if (audioResults.length !== plan.length) {
    throw new Error('Manifest audio result count does not match the plan')
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
      text: performance.text,
      setupText: performance.setupText,
      punchText: performance.punchText,
      setupStyle: performance.setupStyle,
      punchStyle: performance.punchStyle,
      setupStyleDegree: performance.setupStyleDegree,
      punchStyleDegree: performance.punchStyleDegree,
      setupRate: performance.setupRate,
      setupPitch: performance.setupPitch,
      punchRate: performance.punchRate,
      punchPitch: performance.punchPitch,
      breakMs: performance.breakMs,
      plannedTiming: estimateFullBatch01PlannedTiming(performance),
      file: item.relativeFile,
      ssmlCharacters: pricing.files.find(
        (file) => file.relativeFile === item.relativeFile,
      )?.ssmlCharacters,
      byteLength: result.byteLength,
      ...summarizeFullBatch01Audio(result.byteLength),
    }
  })
  return {
    schemaVersion: 1,
    provider: 'Azure AI Speech',
    model: 'MAI-Voice-2-Flash',
    region,
    outputFormat: FULL_BATCH_01_OUTPUT_FORMAT,
    generatedAt,
    sourceCatalog: 'src/data/menuNarrations.ts',
    copyReview: {
      catalogTextPinned: true,
      spokenBeatDelimiterNormalization: 'whitespace-and-commas',
      userListeningReviewRequired: true,
    },
    pricing: {
      environmentVariable: FULL_BATCH_01_PRICE_CEILING_ENV,
      ceilingSource: pricingSource,
      ...pricing,
    },
    quality: {
      targetSeconds: FULL_BATCH_01_QUALITY_TARGET_SECONDS,
      hardMaximumSeconds: FULL_BATCH_01_HARD_MAX_SECONDS,
      durationApproximation: 'MP3 byte length / 20,000 bytes per second',
      maximumPlannedPunchStartSeconds: MAXIMUM_PUNCH_START_SECONDS,
    },
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip: FULL_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP,
      retries: FULL_BATCH_01_RETRY_COUNT,
    },
    generatedFiles,
  }
}

import {
  escapeXml,
  estimateMaximumCostUsd,
} from './azureSpeechBatch.mjs'
import { EXPRESSIVE_PILOT_VOICES } from './azureExpressivePilot.mjs'
import {
  FULL_BATCH_01_DEFAULT_PRICE_CEILING,
  FULL_BATCH_01_HARD_MAX_SECONDS,
  FULL_BATCH_01_OUTPUT_FORMAT,
  FULL_BATCH_01_PRICE_CEILING_ENV,
  FULL_BATCH_01_QUALITY_TARGET_SECONDS,
  FULL_BATCH_01_REQUIRED_REGION,
  readFullBatch01ExecutionConfig,
  readFullBatch01PriceCeiling,
  summarizeFullBatch01Audio,
} from './azureFullBatch01.mjs'

export const SEOLLEONGTANG_COPY_PILOT_01_MENU_ID = 'seolleongtang'
export const SEOLLEONGTANG_COPY_PILOT_01_LIVE_PRIMARY_TEXT =
  '깍두기 없인 진행 불가!'
export const SEOLLEONGTANG_COPY_PILOT_01_REQUIRED_REGION =
  FULL_BATCH_01_REQUIRED_REGION
export const SEOLLEONGTANG_COPY_PILOT_01_OUTPUT_FORMAT =
  FULL_BATCH_01_OUTPUT_FORMAT
export const SEOLLEONGTANG_COPY_PILOT_01_PRICE_CEILING_ENV =
  FULL_BATCH_01_PRICE_CEILING_ENV
export const SEOLLEONGTANG_COPY_PILOT_01_DEFAULT_PRICE_CEILING =
  FULL_BATCH_01_DEFAULT_PRICE_CEILING
export const SEOLLEONGTANG_COPY_PILOT_01_SYNTHESIS_REQUESTS_PER_CLIP = 1
export const SEOLLEONGTANG_COPY_PILOT_01_RETRY_COUNT = 0
export const SEOLLEONGTANG_COPY_PILOT_01_QUALITY_TARGET_SECONDS =
  FULL_BATCH_01_QUALITY_TARGET_SECONDS
export const SEOLLEONGTANG_COPY_PILOT_01_HARD_MAX_SECONDS =
  FULL_BATCH_01_HARD_MAX_SECONDS

const BASE_KOREAN_TIMING_UNITS_PER_SECOND = 5.3
const COMMON_PERFORMANCE = Object.freeze({
  voiceId: 'junho',
  style: 'joyful',
  styleDegree: 0.8,
  rate: '+50%',
  pitch: '+0%',
})
const VOICE_BY_ID = new Map(
  EXPRESSIVE_PILOT_VOICES.map((voice) => [voice.id, voice]),
)

export const SEOLLEONGTANG_COPY_PILOT_01_CANDIDATES = Object.freeze([
  Object.freeze({
    label: 'A',
    takeId: 'A-scallion-buff',
    candidateText: '설렁탕 파 송송 버프 장착!',
    relativeFile: 'A-scallion-buff.mp3',
    ...COMMON_PERFORMANCE,
  }),
  Object.freeze({
    label: 'B',
    takeId: 'B-gukbap-tank',
    candidateText: '설렁탕 국밥계 탱커 등장!',
    relativeFile: 'B-gukbap-tank.mp3',
    ...COMMON_PERFORMANCE,
  }),
  Object.freeze({
    label: 'C',
    takeId: 'C-broth-confiscation',
    candidateText: '설렁탕 설렁대면 국물 압수!',
    relativeFile: 'C-broth-confiscation.mp3',
    ...COMMON_PERFORMANCE,
  }),
])

function parseSignedPercent(value, label) {
  const match = /^([+-])(\d+)%$/.exec(value)
  if (!match) throw new Error(`${label} must be a signed percentage`)
  const magnitude = Number(match[2])
  if (magnitude > 100) throw new Error(`${label} must not exceed 100%`)
  return match[1] === '-' ? -magnitude : magnitude
}

function countTimingUnits(value) {
  return Array.from(value).filter((character) =>
    /[가-힣A-Za-z0-9]/u.test(character),
  ).length
}

function assertCandidate(candidate) {
  if (!['A', 'B', 'C'].includes(candidate.label)) {
    throw new Error(`Unexpected copy pilot label: ${candidate.label}`)
  }
  if (candidate.voiceId !== COMMON_PERFORMANCE.voiceId) {
    throw new Error(`Copy pilot voice changed: ${candidate.label}`)
  }
  for (const key of ['style', 'styleDegree', 'rate', 'pitch']) {
    if (candidate[key] !== COMMON_PERFORMANCE[key]) {
      throw new Error(`Copy pilot ${key} changed: ${candidate.label}`)
    }
  }
  if (!candidate.candidateText.endsWith('!')) {
    throw new Error(`Copy pilot text must end in !: ${candidate.label}`)
  }
  if (/[,，]/u.test(candidate.candidateText)) {
    throw new Error(`Copy pilot text contains pause punctuation: ${candidate.label}`)
  }
  if (candidate.candidateText === SEOLLEONGTANG_COPY_PILOT_01_LIVE_PRIMARY_TEXT) {
    throw new Error(`Copy pilot candidate duplicates live primary: ${candidate.label}`)
  }
  parseSignedPercent(candidate.rate, 'rate')
  parseSignedPercent(candidate.pitch, 'pitch')
}

function assertCandidateSet(candidates) {
  if (candidates.length !== 3) {
    throw new Error('Seolleongtang copy pilot 01 must contain exactly three candidates')
  }
  const labels = candidates.map(({ label }) => label)
  if (labels.join('') !== 'ABC') {
    throw new Error('Seolleongtang copy pilot labels must remain A/B/C')
  }
  for (const key of ['takeId', 'candidateText', 'relativeFile']) {
    const values = candidates.map((candidate) => candidate[key])
    if (new Set(values).size !== values.length) {
      throw new Error(`Seolleongtang copy pilot ${key} values must be unique`)
    }
  }
  for (const candidate of candidates) assertCandidate(candidate)
}

export function selectSeolleongtangCopyPilot01Candidates(catalog) {
  assertCandidateSet(SEOLLEONGTANG_COPY_PILOT_01_CANDIDATES)
  const current = catalog.find(
    ({ menuId }) => menuId === SEOLLEONGTANG_COPY_PILOT_01_MENU_ID,
  )
  if (!current) throw new Error('Narration catalog is missing seolleongtang')
  if (current.text !== SEOLLEONGTANG_COPY_PILOT_01_LIVE_PRIMARY_TEXT) {
    throw new Error('Copy pilot must not change the live seolleongtang primary')
  }
  return SEOLLEONGTANG_COPY_PILOT_01_CANDIDATES
}

export function createSeolleongtangCopyPilot01Plan(
  candidates = SEOLLEONGTANG_COPY_PILOT_01_CANDIDATES,
) {
  assertCandidateSet(candidates)
  const voice = VOICE_BY_ID.get(COMMON_PERFORMANCE.voiceId)
  if (!voice) throw new Error('Junho MAI voice configuration is missing')
  return candidates.map((candidate) => Object.freeze({
    candidate,
    voiceId: voice.id,
    voiceShortName: voice.shortName,
    relativeFile: candidate.relativeFile,
  }))
}

export function estimateSeolleongtangCopyPilot01PlannedTiming(candidate) {
  assertCandidate(candidate)
  const ratePercent = parseSignedPercent(candidate.rate, 'rate')
  const speedMultiplier = 1 + ratePercent / 100
  return Object.freeze({
    approxDurationSeconds: Number((
      countTimingUnits(candidate.candidateText) /
      (BASE_KOREAN_TIMING_UNITS_PER_SECOND * speedMultiplier)
    ).toFixed(3)),
  })
}

export function buildSeolleongtangCopyPilot01Ssml({
  candidate,
  voiceShortName,
}) {
  assertCandidate(candidate)
  const expectedVoice = VOICE_BY_ID.get(candidate.voiceId)
  if (voiceShortName !== expectedVoice?.shortName) {
    throw new Error(`Unexpected voice for copy pilot ${candidate.label}`)
  }
  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ko-KR">',
    `<voice xml:lang="ko-KR" name="${escapeXml(voiceShortName)}">`,
    `<mstts:express-as style="${candidate.style}" styledegree="${candidate.styleDegree}">`,
    `<prosody rate="${candidate.rate}" pitch="${candidate.pitch}">${escapeXml(candidate.candidateText)}</prosody>`,
    '</mstts:express-as>',
    '</voice>',
    '</speak>',
  ].join('')
}

export function validateSeolleongtangCopyPilot01Voices(availableVoices) {
  const shortName = VOICE_BY_ID.get(COMMON_PERFORMANCE.voiceId)?.shortName
  const available = availableVoices.find(
    (voice) => voice?.ShortName === shortName,
  )
  if (!available) {
    throw new Error(`Required Azure MAI voice is unavailable: ${shortName}`)
  }
  const supported = new Set(
    Array.isArray(available.StyleList) ? available.StyleList : [],
  )
  if (!supported.has(COMMON_PERFORMANCE.style)) {
    throw new Error(`${shortName} does not support style: ${COMMON_PERFORMANCE.style}`)
  }
  return true
}

export function readSeolleongtangCopyPilot01PriceCeiling(
  environment,
  requireExplicit = false,
) {
  return readFullBatch01PriceCeiling(environment, requireExplicit)
}

export function readSeolleongtangCopyPilot01ExecutionConfig(environment) {
  return readFullBatch01ExecutionConfig(environment)
}

export function summarizeSeolleongtangCopyPilot01Cost(
  plan,
  maximumPriceUsdPerMillionCharacters,
) {
  const files = plan.map((item) => {
    const ssml = buildSeolleongtangCopyPilot01Ssml({
      candidate: item.candidate,
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

export function summarizeSeolleongtangCopyPilot01Audio(byteLength) {
  return summarizeFullBatch01Audio(byteLength)
}

export function createSeolleongtangCopyPilot01Manifest({
  plan,
  audioResults,
  region,
  pricing,
  pricingSource,
  generatedAt,
}) {
  if (region !== SEOLLEONGTANG_COPY_PILOT_01_REQUIRED_REGION) {
    throw new Error('Manifest region does not match copy pilot 01')
  }
  if (audioResults.length !== plan.length) {
    throw new Error('Manifest audio result count does not match copy pilot plan')
  }
  const resultByFile = new Map(
    audioResults.map((result) => [result.relativeFile, result]),
  )
  const generatedFiles = plan.map((item) => {
    const result = resultByFile.get(item.relativeFile)
    if (!result) throw new Error(`Manifest result is missing ${item.relativeFile}`)
    const candidate = item.candidate
    return {
      label: candidate.label,
      takeId: candidate.takeId,
      menuId: SEOLLEONGTANG_COPY_PILOT_01_MENU_ID,
      candidateText: candidate.candidateText,
      voiceId: item.voiceId,
      voiceShortName: item.voiceShortName,
      style: candidate.style,
      styleDegree: candidate.styleDegree,
      rate: candidate.rate,
      pitch: candidate.pitch,
      plannedTiming: estimateSeolleongtangCopyPilot01PlannedTiming(candidate),
      file: item.relativeFile,
      ssmlCharacters: pricing.files.find(
        (file) => file.relativeFile === item.relativeFile,
      )?.ssmlCharacters,
      byteLength: result.byteLength,
      ...summarizeSeolleongtangCopyPilot01Audio(result.byteLength),
    }
  })
  return {
    schemaVersion: 1,
    provider: 'Azure AI Speech',
    model: 'MAI-Voice-2-Flash',
    region,
    outputFormat: SEOLLEONGTANG_COPY_PILOT_01_OUTPUT_FORMAT,
    generatedAt,
    sourceCatalog: 'src/data/menuNarrations.ts',
    menuId: SEOLLEONGTANG_COPY_PILOT_01_MENU_ID,
    livePrimaryAtGeneration: SEOLLEONGTANG_COPY_PILOT_01_LIVE_PRIMARY_TEXT,
    comparisonControls: {
      candidateOrder: ['A', 'B', 'C'],
      identicalVoiceAndActingParameters: true,
      expressAsBlocksPerClip: 1,
      prosodyBlocksPerClip: 1,
      explicitBreaksPerClip: 0,
      pausePunctuationCharactersUsed: false,
      liveCatalogPrimaryChanged: false,
      userListeningReviewRequired: true,
    },
    pricing: {
      environmentVariable: SEOLLEONGTANG_COPY_PILOT_01_PRICE_CEILING_ENV,
      ceilingSource: pricingSource,
      ...pricing,
    },
    quality: {
      targetSeconds: SEOLLEONGTANG_COPY_PILOT_01_QUALITY_TARGET_SECONDS,
      hardMaximumSeconds: SEOLLEONGTANG_COPY_PILOT_01_HARD_MAX_SECONDS,
      durationApproximation: 'MP3 byte length / 20,000 bytes per second',
    },
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip:
        SEOLLEONGTANG_COPY_PILOT_01_SYNTHESIS_REQUESTS_PER_CLIP,
      retries: SEOLLEONGTANG_COPY_PILOT_01_RETRY_COUNT,
    },
    generatedFiles,
  }
}

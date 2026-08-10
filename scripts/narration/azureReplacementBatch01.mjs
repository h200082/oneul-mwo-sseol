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

export const REPLACEMENT_BATCH_01_MENU_IDS = Object.freeze([
  'cheonggukjang',
  'jeyuk-deopbap',
  'bulgogi-deopbap',
  'gomtang',
  'pasta',
  'shabu-shabu',
])

export const REPLACEMENT_BATCH_01_REQUIRED_REGION =
  FULL_BATCH_01_REQUIRED_REGION
export const REPLACEMENT_BATCH_01_OUTPUT_FORMAT =
  FULL_BATCH_01_OUTPUT_FORMAT
export const REPLACEMENT_BATCH_01_PRICE_CEILING_ENV =
  FULL_BATCH_01_PRICE_CEILING_ENV
export const REPLACEMENT_BATCH_01_DEFAULT_PRICE_CEILING =
  FULL_BATCH_01_DEFAULT_PRICE_CEILING
export const REPLACEMENT_BATCH_01_MP3_BYTES_PER_SECOND =
  FULL_BATCH_01_MP3_BYTES_PER_SECOND
export const REPLACEMENT_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP = 1
export const REPLACEMENT_BATCH_01_RETRY_COUNT = 0
export const REPLACEMENT_BATCH_01_QUALITY_TARGET_SECONDS =
  FULL_BATCH_01_QUALITY_TARGET_SECONDS
export const REPLACEMENT_BATCH_01_HARD_MAX_SECONDS =
  FULL_BATCH_01_HARD_MAX_SECONDS

const BASE_KOREAN_TIMING_UNITS_PER_SECOND = 5.3
const SUPPORTED_STYLES = new Set(['determined', 'joyful'])
const VOICE_BY_ID = new Map(
  EXPRESSIVE_PILOT_VOICES.map((voice) => [voice.id, voice]),
)

export const REPLACEMENT_BATCH_01_SUPERSEDED_SOURCES = Object.freeze({
  cheonggukjang: Object.freeze({
    supersededPreviewPath: 'tmp/narration-preview/full-batch-02/cheonggukjang.mp3',
    supersededCatalogText: '청국장 향부터 어그로 만렙!',
    replacementReason: 'listening-retake',
  }),
  'jeyuk-deopbap': Object.freeze({
    supersededPreviewPath: 'tmp/narration-preview/full-batch-02/jeyuk-deopbap.mp3',
    supersededCatalogText: '제육덮밥 메뉴 고민 강제 종료!',
    replacementReason: 'listening-retake',
  }),
  'bulgogi-deopbap': Object.freeze({
    supersededPreviewPath: 'tmp/narration-preview/full-batch-02/bulgogi-deopbap.mp3',
    supersededCatalogText: '불고기가 밥을 덮쳤다!',
    replacementReason: 'catalog-copy-replacement',
  }),
  gomtang: Object.freeze({
    supersededPreviewPath: 'tmp/narration-preview/full-batch-01-retake-01/gomtang.mp3',
    supersededCatalogText: '곰은 없고 진국만 있다!',
    replacementReason: 'catalog-copy-replacement',
  }),
  pasta: Object.freeze({
    supersededPreviewPath: 'tmp/narration-preview/expressive-pilot-01/junho/pasta.mp3',
    supersededCatalogText: '이탈리아는 몰라도 돌돌은 안다!',
    replacementReason: 'catalog-copy-replacement',
  }),
  'shabu-shabu': Object.freeze({
    supersededPreviewPath: 'tmp/narration-preview/expressive-pilot-01/haena/shabu-shabu.mp3',
    supersededCatalogText: '고기 목욕, 삼 초 컷!',
    replacementReason: 'catalog-copy-replacement',
  }),
})

export const REPLACEMENT_BATCH_01_PERFORMANCES = Object.freeze([
  Object.freeze({
    menuId: 'cheonggukjang', voiceId: 'junho',
    catalogText: '청국장 향부터 어그로 만렙!', spokenText: '청국장 향부터 어그로 만렙!',
    style: 'joyful', styleDegree: 0.55, rate: '+60%', pitch: '-2%',
    reviewIntent: 'Restrained joyful retake with faster pace lower pitch and clear diction.',
    ...REPLACEMENT_BATCH_01_SUPERSEDED_SOURCES.cheonggukjang,
  }),
  Object.freeze({
    menuId: 'jeyuk-deopbap', voiceId: 'junho',
    catalogText: '제육덮밥 메뉴 고민 강제 종료!', spokenText: '제육덮밥 메뉴 고민 강제 종료!',
    style: 'joyful', styleDegree: 0.62, rate: '+45%', pitch: '-1%',
    reviewIntent: 'Lighter joyful retake with balanced full-sentence clarity.',
    ...REPLACEMENT_BATCH_01_SUPERSEDED_SOURCES['jeyuk-deopbap'],
  }),
  Object.freeze({
    menuId: 'bulgogi-deopbap', voiceId: 'junho',
    catalogText: '밥 위 무단점거 현행범!', spokenText: '밥 위 무단점거 현행범!',
    style: 'determined', styleDegree: 0.62, rate: '+50%', pitch: '-1%',
    reviewIntent: 'Determined replacement for the stale batch 02 copy.',
    ...REPLACEMENT_BATCH_01_SUPERSEDED_SOURCES['bulgogi-deopbap'],
  }),
  Object.freeze({
    menuId: 'gomtang', voiceId: 'junho',
    catalogText: '곰은 없어도 곰처럼 든든!', spokenText: '곰은 없어도 곰처럼 든든!',
    style: 'joyful', styleDegree: 0.6, rate: '+50%', pitch: '-1%',
    reviewIntent: 'Warm joyful replacement for the retired stale-catalog clip.',
    ...REPLACEMENT_BATCH_01_SUPERSEDED_SOURCES.gomtang,
  }),
  Object.freeze({
    menuId: 'pasta', voiceId: 'junho',
    catalogText: '포크로 돌리면 갑자기 유럽!', spokenText: '포크로 돌리면 갑자기 유럽!',
    style: 'joyful', styleDegree: 0.7, rate: '+52%', pitch: '+0%',
    reviewIntent: 'Playful current-copy replacement with a clear final punch.',
    ...REPLACEMENT_BATCH_01_SUPERSEDED_SOURCES.pasta,
  }),
  Object.freeze({
    menuId: 'shabu-shabu', voiceId: 'junho',
    catalogText: '채소도 먹었다고 주장 가능합니다!', spokenText: '채소도 먹었다고 주장 가능합니다!',
    style: 'determined', styleDegree: 0.58, rate: '+58%', pitch: '-1%',
    reviewIntent: 'Dry determined replacement with brisk but intelligible delivery.',
    ...REPLACEMENT_BATCH_01_SUPERSEDED_SOURCES['shabu-shabu'],
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
  if (!REPLACEMENT_BATCH_01_MENU_IDS.includes(performance.menuId)) {
    throw new Error(`Unexpected replacement batch 01 menu: ${performance.menuId}`)
  }
  if (performance.voiceId !== 'junho' || !VOICE_BY_ID.has(performance.voiceId)) {
    throw new Error(`Replacement batch 01 voice must be Junho: ${performance.menuId}`)
  }
  if (performance.spokenText !== performance.catalogText) {
    throw new Error(
      'Replacement batch 01 spoken copy must exactly match catalog: ' +
        performance.menuId,
    )
  }
  if (
    !/^[가-힣A-Za-z0-9]+(?: [가-힣A-Za-z0-9]+)*!$/u.test(
      performance.spokenText,
    )
  ) {
    throw new Error(
      'Replacement batch 01 copy must use one sentence with final ! only: ' +
        performance.menuId,
    )
  }
  const expectedSource =
    REPLACEMENT_BATCH_01_SUPERSEDED_SOURCES[performance.menuId]
  if (
    !expectedSource ||
    performance.supersededPreviewPath !== expectedSource.supersededPreviewPath ||
    performance.supersededCatalogText !== expectedSource.supersededCatalogText ||
    performance.replacementReason !== expectedSource.replacementReason
  ) {
    throw new Error(
      'Replacement batch 01 superseded provenance changed: ' +
        performance.menuId,
    )
  }
  if (
    performance.replacementReason === 'catalog-copy-replacement' &&
    performance.supersededCatalogText === performance.catalogText
  ) {
    throw new Error(
      'Replacement batch 01 stale copy must differ from live catalog: ' +
        performance.menuId,
    )
  }
  if (
    performance.replacementReason === 'listening-retake' &&
    performance.supersededCatalogText !== performance.catalogText
  ) {
    throw new Error(
      'Replacement batch 01 listening retake must preserve live copy: ' +
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
  if (performances.length !== REPLACEMENT_BATCH_01_MENU_IDS.length) {
    throw new Error('Replacement batch 01 must contain exactly six performances')
  }
  const ids = performances.map(({ menuId }) => menuId)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Replacement batch 01 menu IDs must be unique')
  }
  if (
    ids.some(
      (menuId, index) => menuId !== REPLACEMENT_BATCH_01_MENU_IDS[index],
    )
  ) {
    throw new Error('Replacement batch 01 menu order changed')
  }
}

export function estimateReplacementBatch01PlannedTiming(performance) {
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

export function selectReplacementBatch01Performances(catalog) {
  assertExactlyOnePerformancePerMenu(REPLACEMENT_BATCH_01_PERFORMANCES)
  const narrationById = new Map(catalog.map((item) => [item.menuId, item]))
  for (const performance of REPLACEMENT_BATCH_01_PERFORMANCES) {
    assertPerformance(performance)
    const current = narrationById.get(performance.menuId)
    if (current === undefined) {
      throw new Error(`Narration catalog is missing ${performance.menuId}`)
    }
    if (current.text !== performance.catalogText) {
      throw new Error(`Replacement batch 01 narration text is stale: ${performance.menuId}`)
    }
    const timing = estimateReplacementBatch01PlannedTiming(performance)
    if (
      timing.approxDurationSeconds >
      REPLACEMENT_BATCH_01_QUALITY_TARGET_SECONDS.maximum
    ) {
      throw new Error(`Planned duration exceeds target: ${performance.menuId}`)
    }
  }
  return REPLACEMENT_BATCH_01_PERFORMANCES
}

export function createReplacementBatch01Plan(
  performances = REPLACEMENT_BATCH_01_PERFORMANCES,
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

export function buildReplacementBatch01Ssml({
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

export function validateReplacementBatch01Voices(
  availableVoices,
  performances = REPLACEMENT_BATCH_01_PERFORMANCES,
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

export function readReplacementBatch01PriceCeiling(
  environment,
  requireExplicit = false,
) {
  return readFullBatch01PriceCeiling(environment, requireExplicit)
}

export function readReplacementBatch01ExecutionConfig(environment) {
  return readFullBatch01ExecutionConfig(environment)
}

export function summarizeReplacementBatch01Cost(
  plan,
  maximumPriceUsdPerMillionCharacters,
) {
  const files = plan.map((item) => {
    const ssml = buildReplacementBatch01Ssml({
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

export function summarizeReplacementBatch01Audio(byteLength) {
  return summarizeFullBatch01Audio(byteLength)
}

export function createReplacementBatch01Manifest({
  plan,
  audioResults,
  region,
  pricing,
  pricingSource,
  generatedAt,
}) {
  if (region !== REPLACEMENT_BATCH_01_REQUIRED_REGION) {
    throw new Error('Manifest region does not match replacement batch 01')
  }
  if (audioResults.length !== plan.length) {
    throw new Error('Manifest audio result count does not match the replacement batch 01 plan')
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
      supersededPreviewPath: performance.supersededPreviewPath,
      supersededCatalogText: performance.supersededCatalogText,
      replacementReason: performance.replacementReason,
      style: performance.style,
      styleDegree: performance.styleDegree,
      rate: performance.rate,
      pitch: performance.pitch,
      plannedTiming: estimateReplacementBatch01PlannedTiming(performance),
      file: item.relativeFile,
      ssmlCharacters: pricing.files.find(
        (file) => file.relativeFile === item.relativeFile,
      )?.ssmlCharacters,
      byteLength: result.byteLength,
      ...summarizeReplacementBatch01Audio(result.byteLength),
    }
  })
  return {
    schemaVersion: 1,
    provider: 'Azure AI Speech',
    model: 'MAI-Voice-2-Flash',
    region,
    outputFormat: REPLACEMENT_BATCH_01_OUTPUT_FORMAT,
    generatedAt,
    sourceCatalog: 'src/data/menuNarrations.ts',
    sourceListeningReview: 'replacement-batch-01-reviewed-copy-and-performance-matrix',
    copyReview: {
      catalogTextPinned: true,
      spokenTextExactlyMatchesCatalog: true,
      pronunciationOverrideUsed: false,
      userListeningReviewRequired: true,
    },
    replacementReview: {
      supersededSourceRecordedPerClip: true,
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
      environmentVariable: REPLACEMENT_BATCH_01_PRICE_CEILING_ENV,
      ceilingSource: pricingSource,
      ...pricing,
    },
    quality: {
      targetSeconds: REPLACEMENT_BATCH_01_QUALITY_TARGET_SECONDS,
      hardMaximumSeconds: REPLACEMENT_BATCH_01_HARD_MAX_SECONDS,
      plannedTimingPreflight: 'maximum-only-heuristic',
      minimumDurationEvaluatedAfterSynthesis: true,
      durationApproximation: 'MP3 byte length / 20,000 bytes per second',
      naturalFullSentenceDeliveryPriority: true,
    },
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip:
        REPLACEMENT_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP,
      retries: REPLACEMENT_BATCH_01_RETRY_COUNT,
    },
    generatedFiles,
  }
}

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
import { inspectSlowRetakeBatch01Mp3 } from './azureSlowRetakeBatch01.mjs'

export const FINAL_RETAKE_BATCH_01_MENU_IDS = Object.freeze([
  'bulgogi-deopbap',
  'pasta',
])

export const FINAL_RETAKE_BATCH_01_REQUIRED_REGION =
  FULL_BATCH_01_REQUIRED_REGION
export const FINAL_RETAKE_BATCH_01_OUTPUT_FORMAT =
  FULL_BATCH_01_OUTPUT_FORMAT
export const FINAL_RETAKE_BATCH_01_PRICE_CEILING_ENV =
  FULL_BATCH_01_PRICE_CEILING_ENV
export const FINAL_RETAKE_BATCH_01_DEFAULT_PRICE_CEILING =
  FULL_BATCH_01_DEFAULT_PRICE_CEILING
export const FINAL_RETAKE_BATCH_01_MP3_BYTES_PER_SECOND =
  FULL_BATCH_01_MP3_BYTES_PER_SECOND
export const FINAL_RETAKE_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP = 1
export const FINAL_RETAKE_BATCH_01_RETRY_COUNT = 0
export const FINAL_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS =
  FULL_BATCH_01_QUALITY_TARGET_SECONDS
export const FINAL_RETAKE_BATCH_01_HARD_MAX_SECONDS =
  FULL_BATCH_01_HARD_MAX_SECONDS
export const FINAL_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS =
  Object.freeze({ minimum: 1.25, maximum: 1.5 })
export const FINAL_RETAKE_BATCH_01_MAX_INTERNAL_GAP_MILLISECONDS = 180

const BASE_KOREAN_TIMING_UNITS_PER_SECOND = 5.3
const SUPPORTED_STYLES = new Set(['determined'])
const SOURCE_KINDS = Object.freeze(['fast', 'slow'])
const VOICE_BY_ID = new Map(
  EXPRESSIVE_PILOT_VOICES.map((voice) => [voice.id, voice]),
)

function sourceCandidate({
  sourceBatch,
  sourceManifestPath,
  sourcePreviewPath,
  sourceCatalogText,
  sourceByteLength,
  sourceSha256,
  sourceListeningFinding,
}) {
  return Object.freeze({
    sourceBatch,
    sourceManifestPath,
    sourcePreviewPath,
    sourceCatalogText,
    sourceByteLength,
    sourceSha256,
    sourceListeningFinding,
  })
}

export const FINAL_RETAKE_BATCH_01_SUPERSEDED_SOURCES = Object.freeze({
  'bulgogi-deopbap': Object.freeze({
    fast: sourceCandidate({
      sourceBatch: 'replacement-batch-01',
      sourceManifestPath:
        'tmp/narration-preview/replacement-batch-01/replacement-batch-01-manifest.json',
      sourcePreviewPath:
        'tmp/narration-preview/replacement-batch-01/bulgogi-deopbap.mp3',
      sourceCatalogText: '밥 위 무단점거 현행범!',
      sourceByteLength: 35_520,
      sourceSha256:
        'dc116da91da1aa385146474e5bcf46c0b801556859442d7cd0ab92464db0c4b6',
      sourceListeningFinding: 'too-fast',
    }),
    slow: sourceCandidate({
      sourceBatch: 'slow-retake-batch-01',
      sourceManifestPath:
        'tmp/narration-preview/slow-retake-batch-01/slow-retake-batch-01-manifest.json',
      sourcePreviewPath:
        'tmp/narration-preview/slow-retake-batch-01/bulgogi-deopbap.mp3',
      sourceCatalogText: '밥 위 무단점거 현행범!',
      sourceByteLength: 89_760,
      sourceSha256:
        '8947ba0744c58e29f96730c5c622d62f7617735a30cdcddde9fa601196de0e88',
      sourceListeningFinding: 'too-slow',
    }),
  }),
  pasta: Object.freeze({
    fast: sourceCandidate({
      sourceBatch: 'replacement-batch-01',
      sourceManifestPath:
        'tmp/narration-preview/replacement-batch-01/replacement-batch-01-manifest.json',
      sourcePreviewPath:
        'tmp/narration-preview/replacement-batch-01/pasta.mp3',
      sourceCatalogText: '포크로 돌리면 갑자기 유럽!',
      sourceByteLength: 35_520,
      sourceSha256:
        'f6f89186fe0a289245feca0da3066fa9926ab6da02e00aa34cca255de30c6624',
      sourceListeningFinding: 'too-fast',
    }),
    slow: sourceCandidate({
      sourceBatch: 'slow-retake-batch-01',
      sourceManifestPath:
        'tmp/narration-preview/slow-retake-batch-01/slow-retake-batch-01-manifest.json',
      sourcePreviewPath:
        'tmp/narration-preview/slow-retake-batch-01/pasta.mp3',
      sourceCatalogText: '포크로 돌리면 갑자기 유럽!',
      sourceByteLength: 66_720,
      sourceSha256:
        'ed24e7b1f177bc642a5ede6516f49ab05d4c68638fd97f31cbdcd1eadda596a7',
      sourceListeningFinding: 'overemphasized-final-with-long-internal-gap',
    }),
  }),
})

export const FINAL_RETAKE_BATCH_01_PERFORMANCES = Object.freeze([
  Object.freeze({
    menuId: 'bulgogi-deopbap',
    voiceId: 'junho',
    catalogText: '밥 위 무단점거 현행범!',
    spokenText: '밥 위 무단점거 현행범!',
    style: 'determined',
    styleDegree: 0.58,
    rate: '+42%',
    pitch: '-1%',
    reviewIntent:
      'Balanced retake between the pinned rushed and over-slow candidates, with clear consonants and one dry comic sentence.',
    supersededSources:
      FINAL_RETAKE_BATCH_01_SUPERSEDED_SOURCES['bulgogi-deopbap'],
  }),
  Object.freeze({
    menuId: 'pasta',
    voiceId: 'junho',
    catalogText: '포크로 돌리면 갑자기 유럽!',
    spokenText: '포크로 돌리면 갑자기 유럽!',
    style: 'determined',
    styleDegree: 0.35,
    rate: '+30%',
    pitch: '-1%',
    reviewIntent:
      'Dry even one-sentence joke without special stress or a dramatic pause on 갑자기 유럽.',
    supersededSources: FINAL_RETAKE_BATCH_01_SUPERSEDED_SOURCES.pasta,
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

function assertSourceCandidate(candidate, expected, catalogText, menuId, kind) {
  if (
    !candidate ||
    candidate.sourceBatch !== expected.sourceBatch ||
    candidate.sourceManifestPath !== expected.sourceManifestPath ||
    candidate.sourcePreviewPath !== expected.sourcePreviewPath ||
    candidate.sourceCatalogText !== expected.sourceCatalogText ||
    candidate.sourceByteLength !== expected.sourceByteLength ||
    candidate.sourceSha256 !== expected.sourceSha256 ||
    candidate.sourceListeningFinding !== expected.sourceListeningFinding
  ) {
    throw new Error(
      `Final retake batch 01 ${kind} source provenance changed: ${menuId}`,
    )
  }
  if (
    candidate.sourceCatalogText !== catalogText ||
    !Number.isSafeInteger(candidate.sourceByteLength) ||
    candidate.sourceByteLength <= 0 ||
    !/^[a-f0-9]{64}$/.test(candidate.sourceSha256)
  ) {
    throw new Error(
      `Final retake batch 01 ${kind} source pin is invalid: ${menuId}`,
    )
  }
}

function assertPerformance(performance) {
  if (!FINAL_RETAKE_BATCH_01_MENU_IDS.includes(performance.menuId)) {
    throw new Error(`Unexpected final retake batch 01 menu: ${performance.menuId}`)
  }
  if (performance.voiceId !== 'junho' || !VOICE_BY_ID.has('junho')) {
    throw new Error(`Final retake batch 01 voice must be Junho: ${performance.menuId}`)
  }
  if (performance.spokenText !== performance.catalogText) {
    throw new Error(
      `Final retake batch 01 spoken copy must exactly match catalog: ${performance.menuId}`,
    )
  }
  if (!/^[가-힣A-Za-z0-9]+(?: [가-힣A-Za-z0-9]+)*!$/u.test(performance.spokenText)) {
    throw new Error(
      `Final retake batch 01 copy must use one sentence with final ! only: ${performance.menuId}`,
    )
  }
  if (!SUPPORTED_STYLES.has(performance.style)) {
    throw new Error(`Unsupported final retake batch 01 style: ${performance.style}`)
  }
  assertStyleDegree(performance.styleDegree)
  parseSignedPercent(performance.rate, 'rate')
  parseSignedPercent(performance.pitch, 'pitch')
  const expectedSources =
    FINAL_RETAKE_BATCH_01_SUPERSEDED_SOURCES[performance.menuId]
  for (const kind of SOURCE_KINDS) {
    assertSourceCandidate(
      performance.supersededSources?.[kind],
      expectedSources?.[kind],
      performance.catalogText,
      performance.menuId,
      kind,
    )
  }
}

function assertExactlyOnePerformancePerMenu(performances) {
  if (performances.length !== FINAL_RETAKE_BATCH_01_MENU_IDS.length) {
    throw new Error('Final retake batch 01 must contain exactly two performances')
  }
  const ids = performances.map(({ menuId }) => menuId)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Final retake batch 01 menu IDs must be unique')
  }
  if (ids.some((menuId, index) => menuId !== FINAL_RETAKE_BATCH_01_MENU_IDS[index])) {
    throw new Error('Final retake batch 01 menu order changed')
  }
}

export function estimateFinalRetakeBatch01PlannedTiming(performance) {
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

export function selectFinalRetakeBatch01Performances(catalog) {
  assertExactlyOnePerformancePerMenu(FINAL_RETAKE_BATCH_01_PERFORMANCES)
  const narrationById = new Map(catalog.map((item) => [item.menuId, item]))
  for (const performance of FINAL_RETAKE_BATCH_01_PERFORMANCES) {
    assertPerformance(performance)
    const current = narrationById.get(performance.menuId)
    if (current === undefined) {
      throw new Error(`Narration catalog is missing ${performance.menuId}`)
    }
    if (current.text !== performance.catalogText) {
      throw new Error(
        `Final retake batch 01 narration text is stale: ${performance.menuId}`,
      )
    }
  }
  return FINAL_RETAKE_BATCH_01_PERFORMANCES
}

export function createFinalRetakeBatch01Plan(
  performances = FINAL_RETAKE_BATCH_01_PERFORMANCES,
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

export function buildFinalRetakeBatch01Ssml({ performance, voiceShortName }) {
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

export function validateFinalRetakeBatch01Voices(
  availableVoices,
  performances = FINAL_RETAKE_BATCH_01_PERFORMANCES,
) {
  assertExactlyOnePerformancePerMenu(performances)
  for (const performance of performances) assertPerformance(performance)
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
  if (!supported.has('determined')) {
    throw new Error(`${shortName} does not support style: determined`)
  }
  return true
}

export function validateFinalRetakeBatch01SourceFile({
  performance,
  sourceKind,
  byteLength,
  sha256,
}) {
  assertPerformance(performance)
  if (!SOURCE_KINDS.includes(sourceKind)) {
    throw new Error(`Unknown final retake source kind: ${sourceKind}`)
  }
  const source = performance.supersededSources[sourceKind]
  if (byteLength !== source.sourceByteLength || sha256 !== source.sourceSha256) {
    throw new Error(
      `Pinned ${sourceKind} source mismatch: ${performance.menuId}`,
    )
  }
  return true
}

export function readFinalRetakeBatch01PriceCeiling(
  environment,
  requireExplicit = false,
) {
  return readFullBatch01PriceCeiling(environment, requireExplicit)
}

export function readFinalRetakeBatch01ExecutionConfig(environment) {
  return readFullBatch01ExecutionConfig(environment)
}

export function summarizeFinalRetakeBatch01Cost(
  plan,
  maximumPriceUsdPerMillionCharacters,
) {
  const files = plan.map((item) => {
    const ssml = buildFinalRetakeBatch01Ssml({
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

export function inspectFinalRetakeBatch01Mp3(audio) {
  return inspectSlowRetakeBatch01Mp3(audio)
}

export function summarizeFinalRetakeBatch01Audio(byteLength) {
  return summarizeFullBatch01Audio(byteLength)
}

export function createFinalRetakeBatch01Manifest({
  plan,
  audioResults,
  region,
  pricing,
  pricingSource,
  generatedAt,
}) {
  if (region !== FINAL_RETAKE_BATCH_01_REQUIRED_REGION) {
    throw new Error('Manifest region does not match final retake batch 01')
  }
  if (audioResults.length !== plan.length) {
    throw new Error(
      'Manifest audio result count does not match final retake batch 01 plan',
    )
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
      supersededSources: performance.supersededSources,
      style: performance.style,
      styleDegree: performance.styleDegree,
      rate: performance.rate,
      pitch: performance.pitch,
      plannedTiming: estimateFinalRetakeBatch01PlannedTiming(performance),
      file: item.relativeFile,
      ssmlCharacters: pricing.files.find(
        (file) => file.relativeFile === item.relativeFile,
      )?.ssmlCharacters,
      byteLength: result.byteLength,
      sha256: result.sha256,
      mpegFrameCount: result.mpegFrameCount,
      exactDurationSeconds: result.exactDurationSeconds,
      ...summarizeFinalRetakeBatch01Audio(result.byteLength),
    }
  })
  const totalByteLength = generatedFiles.reduce(
    (total, file) => total + file.byteLength,
    0,
  )
  const totalMpegFrameCount = generatedFiles.reduce(
    (total, file) => total + file.mpegFrameCount,
    0,
  )
  const totalExactDurationSeconds = Number(
    generatedFiles
      .reduce((total, file) => total + file.exactDurationSeconds, 0)
      .toFixed(6),
  )
  return {
    schemaVersion: 2,
    provider: 'Azure AI Speech',
    model: 'MAI-Voice-2-Flash',
    region,
    outputFormat: FINAL_RETAKE_BATCH_01_OUTPUT_FORMAT,
    generatedAt,
    sourceCatalog: 'src/data/menuNarrations.ts',
    sourceListeningReview:
      'final-retake-batch-01-pinned-fast-and-slow-user-reviewed-candidates',
    copyReview: {
      catalogTextPinned: true,
      spokenTextExactlyMatchesCatalog: true,
      pronunciationOverrideUsed: false,
      userListeningReviewRequired: true,
    },
    finalRetakeReview: {
      fastAndSlowSourcesRecordedPerClip: true,
      sourceBatchManifestPathByteLengthAndSha256Pinned: true,
      outputCandidatesRequireHumanApproval: true,
      integrationBeforeApprovalProhibited: true,
    },
    delivery: {
      expressAsBlocksPerClip: 1,
      prosodyBlocksPerClip: 1,
      explicitBreaksPerClip: 0,
      pronunciationOverridesPerClip: 0,
      emphasisBlocksPerClip: 0,
      midSentenceStyleRateOrPitchSwitch: false,
      pausePunctuationCharactersUsed: false,
    },
    pricing: {
      environmentVariable: FINAL_RETAKE_BATCH_01_PRICE_CEILING_ENV,
      ceilingSource: pricingSource,
      ...pricing,
    },
    outputTotals: {
      clipCount: generatedFiles.length,
      byteLength: totalByteLength,
      mpegFrameCount: totalMpegFrameCount,
      exactDurationSeconds: totalExactDurationSeconds,
    },
    quality: {
      approximateFileDurationTargetSeconds:
        FINAL_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS,
      hardMaximumSeconds: FINAL_RETAKE_BATCH_01_HARD_MAX_SECONDS,
      approximateFileDurationEvaluatedAfterSynthesis: true,
      durationApproximation:
        'MP3 byte length / 20,000 bytes per second',
      totalByteQa: 'sum-of-validated-positive-output-byte-lengths-recorded',
      activeSpeechTargetSeconds:
        FINAL_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS,
      maximumInternalGapMilliseconds:
        FINAL_RETAKE_BATCH_01_MAX_INTERNAL_GAP_MILLISECONDS,
      activeSpeechAndInternalGapQa: 'manual-human-listening-required',
      activeSpeechAndInternalGapAutomaticallyMeasured: false,
      plannedTimingPreflight: 'informational-total-text-heuristic-only',
      naturalFullSentenceDeliveryPriority: true,
      exactDurationMeasurement:
        'validated MPEG frame count * 576 samples / 24,000 Hz',
      outputIdentityPinnedInManifest: true,
    },
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip: FINAL_RETAKE_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP,
      retries: FINAL_RETAKE_BATCH_01_RETRY_COUNT,
    },
    generatedFiles,
  }
}

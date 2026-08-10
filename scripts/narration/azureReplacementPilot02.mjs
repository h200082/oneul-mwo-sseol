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
import { inspectFinalRetakeBatch01Mp3 } from './azureFinalRetakeBatch01.mjs'

export const REPLACEMENT_PILOT_02_MENU_IDS = Object.freeze([
  'pasta',
  'bulgogi-deopbap',
])
export const REPLACEMENT_PILOT_02_REQUIRED_REGION =
  FULL_BATCH_01_REQUIRED_REGION
export const REPLACEMENT_PILOT_02_OUTPUT_FORMAT =
  FULL_BATCH_01_OUTPUT_FORMAT
export const REPLACEMENT_PILOT_02_PRICE_CEILING_ENV =
  FULL_BATCH_01_PRICE_CEILING_ENV
export const REPLACEMENT_PILOT_02_DEFAULT_PRICE_CEILING =
  FULL_BATCH_01_DEFAULT_PRICE_CEILING
export const REPLACEMENT_PILOT_02_SYNTHESIS_REQUESTS_PER_CLIP = 1
export const REPLACEMENT_PILOT_02_RETRY_COUNT = 0
export const REPLACEMENT_PILOT_02_APPROX_FILE_TARGET_SECONDS =
  FULL_BATCH_01_QUALITY_TARGET_SECONDS
export const REPLACEMENT_PILOT_02_HARD_MAX_SECONDS =
  FULL_BATCH_01_HARD_MAX_SECONDS
export const REPLACEMENT_PILOT_02_MAX_INTERNAL_GAP_MILLISECONDS = 180
export const REPLACEMENT_PILOT_02_ACTIVE_SPEECH_TARGET_SECONDS =
  Object.freeze({ minimum: 1.25, maximum: 1.5 })

const BASE_KOREAN_TIMING_UNITS_PER_SECOND = 5.3
const VOICE_BY_ID = new Map(
  EXPRESSIVE_PILOT_VOICES.map((voice) => [voice.id, voice]),
)
const SOURCE_KINDS = Object.freeze(['raw', 'gapTrim'])

function rejectedProfile({ styleDegree, rate }) {
  return Object.freeze({
    voiceId: 'junho',
    voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
    style: 'determined',
    styleDegree,
    rate,
    pitch: '-1%',
    structure: 'one-full-block',
  })
}

function rejectedSource(value) {
  return Object.freeze(value)
}

const PASTA_REJECTED_PROFILE = rejectedProfile({
  styleDegree: 0.35,
  rate: '+30%',
})
const BULGOGI_REJECTED_PROFILE = rejectedProfile({
  styleDegree: 0.58,
  rate: '+42%',
})

export const REPLACEMENT_PILOT_02_REJECTED_SOURCES = Object.freeze({
  pasta: Object.freeze({
    raw: rejectedSource({
      sourceKind: 'raw',
      sourceBatch: 'final-retake-batch-01',
      sourceManifestPath:
        'tmp/narration-preview/final-retake-batch-01/final-retake-batch-01-manifest.json',
      sourcePath:
        'tmp/narration-preview/final-retake-batch-01/pasta.mp3',
      sourceByteLength: 45_600,
      sourceSha256:
        '6446a97cfe953987bdfcc4d37db564058697a27c9f85073888879eab759aeaf7',
      sourceDurationSeconds: 2.28,
      sourceProfile: PASTA_REJECTED_PROFILE,
      rejectionStatus: 'user-rejected-raw',
    }),
    gapTrim: rejectedSource({
      sourceKind: 'gapTrim',
      sourceBatch: 'pasta-gap-trim-01',
      sourceManifestPath:
        'tmp/narration-preview/pasta-gap-trim-01/pasta-gap-trim-01-manifest.json',
      sourcePath:
        'tmp/narration-preview/pasta-gap-trim-01/pasta-gap-trim-01.wav',
      sourceByteLength: 145_484,
      sourceSha256:
        '21585115624b537b75e53a17c1d485949821cf16c5df6c02f725eb3bcb58ebec',
      sourceDurationSeconds: 1.515,
      sourceProfile: PASTA_REJECTED_PROFILE,
      localPostprocess: 'bit-exact-internal-gap-trim',
      rejectionStatus: 'user-rejected-local-gap-trim',
    }),
  }),
  'bulgogi-deopbap': Object.freeze({
    raw: rejectedSource({
      sourceKind: 'raw',
      sourceBatch: 'final-retake-batch-01',
      sourceManifestPath:
        'tmp/narration-preview/final-retake-batch-01/final-retake-batch-01-manifest.json',
      sourcePath:
        'tmp/narration-preview/final-retake-batch-01/bulgogi-deopbap.mp3',
      sourceByteLength: 64_800,
      sourceSha256:
        'ed24ec062fa183c9411fa0f78c5acd80c2e1a76cd170a88615a7d27adc2a5e1b',
      sourceDurationSeconds: 3.24,
      sourceProfile: BULGOGI_REJECTED_PROFILE,
      rejectionStatus: 'user-rejected-raw',
    }),
    gapTrim: rejectedSource({
      sourceKind: 'gapTrim',
      sourceBatch: 'bulgogi-deopbap-gap-trim-01',
      sourceManifestPath:
        'tmp/narration-preview/bulgogi-deopbap-gap-trim-01/bulgogi-deopbap-gap-trim-01-manifest.json',
      sourcePath:
        'tmp/narration-preview/bulgogi-deopbap-gap-trim-01/bulgogi-deopbap-gap-trim-01.wav',
      sourceByteLength: 188_692,
      sourceSha256:
        '3955599acecc366851a8c809802e3a64d575accc31904579d879f5ee8b43ccc9',
      sourceDurationSeconds: 1.9650833333333333,
      sourceProfile: BULGOGI_REJECTED_PROFILE,
      localPostprocess: 'bit-exact-internal-gap-trim',
      rejectionStatus: 'user-rejected-local-gap-trim',
    }),
  }),
})

function candidate({
  menuId,
  label,
  catalogText,
  styleDegree,
  rate,
  structure,
  segments,
  reviewIntent,
}) {
  return Object.freeze({
    menuId,
    label,
    voiceId: 'junho',
    catalogText,
    spokenText: catalogText,
    style: 'joyful',
    styleDegree,
    rate,
    pitch: '+0%',
    structure,
    segments: segments === null ? null : Object.freeze(segments),
    relativeFile: `${menuId}-${label}.mp3`,
    reviewIntent,
    rejectedSources: REPLACEMENT_PILOT_02_REJECTED_SOURCES[menuId],
  })
}

export const REPLACEMENT_PILOT_02_CANDIDATES = Object.freeze([
  candidate({
    menuId: 'pasta',
    label: 'A',
    catalogText: '포크로 돌리면 갑자기 유럽!',
    styleDegree: 0.56,
    rate: '+22%',
    structure: 'one-full-block',
    segments: null,
    reviewIntent:
      'Blinded continuous joyful take with restrained acting and no special final punch.',
  }),
  candidate({
    menuId: 'pasta',
    label: 'B',
    catalogText: '포크로 돌리면 갑자기 유럽!',
    styleDegree: 0.56,
    rate: '+22%',
    structure: 'adjacent-two-blocks-no-break',
    segments: ['포크로 돌리면 ', '갑자기 유럽!'],
    reviewIntent:
      'Blinded adjacent two-block diagnosis with identical joyful controls and no explicit break.',
  }),
  candidate({
    menuId: 'bulgogi-deopbap',
    label: 'A',
    catalogText: '밥 위 무단점거 현행범!',
    styleDegree: 0.6,
    rate: '+28%',
    structure: 'one-full-block',
    segments: null,
    reviewIntent:
      'Blinded continuous joyful take that keeps the legal phrase clear and dry.',
  }),
  candidate({
    menuId: 'bulgogi-deopbap',
    label: 'B',
    catalogText: '밥 위 무단점거 현행범!',
    styleDegree: 0.6,
    rate: '+28%',
    structure: 'adjacent-two-blocks-no-break',
    segments: ['밥 위 ', '무단점거 현행범!'],
    reviewIntent:
      'Blinded adjacent two-block diagnosis that preserves 무단점거 현행범 as one phrase and adds no break.',
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

function performanceFingerprint(value) {
  return [
    value.voiceId,
    value.style,
    value.styleDegree,
    value.rate,
    value.pitch,
  ].join('|')
}

function assertRejectedSource(source, expected, menuId, sourceKind) {
  const keys = [
    'sourceKind',
    'sourceBatch',
    'sourceManifestPath',
    'sourcePath',
    'sourceByteLength',
    'sourceSha256',
    'sourceDurationSeconds',
    'rejectionStatus',
  ]
  for (const key of keys) {
    if (source?.[key] !== expected?.[key]) {
      throw new Error(
        `Replacement pilot 02 rejected ${sourceKind} source changed: ${menuId}`,
      )
    }
  }
  if (
    !source.sourceProfile ||
    performanceFingerprint(source.sourceProfile) !==
      performanceFingerprint(expected.sourceProfile) ||
    source.sourceProfile.structure !== expected.sourceProfile.structure ||
    (sourceKind === 'gapTrim' &&
      source.localPostprocess !== expected.localPostprocess)
  ) {
    throw new Error(
      `Replacement pilot 02 rejected ${sourceKind} profile changed: ${menuId}`,
    )
  }
  if (
    !Number.isSafeInteger(source.sourceByteLength) ||
    source.sourceByteLength <= 0 ||
    !/^[a-f0-9]{64}$/.test(source.sourceSha256)
  ) {
    throw new Error(
      `Replacement pilot 02 rejected ${sourceKind} pin is invalid: ${menuId}`,
    )
  }
}

function assertCandidate(candidateValue) {
  if (!REPLACEMENT_PILOT_02_MENU_IDS.includes(candidateValue.menuId)) {
    throw new Error(`Unexpected replacement pilot 02 menu: ${candidateValue.menuId}`)
  }
  if (!['A', 'B'].includes(candidateValue.label)) {
    throw new Error(`Unexpected replacement pilot 02 label: ${candidateValue.label}`)
  }
  if (candidateValue.voiceId !== 'junho' || !VOICE_BY_ID.has('junho')) {
    throw new Error(`Replacement pilot 02 voice must be Junho: ${candidateValue.menuId}`)
  }
  if (
    candidateValue.spokenText !== candidateValue.catalogText ||
    !/^[가-힣A-Za-z0-9]+(?: [가-힣A-Za-z0-9]+)*!$/u.test(
      candidateValue.spokenText,
    )
  ) {
    throw new Error(
      `Replacement pilot 02 copy must equal catalog with final ! only: ${candidateValue.menuId}-${candidateValue.label}`,
    )
  }
  if (
    candidateValue.style !== 'joyful' ||
    !Number.isFinite(candidateValue.styleDegree) ||
    candidateValue.styleDegree < 0.01 ||
    candidateValue.styleDegree > 2
  ) {
    throw new Error(
      `Replacement pilot 02 joyful controls changed: ${candidateValue.menuId}-${candidateValue.label}`,
    )
  }
  parseSignedPercent(candidateValue.rate, 'rate')
  parseSignedPercent(candidateValue.pitch, 'pitch')
  if (
    candidateValue.structure === 'one-full-block' &&
    candidateValue.segments !== null
  ) {
    throw new Error(`Continuous candidate must not contain segments: ${candidateValue.menuId}`)
  }
  if (candidateValue.structure === 'adjacent-two-blocks-no-break') {
    if (
      !Array.isArray(candidateValue.segments) ||
      candidateValue.segments.length !== 2 ||
      candidateValue.segments.join('') !== candidateValue.spokenText
    ) {
      throw new Error(
        `Segmented candidate must join to exact copy: ${candidateValue.menuId}`,
      )
    }
  } else if (candidateValue.structure !== 'one-full-block') {
    throw new Error(`Unexpected replacement pilot structure: ${candidateValue.structure}`)
  }
  const expectedSources =
    REPLACEMENT_PILOT_02_REJECTED_SOURCES[candidateValue.menuId]
  for (const sourceKind of SOURCE_KINDS) {
    assertRejectedSource(
      candidateValue.rejectedSources?.[sourceKind],
      expectedSources?.[sourceKind],
      candidateValue.menuId,
      sourceKind,
    )
  }
  const candidateFingerprint = performanceFingerprint(candidateValue)
  for (const sourceKind of SOURCE_KINDS) {
    if (
      candidateFingerprint ===
      performanceFingerprint(expectedSources[sourceKind].sourceProfile)
    ) {
      throw new Error(
        `Replacement pilot 02 must not reuse rejected profile: ${candidateValue.menuId}-${candidateValue.label}`,
      )
    }
  }
}

function assertCandidateSet(candidates) {
  if (candidates.length !== 4) {
    throw new Error('Replacement pilot 02 must contain exactly four candidates')
  }
  const expectedOrder = [
    'pasta-A',
    'pasta-B',
    'bulgogi-deopbap-A',
    'bulgogi-deopbap-B',
  ]
  const actualOrder = candidates.map(
    (candidateValue) => `${candidateValue.menuId}-${candidateValue.label}`,
  )
  if (actualOrder.some((value, index) => value !== expectedOrder[index])) {
    throw new Error('Replacement pilot 02 candidate order changed')
  }
  if (new Set(candidates.map(({ relativeFile }) => relativeFile)).size !== 4) {
    throw new Error('Replacement pilot 02 filenames must be unique')
  }
  for (const candidateValue of candidates) assertCandidate(candidateValue)
  for (const menuId of REPLACEMENT_PILOT_02_MENU_IDS) {
    const [continuous, segmented] = candidates.filter(
      (candidateValue) => candidateValue.menuId === menuId,
    )
    for (const key of [
      'voiceId',
      'catalogText',
      'spokenText',
      'style',
      'styleDegree',
      'rate',
      'pitch',
    ]) {
      if (continuous[key] !== segmented[key]) {
        throw new Error(`Replacement pilot 02 A/B ${key} differs: ${menuId}`)
      }
    }
    if (
      continuous.structure !== 'one-full-block' ||
      segmented.structure !== 'adjacent-two-blocks-no-break'
    ) {
      throw new Error(`Replacement pilot 02 A/B structure changed: ${menuId}`)
    }
  }
}

export function selectReplacementPilot02Candidates(catalog) {
  assertCandidateSet(REPLACEMENT_PILOT_02_CANDIDATES)
  const narrationById = new Map(catalog.map((item) => [item.menuId, item]))
  for (const candidateValue of REPLACEMENT_PILOT_02_CANDIDATES) {
    const current = narrationById.get(candidateValue.menuId)
    if (!current) {
      throw new Error(`Narration catalog is missing ${candidateValue.menuId}`)
    }
    if (current.text !== candidateValue.catalogText) {
      throw new Error(
        `Replacement pilot 02 narration text is stale: ${candidateValue.menuId}`,
      )
    }
  }
  return REPLACEMENT_PILOT_02_CANDIDATES
}

export function createReplacementPilot02Plan(
  candidates = REPLACEMENT_PILOT_02_CANDIDATES,
) {
  assertCandidateSet(candidates)
  const voice = VOICE_BY_ID.get('junho')
  return candidates.map((candidateValue) =>
    Object.freeze({
      candidate: candidateValue,
      voiceId: voice.id,
      voiceShortName: voice.shortName,
      relativeFile: candidateValue.relativeFile,
    }),
  )
}

function buildPerformanceBlock(candidateValue, text) {
  return [
    `<mstts:express-as style="${candidateValue.style}" styledegree="${candidateValue.styleDegree}">`,
    `<prosody rate="${candidateValue.rate}" pitch="${candidateValue.pitch}">${escapeXml(text)}</prosody>`,
    '</mstts:express-as>',
  ].join('')
}

export function buildReplacementPilot02Ssml({
  candidate: candidateValue,
  voiceShortName,
}) {
  assertCandidate(candidateValue)
  const expectedVoice = VOICE_BY_ID.get(candidateValue.voiceId)
  if (voiceShortName !== expectedVoice.shortName) {
    throw new Error(`Unexpected voice for ${candidateValue.menuId}-${candidateValue.label}`)
  }
  const body = candidateValue.segments === null
    ? buildPerformanceBlock(candidateValue, candidateValue.spokenText)
    : candidateValue.segments
        .map((segment) => buildPerformanceBlock(candidateValue, segment))
        .join('')
  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ko-KR">',
    `<voice xml:lang="ko-KR" name="${escapeXml(voiceShortName)}">`,
    body,
    '</voice>',
    '</speak>',
  ].join('')
}

export function estimateReplacementPilot02PlannedTiming(candidateValue) {
  assertCandidate(candidateValue)
  const ratePercent = parseSignedPercent(candidateValue.rate, 'rate')
  return Object.freeze({
    approxDurationSeconds: Number(
      (
        countTimingUnits(candidateValue.spokenText) /
        (BASE_KOREAN_TIMING_UNITS_PER_SECOND * (1 + ratePercent / 100))
      ).toFixed(3),
    ),
  })
}

export function validateReplacementPilot02Voices(availableVoices) {
  assertCandidateSet(REPLACEMENT_PILOT_02_CANDIDATES)
  const shortName = VOICE_BY_ID.get('junho').shortName
  const available = availableVoices.find(
    (voice) => voice?.ShortName === shortName,
  )
  if (!available) {
    throw new Error(`Required Azure MAI voice is unavailable: ${shortName}`)
  }
  const supportedStyles = new Set(
    Array.isArray(available.StyleList) ? available.StyleList : [],
  )
  if (!supportedStyles.has('joyful')) {
    throw new Error(`${shortName} does not support style: joyful`)
  }
  return true
}

export function validateReplacementPilot02RejectedSource({
  candidate: candidateValue,
  sourceKind,
  byteLength,
  sha256,
}) {
  assertCandidate(candidateValue)
  if (!SOURCE_KINDS.includes(sourceKind)) {
    throw new Error(`Unknown replacement pilot 02 source kind: ${sourceKind}`)
  }
  const expected = candidateValue.rejectedSources[sourceKind]
  if (
    byteLength !== expected.sourceByteLength ||
    sha256 !== expected.sourceSha256
  ) {
    throw new Error(
      `Pinned rejected ${sourceKind} source mismatch: ${candidateValue.menuId}`,
    )
  }
  return true
}

export function readReplacementPilot02PriceCeiling(
  environment,
  requireExplicit = false,
) {
  return readFullBatch01PriceCeiling(environment, requireExplicit)
}

export function readReplacementPilot02ExecutionConfig(environment) {
  return readFullBatch01ExecutionConfig(environment)
}

export function summarizeReplacementPilot02Cost(
  plan,
  maximumPriceUsdPerMillionCharacters,
) {
  const files = plan.map((item) => {
    const ssml = buildReplacementPilot02Ssml({
      candidate: item.candidate,
      voiceShortName: item.voiceShortName,
    })
    return Object.freeze({
      relativeFile: item.relativeFile,
      ssmlCharacters: Array.from(ssml).length,
    })
  })
  const ssmlCharacters = files.reduce(
    (total, file) => total + file.ssmlCharacters,
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

export function inspectReplacementPilot02Mp3(audio) {
  return inspectFinalRetakeBatch01Mp3(audio)
}

export function summarizeReplacementPilot02Audio(byteLength) {
  return summarizeFullBatch01Audio(byteLength)
}

export function createReplacementPilot02Manifest({
  plan,
  audioResults,
  region,
  pricing,
  pricingSource,
  generatedAt,
}) {
  if (region !== REPLACEMENT_PILOT_02_REQUIRED_REGION) {
    throw new Error('Manifest region does not match replacement pilot 02')
  }
  if (audioResults.length !== plan.length) {
    throw new Error('Manifest result count does not match replacement pilot 02 plan')
  }
  const resultByFile = new Map(
    audioResults.map((result) => [result.relativeFile, result]),
  )
  const generatedFiles = plan.map((item) => {
    const result = resultByFile.get(item.relativeFile)
    if (!result) throw new Error(`Manifest result is missing ${item.relativeFile}`)
    const expectedDuration = Number(
      ((result.mpegFrameCount * 576) / 24_000).toFixed(6),
    )
    if (
      !Number.isSafeInteger(result.byteLength) ||
      result.byteLength <= 0 ||
      !/^[a-f0-9]{64}$/.test(result.sha256) ||
      !Number.isSafeInteger(result.mpegFrameCount) ||
      result.mpegFrameCount <= 0 ||
      result.exactDurationSeconds !== expectedDuration
    ) {
      throw new Error(`Manifest MP3 inspection is invalid: ${item.relativeFile}`)
    }
    const candidateValue = item.candidate
    const expressAsBlocks = candidateValue.segments === null ? 1 : 2
    return {
      menuId: candidateValue.menuId,
      label: candidateValue.label,
      file: item.relativeFile,
      voiceId: item.voiceId,
      voiceShortName: item.voiceShortName,
      catalogText: candidateValue.catalogText,
      spokenText: candidateValue.spokenText,
      style: candidateValue.style,
      styleDegree: candidateValue.styleDegree,
      rate: candidateValue.rate,
      pitch: candidateValue.pitch,
      structure: candidateValue.structure,
      segments: candidateValue.segments,
      expressAsBlocks,
      prosodyBlocks: expressAsBlocks,
      explicitBreaks: 0,
      reviewIntent: candidateValue.reviewIntent,
      rejectedSources: candidateValue.rejectedSources,
      plannedTiming: estimateReplacementPilot02PlannedTiming(candidateValue),
      ssmlCharacters: pricing.files.find(
        (file) => file.relativeFile === item.relativeFile,
      )?.ssmlCharacters,
      byteLength: result.byteLength,
      sha256: result.sha256,
      mpegFrameCount: result.mpegFrameCount,
      exactDurationSeconds: result.exactDurationSeconds,
      ...summarizeReplacementPilot02Audio(result.byteLength),
    }
  })
  const outputTotals = generatedFiles.reduce(
    (totals, file) => ({
      clipCount: totals.clipCount + 1,
      byteLength: totals.byteLength + file.byteLength,
      mpegFrameCount: totals.mpegFrameCount + file.mpegFrameCount,
      exactDurationSeconds: Number(
        (totals.exactDurationSeconds + file.exactDurationSeconds).toFixed(6),
      ),
    }),
    {
      clipCount: 0,
      byteLength: 0,
      mpegFrameCount: 0,
      exactDurationSeconds: 0,
    },
  )
  return {
    schemaVersion: 2,
    provider: 'Azure AI Speech',
    model: 'MAI-Voice-2-Flash',
    region,
    outputFormat: REPLACEMENT_PILOT_02_OUTPUT_FORMAT,
    generatedAt,
    sourceCatalog: 'src/data/menuNarrations.ts',
    experiment: {
      name: 'Set G replacement pilot 02',
      blindedFilenames: true,
      rejectedContinuousDeterminedBaselinePinned: true,
      rejectedLocalGapTrimPinned: true,
      continuousVersusSegmentationIsOnlyWithinMenuDifference: true,
    },
    copyReview: {
      catalogTextPinned: true,
      spokenTextExactlyMatchesCatalog: true,
      segmentedTextJoinsExactlyToCatalog: true,
      finalExclamationOnly: true,
      pronunciationOverrideUsed: false,
    },
    delivery: {
      explicitBreaksPerClip: 0,
      emphasisBlocksPerClip: 0,
      pronunciationOverridesPerClip: 0,
      midSentenceStyleRateOrPitchSwitch: false,
      postprocessingApplied: false,
      rawCandidatesOnly: true,
    },
    pricing: {
      environmentVariable: REPLACEMENT_PILOT_02_PRICE_CEILING_ENV,
      ceilingSource: pricingSource,
      ...pricing,
    },
    outputTotals,
    quality: {
      approximateFileDurationTargetSeconds:
        REPLACEMENT_PILOT_02_APPROX_FILE_TARGET_SECONDS,
      hardMaximumSeconds: REPLACEMENT_PILOT_02_HARD_MAX_SECONDS,
      maximumInternalGapMilliseconds:
        REPLACEMENT_PILOT_02_MAX_INTERNAL_GAP_MILLISECONDS,
      activeSpeechTargetSeconds:
        REPLACEMENT_PILOT_02_ACTIVE_SPEECH_TARGET_SECONDS,
      totalByteQa: 'sum-of-validated-positive-output-byte-lengths-recorded',
      durationAndGapFlagsAreListeningReviewSignalsOnly: true,
      activeSpeechAndInternalGapQa: 'manual-listening-and-local-analysis-required',
      activeSpeechAndInternalGapAutomaticallyMeasured: false,
      oneListenClarityAndNaturalWitRequired: true,
      pastaFinalPhraseMustNotReceiveSpecialPunch: true,
      automaticTrimNormalizationOrIntegrationAllowed: false,
      exactDurationMeasurement:
        'validated MPEG frame count * 576 samples / 24,000 Hz',
      outputIdentityPinnedInManifest: true,
    },
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip: REPLACEMENT_PILOT_02_SYNTHESIS_REQUESTS_PER_CLIP,
      totalSynthesis: plan.length,
      retries: REPLACEMENT_PILOT_02_RETRY_COUNT,
    },
    integration: {
      runtimeIntegrated: false,
      humanApprovalRequiredBeforeAnyCopyOrImport: true,
    },
    generatedFiles,
  }
}

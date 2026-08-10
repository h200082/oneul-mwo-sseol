import { createHash } from 'node:crypto'
import { TextDecoder } from 'node:util'

import { estimateMaximumCostUsd } from './azureSpeechBatch.mjs'
import { readExpressivePilotConfig } from './azureExpressivePilot.mjs'
import {
  REPLACEMENT_PILOT_02_ACTIVE_SPEECH_TARGET_SECONDS,
  REPLACEMENT_PILOT_02_APPROX_FILE_TARGET_SECONDS,
  REPLACEMENT_PILOT_02_CANDIDATES,
  REPLACEMENT_PILOT_02_HARD_MAX_SECONDS,
  REPLACEMENT_PILOT_02_MAX_INTERNAL_GAP_MILLISECONDS,
  REPLACEMENT_PILOT_02_OUTPUT_FORMAT,
  REPLACEMENT_PILOT_02_REQUIRED_REGION,
  buildReplacementPilot02Ssml,
  createReplacementPilot02Plan,
  estimateReplacementPilot02PlannedTiming,
  inspectReplacementPilot02Mp3,
  summarizeReplacementPilot02Audio,
} from './azureReplacementPilot02.mjs'

export const REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_SHORT_NAME =
  'ko-KR-Junho:MAI-Voice-2-Flash'
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME =
  'ko-KR-Junho:MAI-Voice-2'
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_MODEL = 'MAI-Voice-2'
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_REQUIRED_REGION =
  REPLACEMENT_PILOT_02_REQUIRED_REGION
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_OUTPUT_FORMAT =
  REPLACEMENT_PILOT_02_OUTPUT_FORMAT
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_PRICE_CEILING_ENV =
  'AZURE_SPEECH_MAI_VOICE_2_MAX_USD_PER_MILLION_CHARS'
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_DEFAULT_PRICE_CEILING = 20
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_SYNTHESIS_REQUESTS_PER_CLIP = 1
export const REPLACEMENT_PILOT_02_MAI_VOICE_2_RETRY_COUNT = 0

export const REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_MANIFEST = Object.freeze({
  sourceBatch: 'replacement-pilot-02',
  file: 'replacement-pilot-02-manifest.json',
  path:
    'tmp/narration-preview/replacement-pilot-02/replacement-pilot-02-manifest.json',
  byteLength: 14_487,
  sha256:
    'bc44c41f5f17cdbc9293b397e76397017eb279b25cfcc6e59b4e6a7e47399de8',
  generatedAt: '2026-08-10T02:26:37.504Z',
  schemaVersion: 2,
  model: 'MAI-Voice-2-Flash',
})

function flashSource(value) {
  return Object.freeze(value)
}

export const REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_FILES = Object.freeze([
  flashSource({
    menuId: 'pasta',
    label: 'A',
    file: 'pasta-A.mp3',
    path: 'tmp/narration-preview/replacement-pilot-02/pasta-A.mp3',
    byteLength: 45_600,
    sha256:
      '70cced3be2ac3ba5b6a02b8fe98b21f16845d6fedea8fb73f0ce876b05e381e0',
    mpegFrameCount: 95,
    exactDurationSeconds: 2.28,
  }),
  flashSource({
    menuId: 'pasta',
    label: 'B',
    file: 'pasta-B.mp3',
    path: 'tmp/narration-preview/replacement-pilot-02/pasta-B.mp3',
    byteLength: 49_920,
    sha256:
      'edb4d142066ddcc6c75d7b58ad9fbb6d2ab85d7ce562cbbdeb6a824854947431',
    mpegFrameCount: 104,
    exactDurationSeconds: 2.496,
  }),
  flashSource({
    menuId: 'bulgogi-deopbap',
    label: 'A',
    file: 'bulgogi-deopbap-A.mp3',
    path:
      'tmp/narration-preview/replacement-pilot-02/bulgogi-deopbap-A.mp3',
    byteLength: 61_920,
    sha256:
      '8e0b2b4dd9a90dadf88c16288bd904fd4535e5c75d2610c2a0eedb727312ae48',
    mpegFrameCount: 129,
    exactDurationSeconds: 3.096,
  }),
  flashSource({
    menuId: 'bulgogi-deopbap',
    label: 'B',
    file: 'bulgogi-deopbap-B.mp3',
    path:
      'tmp/narration-preview/replacement-pilot-02/bulgogi-deopbap-B.mp3',
    byteLength: 54_720,
    sha256:
      '3b1b4d08e27bbd74f5fb7d7409c5f0818736c49054f4d0dd44dd276c84443430',
    mpegFrameCount: 114,
    exactDurationSeconds: 2.736,
  }),
])

const EXPECTED_KEYS = Object.freeze([
  'pasta-A',
  'pasta-B',
  'bulgogi-deopbap-A',
  'bulgogi-deopbap-B',
])

function candidateKey(value) {
  return `${value.menuId}-${value.label}`
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function assertComparisonPlan(plan) {
  if (!Array.isArray(plan) || plan.length !== 4) {
    throw new Error('MAI-Voice-2 comparison must contain exactly four clips')
  }
  const actualKeys = plan.map(({ candidate }) => candidateKey(candidate))
  if (actualKeys.some((value, index) => value !== EXPECTED_KEYS[index])) {
    throw new Error('MAI-Voice-2 comparison candidate order changed')
  }
  for (let index = 0; index < plan.length; index += 1) {
    const item = plan[index]
    const source = REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_FILES[index]
    if (
      item.candidate !== REPLACEMENT_PILOT_02_CANDIDATES[index] ||
      item.voiceId !== 'junho' ||
      item.voiceShortName !== REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME ||
      item.relativeFile !== source.file ||
      item.flashSource !== source
    ) {
      throw new Error(`MAI-Voice-2 comparison plan changed: ${EXPECTED_KEYS[index]}`)
    }
  }
}

export function createReplacementPilot02MaiVoice2Plan() {
  const flashPlan = createReplacementPilot02Plan()
  const plan = flashPlan.map((item, index) =>
    Object.freeze({
      candidate: item.candidate,
      voiceId: 'junho',
      voiceShortName: REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME,
      relativeFile: item.relativeFile,
      flashSource: REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_FILES[index],
    }),
  )
  assertComparisonPlan(plan)
  return Object.freeze(plan)
}

export function buildReplacementPilot02MaiVoice2Ssml({
  candidate,
  voiceShortName,
}) {
  if (voiceShortName !== REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME) {
    throw new Error(`Unexpected MAI-Voice-2 voice: ${voiceShortName}`)
  }
  const flashSsml = buildReplacementPilot02Ssml({
    candidate,
    voiceShortName: REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_SHORT_NAME,
  })
  if (
    flashSsml.split(REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_SHORT_NAME)
      .length !== 2
  ) {
    throw new Error('Flash SSML must contain its exact voice ShortName once')
  }
  const comparisonSsml = flashSsml.replace(
    REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_SHORT_NAME,
    REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME,
  )
  if (
    comparisonSsml.replace(
      REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME,
      REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_SHORT_NAME,
    ) !== flashSsml
  ) {
    throw new Error('MAI-Voice-2 SSML may differ from Flash only by ShortName')
  }
  return comparisonSsml
}

export function readReplacementPilot02MaiVoice2PriceCeiling(
  environment,
  requireExplicit = false,
) {
  const raw = environment[
    REPLACEMENT_PILOT_02_MAI_VOICE_2_PRICE_CEILING_ENV
  ]?.trim()
  if (!raw && requireExplicit) {
    throw new Error(
      `Missing required environment variable: ${REPLACEMENT_PILOT_02_MAI_VOICE_2_PRICE_CEILING_ENV}`,
    )
  }
  const maximumPriceUsdPerMillionCharacters = raw
    ? Number(raw)
    : REPLACEMENT_PILOT_02_MAI_VOICE_2_DEFAULT_PRICE_CEILING
  if (
    !Number.isFinite(maximumPriceUsdPerMillionCharacters) ||
    maximumPriceUsdPerMillionCharacters <= 0
  ) {
    throw new Error(
      `${REPLACEMENT_PILOT_02_MAI_VOICE_2_PRICE_CEILING_ENV} must be a positive number`,
    )
  }
  return Object.freeze({
    maximumPriceUsdPerMillionCharacters,
    source: raw
      ? 'environment-independent-mai-voice-2-ceiling'
      : 'local-conservative-default',
  })
}

export function readReplacementPilot02MaiVoice2ExecutionConfig(environment) {
  const speech = readExpressivePilotConfig(environment)
  if (speech.region !== REPLACEMENT_PILOT_02_MAI_VOICE_2_REQUIRED_REGION) {
    throw new Error(
      `AZURE_SPEECH_REGION must be ${REPLACEMENT_PILOT_02_MAI_VOICE_2_REQUIRED_REGION} for MAI-Voice-2 comparison`,
    )
  }
  return Object.freeze({
    ...speech,
    ...readReplacementPilot02MaiVoice2PriceCeiling(environment, true),
  })
}

export function summarizeReplacementPilot02MaiVoice2Cost(
  plan,
  maximumPriceUsdPerMillionCharacters,
) {
  assertComparisonPlan(plan)
  const files = plan.map((item) => {
    const ssml = buildReplacementPilot02MaiVoice2Ssml({
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

export function validateReplacementPilot02MaiVoice2Voices(availableVoices) {
  const available = availableVoices.find(
    (voice) =>
      voice?.ShortName === REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME,
  )
  if (!available) {
    throw new Error(
      `Required Azure MAI voice is unavailable: ${REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME}`,
    )
  }
  const styles = new Set(
    Array.isArray(available.StyleList) ? available.StyleList : [],
  )
  if (!styles.has('joyful')) {
    throw new Error(
      `${REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME} does not support style: joyful`,
    )
  }
  return true
}

function assertFlashManifestDocument(manifest) {
  const flashPlan = createReplacementPilot02Plan()
  const expectedPricing = {
    environmentVariable: 'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS',
    ceilingSource: 'environment-local-official-ceiling',
    basis: 'full-ssml-unicode-code-point-upper-bound',
    ssmlCharacters: 1545,
    maximumPriceUsdPerMillionCharacters: 22,
    maximumEstimatedCostUsd: 0.03399,
    files: [
      { relativeFile: 'pasta-A.mp3', ssmlCharacters: 331 },
      { relativeFile: 'pasta-B.mp3', ssmlCharacters: 445 },
      { relativeFile: 'bulgogi-deopbap-A.mp3', ssmlCharacters: 328 },
      { relativeFile: 'bulgogi-deopbap-B.mp3', ssmlCharacters: 441 },
    ],
  }
  if (
    manifest?.schemaVersion !== 2 ||
    manifest.provider !== 'Azure AI Speech' ||
    manifest.model !== REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_MANIFEST.model ||
    manifest.region !== REPLACEMENT_PILOT_02_MAI_VOICE_2_REQUIRED_REGION ||
    manifest.outputFormat !== REPLACEMENT_PILOT_02_MAI_VOICE_2_OUTPUT_FORMAT ||
    manifest.generatedAt !==
      REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_MANIFEST.generatedAt ||
    manifest.sourceCatalog !== 'src/data/menuNarrations.ts' ||
    manifest.experiment?.name !== 'Set G replacement pilot 02' ||
    manifest.experiment?.blindedFilenames !== true ||
    manifest.experiment
      ?.continuousVersusSegmentationIsOnlyWithinMenuDifference !== true ||
    manifest.copyReview?.spokenTextExactlyMatchesCatalog !== true ||
    manifest.copyReview?.segmentedTextJoinsExactlyToCatalog !== true ||
    manifest.delivery?.explicitBreaksPerClip !== 0 ||
    manifest.delivery?.midSentenceStyleRateOrPitchSwitch !== false ||
    manifest.delivery?.postprocessingApplied !== false ||
    manifest.delivery?.rawCandidatesOnly !== true ||
    !jsonEqual(manifest.pricing, expectedPricing) ||
    !jsonEqual(manifest.outputTotals, {
      clipCount: 4,
      byteLength: 212_160,
      mpegFrameCount: 442,
      exactDurationSeconds: 10.608,
    }) ||
    manifest.quality?.automaticTrimNormalizationOrIntegrationAllowed !==
      false ||
    manifest.quality?.outputIdentityPinnedInManifest !== true ||
    manifest.requests?.voiceListPreflight !== 1 ||
    manifest.requests?.synthesisPerClip !== 1 ||
    manifest.requests?.totalSynthesis !== 4 ||
    manifest.requests?.retries !== 0 ||
    manifest.integration?.runtimeIntegrated !== false ||
    !Array.isArray(manifest.generatedFiles) ||
    manifest.generatedFiles.length !== 4
  ) {
    throw new Error('Pinned Flash manifest content mismatch')
  }

  for (let index = 0; index < flashPlan.length; index += 1) {
    const item = flashPlan[index]
    const candidate = item.candidate
    const generated = manifest.generatedFiles[index]
    const source = REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_FILES[index]
    const expectedBlocks = candidate.segments === null ? 1 : 2
    if (
      generated?.menuId !== candidate.menuId ||
      generated?.label !== candidate.label ||
      generated?.file !== item.relativeFile ||
      generated?.voiceId !== 'junho' ||
      generated?.voiceShortName !==
        REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_SHORT_NAME ||
      generated?.catalogText !== candidate.catalogText ||
      generated?.spokenText !== candidate.spokenText ||
      generated?.style !== candidate.style ||
      generated?.styleDegree !== candidate.styleDegree ||
      generated?.rate !== candidate.rate ||
      generated?.pitch !== candidate.pitch ||
      generated?.structure !== candidate.structure ||
      !jsonEqual(generated?.segments, candidate.segments) ||
      generated?.expressAsBlocks !== expectedBlocks ||
      generated?.prosodyBlocks !== expectedBlocks ||
      generated?.explicitBreaks !== 0 ||
      generated?.reviewIntent !== candidate.reviewIntent ||
      !jsonEqual(generated?.rejectedSources, candidate.rejectedSources) ||
      !jsonEqual(
        generated?.plannedTiming,
        estimateReplacementPilot02PlannedTiming(candidate),
      ) ||
      generated?.ssmlCharacters !== expectedPricing.files[index].ssmlCharacters ||
      generated?.byteLength !== source.byteLength ||
      generated?.sha256 !== source.sha256 ||
      generated?.mpegFrameCount !== source.mpegFrameCount ||
      generated?.exactDurationSeconds !== source.exactDurationSeconds
    ) {
      throw new Error(
        `Pinned Flash manifest candidate mismatch: ${EXPECTED_KEYS[index]}`,
      )
    }
  }
}

export function validateReplacementPilot02MaiVoice2FlashManifestBytes(bytes) {
  const identity = REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_MANIFEST
  if (
    bytes.byteLength !== identity.byteLength ||
    sha256(bytes) !== identity.sha256
  ) {
    throw new Error('Pinned Flash manifest byte identity mismatch')
  }
  let manifest
  try {
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new Error('Pinned Flash manifest is not valid UTF-8 JSON')
  }
  assertFlashManifestDocument(manifest)
  return Object.freeze({
    sourceBatch: identity.sourceBatch,
    file: identity.file,
    path: identity.path,
    byteLength: identity.byteLength,
    sha256: identity.sha256,
    generatedAt: identity.generatedAt,
    schemaVersion: identity.schemaVersion,
    model: identity.model,
  })
}

export function validateReplacementPilot02MaiVoice2FlashAudioIdentity({
  source,
  byteLength,
  sha256: actualSha256,
  mpegFrameCount,
  exactDurationSeconds,
}) {
  const expected = REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_FILES.find(
    (item) => item.file === source.file,
  )
  if (
    source !== expected ||
    byteLength !== expected?.byteLength ||
    actualSha256 !== expected?.sha256 ||
    mpegFrameCount !== expected?.mpegFrameCount ||
    exactDurationSeconds !== expected?.exactDurationSeconds
  ) {
    throw new Error(`Pinned Flash audio identity mismatch: ${source?.file}`)
  }
  return true
}

function assertFlashAttestation(attestation) {
  if (
    !jsonEqual(
      attestation?.manifest,
      REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_MANIFEST,
    ) ||
    !jsonEqual(
      attestation?.files,
      REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_FILES,
    )
  ) {
    throw new Error('Flash baseline attestation is incomplete or changed')
  }
}

export function inspectReplacementPilot02MaiVoice2Mp3(audio) {
  return inspectReplacementPilot02Mp3(audio)
}

export function createReplacementPilot02MaiVoice2Manifest({
  plan,
  audioResults,
  flashAttestation,
  region,
  pricing,
  pricingSource,
  generatedAt,
}) {
  assertComparisonPlan(plan)
  assertFlashAttestation(flashAttestation)
  if (region !== REPLACEMENT_PILOT_02_MAI_VOICE_2_REQUIRED_REGION) {
    throw new Error('Manifest region does not match MAI-Voice-2 comparison')
  }
  if (audioResults.length !== plan.length) {
    throw new Error('Manifest result count does not match MAI-Voice-2 plan')
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
    const candidate = item.candidate
    const blocks = candidate.segments === null ? 1 : 2
    return {
      menuId: candidate.menuId,
      label: candidate.label,
      file: item.relativeFile,
      voiceId: item.voiceId,
      voiceShortName: item.voiceShortName,
      catalogText: candidate.catalogText,
      spokenText: candidate.spokenText,
      style: candidate.style,
      styleDegree: candidate.styleDegree,
      rate: candidate.rate,
      pitch: candidate.pitch,
      structure: candidate.structure,
      segments: candidate.segments,
      expressAsBlocks: blocks,
      prosodyBlocks: blocks,
      explicitBreaks: 0,
      flashSource: item.flashSource,
      ssmlDifferenceFromFlash: {
        onlyVoiceShortNameChanged: true,
        flashVoiceShortName:
          REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_SHORT_NAME,
        comparisonVoiceShortName:
          REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME,
      },
      plannedTiming: estimateReplacementPilot02PlannedTiming(candidate),
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
    { clipCount: 0, byteLength: 0, mpegFrameCount: 0, exactDurationSeconds: 0 },
  )
  return {
    schemaVersion: 2,
    provider: 'Azure AI Speech',
    model: REPLACEMENT_PILOT_02_MAI_VOICE_2_MODEL,
    region,
    outputFormat: REPLACEMENT_PILOT_02_MAI_VOICE_2_OUTPUT_FORMAT,
    generatedAt,
    sourceCatalog: 'src/data/menuNarrations.ts',
    comparison: {
      name: 'Set G MAI-Voice-2 versus MAI-Voice-2-Flash comparison',
      onlyVoiceShortNameDiffersInSsml: true,
      exactCandidateObjectsReused: true,
      flashBaselineValidatedBeforeNetworkAndWrites: true,
      flashManifest: flashAttestation.manifest,
      flashFiles: flashAttestation.files,
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
      environmentVariable:
        REPLACEMENT_PILOT_02_MAI_VOICE_2_PRICE_CEILING_ENV,
      ceilingSource: pricingSource,
      ...pricing,
    },
    outputTotals,
    quality: {
      approximateFileDurationTargetSeconds:
        REPLACEMENT_PILOT_02_APPROX_FILE_TARGET_SECONDS,
      hardMaximumSeconds: REPLACEMENT_PILOT_02_HARD_MAX_SECONDS,
      activeSpeechTargetSeconds:
        REPLACEMENT_PILOT_02_ACTIVE_SPEECH_TARGET_SECONDS,
      maximumInternalGapMilliseconds:
        REPLACEMENT_PILOT_02_MAX_INTERNAL_GAP_MILLISECONDS,
      activeSpeechAndInternalGapQa:
        'manual-listening-and-local-analysis-required',
      activeSpeechAndInternalGapAutomaticallyMeasured: false,
      automaticTrimNormalizationOrIntegrationAllowed: false,
      exactDurationMeasurement:
        'validated MPEG frame count * 576 samples / 24,000 Hz',
      totalByteQa: 'sum-of-validated-positive-output-byte-lengths-recorded',
      outputIdentityPinnedInManifest: true,
    },
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip:
        REPLACEMENT_PILOT_02_MAI_VOICE_2_SYNTHESIS_REQUESTS_PER_CLIP,
      totalSynthesis: plan.length,
      retries: REPLACEMENT_PILOT_02_MAI_VOICE_2_RETRY_COUNT,
    },
    integration: {
      runtimeIntegrated: false,
      humanApprovalRequiredBeforeAnyCopyOrImport: true,
    },
    generatedFiles,
  }
}

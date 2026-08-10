import { createHash } from 'node:crypto'

import { escapeXml, parseNarrationCatalog } from './azureSpeechBatch.mjs'
import { inspectRemainingBatch01Mp3 } from './azureRemainingBatch01.mjs'

export const TTEOKBOKKI_ONSET_RETAKE_01_REQUIRED_REGION = 'southeastasia'
export const TTEOKBOKKI_ONSET_RETAKE_01_OUTPUT_FORMAT =
  'audio-24khz-160kbitrate-mono-mp3'
export const TTEOKBOKKI_ONSET_RETAKE_01_PRICE_ENV =
  'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS'
export const TTEOKBOKKI_ONSET_RETAKE_01_OFFICIAL_PRICE_CEILING = 22
export const TTEOKBOKKI_ONSET_RETAKE_01_RETRY_COUNT = 0

export const TTEOKBOKKI_ONSET_RETAKE_01_USER_QUOTE =
  '떡볶이는 앞에 "떡볶"이가 안들리고 앞부분이 짤린거 같아. 떡볶이는 짤린거 말고는 괜찮아. 햄버거는 햄부기 3번 반복하는데 더 빠르게 반복해줘. 이 둘 말고는 괜찮아'

export const TTEOKBOKKI_ONSET_RETAKE_01_SOURCE_PINS = Object.freeze({
  catalog: Object.freeze({
    path: 'src/data/menuNarrations.ts',
    byteLength: 13_780,
    sha256:
      'cd499819aa43a3c9bd97b4f4b1051d631f99ef6d7ebe461a1fb5e40d6ca196ca',
  }),
  activeAudioIds: Object.freeze({
    path: 'src/data/menuNarrationAudioIds.ts',
    byteLength: 923,
    sha256:
      'c0030a57f2fa71439c19643f99923d10f11db537beb431dc1a34e2b45b9aca3e',
  }),
  rejectedRaw: Object.freeze({
    path: 'tmp/narration-preview/remaining-batch-01/tteokbokki.mp3',
    byteLength: 64_800,
    sha256:
      'e7d000e53d5623674c4d3054cb225df484728c49eea192afa4527e6ccfa611b7',
    mpegFrameCount: 135,
    exactDurationSeconds: 3.24,
  }),
  parentManifest: Object.freeze({
    path:
      'tmp/narration-preview/remaining-batch-01/remaining-batch-01-manifest.json',
    byteLength: 42_007,
    sha256:
      'c2a6a2846c37a76c1fcf4a8e7f1e7f6255248d007d0712288ec934736cbf107e',
    schemaVersion: 2,
  }),
})

const COMMON_PERFORMANCE = Object.freeze({
  menuId: 'tteokbokki',
  tone: 'alert',
  catalogText: '떡볶이 포획! 쿨피스 지원 요청!',
  spokenText: '떡볶이 포획! 쿨피스 지원 요청!',
  modelId: 'flash',
  model: 'MAI-Voice-2-Flash',
  voiceId: 'haena',
  voiceShortName: 'ko-KR-Haena:MAI-Voice-2-Flash',
  style: 'joyful',
  styleDegree: 0.5,
  pitch: '-1%',
  structure: 'adjacent-two-block',
  segments: Object.freeze(['떡볶이 포획! ', '쿨피스 지원 요청!']),
  leadingBreakMilliseconds: 100,
  brandReview: 'metadata-only',
  synthesisAllowed: true,
})

export const TTEOKBOKKI_ONSET_RETAKE_01_CANDIDATES = Object.freeze([
  Object.freeze({
    ...COMMON_PERFORMANCE,
    candidateId: 'A',
    relativeFile: 'A.mp3',
    rates: Object.freeze(['+22%', '+22%']),
  }),
  Object.freeze({
    ...COMMON_PERFORMANCE,
    candidateId: 'B',
    relativeFile: 'B.mp3',
    rates: Object.freeze(['+12%', '+22%']),
  }),
])

function validatePinnedBytes(bytes, pin, label) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`${label} source must be bytes`)
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (bytes.byteLength !== pin.byteLength || sha256 !== pin.sha256) {
    throw new Error(`${label} source identity changed`)
  }
  return Object.freeze({ ...pin })
}

function parseActiveAudioIds(source) {
  const match =
    /export const MENU_NARRATION_AUDIO_IDS = \[([\s\S]*?)\]\s+as const/u.exec(
      source,
    )
  if (!match?.[1]) throw new Error('Could not parse active narration audio IDs')
  const ids = [...match[1].matchAll(/'([a-z0-9-]+)'/g)].map(
    (entry) => entry[1],
  )
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error('Active narration audio IDs are empty or duplicated')
  }
  return ids
}

function assertCandidate(candidate) {
  const expectedRates = candidate.candidateId === 'A'
    ? ['+22%', '+22%']
    : ['+12%', '+22%']
  if (
    !['A', 'B'].includes(candidate.candidateId) ||
    candidate.relativeFile !== `${candidate.candidateId}.mp3` ||
    candidate.menuId !== COMMON_PERFORMANCE.menuId ||
    candidate.tone !== COMMON_PERFORMANCE.tone ||
    candidate.catalogText !== COMMON_PERFORMANCE.catalogText ||
    candidate.spokenText !== candidate.catalogText ||
    candidate.modelId !== 'flash' ||
    candidate.model !== 'MAI-Voice-2-Flash' ||
    candidate.voiceId !== 'haena' ||
    candidate.voiceShortName !== 'ko-KR-Haena:MAI-Voice-2-Flash' ||
    candidate.style !== 'joyful' ||
    candidate.styleDegree !== 0.5 ||
    candidate.pitch !== '-1%' ||
    candidate.structure !== 'adjacent-two-block' ||
    candidate.segments.length !== 2 ||
    candidate.segments.join('') !== candidate.catalogText ||
    candidate.leadingBreakMilliseconds !== 100 ||
    candidate.brandReview !== 'metadata-only' ||
    candidate.synthesisAllowed !== true ||
    candidate.rates.length !== 2 ||
    candidate.rates.some((rate, index) => rate !== expectedRates[index])
  ) {
    throw new Error('Tteokbokki onset retake candidate changed')
  }
}

export function validateTteokbokkiOnsetRetake01Sources({
  catalogBytes,
  activeAudioIdsBytes,
  rejectedRawBytes,
  parentManifestBytes,
}) {
  const catalogPin = validatePinnedBytes(
    catalogBytes,
    TTEOKBOKKI_ONSET_RETAKE_01_SOURCE_PINS.catalog,
    'Narration catalog',
  )
  const activeAudioIdsPin = validatePinnedBytes(
    activeAudioIdsBytes,
    TTEOKBOKKI_ONSET_RETAKE_01_SOURCE_PINS.activeAudioIds,
    'Active audio IDs',
  )
  const rejectedRawPin = validatePinnedBytes(
    rejectedRawBytes,
    TTEOKBOKKI_ONSET_RETAKE_01_SOURCE_PINS.rejectedRaw,
    'Rejected tteokbokki raw audio',
  )
  const parentManifestPin = validatePinnedBytes(
    parentManifestBytes,
    TTEOKBOKKI_ONSET_RETAKE_01_SOURCE_PINS.parentManifest,
    'Parent remaining-batch manifest',
  )
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const catalog = parseNarrationCatalog(decoder.decode(catalogBytes))
  const activeAudioIds = parseActiveAudioIds(
    decoder.decode(activeAudioIdsBytes),
  )
  const current = catalog.find(({ menuId }) => menuId === 'tteokbokki')
  for (const candidate of TTEOKBOKKI_ONSET_RETAKE_01_CANDIDATES) {
    assertCandidate(candidate)
  }
  if (
    !current ||
    current.text !== COMMON_PERFORMANCE.catalogText ||
    current.tone !== COMMON_PERFORMANCE.tone
  ) {
    throw new Error('Tteokbokki current catalog copy or tone changed')
  }
  if (activeAudioIds.length !== 41 || activeAudioIds.includes('tteokbokki')) {
    throw new Error('Tteokbokki must remain inactive before listening approval')
  }
  const rejectedInspection = inspectRemainingBatch01Mp3(rejectedRawBytes)
  if (
    rejectedInspection.mpegFrameCount !== rejectedRawPin.mpegFrameCount ||
    rejectedInspection.exactDurationSeconds !==
      rejectedRawPin.exactDurationSeconds
  ) {
    throw new Error('Rejected tteokbokki raw MPEG identity changed')
  }
  const parentManifest = JSON.parse(decoder.decode(parentManifestBytes))
  const rejectedEntry = parentManifest.generatedFiles?.find(
    ({ menuId }) => menuId === 'tteokbokki',
  )
  if (
    parentManifest.schemaVersion !== 2 ||
    rejectedEntry?.catalogText !== COMMON_PERFORMANCE.catalogText ||
    rejectedEntry?.byteLength !== rejectedRawPin.byteLength ||
    rejectedEntry?.sha256 !== rejectedRawPin.sha256 ||
    rejectedEntry?.mpegFrameCount !== rejectedRawPin.mpegFrameCount ||
    rejectedEntry?.exactDurationSeconds !== rejectedRawPin.exactDurationSeconds
  ) {
    throw new Error('Rejected tteokbokki parent manifest lineage changed')
  }
  return Object.freeze({
    catalogPin,
    activeAudioIdsPin,
    rejectedRawPin,
    parentManifestPin,
    activeAudioIds: Object.freeze(activeAudioIds),
    current: Object.freeze(current),
  })
}

export function createTteokbokkiOnsetRetake01Plan() {
  for (const candidate of TTEOKBOKKI_ONSET_RETAKE_01_CANDIDATES) {
    assertCandidate(candidate)
  }
  return TTEOKBOKKI_ONSET_RETAKE_01_CANDIDATES
}

export function buildTteokbokkiOnsetRetake01Ssml(candidate) {
  assertCandidate(candidate)
  const blocks = candidate.segments.map(
    (segment, index) =>
      `<mstts:express-as style="${candidate.style}" styledegree="${candidate.styleDegree}"><prosody rate="${candidate.rates[index]}" pitch="${candidate.pitch}">${escapeXml(segment)}</prosody></mstts:express-as>`,
  )
  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ko-KR">',
    `<voice xml:lang="ko-KR" name="${escapeXml(candidate.voiceShortName)}">`,
    '<break time="100ms"/>',
    ...blocks,
    '</voice>',
    '</speak>',
  ].join('')
}

export function validateTteokbokkiOnsetRetake01Voice(availableVoices) {
  const voice = availableVoices.find(
    ({ ShortName }) =>
      ShortName === TTEOKBOKKI_ONSET_RETAKE_01_CANDIDATES[0].voiceShortName,
  )
  if (!voice) throw new Error('Required tteokbokki MAI voice is unavailable')
  if (!Array.isArray(voice.StyleList) || !voice.StyleList.includes('joyful')) {
    throw new Error('Required tteokbokki joyful style is unavailable')
  }
  return true
}

export function readTteokbokkiOnsetRetake01PriceCeiling(environment) {
  const raw = environment[TTEOKBOKKI_ONSET_RETAKE_01_PRICE_ENV]?.trim()
  if (!raw) {
    throw new Error(`${TTEOKBOKKI_ONSET_RETAKE_01_PRICE_ENV} is required`)
  }
  const value = Number(raw)
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > TTEOKBOKKI_ONSET_RETAKE_01_OFFICIAL_PRICE_CEILING
  ) {
    throw new Error(
      `${TTEOKBOKKI_ONSET_RETAKE_01_PRICE_ENV} must be > 0 and <= ${TTEOKBOKKI_ONSET_RETAKE_01_OFFICIAL_PRICE_CEILING}`,
    )
  }
  return value
}

export function readTteokbokkiOnsetRetake01ExecutionConfig(environment) {
  const key = environment.AZURE_SPEECH_KEY?.trim()
  const region = environment.AZURE_SPEECH_REGION?.trim().toLowerCase()
  if (!key) throw new Error('AZURE_SPEECH_KEY is required')
  if (!/^[\x21-\x7e]+$/.test(key)) {
    throw new Error('AZURE_SPEECH_KEY must contain only printable ASCII')
  }
  if (region !== TTEOKBOKKI_ONSET_RETAKE_01_REQUIRED_REGION) {
    throw new Error(
      `AZURE_SPEECH_REGION must be ${TTEOKBOKKI_ONSET_RETAKE_01_REQUIRED_REGION}`,
    )
  }
  return Object.freeze({
    key,
    region,
    maximumUsdPerMillionCharacters:
      readTteokbokkiOnsetRetake01PriceCeiling(environment),
  })
}

export function summarizeTteokbokkiOnsetRetake01Cost(
  plan,
  maximumUsdPerMillionCharacters,
) {
  if (plan.length !== 2) {
    throw new Error('Tteokbokki onset retake must have two clips')
  }
  const ssmlCharacters = plan.reduce(
    (total, candidate) =>
      total + Array.from(buildTteokbokkiOnsetRetake01Ssml(candidate)).length,
    0,
  )
  return Object.freeze({
    ssmlCharacters,
    maximumUsdPerMillionCharacters,
    maximumEstimatedCostUsd:
      (ssmlCharacters * maximumUsdPerMillionCharacters) / 1_000_000,
  })
}

function assertInspection(inspection) {
  if (
    !inspection ||
    !Number.isInteger(inspection.byteLength) ||
    inspection.byteLength <= 0 ||
    !/^[a-f0-9]{64}$/.test(inspection.sha256) ||
    !Number.isInteger(inspection.mpegFrameCount) ||
    inspection.mpegFrameCount <= 0 ||
    !Number.isFinite(inspection.exactDurationSeconds) ||
    inspection.exactDurationSeconds <= 0
  ) {
    throw new Error('Tteokbokki onset retake MP3 inspection is invalid')
  }
}

export function createTteokbokkiOnsetRetake01Manifest({
  sourceAttestation,
  audioResults,
  pricing,
  generatedAt,
}) {
  const plan = createTteokbokkiOnsetRetake01Plan()
  if (audioResults.length !== plan.length) {
    throw new Error('Tteokbokki onset retake output count is invalid')
  }
  for (const result of audioResults) assertInspection(result)
  return {
    schemaVersion: 2,
    provider: 'Azure AI Speech',
    batch: 'tteokbokki-onset-retake-01',
    region: TTEOKBOKKI_ONSET_RETAKE_01_REQUIRED_REGION,
    outputFormat: TTEOKBOKKI_ONSET_RETAKE_01_OUTPUT_FORMAT,
    generatedAt,
    userFeedback: { statement: TTEOKBOKKI_ONSET_RETAKE_01_USER_QUOTE },
    sourcePins: {
      catalog: sourceAttestation.catalogPin,
      activeAudioIds: sourceAttestation.activeAudioIdsPin,
      rejectedRaw: sourceAttestation.rejectedRawPin,
      parentManifest: sourceAttestation.parentManifestPin,
      tteokbokkiInactiveBeforeListening: true,
    },
    candidates: plan,
    delivery: {
      oneVoicePerClip: true,
      expressAsPerClip: 2,
      prosodyPerClip: 2,
      leadingBreakMilliseconds: 100,
      leadingBreakPerClip: 1,
      otherBreaksPerClip: 0,
      subTagsUsed: false,
      phonemeTagsUsed: false,
      emphasisTagsUsed: false,
      voiceSwitchesPerClip: 0,
      onlyAbVariable: 'first-block-rate',
    },
    pricing,
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip: 1,
      totalSynthesisRequests: 2,
      retries: TTEOKBOKKI_ONSET_RETAKE_01_RETRY_COUNT,
    },
    generatedFiles: plan.map((candidate, index) => ({
      candidateId: candidate.candidateId,
      menuId: candidate.menuId,
      file: candidate.relativeFile,
      rates: candidate.rates,
      ...audioResults[index],
    })),
    listeningQa: {
      decodedLeadingHeadTargetMilliseconds: Object.freeze([110, 180]),
      completeTteokbokkiWordHumanReviewRequired: true,
      automaticLexicalAlignmentUsed: false,
    },
    outputQa: {
      totalByteLength: audioResults.reduce(
        (total, result) => total + result.byteLength,
        0,
      ),
      outputIdentityPinnedInManifest: true,
      exactDurationMeasurement:
        'validated MPEG frame count * 576 samples / 24,000 Hz',
      postprocessingApplied: false,
      runtimeIntegrationAttempted: false,
      listeningReviewRequired: true,
    },
  }
}

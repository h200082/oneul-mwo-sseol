import { escapeXml } from './azureSpeechBatch.mjs'
import { EXPRESSIVE_PILOT_VOICES } from './azureExpressivePilot.mjs'
import { APPROVED_RETAKE_TEXT_OVERRIDES } from './azureExpressiveRetakes.mjs'

export const RAMYEON_SOFT_RETAKE_TEXT =
  APPROVED_RETAKE_TEXT_OVERRIDES.ramyeon

export const RAMYEON_SOFT_RETAKE_CATALOG_TEXT =
  RAMYEON_SOFT_RETAKE_TEXT

export const RAMYEON_SOFT_RETAKE_QUALITY_TARGET_SECONDS = Object.freeze({
  minimum: 1.6,
  maximum: 2.2,
})

export const AZURE_MAI_MP3_BYTES_PER_SECOND = 20_000

const haenaVoice = EXPRESSIVE_PILOT_VOICES.find(
  ({ id }) => id === 'haena',
)

if (haenaVoice === undefined) {
  throw new Error('Haena MAI voice configuration is missing')
}

export const RAMYEON_SOFT_RETAKE_VOICE = Object.freeze({
  id: haenaVoice.id,
  shortName: haenaVoice.shortName,
})

export const RAMYEON_SOFT_RETAKE_VARIANTS = Object.freeze([
  Object.freeze({
    menuId: 'ramyeon',
    takeId: 'soft-excited',
    voiceId: 'haena',
    text: RAMYEON_SOFT_RETAKE_TEXT,
    setupText: '현기증 오기 전에',
    punchText: '끓여 와 줘!',
    setupStyle: 'excited',
    punchStyle: 'excited',
    setupStyleDegree: 1.1,
    punchStyleDegree: 1.3,
    setupRate: '+72%',
    setupPitch: '+0%',
    punchRate: '+82%',
    punchPitch: '+1%',
    breakMs: 35,
  }),
  Object.freeze({
    menuId: 'ramyeon',
    takeId: 'happy-hurry',
    voiceId: 'haena',
    text: RAMYEON_SOFT_RETAKE_TEXT,
    setupText: '현기증 오기 전에',
    punchText: '끓여 와 줘!',
    setupStyle: 'happy',
    punchStyle: 'happy',
    setupStyleDegree: 1.2,
    punchStyleDegree: 1.4,
    setupRate: '+68%',
    setupPitch: '+0%',
    punchRate: '+78%',
    punchPitch: '+1%',
    breakMs: 40,
  }),
])

const SUPPORTED_STYLES = new Set(['excited', 'happy'])

function assertSignedPercent(value, label) {
  const match = /^([+-])(\d+)%$/.exec(value)
  if (!match) throw new Error(`${label} must be a signed percentage`)
  if (Number(match[2]) > 100) {
    throw new Error(`${label} must not exceed 100%`)
  }
}

function assertStyleDegree(value, label) {
  if (!Number.isFinite(value) || value < 0.01 || value > 2) {
    throw new Error(`${label} must be between 0.01 and 2`)
  }
}

function assertSoftRetakeVariant(variant) {
  if (variant.menuId !== 'ramyeon') {
    throw new Error(`Unexpected soft retake menu: ${variant.menuId}`)
  }
  if (variant.voiceId !== RAMYEON_SOFT_RETAKE_VOICE.id) {
    throw new Error(`Unexpected soft retake voice: ${variant.voiceId}`)
  }
  if (!/^[a-z0-9-]+$/.test(variant.takeId)) {
    throw new Error(`Invalid soft retake id: ${variant.takeId}`)
  }
  if (variant.text !== RAMYEON_SOFT_RETAKE_TEXT) {
    throw new Error('Soft retake copy does not match the approved text')
  }
  if (!variant.setupText.trim() || !variant.punchText.trim()) {
    throw new Error('Soft retake acting beats must not be empty')
  }
  for (const key of ['setupStyle', 'punchStyle']) {
    if (!SUPPORTED_STYLES.has(variant[key])) {
      throw new Error(`Unsupported ${key}: ${variant[key]}`)
    }
  }
  assertStyleDegree(variant.setupStyleDegree, 'setupStyleDegree')
  assertStyleDegree(variant.punchStyleDegree, 'punchStyleDegree')
  for (const key of [
    'setupRate',
    'setupPitch',
    'punchRate',
    'punchPitch',
  ]) {
    assertSignedPercent(variant[key], key)
  }
  if (!Number.isInteger(variant.breakMs) || variant.breakMs < 0) {
    throw new Error('breakMs must be a non-negative integer')
  }
}

function assertExactlyTwoUniqueVariants(variants) {
  if (variants.length !== 2) {
    throw new Error('Ramyeon soft retake must contain exactly two variants')
  }
  if (new Set(variants.map(({ takeId }) => takeId)).size !== 2) {
    throw new Error('Ramyeon soft retake IDs must be unique')
  }
}

export function selectRamyeonSoftRetakeVariants(catalog) {
  const ramyeon = catalog.find(({ menuId }) => menuId === 'ramyeon')
  if (ramyeon === undefined) {
    throw new Error('Narration catalog is missing ramyeon')
  }
  if (ramyeon.text !== RAMYEON_SOFT_RETAKE_CATALOG_TEXT) {
    throw new Error('Ramyeon catalog text changed; review the approved retake copy')
  }

  assertExactlyTwoUniqueVariants(RAMYEON_SOFT_RETAKE_VARIANTS)
  for (const variant of RAMYEON_SOFT_RETAKE_VARIANTS) {
    assertSoftRetakeVariant(variant)
  }
  return RAMYEON_SOFT_RETAKE_VARIANTS
}

export function createRamyeonSoftRetakePlan(
  variants = RAMYEON_SOFT_RETAKE_VARIANTS,
) {
  assertExactlyTwoUniqueVariants(variants)
  return variants.map((variant) => {
    assertSoftRetakeVariant(variant)
    return Object.freeze({
      variant,
      voiceId: RAMYEON_SOFT_RETAKE_VOICE.id,
      voiceShortName: RAMYEON_SOFT_RETAKE_VOICE.shortName,
      relativeFile: `ramyeon/${variant.takeId}-haena.mp3`,
    })
  })
}

export function buildRamyeonSoftRetakeSsml({ variant, voiceShortName }) {
  assertSoftRetakeVariant(variant)
  if (voiceShortName !== RAMYEON_SOFT_RETAKE_VOICE.shortName) {
    throw new Error('Ramyeon soft retakes require the approved Haena voice')
  }

  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ko-KR">',
    `<voice xml:lang="ko-KR" name="${escapeXml(voiceShortName)}">`,
    `<mstts:express-as style="${variant.setupStyle}" styledegree="${variant.setupStyleDegree}">`,
    `<prosody rate="${variant.setupRate}" pitch="${variant.setupPitch}">${escapeXml(variant.setupText)}</prosody>`,
    '</mstts:express-as>',
    `<break time="${variant.breakMs}ms"/>`,
    `<mstts:express-as style="${variant.punchStyle}" styledegree="${variant.punchStyleDegree}">`,
    `<prosody rate="${variant.punchRate}" pitch="${variant.punchPitch}">${escapeXml(variant.punchText)}</prosody>`,
    '</mstts:express-as>',
    '</voice>',
    '</speak>',
  ].join('')
}

export function validateRamyeonSoftRetakeVoice(
  availableVoices,
  variants = RAMYEON_SOFT_RETAKE_VARIANTS,
) {
  assertExactlyTwoUniqueVariants(variants)
  const available = availableVoices.find(
    (voice) => voice?.ShortName === RAMYEON_SOFT_RETAKE_VOICE.shortName,
  )
  if (!available) {
    throw new Error(
      `Required Azure MAI voice is unavailable: ${RAMYEON_SOFT_RETAKE_VOICE.shortName}`,
    )
  }

  const requiredStyles = new Set()
  for (const variant of variants) {
    assertSoftRetakeVariant(variant)
    requiredStyles.add(variant.setupStyle)
    requiredStyles.add(variant.punchStyle)
  }
  const supportedStyles = new Set(
    Array.isArray(available.StyleList) ? available.StyleList : [],
  )
  for (const style of requiredStyles) {
    if (!supportedStyles.has(style)) {
      throw new Error(
        `${RAMYEON_SOFT_RETAKE_VOICE.shortName} does not support style: ${style}`,
      )
    }
  }
  return true
}

export function summarizeRamyeonSoftRetakeAudio(byteLength) {
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    throw new Error('Azure MAI MP3 byte length must be a positive integer')
  }
  const approxDurationSeconds = byteLength / AZURE_MAI_MP3_BYTES_PER_SECOND
  const durationWithinTarget =
    approxDurationSeconds >=
      RAMYEON_SOFT_RETAKE_QUALITY_TARGET_SECONDS.minimum &&
    approxDurationSeconds <=
      RAMYEON_SOFT_RETAKE_QUALITY_TARGET_SECONDS.maximum

  return Object.freeze({
    approxDurationSeconds,
    durationWithinTarget,
  })
}

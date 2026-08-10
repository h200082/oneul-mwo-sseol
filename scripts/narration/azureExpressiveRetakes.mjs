import { escapeXml } from './azureSpeechBatch.mjs'
import { EXPRESSIVE_PILOT_VOICES } from './azureExpressivePilot.mjs'

export const EXPRESSIVE_RETAKE_MENU_IDS = Object.freeze([
  'budae-jjigae',
  'yukgaejang',
  'ramyeon',
])

export const APPROVED_RETAKE_TEXT_OVERRIDES = Object.freeze({
  ramyeon: '현기증 오기 전에 끓여 와 줘!',
})

export const EXPRESSIVE_RETAKE_VARIANTS = Object.freeze([
  Object.freeze({
    menuId: 'budae-jjigae',
    takeId: 'radio-command',
    voiceId: 'junho',
    text: '라면사리, 증원 요청!',
    setupText: '라면사리',
    punchText: '증원 요청!',
    setupStyle: 'excited',
    punchStyle: 'determined',
    setupStyleDegree: 1.35,
    punchStyleDegree: 1.9,
    setupRate: '+28%',
    setupPitch: '+2%',
    punchRate: '+42%',
    punchPitch: '+4%',
    breakMs: 45,
  }),
  Object.freeze({
    menuId: 'budae-jjigae',
    takeId: 'arcade-alarm',
    voiceId: 'junho',
    text: '라면사리, 증원 요청!',
    setupText: '라면사리',
    punchText: '증원 요청!',
    setupStyle: 'determined',
    punchStyle: 'excited',
    setupStyleDegree: 1.2,
    punchStyleDegree: 1.9,
    setupRate: '+34%',
    setupPitch: '+0%',
    punchRate: '+50%',
    punchPitch: '+5%',
    breakMs: 35,
  }),
  Object.freeze({
    menuId: 'yukgaejang',
    takeId: 'haena-rally',
    voiceId: 'haena',
    text: '입은 후퇴, 숟가락은 전진!',
    setupText: '입은 후퇴',
    punchText: '숟가락은 전진!',
    setupStyle: 'excited',
    punchStyle: 'determined',
    setupStyleDegree: 1.35,
    punchStyleDegree: 1.9,
    setupRate: '+45%',
    setupPitch: '+3%',
    punchRate: '+62%',
    punchPitch: '+5%',
    breakMs: 45,
  }),
  Object.freeze({
    menuId: 'yukgaejang',
    takeId: 'junho-command',
    voiceId: 'junho',
    text: '입은 후퇴, 숟가락은 전진!',
    setupText: '입은 후퇴',
    punchText: '숟가락은 전진!',
    setupStyle: 'excited',
    punchStyle: 'determined',
    setupStyleDegree: 1.4,
    punchStyleDegree: 1.95,
    setupRate: '+55%',
    setupPitch: '+2%',
    punchRate: '+72%',
    punchPitch: '+5%',
    breakMs: 35,
  }),
  Object.freeze({
    menuId: 'ramyeon',
    takeId: 'hungry-rush',
    voiceId: 'haena',
    text: '현기증 오기 전에 끓여 와 줘!',
    setupText: '현기증 오기 전에',
    punchText: '끓여 와 줘!',
    setupStyle: 'excited',
    punchStyle: 'excited',
    setupStyleDegree: 1.5,
    punchStyleDegree: 1.95,
    setupRate: '+90%',
    setupPitch: '+4%',
    punchRate: '+100%',
    punchPitch: '+7%',
    breakMs: 25,
  }),
  Object.freeze({
    menuId: 'ramyeon',
    takeId: 'come-here-punch',
    voiceId: 'haena',
    text: '현기증 오기 전에 끓여 와 줘!',
    setupText: '현기증 오기 전에 끓여',
    punchText: '와 줘!',
    setupStyle: 'excited',
    punchStyle: 'determined',
    setupStyleDegree: 1.65,
    punchStyleDegree: 1.9,
    setupRate: '+100%',
    setupPitch: '+5%',
    punchRate: '+70%',
    punchPitch: '+2%',
    breakMs: 25,
  }),
])

const SUPPORTED_STYLES = new Set(['determined', 'excited'])
const VOICE_BY_ID = new Map(
  EXPRESSIVE_PILOT_VOICES.map((voice) => [voice.id, voice]),
)

function assertSignedPercent(value, label) {
  const match = /^([+-])(\d+)%$/.exec(value)
  if (!match) throw new Error(`${label} must be a signed percentage`)
  const amount = Number(match[2])
  if (amount > 100) throw new Error(`${label} must not exceed 100%`)
}

function assertStyleDegree(value, label) {
  if (!Number.isFinite(value) || value < 0.01 || value > 2) {
    throw new Error(`${label} must be between 0.01 and 2`)
  }
}

function assertRetakeVariant(variant) {
  if (!EXPRESSIVE_RETAKE_MENU_IDS.includes(variant.menuId)) {
    throw new Error(`Unexpected retake menu: ${variant.menuId}`)
  }
  if (!/^[a-z0-9-]+$/.test(variant.takeId)) {
    throw new Error(`Invalid retake id: ${variant.takeId}`)
  }
  if (!VOICE_BY_ID.has(variant.voiceId)) {
    throw new Error(`Unknown retake voice: ${variant.voiceId}`)
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

export function selectExpressiveRetakeVariants(catalog) {
  const narrationById = new Map(catalog.map((item) => [item.menuId, item]))
  for (const menuId of EXPRESSIVE_RETAKE_MENU_IDS) {
    if (!narrationById.has(menuId)) {
      throw new Error(`Narration catalog is missing ${menuId}`)
    }
  }
  for (const variant of EXPRESSIVE_RETAKE_VARIANTS) {
    assertRetakeVariant(variant)
    const catalogText = narrationById.get(variant.menuId).text
    const approvedText =
      APPROVED_RETAKE_TEXT_OVERRIDES[variant.menuId] ?? catalogText
    if (variant.text !== approvedText) {
      throw new Error(`Retake copy does not match approval for ${variant.menuId}`)
    }
  }
  return EXPRESSIVE_RETAKE_VARIANTS
}

export function createExpressiveRetakePlan(
  variants = EXPRESSIVE_RETAKE_VARIANTS,
) {
  return variants.map((variant) => {
    assertRetakeVariant(variant)
    const voice = VOICE_BY_ID.get(variant.voiceId)
    return Object.freeze({
      variant,
      voiceId: voice.id,
      voiceShortName: voice.shortName,
      relativeFile: `${variant.menuId}/${variant.takeId}-${voice.id}.mp3`,
    })
  })
}

export function buildExpressiveRetakeSsml({ variant, voiceShortName }) {
  assertRetakeVariant(variant)
  if (!/^[A-Za-z0-9:-]+$/.test(voiceShortName)) {
    throw new Error('Azure MAI voice name contains unsupported characters')
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

export function validateExpressiveRetakeVoices(
  availableVoices,
  variants = EXPRESSIVE_RETAKE_VARIANTS,
) {
  const requirements = new Map()
  for (const variant of variants) {
    assertRetakeVariant(variant)
    const voice = VOICE_BY_ID.get(variant.voiceId)
    const styles = requirements.get(voice.shortName) ?? new Set()
    styles.add(variant.setupStyle)
    styles.add(variant.punchStyle)
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

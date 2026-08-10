import {
  escapeXml,
  parseCliArgs,
  sanitizeAzureSpeechErrorDetail,
} from './azureSpeechBatch.mjs'

export const AZURE_MAI_OUTPUT_FORMAT =
  'audio-24khz-160kbitrate-mono-mp3'

export const EXPRESSIVE_PILOT_VOICES = Object.freeze([
  Object.freeze({
    id: 'haena',
    shortName: 'ko-KR-Haena:MAI-Voice-2-Flash',
  }),
  Object.freeze({
    id: 'junho',
    shortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
  }),
])

export const EXPRESSIVE_PILOT_LINES = Object.freeze([
  Object.freeze({
    menuId: 'kimchi-jjigae',
    text: '밥 한 공기론 합의 불가!',
    setupText: '밥 한 공기론',
    punchText: '합의 불가!',
    style: 'determined',
    setupStyleDegree: 0.8,
    punchStyleDegree: 1.45,
    setupRate: '+4%',
    setupPitch: '-2%',
    punchRate: '+12%',
    punchPitch: '+1%',
    breakMs: 160,
  }),
  Object.freeze({
    menuId: 'budae-jjigae',
    text: '라면사리, 증원 요청!',
    setupText: '라면사리',
    punchText: '증원 요청!',
    style: 'determined',
    setupStyleDegree: 1,
    punchStyleDegree: 1.5,
    setupRate: '+10%',
    setupPitch: '+1%',
    punchRate: '+16%',
    punchPitch: '+3%',
    breakMs: 90,
  }),
  Object.freeze({
    menuId: 'yukgaejang',
    text: '입은 후퇴, 숟가락은 전진!',
    setupText: '입은 후퇴',
    punchText: '숟가락은 전진!',
    style: 'determined',
    setupStyleDegree: 0.85,
    punchStyleDegree: 1.55,
    setupRate: '+8%',
    setupPitch: '-2%',
    punchRate: '+15%',
    punchPitch: '+3%',
    breakMs: 120,
  }),
  Object.freeze({
    menuId: 'ramyeon',
    text: '현기증 오기 전에 끓여 와 줘!',
    setupText: '현기증 오기 전에',
    punchText: '끓여 와 줘!',
    style: 'excited',
    setupStyleDegree: 1.2,
    punchStyleDegree: 1.65,
    setupRate: '+15%',
    setupPitch: '+2%',
    punchRate: '+20%',
    punchPitch: '+5%',
    breakMs: 70,
  }),
  Object.freeze({
    menuId: 'pasta',
    text: '이탈리아는 몰라도 돌돌은 안다!',
    setupText: '이탈리아는 몰라도',
    punchText: '돌돌은 안다!',
    style: 'joyful',
    setupStyleDegree: 0.9,
    punchStyleDegree: 1.45,
    setupRate: '+8%',
    setupPitch: '+1%',
    punchRate: '+14%',
    punchPitch: '+4%',
    breakMs: 160,
  }),
  Object.freeze({
    menuId: 'shabu-shabu',
    text: '고기 목욕, 삼 초 컷!',
    setupText: '고기 목욕',
    punchText: '삼 초 컷!',
    style: 'excited',
    setupStyleDegree: 0.95,
    punchStyleDegree: 1.5,
    setupRate: '+8%',
    setupPitch: '+2%',
    punchRate: '+18%',
    punchPitch: '+4%',
    breakMs: 100,
  }),
])

const SUPPORTED_STYLES = new Set([
  'determined',
  'excited',
  'joyful',
])

function assertPercentValue(value, label) {
  if (!/^[+-]\d+%$/.test(value)) {
    throw new Error(`${label} must be a signed percentage`)
  }
}

function assertStyleDegree(value, label) {
  if (!Number.isFinite(value) || value < 0.01 || value > 2) {
    throw new Error(`${label} must be between 0.01 and 2`)
  }
}

function assertPilotLine(line) {
  if (!SUPPORTED_STYLES.has(line.style)) {
    throw new Error(`Unsupported expressive style: ${line.style}`)
  }
  if (!Number.isInteger(line.breakMs) || line.breakMs < 70 || line.breakMs > 180) {
    throw new Error(`Invalid comedy break for ${line.menuId}`)
  }
  assertStyleDegree(line.setupStyleDegree, 'setupStyleDegree')
  assertStyleDegree(line.punchStyleDegree, 'punchStyleDegree')
  assertPercentValue(line.setupRate, 'setupRate')
  assertPercentValue(line.setupPitch, 'setupPitch')
  assertPercentValue(line.punchRate, 'punchRate')
  assertPercentValue(line.punchPitch, 'punchPitch')
}

export function selectExpressivePilotLines(catalog) {
  const byMenuId = new Map(catalog.map((entry) => [entry.menuId, entry]))

  return EXPRESSIVE_PILOT_LINES.map((line) => {
    assertPilotLine(line)
    const current = byMenuId.get(line.menuId)
    if (current === undefined) {
      throw new Error(`Expressive pilot narration is missing: ${line.menuId}`)
    }
    if (current.text !== line.text) {
      throw new Error(`Expressive pilot text is stale: ${line.menuId}`)
    }
    return line
  })
}

export function createExpressivePilotMatrix(lines = EXPRESSIVE_PILOT_LINES) {
  return EXPRESSIVE_PILOT_VOICES.flatMap((voice) =>
    lines.map((line) =>
      Object.freeze({
        voiceId: voice.id,
        voiceShortName: voice.shortName,
        line,
        relativeFile: `${voice.id}/${line.menuId}.mp3`,
      }),
    ),
  )
}

export function buildExpressivePilotSsml({ line, voiceShortName }) {
  assertPilotLine(line)
  if (!/^[A-Za-z0-9:-]+$/.test(voiceShortName)) {
    throw new Error('Azure MAI voice name contains unsupported characters')
  }

  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ko-KR">',
    `<voice xml:lang="ko-KR" name="${escapeXml(voiceShortName)}">`,
    `<mstts:express-as style="${line.style}" styledegree="${line.setupStyleDegree}">`,
    `<prosody rate="${line.setupRate}" pitch="${line.setupPitch}">${escapeXml(line.setupText)}</prosody>`,
    '</mstts:express-as>',
    `<break time="${line.breakMs}ms"/>`,
    `<mstts:express-as style="${line.style}" styledegree="${line.punchStyleDegree}">`,
    `<prosody rate="${line.punchRate}" pitch="${line.punchPitch}">${escapeXml(line.punchText)}</prosody>`,
    '</mstts:express-as>',
    '</voice>',
    '</speak>',
  ].join('')
}

export function readExpressivePilotConfig(environment) {
  const key = environment.AZURE_SPEECH_KEY?.trim()
  const region = environment.AZURE_SPEECH_REGION?.trim()
  const missing = []
  if (!key) missing.push('AZURE_SPEECH_KEY')
  if (!region) missing.push('AZURE_SPEECH_REGION')
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  if (!/^[\x21-\x7e]+$/.test(key)) {
    throw new Error('AZURE_SPEECH_KEY must contain only printable ASCII characters')
  }
  if (!/^[a-z0-9-]+$/.test(region)) {
    throw new Error('AZURE_SPEECH_REGION contains unsupported characters')
  }
  return { key, region }
}

export function validateExpressivePilotVoices(availableVoices) {
  const requiredStyles = new Set(EXPRESSIVE_PILOT_LINES.map(({ style }) => style))
  const byShortName = new Map(
    availableVoices.map((voice) => [voice.ShortName, voice]),
  )

  for (const expected of EXPRESSIVE_PILOT_VOICES) {
    const available = byShortName.get(expected.shortName)
    if (available === undefined) {
      throw new Error(`Required Azure MAI voice is unavailable: ${expected.shortName}`)
    }
    const styles = new Set(Array.isArray(available.StyleList) ? available.StyleList : [])
    for (const style of requiredStyles) {
      if (!styles.has(style)) {
        throw new Error(
          `Azure MAI voice ${expected.shortName} does not support style: ${style}`,
        )
      }
    }
  }
  return true
}

export async function readSafeAzureErrorDetail(response, redactions = []) {
  try {
    return sanitizeAzureSpeechErrorDetail(await response.text(), redactions)
  } catch {
    return ''
  }
}

export { parseCliArgs }

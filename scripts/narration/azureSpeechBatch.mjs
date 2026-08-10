export const REPRESENTATIVE_MENU_IDS = Object.freeze([
  'kimchi-jjigae',
  'budae-jjigae',
  'yukgaejang',
  'ramyeon',
  'pasta',
  'shabu-shabu',
])

export const TONE_SSML_PROFILES = Object.freeze({
  playful: Object.freeze({ rate: '+8%', pitch: '+3%', volume: '+0%' }),
  alert: Object.freeze({ rate: '+12%', pitch: '+2%', volume: '+3%' }),
  deadpan: Object.freeze({ rate: '-4%', pitch: '-2%', volume: '+0%' }),
  epic: Object.freeze({ rate: '-8%', pitch: '+1%', volume: '+3%' }),
})

export const DEFAULT_MAX_PRICE_USD_PER_MILLION_CHARS = 20
export const AZURE_SPEECH_OUTPUT_FORMAT =
  'audio-24khz-96kbitrate-mono-mp3'

const MENU_ENTRY_PATTERN =
  /\{\s*menuId:\s*'((?:\\.|[^'\\])*)',\s*text:\s*'((?:\\.|[^'\\])*)',\s*tone:\s*'(playful|alert|deadpan|epic)'/g

const ESCAPED_CHARACTER_VALUES = Object.freeze({
  "'": "'",
  '\\': '\\',
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  v: '\v',
  0: '\0',
})

function decodeSingleQuotedLiteral(value) {
  let decoded = ''

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character !== '\\') {
      decoded += character
      continue
    }

    const escaped = value[index + 1]
    if (escaped === undefined || !(escaped in ESCAPED_CHARACTER_VALUES)) {
      throw new Error('Unsupported escape sequence in narration catalog')
    }

    decoded += ESCAPED_CHARACTER_VALUES[escaped]
    index += 1
  }

  return decoded
}

export function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function parseNarrationCatalog(source) {
  const entries = []
  const seenMenuIds = new Set()

  for (const match of source.matchAll(MENU_ENTRY_PATTERN)) {
    const encodedMenuId = match[1]
    const encodedText = match[2]
    const tone = match[3]
    if (encodedMenuId === undefined || encodedText === undefined || tone === undefined) {
      continue
    }

    const menuId = decodeSingleQuotedLiteral(encodedMenuId)
    if (seenMenuIds.has(menuId)) {
      throw new Error(`Duplicate narration menu ID: ${menuId}`)
    }

    seenMenuIds.add(menuId)
    entries.push({
      menuId,
      text: decodeSingleQuotedLiteral(encodedText),
      tone,
    })
  }

  if (entries.length === 0) {
    throw new Error('No narration entries found in menuNarrations.ts')
  }

  return entries
}

export function selectRepresentativeNarrations(catalog) {
  const byMenuId = new Map(catalog.map((entry) => [entry.menuId, entry]))

  return REPRESENTATIVE_MENU_IDS.map((menuId) => {
    const narration = byMenuId.get(menuId)
    if (narration === undefined) {
      throw new Error(`Representative narration is missing: ${menuId}`)
    }

    if (narration.text.trim().length === 0) {
      throw new Error(`Representative narration text is empty: ${menuId}`)
    }

    if (!(narration.tone in TONE_SSML_PROFILES)) {
      throw new Error(`Unsupported narration tone for ${menuId}: ${narration.tone}`)
    }

    return narration
  })
}

export function buildSsml({ text, tone, voice }) {
  const profile = TONE_SSML_PROFILES[tone]
  if (profile === undefined) {
    throw new Error(`Unsupported narration tone: ${tone}`)
  }
  if (!/^[A-Za-z0-9-]+$/.test(voice)) {
    throw new Error('AZURE_SPEECH_VOICE contains unsupported characters')
  }

  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">',
    `<voice name="${escapeXml(voice)}">`,
    `<prosody rate="${profile.rate}" pitch="${profile.pitch}" volume="${profile.volume}">`,
    escapeXml(text),
    '</prosody>',
    '</voice>',
    '</speak>',
  ].join('')
}

export function sanitizeAzureSpeechErrorDetail(
  responseBody,
  sensitiveValues = [],
) {
  let detail = String(responseBody ?? '')

  for (const sensitiveValue of sensitiveValues) {
    if (sensitiveValue) detail = detail.replaceAll(sensitiveValue, '[redacted]')
  }

  detail = detail
    .replace(/<speak\b[\s\S]*?<\/speak>/gi, '[redacted-ssml]')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (detail.length <= 400) return detail
  return detail.slice(0, 399) + '…'
}
export function countBillableCharacters(narrations) {
  return narrations.reduce(
    (total, narration) => total + Array.from(narration.text).length,
    0,
  )
}

export function estimateMaximumCostUsd(
  characterCount,
  maximumPriceUsdPerMillion = DEFAULT_MAX_PRICE_USD_PER_MILLION_CHARS,
) {
  if (!Number.isFinite(characterCount) || characterCount < 0) {
    throw new Error('Character count must be a non-negative finite number')
  }
  if (
    !Number.isFinite(maximumPriceUsdPerMillion) ||
    maximumPriceUsdPerMillion <= 0
  ) {
    throw new Error('Maximum price must be a positive finite number')
  }

  return (characterCount / 1_000_000) * maximumPriceUsdPerMillion
}

export function parseCliArgs(args) {
  let execute = false
  let sawDryRun = false
  let outputDir
  let help = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--execute') {
      execute = true
      continue
    }
    if (argument === '--dry-run') {
      sawDryRun = true
      continue
    }
    if (argument === '--help' || argument === '-h') {
      help = true
      continue
    }
    if (argument === '--output') {
      const value = args[index + 1]
      if (value === undefined || value.startsWith('--')) {
        throw new Error('--output requires a directory path')
      }
      outputDir = value
      index += 1
      continue
    }
    if (argument?.startsWith('--output=')) {
      const value = argument.slice('--output='.length)
      if (value.length === 0) {
        throw new Error('--output requires a directory path')
      }
      outputDir = value
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  if (execute && sawDryRun) {
    throw new Error('--execute and --dry-run cannot be used together')
  }

  return { execute, outputDir, help }
}

export function readExecutionConfig(environment) {
  const key = environment.AZURE_SPEECH_KEY?.trim()
  const region = environment.AZURE_SPEECH_REGION?.trim()
  const voice = environment.AZURE_SPEECH_VOICE?.trim()
  const maximumPriceRaw =
    environment.AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS?.trim()
  const missingVariables = []

  if (!key) missingVariables.push('AZURE_SPEECH_KEY')
  if (!region) missingVariables.push('AZURE_SPEECH_REGION')
  if (!voice) missingVariables.push('AZURE_SPEECH_VOICE')
  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(', ')}`,
    )
  }

  if (!/^[\x21-\x7e]+$/.test(key)) {
    throw new Error(
      'AZURE_SPEECH_KEY must contain only printable ASCII characters. Copy only the Azure Speech key value, without labels or other clipboard text.',
    )
  }
  if (!/^[a-z0-9-]+$/.test(region)) {
    throw new Error('AZURE_SPEECH_REGION contains unsupported characters')
  }
  if (!/^[A-Za-z0-9-]+$/.test(voice)) {
    throw new Error('AZURE_SPEECH_VOICE contains unsupported characters')
  }

  const maximumPriceUsdPerMillion = maximumPriceRaw
    ? Number(maximumPriceRaw)
    : DEFAULT_MAX_PRICE_USD_PER_MILLION_CHARS
  if (
    !Number.isFinite(maximumPriceUsdPerMillion) ||
    maximumPriceUsdPerMillion <= 0
  ) {
    throw new Error(
      'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS must be a positive number',
    )
  }

  return {
    key,
    region,
    voice,
    maximumPriceUsdPerMillion,
  }
}

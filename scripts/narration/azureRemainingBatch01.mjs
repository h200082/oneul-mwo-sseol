import { createHash } from 'node:crypto'

import {
  escapeXml,
  estimateMaximumCostUsd,
  parseNarrationCatalog,
} from './azureSpeechBatch.mjs'
import {
  readExpressivePilotConfig,
} from './azureExpressivePilot.mjs'
import { inspectFinalRetakeBatch01Mp3 } from './azureFinalRetakeBatch01.mjs'

export const REMAINING_BATCH_01_REQUIRED_REGION = 'southeastasia'
export const REMAINING_BATCH_01_OUTPUT_FORMAT =
  'audio-24khz-160kbitrate-mono-mp3'
export const REMAINING_BATCH_01_RETRY_COUNT = 0
export const REMAINING_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP = 1

export const REMAINING_BATCH_01_MODEL_PRICE_PROFILES = Object.freeze({
  flash: Object.freeze({
    model: 'MAI-Voice-2-Flash',
    environmentVariable: 'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS',
    defaultPriceCeiling: 20,
  }),
  'mai-voice-2': Object.freeze({
    model: 'MAI-Voice-2',
    environmentVariable:
      'AZURE_SPEECH_MAI_VOICE_2_MAX_USD_PER_MILLION_CHARS',
    defaultPriceCeiling: 20,
  }),
})

export const REMAINING_BATCH_01_SOURCE_PINS = Object.freeze({
  catalog: Object.freeze({
    path: 'src/data/menuNarrations.ts',
    byteLength: 13_166,
    sha256: '252ed6f1e6cb1d19f31fa0d2763734504c9ee71894214afa079c36ee2ae3a20f',
  }),
  activeAudioIds: Object.freeze({
    path: 'src/data/menuNarrationAudioIds.ts',
    byteLength: 635,
    sha256: '15ea436f228609b94a1956f854d9e33fdc2244e5cfafa0897f014bb6d86203ed',
  }),
})

export const REMAINING_BATCH_01_ACTIVE_MENU_IDS = Object.freeze([
  'kimchi-jjigae',
  'doenjang-jjigae',
  'sundubu-jjigae',
  'budae-jjigae',
  'gamjatang',
  'seolleongtang',
  'gomtang',
  'galbitang',
  'yukgaejang',
  'samgyetang',
  'kongnamul-gukbap',
  'dwaeji-gukbap',
  'sundae-guk',
  'cheonggukjang',
  'home-style-baekban',
  'bibimbap',
  'jeyuk-deopbap',
  'bulgogi-deopbap',
  'chicken-mayo-deopbap',
  'ramyeon',
  'pasta',
  'shabu-shabu',
])

export const REMAINING_BATCH_01_MENU_IDS = Object.freeze([
  'curry-rice',
  'omurice',
  'fried-rice',
  'kimchi-fried-rice',
  'pork-cutlet',
  'sushi',
  'bibim-guksu',
  'janchi-guksu',
  'kalguksu',
  'naengmyeon',
  'jjajangmyeon',
  'jjamppong',
  'udon',
  'pho',
  'tteokbokki',
  'gimbap',
  'sandwich',
  'hamburger',
  'korean-toast',
  'samgyeopsal',
  'grilled-galbi',
  'dakgalbi',
  'bossam',
  'jokbal',
  'bulgogi',
  'fried-chicken',
  'pizza',
  'dak-hanmari',
])

export const REMAINING_BATCH_01_CATALOG_ORDER = Object.freeze([
  'kimchi-jjigae',
  'doenjang-jjigae',
  'sundubu-jjigae',
  'budae-jjigae',
  'gamjatang',
  'seolleongtang',
  'gomtang',
  'galbitang',
  'yukgaejang',
  'samgyetang',
  'kongnamul-gukbap',
  'dwaeji-gukbap',
  'sundae-guk',
  'cheonggukjang',
  'home-style-baekban',
  'bibimbap',
  'jeyuk-deopbap',
  'bulgogi-deopbap',
  'chicken-mayo-deopbap',
  'curry-rice',
  'omurice',
  'fried-rice',
  'kimchi-fried-rice',
  'pork-cutlet',
  'sushi',
  'bibim-guksu',
  'janchi-guksu',
  'kalguksu',
  'naengmyeon',
  'jjajangmyeon',
  'jjamppong',
  'ramyeon',
  'udon',
  'pasta',
  'pho',
  'tteokbokki',
  'gimbap',
  'sandwich',
  'hamburger',
  'korean-toast',
  'samgyeopsal',
  'grilled-galbi',
  'dakgalbi',
  'bossam',
  'jokbal',
  'bulgogi',
  'fried-chicken',
  'pizza',
  'dak-hanmari',
  'shabu-shabu',
])

export const REMAINING_BATCH_01_LISTENING_GROUPS = Object.freeze([
  Object.freeze({
    listeningGroup: 1,
    menuIds: Object.freeze(REMAINING_BATCH_01_MENU_IDS.slice(0, 7)),
  }),
  Object.freeze({
    listeningGroup: 2,
    menuIds: Object.freeze(REMAINING_BATCH_01_MENU_IDS.slice(7, 14)),
  }),
  Object.freeze({
    listeningGroup: 3,
    menuIds: Object.freeze(REMAINING_BATCH_01_MENU_IDS.slice(14, 21)),
  }),
  Object.freeze({
    listeningGroup: 4,
    menuIds: Object.freeze(REMAINING_BATCH_01_MENU_IDS.slice(21, 28)),
  }),
])

export const REMAINING_BATCH_01_VOICES = Object.freeze({
  'flash:junho': Object.freeze({
    modelId: 'flash',
    model: 'MAI-Voice-2-Flash',
    voiceId: 'junho',
    shortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
  }),
  'flash:haena': Object.freeze({
    modelId: 'flash',
    model: 'MAI-Voice-2-Flash',
    voiceId: 'haena',
    shortName: 'ko-KR-Haena:MAI-Voice-2-Flash',
  }),
  'mai-voice-2:junho': Object.freeze({
    modelId: 'mai-voice-2',
    model: 'MAI-Voice-2',
    voiceId: 'junho',
    shortName: 'ko-KR-Junho:MAI-Voice-2',
  }),
})

function freezePerformance(value) {
  return Object.freeze({
    ...value,
    spokenText: value.catalogText,
    synthesisAllowed: true,
    segments: Object.freeze([...value.segments]),
    copyRisk: Object.freeze([...(value.copyRisk ?? [])]),
  })
}
export const REMAINING_BATCH_01_PERFORMANCES = Object.freeze([
  freezePerformance({ menuId: 'curry-rice', listeningGroup: 1, tone: 'alert', catalogText: '한 번 끓여 세 끼를 지배한다!', modelId: 'flash', voiceId: 'junho', style: 'joyful', styleDegree: 0.54, rate: '+24%', pitch: '+0%', segments: ['한 번 끓여 ', '세 끼를 지배한다!'] }),
  freezePerformance({ menuId: 'omurice', listeningGroup: 1, tone: 'deadpan', catalogText: '밥이 계란으로 신분 세탁!', modelId: 'flash', voiceId: 'junho', style: 'determined', styleDegree: 0.46, rate: '+22%', pitch: '-1%', segments: ['밥이 계란으로 신분 세탁!'] }),
  freezePerformance({ menuId: 'fried-rice', listeningGroup: 1, tone: 'epic', catalogText: '냉장고 올스타전!', modelId: 'flash', voiceId: 'junho', style: 'joyful', styleDegree: 0.52, rate: '+18%', pitch: '+0%', segments: ['냉장고 올스타전!'] }),
  freezePerformance({ menuId: 'kimchi-fried-rice', listeningGroup: 1, tone: 'epic', catalogText: '신김치의 화려한 재데뷔!', modelId: 'flash', voiceId: 'haena', style: 'joyful', styleDegree: 0.48, rate: '+20%', pitch: '-1%', segments: ['신김치의 화려한 재데뷔!'] }),
  freezePerformance({ menuId: 'pork-cutlet', listeningGroup: 1, tone: 'deadpan', catalogText: '돈가스 먹으러 가자? 일단 의심해!', modelId: 'mai-voice-2', voiceId: 'junho', style: 'joyful', styleDegree: 0.44, rate: '+20%', pitch: '-1%', segments: ['돈가스 먹으러 가자? ', '일단 의심해!'], copyRisk: ['question-pause', 'cultural-copy'] }),
  freezePerformance({ menuId: 'sushi', listeningGroup: 1, tone: 'playful', catalogText: '그릇은 쌓이고 통장은 비어간다!', modelId: 'flash', voiceId: 'junho', style: 'joyful', styleDegree: 0.5, rate: '+22%', pitch: '-1%', segments: ['그릇은 쌓이고 ', '통장은 비어간다!'] }),
  freezePerformance({ menuId: 'bibim-guksu', listeningGroup: 1, tone: 'playful', catalogText: '면은 꼬이고 입맛은 풀린다!', modelId: 'flash', voiceId: 'junho', style: 'joyful', styleDegree: 0.5, rate: '+22%', pitch: '+0%', segments: ['면은 꼬이고 ', '입맛은 풀린다!'] }),

  freezePerformance({ menuId: 'janchi-guksu', listeningGroup: 2, tone: 'playful', catalogText: '혼자 먹어도 이름은 잔치!', modelId: 'flash', voiceId: 'haena', style: 'joyful', styleDegree: 0.46, rate: '+20%', pitch: '-1%', segments: ['혼자 먹어도 이름은 잔치!'] }),
  freezePerformance({ menuId: 'kalguksu', listeningGroup: 2, tone: 'playful', catalogText: '칼은 이름에만, 국물은 따뜻!', modelId: 'flash', voiceId: 'junho', style: 'determined', styleDegree: 0.46, rate: '+20%', pitch: '-1%', segments: ['칼은 이름에만, ', '국물은 따뜻!'] }),
  freezePerformance({ menuId: 'naengmyeon', listeningGroup: 2, tone: 'epic', catalogText: '중요한 건 꺾이지 않는 면발!', modelId: 'flash', voiceId: 'junho', style: 'determined', styleDegree: 0.52, rate: '+22%', pitch: '-1%', segments: ['중요한 건 ', '꺾이지 않는 면발!'] }),
  freezePerformance({ menuId: 'jjajangmyeon', listeningGroup: 2, tone: 'alert', catalogText: '짜장면 등장, 젓가락 급가속!', modelId: 'flash', voiceId: 'junho', style: 'joyful', styleDegree: 0.5, rate: '+22%', pitch: '+0%', segments: ['짜장면 등장, ', '젓가락 급가속!'] }),
  freezePerformance({ menuId: 'jjamppong', listeningGroup: 2, tone: 'playful', catalogText: '국물 한입, 정신 자동 재부팅!', modelId: 'flash', voiceId: 'haena', style: 'joyful', styleDegree: 0.48, rate: '+22%', pitch: '-1%', segments: ['국물 한입, ', '정신 자동 재부팅!'] }),
  freezePerformance({ menuId: 'udon', listeningGroup: 2, tone: 'deadpan', catalogText: '우동은 굵고 고민은 짧다!', modelId: 'flash', voiceId: 'junho', style: 'determined', styleDegree: 0.46, rate: '+20%', pitch: '-1%', segments: ['우동은 굵고 ', '고민은 짧다!'] }),
  freezePerformance({ menuId: 'pho', listeningGroup: 2, tone: 'deadpan', catalogText: '고수 넣는 자가 진짜 고수!', modelId: 'flash', voiceId: 'junho', style: 'determined', styleDegree: 0.48, rate: '+20%', pitch: '-1%', segments: ['고수 넣는 자가 ', '진짜 고수!'] }),

  freezePerformance({ menuId: 'tteokbokki', listeningGroup: 3, tone: 'alert', catalogText: '떡볶이 포획! 쿨피스 지원 요청!', modelId: 'flash', voiceId: 'haena', style: 'joyful', styleDegree: 0.5, rate: '+22%', pitch: '-1%', segments: ['떡볶이 포획! ', '쿨피스 지원 요청!'], copyRisk: ['brand-term-review:쿨피스'], brandReview: 'metadata-only' }),
  freezePerformance({ menuId: 'gimbap', listeningGroup: 3, tone: 'deadpan', catalogText: '꼬다리 소유권 분쟁 발생!', modelId: 'flash', voiceId: 'junho', style: 'determined', styleDegree: 0.48, rate: '+18%', pitch: '-1%', segments: ['꼬다리 소유권 분쟁 발생!'] }),
  freezePerformance({ menuId: 'sandwich', listeningGroup: 3, tone: 'alert', catalogText: '빵은 잡았는데 속은 탈출!', modelId: 'flash', voiceId: 'junho', style: 'joyful', styleDegree: 0.48, rate: '+22%', pitch: '-1%', segments: ['빵은 잡았는데 ', '속은 탈출!'] }),
  freezePerformance({ menuId: 'hamburger', listeningGroup: 3, tone: 'epic', catalogText: '햄부기! 햄부기! 햄부기!', modelId: 'flash', voiceId: 'haena', style: 'joyful', styleDegree: 0.42, rate: '+16%', pitch: '-2%', segments: ['햄부기! 햄부기! 햄부기!'], copyRisk: ['intentional-nonstandard:햄부기', 'shout-risk'] }),
  freezePerformance({ menuId: 'korean-toast', listeningGroup: 3, tone: 'playful', catalogText: '한입 먹자마자 등굣길!', modelId: 'flash', voiceId: 'haena', style: 'joyful', styleDegree: 0.46, rate: '+20%', pitch: '-1%', segments: ['한입 먹자마자 등굣길!'] }),
  freezePerformance({ menuId: 'samgyeopsal', listeningGroup: 3, tone: 'alert', catalogText: '누가 고기 굽는 소리를 내었는가!', modelId: 'mai-voice-2', voiceId: 'junho', style: 'joyful', styleDegree: 0.4, rate: '+22%', pitch: '-1%', segments: ['누가 고기 굽는 소리를 내었는가!'], copyRisk: ['neutral-no-impersonation'], neutralNoImpersonation: true }),
  freezePerformance({ menuId: 'grilled-galbi', listeningGroup: 3, tone: 'playful', catalogText: '체면 내려놓고 뼈를 들어라!', modelId: 'flash', voiceId: 'junho', style: 'determined', styleDegree: 0.48, rate: '+20%', pitch: '-1%', segments: ['체면 내려놓고 ', '뼈를 들어라!'] }),

  freezePerformance({ menuId: 'dakgalbi', listeningGroup: 4, tone: 'deadpan', catalogText: '닭은 있는데 갈비는 어디 갔지?', modelId: 'mai-voice-2', voiceId: 'junho', style: 'joyful', styleDegree: 0.44, rate: '+20%', pitch: '-1%', segments: ['닭은 있는데 갈비는 어디 갔지?'] }),
  freezePerformance({ menuId: 'bossam', listeningGroup: 4, tone: 'deadpan', catalogText: '배추가 고기를 보쌈했다!', modelId: 'flash', voiceId: 'junho', style: 'determined', styleDegree: 0.46, rate: '+20%', pitch: '-1%', segments: ['배추가 고기를 보쌈했다!'] }),
  freezePerformance({ menuId: 'jokbal', listeningGroup: 4, tone: 'playful', catalogText: '발을 먹는데 손이 바쁘다!', modelId: 'flash', voiceId: 'junho', style: 'joyful', styleDegree: 0.48, rate: '+22%', pitch: '+0%', segments: ['발을 먹는데 ', '손이 바쁘다!'] }),
  freezePerformance({ menuId: 'bulgogi', listeningGroup: 4, tone: 'alert', catalogText: '엄마 물고기 말고 불고기!', modelId: 'flash', voiceId: 'junho', style: 'joyful', styleDegree: 0.48, rate: '+20%', pitch: '-1%', segments: ['엄마', ' 물고기 말고 불고기!'], copyRisk: ['vocative-ambiguity', 'near-homophone:물고기/불고기', 'first-block-shout-risk'] }),
  freezePerformance({ menuId: 'fried-chicken', listeningGroup: 4, tone: 'epic', catalogText: '반반은 우유부단이 아니라 지혜다!', modelId: 'mai-voice-2', voiceId: 'junho', style: 'joyful', styleDegree: 0.48, rate: '+26%', pitch: '-1%', segments: ['반반은 우유부단이 아니라 지혜다!'] }),
  freezePerformance({ menuId: 'pizza', listeningGroup: 4, tone: 'alert', catalogText: '피자 먹고 팔자 피자!', modelId: 'flash', voiceId: 'junho', style: 'joyful', styleDegree: 0.46, rate: '+18%', pitch: '+0%', segments: ['피자 먹고', ' 팔자 피자!'], copyRisk: ['audio-ambiguity', 'near-homophone:피자/팔자/피자'] }),
  freezePerformance({ menuId: 'dak-hanmari', listeningGroup: 4, tone: 'deadpan', catalogText: '메뉴 이름이 설명서다!', modelId: 'flash', voiceId: 'junho', style: 'determined', styleDegree: 0.46, rate: '+18%', pitch: '-1%', segments: ['메뉴 이름이 설명서다!'] }),
])

const SUPPORTED_STYLES = new Set(['joyful', 'determined'])
const BASE_KOREAN_TIMING_UNITS_PER_SECOND = 5.3

function parseSignedPercent(value, label) {
  const match = /^([+-])(\d+)%$/.exec(value)
  if (!match) throw new Error(`${label} must be a signed percentage`)
  const magnitude = Number(match[2])
  if (magnitude > 100) throw new Error(`${label} must not exceed 100%`)
  return match[1] === '-' ? -magnitude : magnitude
}

function voiceFor(performance) {
  return REMAINING_BATCH_01_VOICES[
    `${performance.modelId}:${performance.voiceId}`
  ]
}

function assertPerformance(performance) {
  const expectedVoice = voiceFor(performance)
  if (!expectedVoice) {
    throw new Error(`Unsupported model/voice: ${performance.menuId}`)
  }
  if (!SUPPORTED_STYLES.has(performance.style)) {
    throw new Error(`Unsupported style: ${performance.menuId}`)
  }
  if (
    !Number.isFinite(performance.styleDegree) ||
    performance.styleDegree < 0.01 ||
    performance.styleDegree > 2
  ) {
    throw new Error(`Invalid style degree: ${performance.menuId}`)
  }
  parseSignedPercent(performance.rate, 'rate')
  parseSignedPercent(performance.pitch, 'pitch')
  if (performance.spokenText !== performance.catalogText) {
    throw new Error(`Spoken copy changed: ${performance.menuId}`)
  }
  if (
    !Array.isArray(performance.segments) ||
    ![1, 2].includes(performance.segments.length) ||
    performance.segments.some((segment) => segment.length === 0) ||
    performance.segments.join('') !== performance.catalogText
  ) {
    throw new Error(`Segments do not join exact catalog copy: ${performance.menuId}`)
  }
  if (performance.synthesisAllowed !== true) {
    throw new Error(`Synthesis is not explicitly allowed: ${performance.menuId}`)
  }
  const expectedGroup =
    Math.floor(REMAINING_BATCH_01_MENU_IDS.indexOf(performance.menuId) / 7) + 1
  if (performance.listeningGroup !== expectedGroup) {
    throw new Error(`Listening group changed: ${performance.menuId}`)
  }
}

function assertPerformanceMatrix(performances) {
  if (performances.length !== REMAINING_BATCH_01_MENU_IDS.length) {
    throw new Error('Remaining batch 01 must contain exactly 28 performances')
  }
  const ids = performances.map(({ menuId }) => menuId)
  if (
    new Set(ids).size !== ids.length ||
    ids.some((menuId, index) => menuId !== REMAINING_BATCH_01_MENU_IDS[index])
  ) {
    throw new Error('Remaining batch 01 menu order changed')
  }
  for (const performance of performances) assertPerformance(performance)

  const count = (predicate) => performances.filter(predicate).length
  if (
    count(({ modelId }) => modelId === 'flash') !== 24 ||
    count(({ modelId }) => modelId === 'mai-voice-2') !== 4 ||
    count(({ voiceId }) => voiceId === 'junho') !== 22 ||
    count(({ voiceId }) => voiceId === 'haena') !== 6 ||
    count(({ segments }) => segments.length === 1) !== 12 ||
    count(({ segments }) => segments.length === 2) !== 16
  ) {
    throw new Error('Remaining batch 01 matrix totals changed')
  }
}

function assertExactArray(actual, expected, label) {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(`${label} changed`)
  }
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

export function selectRemainingBatch01Performances(catalog, activeAudioIds) {
  assertPerformanceMatrix(REMAINING_BATCH_01_PERFORMANCES)
  assertExactArray(
    catalog.map(({ menuId }) => menuId),
    REMAINING_BATCH_01_CATALOG_ORDER,
    'Narration catalog order',
  )
  assertExactArray(
    activeAudioIds,
    REMAINING_BATCH_01_ACTIVE_MENU_IDS,
    'Active narration audio IDs',
  )
  const active = new Set(activeAudioIds)
  const byId = new Map(catalog.map((item) => [item.menuId, item]))
  for (const performance of REMAINING_BATCH_01_PERFORMANCES) {
    if (active.has(performance.menuId)) {
      throw new Error(`Remaining menu already has active audio: ${performance.menuId}`)
    }
    const current = byId.get(performance.menuId)
    if (
      !current ||
      current.text !== performance.catalogText ||
      current.tone !== performance.tone
    ) {
      throw new Error(`Remaining narration pin is stale: ${performance.menuId}`)
    }
  }
  if (active.size + REMAINING_BATCH_01_PERFORMANCES.length !== catalog.length) {
    throw new Error('Active and remaining narration sets do not cover the catalog')
  }
  return REMAINING_BATCH_01_PERFORMANCES
}

export function validateRemainingBatch01SourceFiles({
  catalogBytes,
  activeAudioIdsBytes,
}) {
  const catalogPin = validatePinnedBytes(
    catalogBytes,
    REMAINING_BATCH_01_SOURCE_PINS.catalog,
    'Narration catalog',
  )
  const activeAudioIdsPin = validatePinnedBytes(
    activeAudioIdsBytes,
    REMAINING_BATCH_01_SOURCE_PINS.activeAudioIds,
    'Active audio IDs',
  )
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const catalog = parseNarrationCatalog(decoder.decode(catalogBytes))
  const activeAudioIds = parseActiveAudioIds(
    decoder.decode(activeAudioIdsBytes),
  )
  const performances = selectRemainingBatch01Performances(
    catalog,
    activeAudioIds,
  )
  return Object.freeze({
    catalogPin,
    activeAudioIdsPin,
    catalog: Object.freeze(catalog),
    activeAudioIds: Object.freeze(activeAudioIds),
    performances,
  })
}

export function createRemainingBatch01Plan(
  performances = REMAINING_BATCH_01_PERFORMANCES,
) {
  assertPerformanceMatrix(performances)
  return Object.freeze(
    performances.map((performance) => {
      const voice = voiceFor(performance)
      return Object.freeze({
        performance,
        modelId: voice.modelId,
        model: voice.model,
        voiceId: voice.voiceId,
        voiceShortName: voice.shortName,
        relativeFile: `${performance.menuId}.mp3`,
      })
    }),
  )
}

function buildPerformanceBlock(performance, text) {
  return [
    `<mstts:express-as style="${performance.style}" styledegree="${performance.styleDegree}">`,
    `<prosody rate="${performance.rate}" pitch="${performance.pitch}">${escapeXml(text)}</prosody>`,
    '</mstts:express-as>',
  ].join('')
}

export function buildRemainingBatch01Ssml({
  performance,
  voiceShortName,
}) {
  assertPerformance(performance)
  const expectedVoice = voiceFor(performance)
  if (voiceShortName !== expectedVoice.shortName) {
    throw new Error(`Unexpected voice for ${performance.menuId}`)
  }
  const body = performance.segments
    .map((segment) => buildPerformanceBlock(performance, segment))
    .join('')
  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ko-KR">',
    `<voice xml:lang="ko-KR" name="${escapeXml(voiceShortName)}">`,
    body,
    '</voice>',
    '</speak>',
  ].join('')
}

export function estimateRemainingBatch01PlannedTiming(performance) {
  assertPerformance(performance)
  const timingUnits = Array.from(performance.spokenText).filter((character) =>
    /[가-힣A-Za-z0-9]/u.test(character),
  ).length
  const ratePercent = parseSignedPercent(performance.rate, 'rate')
  return Object.freeze({
    approxDurationSeconds: Number(
      (
        timingUnits /
        (BASE_KOREAN_TIMING_UNITS_PER_SECOND * (1 + ratePercent / 100))
      ).toFixed(3),
    ),
    basis: 'informational-total-text-heuristic-only',
  })
}

export function validateRemainingBatch01Voices(availableVoices) {
  assertPerformanceMatrix(REMAINING_BATCH_01_PERFORMANCES)
  const requirements = new Map()
  for (const performance of REMAINING_BATCH_01_PERFORMANCES) {
    const shortName = voiceFor(performance).shortName
    const styles = requirements.get(shortName) ?? new Set()
    styles.add(performance.style)
    requirements.set(shortName, styles)
  }
  for (const [shortName, styles] of requirements) {
    const available = availableVoices.find(
      (voice) => voice?.ShortName === shortName,
    )
    if (!available) {
      throw new Error(`Required Azure MAI voice is unavailable: ${shortName}`)
    }
    const supported = new Set(
      Array.isArray(available.StyleList) ? available.StyleList : [],
    )
    for (const style of styles) {
      if (!supported.has(style)) {
        throw new Error(`${shortName} does not support style: ${style}`)
      }
    }
  }
  return true
}

export function readRemainingBatch01PriceCeilings(
  environment,
  requireExplicit = false,
) {
  const result = {}
  for (const [modelId, profile] of Object.entries(
    REMAINING_BATCH_01_MODEL_PRICE_PROFILES,
  )) {
    const raw = environment[profile.environmentVariable]?.trim()
    if (!raw && requireExplicit) {
      throw new Error(
        `Missing required environment variable: ${profile.environmentVariable}`,
      )
    }
    const maximumPriceUsdPerMillionCharacters = raw
      ? Number(raw)
      : profile.defaultPriceCeiling
    if (
      !Number.isFinite(maximumPriceUsdPerMillionCharacters) ||
      maximumPriceUsdPerMillionCharacters <= 0
    ) {
      throw new Error(
        `${profile.environmentVariable} must be a positive number`,
      )
    }
    result[modelId] = Object.freeze({
      modelId,
      model: profile.model,
      environmentVariable: profile.environmentVariable,
      maximumPriceUsdPerMillionCharacters,
      source: raw
        ? 'environment-local-official-ceiling'
        : 'local-conservative-default',
    })
  }
  return Object.freeze(result)
}

export function readRemainingBatch01ExecutionConfig(environment) {
  const speech = readExpressivePilotConfig(environment)
  if (speech.region !== REMAINING_BATCH_01_REQUIRED_REGION) {
    throw new Error(
      `AZURE_SPEECH_REGION must be ${REMAINING_BATCH_01_REQUIRED_REGION} for remaining batch 01`,
    )
  }
  return Object.freeze({
    ...speech,
    priceCeilings: readRemainingBatch01PriceCeilings(environment, true),
  })
}

export function summarizeRemainingBatch01Cost(plan, priceCeilings) {
  const files = plan.map((item) => {
    const ssml = buildRemainingBatch01Ssml({
      performance: item.performance,
      voiceShortName: item.voiceShortName,
    })
    return Object.freeze({
      relativeFile: item.relativeFile,
      modelId: item.modelId,
      ssmlCharacters: Array.from(ssml).length,
    })
  })
  const models = Object.keys(REMAINING_BATCH_01_MODEL_PRICE_PROFILES).map(
    (modelId) => {
      const ceiling = priceCeilings[modelId]
      if (!ceiling) throw new Error(`Missing price ceiling for model: ${modelId}`)
      const modelFiles = files.filter((file) => file.modelId === modelId)
      const ssmlCharacters = modelFiles.reduce(
        (total, file) => total + file.ssmlCharacters,
        0,
      )
      return Object.freeze({
        ...ceiling,
        ssmlCharacters,
        maximumEstimatedCostUsd: estimateMaximumCostUsd(
          ssmlCharacters,
          ceiling.maximumPriceUsdPerMillionCharacters,
        ),
        files: Object.freeze(modelFiles),
      })
    },
  )
  return Object.freeze({
    basis: 'full-ssml-unicode-code-point-upper-bound',
    models: Object.freeze(models),
    ssmlCharacters: models.reduce(
      (total, model) => total + model.ssmlCharacters,
      0,
    ),
    maximumEstimatedCostUsd: models.reduce(
      (total, model) => total + model.maximumEstimatedCostUsd,
      0,
    ),
    files: Object.freeze(files),
  })
}

export function inspectRemainingBatch01Mp3(audio) {
  return inspectFinalRetakeBatch01Mp3(audio)
}

export function createRemainingBatch01Manifest({
  plan,
  audioResults,
  sourceAttestation,
  region,
  pricing,
  generatedAt,
}) {
  if (region !== REMAINING_BATCH_01_REQUIRED_REGION) {
    throw new Error('Manifest region does not match remaining batch 01')
  }
  if (audioResults.length !== plan.length) {
    throw new Error('Manifest audio result count does not match plan')
  }
  const resultByFile = new Map(
    audioResults.map((result) => [result.relativeFile, result]),
  )
  if (resultByFile.size !== plan.length) {
    throw new Error('Manifest audio results contain duplicates')
  }
  const generatedFiles = plan.map((item) => {
    const result = resultByFile.get(item.relativeFile)
    if (
      !result ||
      !Number.isInteger(result.byteLength) ||
      result.byteLength <= 0 ||
      !/^[a-f0-9]{64}$/.test(result.sha256) ||
      !Number.isInteger(result.mpegFrameCount) ||
      result.mpegFrameCount <= 0 ||
      !Number.isFinite(result.exactDurationSeconds) ||
      result.exactDurationSeconds <= 0
    ) {
      throw new Error(`Manifest MP3 inspection is invalid: ${item.relativeFile}`)
    }
    const performance = item.performance
    return {
      menuId: performance.menuId,
      listeningGroup: performance.listeningGroup,
      tone: performance.tone,
      modelId: item.modelId,
      model: item.model,
      voiceId: item.voiceId,
      voiceShortName: item.voiceShortName,
      catalogText: performance.catalogText,
      spokenText: performance.spokenText,
      synthesisAllowed: performance.synthesisAllowed,
      copyRisk: performance.copyRisk,
      brandReview: performance.brandReview ?? null,
      neutralNoImpersonation:
        performance.neutralNoImpersonation === true,
      style: performance.style,
      styleDegree: performance.styleDegree,
      rate: performance.rate,
      pitch: performance.pitch,
      structure:
        performance.segments.length === 1
          ? 'one-block'
          : 'adjacent-two-block',
      segments: performance.segments,
      explicitBreaks: 0,
      plannedTiming: estimateRemainingBatch01PlannedTiming(performance),
      file: item.relativeFile,
      ssmlCharacters: pricing.files.find(
        (file) => file.relativeFile === item.relativeFile,
      )?.ssmlCharacters,
      byteLength: result.byteLength,
      sha256: result.sha256,
      mpegFrameCount: result.mpegFrameCount,
      exactDurationSeconds: result.exactDurationSeconds,
    }
  })
  const totalByteLength = generatedFiles.reduce(
    (total, file) => total + file.byteLength,
    0,
  )
  return {
    schemaVersion: 2,
    provider: 'Azure AI Speech',
    batch: 'remaining-batch-01',
    region,
    outputFormat: REMAINING_BATCH_01_OUTPUT_FORMAT,
    generatedAt,
    sourcePins: {
      catalog: sourceAttestation.catalogPin,
      activeAudioIds: sourceAttestation.activeAudioIdsPin,
      catalogOrderPinned: true,
      activeAudioIdsPinned: true,
      activeAudioIdsExcluded: true,
      activeAudioCount: REMAINING_BATCH_01_ACTIVE_MENU_IDS.length,
      remainingAudioCount: REMAINING_BATCH_01_MENU_IDS.length,
    },
    listeningGroups: REMAINING_BATCH_01_LISTENING_GROUPS,
    matrix: {
      flashClips: 24,
      maiVoice2Clips: 4,
      junhoClips: 22,
      haenaClips: 6,
      oneBlockClips: 12,
      adjacentTwoBlockClips: 16,
    },
    copyReview: {
      catalogTextByteExact: true,
      spokenTextExactlyMatchesCatalog: true,
      segmentJoinExactlyMatchesCatalog: true,
      punctuationInserted: false,
      pronunciationOverrideUsed: false,
      brandReviewMetadataOnly: true,
      userListeningReviewRequired: true,
    },
    delivery: {
      oneVoicePerClip: true,
      identicalControlsAcrossAdjacentBlocks: true,
      explicitBreaksPerClip: 0,
      subTagsUsed: false,
      phonemeTagsUsed: false,
      emphasisTagsUsed: false,
      midSentenceVoiceSwitch: false,
    },
    pricing,
    requests: {
      voiceListPreflight: 1,
      synthesisPerClip: REMAINING_BATCH_01_SYNTHESIS_REQUESTS_PER_CLIP,
      totalSynthesisRequests: plan.length,
      retries: REMAINING_BATCH_01_RETRY_COUNT,
    },
    outputQa: {
      totalByteLength,
      totalByteQa: 'sum-of-validated-positive-output-byte-lengths-recorded',
      outputIdentityPinnedInManifest: true,
      exactDurationMeasurement:
        'validated MPEG frame count * 576 samples / 24,000 Hz',
      activeSpeechAndInternalGapQa: 'human-listening-required',
      activeSpeechAndInternalGapAutomaticallyMeasured: false,
      postprocessingApplied: false,
      runtimeIntegrationAttempted: false,
    },
    generatedFiles,
  }
}

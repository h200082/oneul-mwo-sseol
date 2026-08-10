import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { MENU_CATALOG } from '../src/data/menus'
import {
  FULL_BATCH_01_APPROVED_NARRATION_SELECTIONS,
  FULL_BATCH_01_RETIRED_NARRATION_SELECTIONS,
} from '../scripts/narration/fullBatch01ApprovedAudioSelections.mjs'
import {
  MENU_NARRATION_AUDIO_IDS,
  MENU_NARRATION_AUDIO_URLS,
  getMenuNarrationAudioUrl,
} from '../src/data/menuNarrationAudioManifest'
import {
  MAX_NARRATION_TEXT_LENGTH,
  MENU_NARRATIONS,
  NARRATION_TONES,
  getMenuNarration,
} from '../src/data/menuNarrations'

const FORBIDDEN_PHRASES = [
  '묻고 밥 두 공기로 가',
  '짜장면 시키신 분',
  '손은 눈보다 빠르다',
  '치킨은 살 안 쪄요',
  '왜 먹지를 못하니',
] as const

const REPRESENTATIVE_PRIMARY_LINES = {
  'gomtang': '곰은 없어도 곰처럼 든든!',
  'bulgogi-deopbap': '밥 위 무단점거 현행범!',
  'curry-rice': '한 번 끓여 세 끼를 지배한다!',
  'pork-cutlet': '돈가스 먹으러 가자? 일단 의심해!',
  'sushi': '그릇은 쌓이고 통장은 비어간다!',
  'naengmyeon': '중요한 건 꺾이지 않는 면발!',
  'jjamppong': '국물 한입, 정신 자동 재부팅!',
  'pasta': '포크로 돌리면 갑자기 유럽!',
  'pho': '고수 넣는 자가 진짜 고수!',
  'tteokbokki': '떡볶이 포획! 쿨피스 지원 요청!',
  'gimbap': '꼬다리 소유권 분쟁 발생!',
  'hamburger': '햄부기! 햄부기! 햄부기!',
  'samgyeopsal': '누가 고기 굽는 소리를 내었는가!',
  'grilled-galbi': '체면 내려놓고 뼈를 들어라!',
  'bulgogi': '엄마 물고기 말고 불고기!',
  'fried-chicken': '반반은 우유부단이 아니라 지혜다!',
  'pizza': '피자 먹고 팔자 피자!',
  'dak-hanmari': '메뉴 이름이 설명서다!',
  'shabu-shabu': '채소도 먹었다고 주장 가능합니다!',
} as const

describe('MENU_NARRATIONS', () => {
  it('covers every catalog menu exactly once', () => {
    const catalogIds = MENU_CATALOG.map((menu) => menu.id).sort()
    const narrationIds = MENU_NARRATIONS.map((narration) => narration.menuId).sort()

    expect(MENU_NARRATIONS).toHaveLength(50)
    expect(new Set(narrationIds).size).toBe(narrationIds.length)
    expect(narrationIds).toEqual(catalogIds)
  })

  it('uses supported tones and attaches all fifty active audio assets', () => {
    const approvedIds = new Set<string>(MENU_NARRATION_AUDIO_IDS)
    const narrationsWithAudio = MENU_NARRATIONS.filter(
      ({ audioUrl }) => audioUrl !== null,
    )

    expect(narrationsWithAudio.map(({ menuId }) => menuId)).toEqual(
      MENU_NARRATION_AUDIO_IDS,
    )
    expect(MENU_NARRATION_AUDIO_IDS).toHaveLength(50)
    expect(narrationsWithAudio).toHaveLength(50)
    expect(
      MENU_NARRATIONS.filter(({ audioUrl }) => audioUrl === null),
    ).toHaveLength(0)
    expect(Object.keys(MENU_NARRATION_AUDIO_URLS)).toEqual(
      MENU_NARRATION_AUDIO_IDS,
    )
    expect(getMenuNarrationAudioUrl('gomtang')).toMatch(/\.wav(?:\?|$)/)
    expect(getMenuNarrationAudioUrl('pasta')).toMatch(/\.mp3(?:\?|$)/)
    expect(getMenuNarrationAudioUrl('bulgogi-deopbap')).toMatch(
      /\.mp3(?:\?|$)/,
    )

    for (const narration of MENU_NARRATIONS) {
      expect(NARRATION_TONES).toContain(narration.tone)
      if (approvedIds.has(narration.menuId)) {
        expect(narration.audioUrl).toBeTypeOf('string')
        expect(narration.audioUrl).toMatch(/\.(?:mp3|wav)(?:\?|$)/)
        expect(narration.audioUrl).not.toMatch(/tmp|narration-preview/i)
      } else {
        expect(narration.audioUrl).toBeNull()
      }
    }
  })

  it('pins active and retired first-batch provenance to copied asset hashes', () => {
    expect(FULL_BATCH_01_APPROVED_NARRATION_SELECTIONS).toHaveLength(7)
    expect(FULL_BATCH_01_RETIRED_NARRATION_SELECTIONS).toHaveLength(1)
    const allSelections = [
      ...FULL_BATCH_01_APPROVED_NARRATION_SELECTIONS,
      ...FULL_BATCH_01_RETIRED_NARRATION_SELECTIONS,
    ]
    expect(allSelections).toHaveLength(8)

    for (const selection of allSelections) {
      const bytes = readFileSync(selection.targetAssetPath)
      expect(selection.humanApproved).toBe(true)
      expect(bytes.byteLength).toBe(selection.byteLength)
      expect(createHash('sha256').update(bytes).digest('hex').toUpperCase()).toBe(
        selection.sha256,
      )
    }
    for (const selection of FULL_BATCH_01_APPROVED_NARRATION_SELECTIONS) {
      expect(selection.deploymentStatus).toBe('active')
      expect(selection.currentlyDeployed).toBe(true)
    }
    expect(FULL_BATCH_01_RETIRED_NARRATION_SELECTIONS[0]).toMatchObject({
      menuId: 'gomtang',
      historicalCatalogText: '곰은 없고 진국만 있다!',
      sourcePreviewPath:
        'tmp/narration-preview/full-batch-01-retake-01/gomtang.mp3',
      deploymentStatus: 'retired-catalog-copy-mismatch',
      currentlyDeployed: false,
      selection: 'full-batch-01-retake-01',
    })
    expect(
      FULL_BATCH_01_RETIRED_NARRATION_SELECTIONS[0]?.retirementReason,
    ).toContain('곰은 없어도 곰처럼 든든!')

    expect(
      FULL_BATCH_01_APPROVED_NARRATION_SELECTIONS.filter(
        ({ durationReview }) =>
          durationReview.status === 'human-listening-exception',
      ).map(({ menuId }) => menuId),
    ).toEqual(['gamjatang', 'seolleongtang'])
    expect(
      FULL_BATCH_01_APPROVED_NARRATION_SELECTIONS.find(
        ({ menuId }) => menuId === 'seolleongtang',
      ),
    ).toMatchObject({
      sourcePreviewPath:
        'tmp/narration-preview/seolleongtang-copy-pilot-01/B-gukbap-tank.mp3',
      approximateDurationSeconds: 2.424,
      selection: 'seolleongtang-copy-pilot-01-b',
      durationReview: {
        status: 'human-listening-exception',
        targetHardMaximumSeconds: 2,
      },
    })
  })
  it('keeps primary lines concise and alternatives usable', () => {
    for (const narration of MENU_NARRATIONS) {
      expect(narration.text.length).toBeGreaterThan(0)
      expect(Array.from(narration.text).length).toBeLessThanOrEqual(
        MAX_NARRATION_TEXT_LENGTH,
      )
      expect(narration.text.trim()).toBe(narration.text)
      expect(narration.alternatives.length).toBeGreaterThanOrEqual(2)
      expect(new Set(narration.alternatives).size).toBe(
        narration.alternatives.length,
      )

      for (const alternative of narration.alternatives) {
        expect(alternative.trim()).toBe(alternative)
        expect(alternative).not.toBe(narration.text)
      }
    }
  })

  it('contains the approved rewrites', () => {
    for (const [menuId, text] of Object.entries(REPRESENTATIVE_PRIMARY_LINES)) {
      expectApproved(menuId, text)
    }

    expectApproved('kimchi-jjigae', '밥 한 공기론 합의 불가!')
    expectApproved('seolleongtang', '설렁탕 국밥계 탱커 등장!')
    expectApproved('kongnamul-gukbap', '한 숟갈에 인간 복귀!')
    expectApproved('dwaeji-gukbap', '돼지국밥 한술에 부산 도착!')
    expectApproved('sundae-guk', '순대국 든든 버프 풀충전!')
    expectApproved('cheonggukjang', '청국장 향부터 어그로 만렙!')
    expectApproved('home-style-baekban', '백반 한상 반찬 슬롯 만렙!')
    expectApproved('bibimbap', '고추장 아래 만민평등!')
    expectApproved('jeyuk-deopbap', '제육덮밥 메뉴 고민 강제 종료!')
    expectApproved('bulgogi-deopbap', '밥 위 무단점거 현행범!')
    expectApproved('chicken-mayo-deopbap', '치킨마요 소스줄은 생명줄!')
    expectApproved('sushi', '그릇은 쌓이고 통장은 비어간다!')
    expectApproved('kalguksu', '칼은 위협용!')
    expect(getMenuNarration('kalguksu')?.tone).toBe('deadpan')
    expectApproved('naengmyeon', '중요한 건 꺾이지 않는 면발!')
    expectApproved('jjajangmyeon', '짜장면 등장, 젓가락 급가속!')
    expectApproved('tteokbokki', '떡볶이 포획! 쿨피스 지원 요청!')
    expectApproved('jokbal', '발을 먹는데? 손이 더 바쁘다!')
    expect(getMenuNarration('jokbal')?.tone).toBe('playful')
    expectApproved('samgyeopsal', '누가 고기 굽는 소리를 내었는가!')
    expectApproved('grilled-galbi', '체면 내려놓고 뼈를 들어라!')
    expectApproved('pizza', '피자 먹고 팔자 피자!')
    expectApproved('dak-hanmari', '메뉴 이름이 설명서다!')
    expectApproved('samgyetang', '복날 체력바 전부 회복!')
    const allCatalogLines = MENU_NARRATIONS.flatMap(
      ({ text, alternatives }) => [text, ...alternatives],
    )
    expect(allCatalogLines).not.toContain('닭 한 마리에서 찹쌀 드롭!')
    expect(allCatalogLines).not.toContain('깍두기 없인, 진행 불가!')
    expect(allCatalogLines).not.toContain('복날 체력바, 전부 회복!')
  })
  it('excludes recognisable or third-party-risk phrases from every line', () => {
    const allLines = MENU_NARRATIONS.flatMap((narration) => [
      narration.text,
      ...narration.alternatives,
    ])

    for (const line of allLines) {
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(line).not.toContain(phrase)
      }
    }
  })

  it('looks up a narration by menu id without inventing missing entries', () => {
    expect(getMenuNarration('ramyeon')?.text).toBe(
      '현기증 오기 전에 끓여 와 줘!',
    )
    expect(getMenuNarration('not-a-menu')).toBeUndefined()
  })
})

function expectApproved(menuId: string, text: string): void {
  expect(getMenuNarration(menuId)?.text).toBe(text)
}

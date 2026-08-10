import { getMenuNarrationAudioUrl } from './menuNarrationAudioManifest'

export const NARRATION_TONES = [
  'playful',
  'alert',
  'deadpan',
  'epic',
] as const

export type NarrationTone = (typeof NARRATION_TONES)[number]

export interface MenuNarration {
  readonly menuId: string
  readonly text: string
  readonly tone: NarrationTone
  readonly alternatives: readonly string[]
  /** Pre-rendered narration asset. `null` until the voice batch is approved. */
  readonly audioUrl: string | null
}

/** Keeps the spoken line short enough for the pace of a falling-food round. */
export const MAX_NARRATION_TEXT_LENGTH = 24

/**
 * Safe, original narration copy for every MVP menu.
 *
 * The alternatives are retained for a later rare-line feature. Lines that
 * closely echoed recognisable third-party catchphrases were deliberately
 * removed or rewritten before being added here.
 */
export const MENU_NARRATIONS = [
  {
    menuId: 'kimchi-jjigae',
    text: '밥 한 공기론 합의 불가!',
    tone: 'deadpan',
    alternatives: ['김치가 찌개로 진급했다!', '밥상 협상, 찌개부터 시작!'],
    audioUrl: getMenuNarrationAudioUrl('kimchi-jjigae'),
  },
  {
    menuId: 'doenjang-jjigae',
    text: '된장 나오면 밥상 끝장!',
    tone: 'playful',
    alternatives: ['된장인데, 이건 된다!', '냄새가 먼저 먹고 들어간다!'],
    audioUrl: getMenuNarrationAudioUrl('doenjang-jjigae'),
  },
  {
    menuId: 'sundubu-jjigae',
    text: '순두부의 순은, 순삭의 순!',
    tone: 'playful',
    alternatives: ['두부만 순하고 국물은 안 순해!', '계란 투하, 매운맛 협상 완료!'],
    audioUrl: getMenuNarrationAudioUrl('sundubu-jjigae'),
  },
  {
    menuId: 'budae-jjigae',
    text: '라면사리, 증원 요청!',
    tone: 'alert',
    alternatives: ['햄 부대, 전원 집합!', '사리 추가는 작전이다!'],
    audioUrl: getMenuNarrationAudioUrl('budae-jjigae'),
  },
  {
    menuId: 'gamjatang',
    text: '감자는 조연, 뼈가 주연!',
    tone: 'epic',
    alternatives: ['뼈 발굴 작업 시작!', '볶음밥 전까지는 예선전!'],
    audioUrl: getMenuNarrationAudioUrl('gamjatang'),
  },
  {
    menuId: 'seolleongtang',
    text: '설렁탕 국밥계 탱커 등장!',
    tone: 'alert',
    alternatives: ['설렁탕인데 설렁 먹을 수가 없다!', '뜨끈한 국물, 천천히 완주!'],
    audioUrl: getMenuNarrationAudioUrl('seolleongtang'),
  },
  {
    menuId: 'gomtang',
    text: '곰은 없어도 곰처럼 든든!',
    tone: 'deadpan',
    alternatives: ['곰 검출 0%, 진국 100%!', '곰은 없고 진국만 있다!'],
    audioUrl: getMenuNarrationAudioUrl('gomtang'),
  },
  {
    menuId: 'galbitang',
    text: '갈비탕은 뼈대부터 다르다!',
    tone: 'epic',
    alternatives: ['오늘 국물, 뼈가 있네!', '고기는 먹고 뼈만 증거로!'],
    audioUrl: getMenuNarrationAudioUrl('galbitang'),
  },
  {
    menuId: 'yukgaejang',
    text: '입은 후퇴, 숟가락은 전진!',
    tone: 'alert',
    alternatives: ['혀는 말리는데 손은 안 말려!', '빨간 국물, 정신 번쩍!'],
    audioUrl: getMenuNarrationAudioUrl('yukgaejang'),
  },
  {
    menuId: 'samgyetang',
    text: '복날 체력바 전부 회복!',
    tone: 'epic',
    alternatives: ['인삼 버프 획득!', '찹쌀 장착, 원기 충전!'],
    audioUrl: getMenuNarrationAudioUrl('samgyetang'),
  },
  {
    menuId: 'kongnamul-gukbap',
    text: '한 숟갈에 인간 복귀!',
    tone: 'deadpan',
    alternatives: ['술은 내가, 수습은 콩나물이!', '콩나물아, 뒤를 부탁해!'],
    audioUrl: getMenuNarrationAudioUrl('kongnamul-gukbap'),
  },
  {
    menuId: 'dwaeji-gukbap',
    text: '돼지국밥 한술에 부산 도착!',
    tone: 'playful',
    alternatives: ['돼지는 잡고, 허기는 놓쳤다!', '밥 말면 대화는 끝난다!'],
    audioUrl: getMenuNarrationAudioUrl('dwaeji-gukbap'),
  },
  {
    menuId: 'sundae-guk',
    text: '순대국 든든 버프 풀충전!',
    tone: 'playful',
    alternatives: ['한 숟갈마다 부위가 랜덤!', '간이 들어가니 간이 맞네!'],
    audioUrl: getMenuNarrationAudioUrl('sundae-guk'),
  },
  {
    menuId: 'cheonggukjang',
    text: '청국장 향부터 어그로 만렙!',
    tone: 'epic',
    alternatives: ['코는 거부, 밥은 승인!', '포획 완료, 은폐 실패!'],
    audioUrl: getMenuNarrationAudioUrl('cheonggukjang'),
  },
  {
    menuId: 'home-style-baekban',
    text: '백반 한상 반찬 슬롯 만렙!',
    tone: 'playful',
    alternatives: ['밥 한 공기에 반찬이 단체전!', '반찬 뽑기, 꽝 없음!'],
    audioUrl: getMenuNarrationAudioUrl('home-style-baekban'),
  },
  {
    menuId: 'bibimbap',
    text: '고추장 아래 만민평등!',
    tone: 'epic',
    alternatives: ['각자 놀다 한 그릇에 대통합!', '섞는 순간 팀워크 완성!'],
    audioUrl: getMenuNarrationAudioUrl('bibimbap'),
  },
  {
    menuId: 'jeyuk-deopbap',
    text: '제육덮밥 메뉴 고민 강제 종료!',
    tone: 'epic',
    alternatives: ['밥이 제육에게 점령당했다!', '제육 포획! 오후 버프 획득!'],
    audioUrl: getMenuNarrationAudioUrl('jeyuk-deopbap'),
  },
  {
    menuId: 'bulgogi-deopbap',
    text: '밥 위 무단점거 현행범!',
    tone: 'alert',
    alternatives: ['불고기가 밥을 덮쳤다!', '밥은 깔리고 고기는 빛난다!'],
    audioUrl: getMenuNarrationAudioUrl('bulgogi-deopbap'),
  },
  {
    menuId: 'chicken-mayo-deopbap',
    text: '치킨마요 소스줄은 생명줄!',
    tone: 'deadpan',
    alternatives: ['치킨이 덮고 마요가 은폐!', '지그재그로 뿌리면 0칼로리!'],
    audioUrl: getMenuNarrationAudioUrl('chicken-mayo-deopbap'),
  },
  {
    menuId: 'curry-rice',
    text: '한 번 끓여 세 끼를 지배한다!',
    tone: 'alert',
    alternatives: ['카레 포획! 흰옷은 피신!', '오늘보다 내일 더 강해진다!'],
    audioUrl: getMenuNarrationAudioUrl('curry-rice'),
  },
  {
    menuId: 'omurice',
    text: '밥이 계란으로 신분 세탁!',
    tone: 'deadpan',
    alternatives: ['계란 이불 속 볶음밥 검거!', '볶음밥이 계란 뒤에 숨었다!'],
    audioUrl: getMenuNarrationAudioUrl('omurice'),
  },
  {
    menuId: 'fried-rice',
    text: '냉장고 올스타전!',
    tone: 'epic',
    alternatives: ['남은 재료들의 패자부활전!', '찬밥의 화려한 재취업!'],
    audioUrl: getMenuNarrationAudioUrl('fried-rice'),
  },
  {
    menuId: 'kimchi-fried-rice',
    text: '신김치의 화려한 재데뷔!',
    tone: 'epic',
    alternatives: ['김치가 밥을 제대로 볶아놨다!', '계란후라이까지 올려야 엔딩!'],
    audioUrl: getMenuNarrationAudioUrl('kimchi-fried-rice'),
  },
  {
    menuId: 'pork-cutlet',
    text: '돈가스 먹으러 가자? 일단 의심해!',
    tone: 'deadpan',
    alternatives: ['돈가스 포획! 돈은 미검출!', '소스 붓는 순간, 바삭함 퇴근!'],
    audioUrl: getMenuNarrationAudioUrl('pork-cutlet'),
  },
  {
    menuId: 'sushi',
    text: '그릇은 쌓이고 통장은 비어간다!',
    tone: 'playful',
    alternatives: ['와사비는 숨었는데 눈물은 들켰다!', '한입은 초밥, 계산은 한숨!'],
    audioUrl: getMenuNarrationAudioUrl('sushi'),
  },
  {
    menuId: 'bibim-guksu',
    text: '면은 꼬이고 입맛은 풀린다!',
    tone: 'playful',
    alternatives: ['입맛 없다는 사람 검거!', '빨갛게 비비고 순식간에 비운다!'],
    audioUrl: getMenuNarrationAudioUrl('bibim-guksu'),
  },
  {
    menuId: 'janchi-guksu',
    text: '혼자 먹어도 이름은 잔치!',
    tone: 'playful',
    alternatives: ['초대장 없이 잔치 입장!', '멸치 몇 마리가 잔치를 열었다!'],
    audioUrl: getMenuNarrationAudioUrl('janchi-guksu'),
  },
  {
    menuId: 'kalguksu',
    text: '칼은 위협용!',
    tone: 'deadpan',
    alternatives: ['칼국수 포획! 칼은 미검출!', '밀가루가 칼을 만나 면이 됐다!'],
    audioUrl: getMenuNarrationAudioUrl('kalguksu'),
  },
  {
    menuId: 'naengmyeon',
    text: '중요한 건 꺾이지 않는 면발!',
    tone: 'epic',
    alternatives: ['육수는 차갑고 식욕은 뜨겁다!', '냉면 포획! 이가 먼저 항복!'],
    audioUrl: getMenuNarrationAudioUrl('naengmyeon'),
  },
  {
    menuId: 'jjajangmyeon',
    text: '짜장면 등장, 젓가락 급가속!',
    tone: 'alert',
    alternatives: ['입가에 범행 흔적 발견!', '하얀 옷, 비상경계 발령!'],
    audioUrl: getMenuNarrationAudioUrl('jjajangmyeon'),
  },
  {
    menuId: 'jjamppong',
    text: '국물 한입, 정신 자동 재부팅!',
    tone: 'playful',
    alternatives: ['입은 맵고 코는 뚫린다!', '짬뽕은 섞였는데 맛은 정리됐다!'],
    audioUrl: getMenuNarrationAudioUrl('jjamppong'),
  },
  {
    menuId: 'ramyeon',
    text: '현기증 오기 전에 끓여 와 줘!',
    tone: 'alert',
    alternatives: ['꼬들할 때 잡아! 퍼지면 끝이야!', '물 조절 실패! 한강 개장!'],
    audioUrl: getMenuNarrationAudioUrl('ramyeon'),
  },
  {
    menuId: 'udon',
    text: '우동은 굵고 고민은 짧다!',
    tone: 'deadpan',
    alternatives: ['젓가락 근력 테스트 시작!', '한 가닥인데 입이 꽉 찬다!'],
    audioUrl: getMenuNarrationAudioUrl('udon'),
  },
  {
    menuId: 'pasta',
    text: '포크로 돌리면 갑자기 유럽!',
    tone: 'playful',
    alternatives: ['이탈리아는 몰라도 돌돌은 안다!', '소스 튀는 순간 우아함 종료!'],
    audioUrl: getMenuNarrationAudioUrl('pasta'),
  },
  {
    menuId: 'pho',
    text: '고수 넣는 자가 진짜 고수!',
    tone: 'deadpan',
    alternatives: ['쌀이 면으로 위장했다!', '고수 선택창이 열렸습니다!'],
    audioUrl: getMenuNarrationAudioUrl('pho'),
  },
  {
    menuId: 'tteokbokki',
    text: '떡볶이 포획! 쿨피스 지원 요청!',
    tone: 'alert',
    alternatives: ['혀는 울고 떡은 줄어든다!', '매운맛 경보, 물 한 잔 준비!'],
    audioUrl: getMenuNarrationAudioUrl('tteokbokki'),
  },
  {
    menuId: 'gimbap',
    text: '꼬다리 소유권 분쟁 발생!',
    tone: 'deadpan',
    alternatives: ['한 줄만은 김밥계의 거짓말!', '재료들이 김 안에 단체 입주!'],
    audioUrl: getMenuNarrationAudioUrl('gimbap'),
  },
  {
    menuId: 'sandwich',
    text: '빵은 잡았는데 속은 탈출!',
    tone: 'alert',
    alternatives: ['한입 베면 반대편이 도망간다!', '턱 관절, 확장 모드!'],
    audioUrl: getMenuNarrationAudioUrl('sandwich'),
  },
  {
    menuId: 'hamburger',
    text: '햄부기! 햄부기! 햄부기!',
    tone: 'epic',
    alternatives: ['버거 잡고 체면 놓쳤다!', '한입 크기, 턱은 비상!'],
    audioUrl: getMenuNarrationAudioUrl('hamburger'),
  },
  {
    menuId: 'korean-toast',
    text: '한입 먹자마자 등굣길!',
    tone: 'playful',
    alternatives: ['양배추가 이렇게 달 일인가!', '설탕 톡톡, 추억도 톡톡!'],
    audioUrl: getMenuNarrationAudioUrl('korean-toast'),
  },
  {
    menuId: 'samgyeopsal',
    text: '누가 고기 굽는 소리를 내었는가!',
    tone: 'alert',
    alternatives: ['기름은 튀고 대화는 끊긴다!', '삼겹살은 세 겹, 행복은 무한 겹!'],
    audioUrl: getMenuNarrationAudioUrl('samgyeopsal'),
  },
  {
    menuId: 'grilled-galbi',
    text: '체면 내려놓고 뼈를 들어라!',
    tone: 'playful',
    alternatives: ['뜯을수록 대화가 줄어드는 맛!', '뼈만 남기면 임무 완료!'],
    audioUrl: getMenuNarrationAudioUrl('grilled-galbi'),
  },
  {
    menuId: 'dakgalbi',
    text: '닭은 있는데 갈비는 어디 갔지?',
    tone: 'deadpan',
    alternatives: ['볶음밥 전까지는 튜토리얼!', '치즈 투하, 철판 평화 협정!'],
    audioUrl: getMenuNarrationAudioUrl('dakgalbi'),
  },
  {
    menuId: 'bossam',
    text: '배추가 고기를 보쌈했다!',
    tone: 'deadpan',
    alternatives: ['고기를 싸서 증거를 감췄다!', '한입 크기는 내가 정한다!'],
    audioUrl: getMenuNarrationAudioUrl('bossam'),
  },
  {
    menuId: 'jokbal',
    text: '발을 먹는데? 손이 더 바쁘다!',
    tone: 'playful',
    alternatives: ['야식이 제 발로 왔다!', '앞발이든 뒷발이든 입장은 찬성!'],
    audioUrl: getMenuNarrationAudioUrl('jokbal'),
  },
  {
    menuId: 'bulgogi',
    text: '엄마 물고기 말고 불고기!',
    tone: 'alert',
    alternatives: ['고기가 불을 만나 레벨 업!', '밥도둑, 불맛 입고 현행범!'],
    audioUrl: getMenuNarrationAudioUrl('bulgogi'),
  },
  {
    menuId: 'fried-chicken',
    text: '반반은 우유부단이 아니라 지혜다!',
    tone: 'epic',
    alternatives: ['닭은 못 날아도 주문은 날아온다!', '바삭한 소리에 집중력 상승!'],
    audioUrl: getMenuNarrationAudioUrl('fried-chicken'),
  },
  {
    menuId: 'pizza',
    text: '피자 먹고 팔자 피자!',
    tone: 'alert',
    alternatives: ['마지막 피자 한 조각, 우정 시험!', '치즈는 늘고 양심은 줄고!'],
    audioUrl: getMenuNarrationAudioUrl('pizza'),
  },
  {
    menuId: 'dak-hanmari',
    text: '메뉴 이름이 설명서다!',
    tone: 'deadpan',
    alternatives: ['닭 한 마리, 이름값 완료!', '닭은 한 마리, 코스는 끝이 없다!'],
    audioUrl: getMenuNarrationAudioUrl('dak-hanmari'),
  },
  {
    menuId: 'shabu-shabu',
    text: '채소도 먹었다고 주장 가능합니다!',
    tone: 'alert',
    alternatives: ['고기 목욕, 삼 초 컷!', '입수는 짧게, 행복은 길게!'],
    audioUrl: getMenuNarrationAudioUrl('shabu-shabu'),
  },
] as const satisfies readonly MenuNarration[]

export const MENU_NARRATIONS_BY_ID: ReadonlyMap<string, MenuNarration> =
  new Map(
    MENU_NARRATIONS.map((narration) => [narration.menuId, narration] as const),
  )

export function getMenuNarration(menuId: string): MenuNarration | undefined {
  return MENU_NARRATIONS_BY_ID.get(menuId)
}
